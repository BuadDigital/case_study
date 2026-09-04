"use client";

import { useEffect, useState } from "react";

/**
 * Trails `value` by `delayMs`. Used for search boxes that drive a **server**
 * query: the input stays immediate, the request fires once the typing settles.
 * (`useDeferredValue` is the right tool when the filtering is local; it does
 * not throttle network calls.)
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
