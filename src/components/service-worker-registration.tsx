"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      void Promise.all([
        navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister()))),
        caches
          .keys()
          .then((keys) => Promise.all(keys.filter((key) => key.startsWith("estateflow-")).map((key) => caches.delete(key)))),
      ]);

      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installation remains available even if offline support cannot register.
    });
  }, []);

  return null;
}
