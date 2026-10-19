"use client";

import { useEffect } from "react";
import { CART_STORAGE_KEY, useCartStore } from "@/lib/stores/cart-store";

/** Loads the saved cart from the browser after the page appears, and keeps tabs in sync. */
export function CartHydrator() {
  useEffect(() => {
    void useCartStore.persist.rehydrate();

    function handleStorage(event: StorageEvent) {
      if (event.key === CART_STORAGE_KEY) {
        void useCartStore.persist.rehydrate();
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return null;
}
