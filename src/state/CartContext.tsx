import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem } from '../types/order';
import { generateCartLineKey } from '../utils/cartLineKey';
import { mockProducts } from '../data/mockProducts';
import { getItemLineUnitPrice } from '../utils/calculateTotals';
import { productService } from '../services';
import { Product } from '../types/product';

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

const defaultProductsMap = mockProducts.reduce((acc, p) => {
  acc[p.id] = p;
  return acc;
}, {} as Record<string, Product>);

const CartContext = createContext<CartContextType>({} as CartContextType);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [productsMap, setProductsMap] = useState<Record<string, Product>>(defaultProductsMap);

  // Sync productsMap from Firebase Firestore via productService
  useEffect(() => {
    productService
      .list()
      .then((list) => {
        if (list && list.length > 0) {
          const map = list.reduce((acc, p) => {
            acc[p.id] = p;
            return acc;
          }, {} as Record<string, Product>);
          setProductsMap(map);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setItems(
              parsed
                .filter((item: any) => item && (item.productId || item.id))
                .map((item: any) => {
                  const pid = item.productId || item.id;
                  const addons = Array.isArray(item.addonIds) ? item.addonIds : [];
                  const lid =
                    item.lineId && !item.lineId.startsWith('undefined')
                      ? item.lineId
                      : generateCartLineKey(pid, item.variantId, addons, item.specialInstructions, item.customization);
                  return {
                    productId: pid,
                    variantId: item.variantId,
                    addonIds: addons,
                    specialInstructions: item.specialInstructions,
                    quantity: Number(item.quantity) || 1,
                    customization: item.customization,
                    lineId: lid,
                  };
                })
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

  const addItem = (item: any) => {
    const productId = item.productId || item.id;
    if (!productId) return;
    const qty = Number(item.quantity) || 1;
    const addonIds = Array.isArray(item.addonIds) ? item.addonIds : [];
    const lineId = generateCartLineKey(
      productId,
      item.variantId,
      addonIds,
      item.specialInstructions,
      item.customization
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
      return [
        ...prev,
        {
          productId,
          variantId: item.variantId,
          addonIds,
          specialInstructions: item.specialInstructions,
          quantity: qty,
          customization: item.customization,
          lineId,
        },
      ];
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
  }, [items, productsMap]);

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
