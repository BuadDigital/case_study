"use client";

/**
 * Load / edit / save of one property's «جدول الحصر», shared by the case specialist's
 * «مكونات العقار» section (manual save, plus the report text) and the inspector's card
 * (debounced autosave, offline queue).
 *
 * Saves are single-flight and coalescing: edits made while a save is in the air do not start
 * a second request, they mark the table dirty and the same loop sends the newest version when
 * the first returns — with the server ids of the reply already adopted by the rows on screen,
 * so a quick edit after a save never re-sends stale ids (a full replace would otherwise
 * duplicate or delete lines). `flush()` settles everything before the inspection is submitted.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getBuildingInventory,
  saveBuildingInventory,
  type ApiErr,
  type BuildingInventoryDto,
  type BuildingInventoryLineDto,
} from "@platform/api-client";
import {
  loadBuildingInventoryWithOffline,
  saveBuildingInventoryWithOffline,
} from "@platform/app-shared/offline/building-inventory-offline";
import { workOrdersApiConfig } from "../../lib/work-orders-api-config";
import {
  INSPECTOR_INVENTORY_LOAD_FAILED,
  INVENTORY_AUTOSAVE_MS,
  SPECIALIST_INVENTORY_LOAD_FAILED,
  adoptSavedLineIds,
  componentLinesForSave,
  inventorySaveMessage,
  sameRows,
  type BuildingInventoryActor,
} from "../../lib/app-data/building-inventory-editor-state";
import {
  componentLinesIssue,
  emptyComponentLine,
} from "../../lib/app-data/specialist-components";

export type BuildingInventorySaveOutcome = {
  ok: boolean;
  message?: string;
  /** Kept on the device, to be sent when the connection returns. */
  queued?: boolean;
};

export type BuildingInventoryEditor = {
  loading: boolean;
  /** The table could not be opened — editing stays off so an empty copy is never saved over it. */
  loadError: string | null;
  text: string;
  setText: (value: string) => void;
  lines: BuildingInventoryLineDto[];
  saving: boolean;
  dirty: boolean;
  /** The last save is waiting in the offline queue. */
  queued: boolean;
  error: string | null;
  addLine: () => void;
  patchLine: (index: number, next: BuildingInventoryLineDto) => void;
  removeLine: (index: number) => void;
  /** Save now (the specialist's button). */
  save: () => Promise<BuildingInventorySaveOutcome>;
  /** Send whatever is pending and wait until nothing is in flight (never throws). */
  flush: () => Promise<BuildingInventorySaveOutcome>;
  reload: () => Promise<void>;
};

