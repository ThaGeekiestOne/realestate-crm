"use client";

import { useEffect, useState } from "react";

const estateFlowStoragePrefix = "estateflow.";

export function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(key);
    const hydrate = () => {
      if (stored) {
        try {
          setValue(JSON.parse(stored) as T);
        } catch {
          window.localStorage.removeItem(key);
        }
      }

      setHydrated(true);
    };

    const timeout = window.setTimeout(hydrate, 0);
    return () => window.clearTimeout(timeout);
  }, [key]);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  }, [hydrated, key, value]);

  return [value, setValue] as const;
}

export function resetEstateFlowDemoState() {
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);

    if (key?.startsWith(estateFlowStoragePrefix)) {
      window.localStorage.removeItem(key);
    }
  }
}
