import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const MAX_LINE_QUANTITY = 50;
export const CART_STORAGE_KEY = "similife-cart-v1";

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  /** Price shown in the cart. The server always re-prices the order from the database. */
  price: number;
  imageUrl: string | null;
  packSize: string | null;
  requiresPrescription: boolean;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  discountCode: string | null;
  hydrated: boolean;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  setDiscountCode: (code: string | null) => void;
  clear: () => void;
  setHydrated: () => void;
}

function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(Math.max(Math.floor(quantity), 1), MAX_LINE_QUANTITY);
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      discountCode: null,
      hydrated: false,

      addItem: (item, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((line) => line.productId === item.productId);
          if (existing) {
            return {
              items: state.items.map((line) =>
                line.productId === item.productId
                  ? { ...line, ...item, quantity: clampQuantity(line.quantity + quantity) }
                  : line
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity: clampQuantity(quantity) }] };
        }),

      setQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items.map((line) =>
            line.productId === productId ? { ...line, quantity: clampQuantity(quantity) } : line
          ),
        })),

      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((line) => line.productId !== productId) })),

      setDiscountCode: (code) => set({ discountCode: code }),

      clear: () => set({ items: [], discountCode: null }),

      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: CART_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items, discountCode: state.discountCode }),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);

export const selectItemCount = (state: CartState): number =>
  state.items.reduce((total, line) => total + line.quantity, 0);

export const selectSubtotal = (state: CartState): number =>
  state.items.reduce((total, line) => total + line.price * line.quantity, 0);

export const selectHasPrescriptionItems = (state: CartState): boolean =>
  state.items.some((line) => line.requiresPrescription);