export function useBuildingInventoryEditor(input: {
  actor: BuildingInventoryActor;
  poNumber: string;
  propertyId: string;
  /** The inspection task — a queued save is replayed before that task's submit. */
  taskId?: string;
  disabled?: boolean;
  /** Save a pause after the last edit (the inspector's card); default only for the inspector. */
  autosave?: boolean;
  onSaved?: (outcome: BuildingInventorySaveOutcome) => void;
}): BuildingInventoryEditor {
  const { actor, poNumber, propertyId, taskId, disabled = false, onSaved } = input;
  const autosave = input.autosave ?? actor === "inspector";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setTextState] = useState("");
  const [lines, setLinesState] = useState<BuildingInventoryLineDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The refs are the source of truth between renders: the save loop reads the newest edit.
  const linesRef = useRef<BuildingInventoryLineDto[]>([]);
  const textRef = useRef("");
  const dirtyRef = useRef(false);
  const loopRef = useRef<Promise<BuildingInventorySaveOutcome> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const lockedRef = useRef(true);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const keysRef = useRef(new WeakMap<object, string>());
  const keySeqRef = useRef(0);

  const keyOf = useCallback((line: BuildingInventoryLineDto): string => {
    let key = keysRef.current.get(line);
    if (!key) {
      keySeqRef.current += 1;
      key = `row-${keySeqRef.current}`;
      keysRef.current.set(line, key);
    }
    return key;
  }, []);

  const setLines = useCallback((next: BuildingInventoryLineDto[]) => {
    linesRef.current = next;
    if (mountedRef.current) setLinesState(next);
  }, []);

  const reload = useCallback(async () => {
    if (!propertyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const config = workOrdersApiConfig();
    const res =
      actor === "inspector"
        ? await loadBuildingInventoryWithOffline(config, poNumber, propertyId)
        : config
          ? await getBuildingInventory(config, poNumber, propertyId)
          : ({ ok: false, kind: "auth" } as ApiErr);
    if (!mountedRef.current) return;
    setLoading(false);
    if (!res.ok) {
      setLoadError(
        actor === "inspector" ? INSPECTOR_INVENTORY_LOAD_FAILED : SPECIALIST_INVENTORY_LOAD_FAILED,
      );
      return;
    }
    setLoadError(null);
    setError(null);
    textRef.current = res.data.componentsText ?? "";
    setTextState(textRef.current);
    setLines(res.data.lines);
    dirtyRef.current = false;
    setDirty(false);
  }, [actor, poNumber, propertyId, setLines]);

  useEffect(() => {
    mountedRef.current = true;
    void reload();
    return () => {
      mountedRef.current = false;
    };
  }, [reload]);

  lockedRef.current = disabled || loading || Boolean(loadError);

  /** One request: the newest rows and text; adopts the reply's ids; false stops the loop. */
  const saveOnce = useCallback(async (): Promise<BuildingInventorySaveOutcome> => {
    const sentRows = linesRef.current;
    const sentText = textRef.current;
    const { kept, body } = componentLinesForSave(sentRows);
    const issue = componentLinesIssue(kept);
    if (issue) {
      // A half-typed row is not an error to shout about while typing: it stays unsent.
      if (mountedRef.current) setError(issue);
      return { ok: false, message: issue };
    }
    dirtyRef.current = false;
    if (mountedRef.current) {
      setSaving(true);
      setError(null);
    }
    const config = workOrdersApiConfig();
    // The report text is the specialist's: the inspector's save never carries it (omitted =
    // "keep the saved text"), even if an older server would otherwise take it.
    const request =
      actor === "inspector" ? { lines: body } : { componentsText: sentText, lines: body };
    const res =
      actor === "inspector"
        ? await saveBuildingInventoryWithOffline(config, poNumber, propertyId, request, taskId)
        : config
          ? await saveBuildingInventory(config, poNumber, propertyId, request)
          : ({ ok: false, kind: "auth" } as ApiErr);
    if (mountedRef.current) setSaving(false);
    if (!res.ok) {
      dirtyRef.current = true;
      const message = inventorySaveMessage(res, actor);
      if (mountedRef.current) setError(message);
      return { ok: false, message };
    }
    const wasQueued = "queued" in res && res.queued === true;
    if (mountedRef.current) setQueued(wasQueued);
    const untouched = sameRows(linesRef.current, sentRows);
    if (untouched && kept.length === sentRows.length && !wasQueued) {
      // Nothing changed meanwhile: show exactly what the server holds (ids, provenance).
      setLines(res.data.lines);
      textRef.current = res.data.componentsText ?? textRef.current;
      if (mountedRef.current) setTextState(textRef.current);
    } else if (!wasQueued) {
      setLines(adoptSavedLineIds(linesRef.current, kept, res.data.lines, keyOf));
    }
    if (mountedRef.current) setDirty(dirtyRef.current);
    const outcome = { ok: true, queued: wasQueued };
    onSavedRef.current?.(outcome);
    return outcome;
  }, [actor, keyOf, poNumber, propertyId, setLines, taskId]);

  /** Single-flight: callers during a save join its loop, which repeats while edits keep coming. */
  const requestSave = useCallback((): Promise<BuildingInventorySaveOutcome> => {
    if (!loopRef.current) {
      loopRef.current = (async () => {
        let outcome: BuildingInventorySaveOutcome = { ok: true };
        try {
          while (dirtyRef.current && !lockedRef.current) {
            outcome = await saveOnce();
            if (!outcome.ok) break;
          }
        } finally {
          loopRef.current = null;
        }
        return outcome;
      })();
    }
    return loopRef.current;
  }, [saveOnce]);

  const markEdited = useCallback(() => {
    dirtyRef.current = true;
    if (mountedRef.current) {
      setDirty(true);
      setError(null);
    }
    if (!autosave) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void requestSave();
    }, INVENTORY_AUTOSAVE_MS);
  }, [autosave, requestSave]);

  const setText = useCallback(
    (value: string) => {
      textRef.current = value;
      setTextState(value);
      markEdited();
    },
    [markEdited],
  );

  const addLine = useCallback(() => {
    setLines([...linesRef.current, emptyComponentLine(linesRef.current.length)]);
    // A blank row is not sent, so adding it does not make the table dirty.
  }, [setLines]);

  const patchLine = useCallback(
    (index: number, next: BuildingInventoryLineDto) => {
      const prev = linesRef.current[index];
      if (!prev) return;
      keysRef.current.set(next, keyOf(prev));
      setLines(linesRef.current.map((line, i) => (i === index ? next : line)));
      markEdited();
    },
    [keyOf, markEdited, setLines],
  );

  const removeLine = useCallback(
    (index: number) => {
      setLines(linesRef.current.filter((_, i) => i !== index));
      markEdited();
    },
    [markEdited, setLines],
  );

  const flush = useCallback(async (): Promise<BuildingInventorySaveOutcome> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (dirtyRef.current && !lockedRef.current) return requestSave();
    return loopRef.current ?? { ok: true };
  }, [requestSave]);

  const save = useCallback(async (): Promise<BuildingInventorySaveOutcome> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    dirtyRef.current = true;
    return requestSave();
  }, [requestSave]);

  // Leaving the screen with typing still pending: send it rather than lose it.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (autosave && dirtyRef.current && !lockedRef.current) void requestSave();
    },
    [autosave, requestSave],
  );

  return {
    loading,
    loadError,
    text,
    setText,
    lines,
    saving,
    dirty,
    queued,
    error,
    addLine,
    patchLine,
    removeLine,
    save,
    flush,
    reload,
  };
}
