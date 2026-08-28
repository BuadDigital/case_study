"use client";

import { useSyncExternalStore } from "react";

// حد Tailwind lg — نفس نقطة تبديل بطاقات الجوال/جداول الديسكتوب في الطوابير.
const QUERY = "(min-width: 1024px)";

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot(): boolean | null {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean | null {
  return null;
}

/**
 * true = ديسكتوب، false = جوال، null = غير معروف (SSR/الترطيب — اعرض الشجرتين
 * بفئات CSS كما قبل). كانت شجرتا الجوال والديسكتوب تركبان معاً دائماً:
 * display:none يوفّر الرسم لا التصيير، فكل الصفوف تُبنى مرتين (rendering).
 */
export function useViewportDesktop(): boolean | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
