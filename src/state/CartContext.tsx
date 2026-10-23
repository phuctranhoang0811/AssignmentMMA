import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem } from '../types/order';
import { generateCartLineKey } from '../utils/cartLineKey';
import { mockProducts } from '../data/mockProducts';
import { getItemLineUnitPrice } from '../utils/calculateTotals';

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, 'lineId'>) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeItem: (lineId: string) => void;
  clearCart: () => void;
}

const CART_STORAGE_KEY = '@pizza_time_cart_v1';

const productsMap = mockProducts.reduce((acc, p) => {
  acc[p.id] = p;
  return acc;
}, {} as Record<string, (typeof mockProducts)[0]>);

const CartContext = createContext<CartContextType>({} as CartContextType);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setItems(
              parsed.map((item) => ({
                ...item,
                quantity: Number(item.quantity) || 1,
              }))
            );
          }
        }
      } catch {
        // Fallback
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items)).catch(() => {});
    }
  }, [items, isLoaded]);

  const addItem = (item: Omit<CartItem, 'lineId'>) => {
    const qty = Number(item.quantity) || 1;
    const lineId = generateCartLineKey(
      item.productId,
      item.variantId,
      item.addonIds,
      item.specialInstructions
    );

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.lineId === lineId);
      if (existingIndex > -1) {
        const updated = [...prev];
        const currentQty = Number(updated[existingIndex].quantity) || 1;
        const newQty = Math.min(20, currentQty + qty);
        updated[existingIndex] = { ...updated[existingIndex], quantity: newQty };
        return updated;
      }
      return [...prev, { ...item, quantity: qty, lineId }];
    });
  };

  const updateQuantity = (lineId: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) {
        return prev.filter((i) => i.lineId !== lineId);
      }
      return prev.map((i) =>
        i.lineId === lineId ? { ...i, quantity: Math.min(20, Math.max(1, quantity)) } : i
      );
    });
  };

  const removeItem = (lineId: string) => {
    setItems((prev) => prev.filter((i) => i.lineId !== lineId));
  };

  const clearCart = () => {
    setItems([]);
  };

  const itemCount = useMemo(() => {
    return items.reduce((acc, i) => acc + (Number(i.quantity) || 1), 0);
  }, [items]);

  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => {
      const product = productsMap[item.productId];
      const unitPrice = getItemLineUnitPrice(item, product) || 0;
      const qty = Number(item.quantity) || 1;
      return acc + unitPrice * qty;
    }, 0);
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
