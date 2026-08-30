"use client";

import { useSyncExternalStore } from "react";

// اشتراك واحد على مستوى الوحدة: كانت جسور الجلسة والإشعارات والمزامنة — وكلها
// مركّبة على كل صفحة مصادَقة — تضيف مستمع visibilitychange مستقلاً لكل منها
// (client-event-listeners). المستمع يُفصل تلقائياً مع آخر مشترك.
const listeners = new Set<() => void>();
let attached = false;

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!attached) {
    attached = true;
    document.addEventListener("visibilitychange", emit);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && attached) {
      attached = false;
      document.removeEventListener("visibilitychange", emit);
    }
  };
}

function getSnapshot(): boolean {
  return document.visibilityState === "visible";
}

function getServerSnapshot(): boolean {
  return true;
}

/**
 * true حين تكون التبويبة ظاهرة. للعمل المرتبط بالانتقال (مخفي ← ظاهر) استخدم
 * القيمة داخل تأثير مفتاحه هذه القيمة مع ref للقيمة السابقة، لا كقراءة لحظية.
 */
export function useDocumentVisible(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
