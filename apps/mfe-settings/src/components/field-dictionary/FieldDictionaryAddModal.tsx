"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Input,
  Label,
  ModalCard,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Select,
  cn,
  useToast,
} from "@platform/design-system";
import {
  FIELD_TYPE_GROUPS,
  FIELD_TYPE_LABELS,
  SOURCE_REQUIRED_TYPES,
  fieldDictionaryRoleIds,
  nextFieldRef,
  type FieldDictionaryAssignment,
  type FieldDictionaryField,
  type FieldDictionaryFieldType,
} from "@platform/app-shared/prototype/field-dictionary";
import {
  FieldDictionaryAssignmentsEditor,
  normalizeFieldAssignments,
} from "./FieldDictionaryAssignmentsEditor";

type DraftAssignment = FieldDictionaryAssignment;

type Props = {
  tags: string[];
  onAddTag: (tag: string) => void;
  onSave: (field: FieldDictionaryField) => void;
  onClose: () => void;
  listFields: FieldDictionaryField[];
};

function emptyDraft(): {
  name: string;
  ref: string;
  type: FieldDictionaryFieldType;
  source: string;
  parent: string;
  tagSet: Set<string>;
  assignments: DraftAssignment[];
} {
  return {
    name: "",
    ref: "",
    type: "text",
    source: "",
    parent: "",
    tagSet: new Set<string>(),
    assignments: [
      {
        role: fieldDictionaryRoleIds()[0] ?? "case-specialist",
        screens: [],
        mode: "input",
        required: false,
        final: false,
      },
    ],
  };
}

export function FieldDictionaryAddModal({
  tags,
  onAddTag,
  onSave,
  onClose,
  listFields,
}: Props) {
  const { showToast } = useToast();
  const [draft, setDraft] = useState(() => ({
    ...emptyDraft(),
    ref: nextFieldRef(listFields),
  }));
  const [newTag, setNewTag] = useState("");

  const showSource = SOURCE_REQUIRED_TYPES.includes(draft.type);
  const showParent = draft.type === "linked";
  const parentOptions = listFields.filter((field) => field.type === "list");

  function handleSave(): void {
    const name = draft.name.trim();
    if (!name) {
      showToast("اكتب اسم الحقل", "error");
      return;
    }
    const assignments = normalizeFieldAssignments(draft.assignments);
    if (assignments.length === 0) {
      showToast("أضف دوراً واحداً على الأقل مع شاشة.", "error");
      return;
    }
    onSave({
      id: `f-${Date.now()}`,
      ref: draft.ref.replace(/^#/, ""),
      key: `custom.${Date.now()}`,
      name,
      type: draft.type,
      tags: [...draft.tagSet],
      source: draft.source.trim() || undefined,
      parent: draft.type === "linked" ? draft.parent || undefined : undefined,
      persisted: false,
      assignments,
    });
  }

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard wide className="p-0" onClick={(event) => event.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>إضافة حقل جديد</ModalTitle>
        </ModalHeader>
        <div className="space-y-3 px-4 py-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="fd-name">اسم الحقل</Label>
              <Input
                id="fd-name"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="مثال: أتعاب المكتب الهندسي"
              />
            </div>
            <div>
              <Label htmlFor="fd-ref">الرقم المرجعي</Label>
              <Input id="fd-ref" value={draft.ref} readOnly />
              <p className="mt-1 text-[10px] text-text-3">
                يُولَّد تلقائياً ويبقى ثابتاً
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="fd-type">النوع</Label>
            <Select
              id="fd-type"
              value={draft.type}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  type: event.target.value as FieldDictionaryFieldType,
                }))
              }
            >
              {FIELD_TYPE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.types.map((type) => (
                    <option key={type} value={type}>
                      {FIELD_TYPE_LABELS[type]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>

          {showSource ? (
            <div>
              <Label htmlFor="fd-source">مصدر القيم</Label>
              <Input
                id="fd-source"
                value={draft.source}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, source: event.target.value }))
                }
                placeholder="جدول مرجعي / وحدة / قائمة ثابتة"
              />
            </div>
          ) : null}

          {showParent ? (
            <div>
              <Label htmlFor="fd-parent">الحقل الأب</Label>
              <Select
                id="fd-parent"
                value={draft.parent}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, parent: event.target.value }))
                }
              >
                <option value="">— اختر —</option>
                {parentOptions.map((field) => (
                  <option key={field.id} value={field.name}>
                    {field.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <div>
            <Label>الوسوم</Label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs",
                    draft.tagSet.has(tag)
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-surface text-text-2",
                  )}
                  onClick={() =>
                    setDraft((current) => {
                      const tagSet = new Set(current.tagSet);
                      if (tagSet.has(tag)) tagSet.delete(tag);
                      else tagSet.add(tag);
                      return { ...current, tagSet };
                    })
                  }
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                value={newTag}
                onChange={(event) => setNewTag(event.target.value)}
                placeholder="وسم جديد…"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const value = newTag.trim();
                  if (!value) return;
                  onAddTag(value);
                  setDraft((current) => ({
                    ...current,
                    tagSet: new Set([...current.tagSet, value]),
                  }));
                  setNewTag("");
                }}
              >
                ＋ وسم
              </Button>
            </div>
          </div>

          <div>
            <Label>الإسناد — لكل دور شاشاته</Label>
            <FieldDictionaryAssignmentsEditor
              assignments={draft.assignments}
              onChange={(assignments) =>
                setDraft((current) => ({ ...current, assignments }))
              }
            />
          </div>
        </div>
        <ModalFooter>
          <Button type="button" onClick={handleSave}>
            حفظ الحقل
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            إلغاء
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
