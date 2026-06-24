"use client";

import { useCallback, useMemo, useState } from "react";

export function useBulkSelection<T>(items: readonly T[], getId: (item: T) => string) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const ids = useMemo(() => items.map(getId), [items, getId]);

  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (ids.every((id) => prev.has(id))) return new Set();
      return new Set(ids);
    });
  }, [ids]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const selectedItems = useMemo(
    () => items.filter((item) => selected.has(getId(item))),
    [items, selected, getId],
  );

  return {
    selected,
    selectedItems,
    allSelected,
    count: selected.size,
    isSelected: (id: string) => selected.has(id),
    toggle,
    toggleAll,
    clear,
  };
}
