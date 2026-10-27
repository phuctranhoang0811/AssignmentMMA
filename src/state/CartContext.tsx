import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem } from '../types/order';
import { generateCartLineKey } from '../utils/cartLineKey';
import { mockProducts } from '../data/mockProducts';
import { getItemLineUnitPrice } from '../utils/calculateTotals';
import { replaceCartItem } from '../utils/cartOperations';

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  isLoaded: boolean;
  needCutlery: boolean;
  setNeedCutlery: (value: boolean) => void;
  promoCode: string;
  setPromoCode: (code: string) => void;
  fulfillmentType: 'delivery' | 'takeaway';
  setFulfillmentType: (mode: 'delivery' | 'takeaway') => void;
  updateItem: (lineId: string, item: Omit<CartItem, 'lineId'>) => void;
  addItem: (item: Omit<CartItem, 'lineId'>) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeItem: (lineId: string) => void;
  clearCart: () => void;
}

const CART_STORAGE_KEY = '@pizza_time_cart_v1';
const CHECKOUT_STORAGE_KEY = '@pizza_checkout_preferences_v1';

const productsMap = mockProducts.reduce((acc, p) => {
  acc[p.id] = p;
  return acc;
}, {} as Record<string, (typeof mockProducts)[0]>);

// Quick-add buttons send no size; the backend rejects a sized product without one, so use the first (default) size.
const withVariant = (productId: string, variantId?: string) => variantId ?? productsMap[productId]?.variants?.[0]?.id;

const CartContext = createContext<CartContextType>({} as CartContextType);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [needCutlery, setNeedCutlery] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'takeaway'>('delivery');

  useEffect(() => {
    (async () => {
      try {
        const preferences = await AsyncStorage.getItem(CHECKOUT_STORAGE_KEY);
        if (preferences) {
          try {
            const saved = JSON.parse(preferences);
            if (typeof saved?.promoCode === 'string') setPromoCode(saved.promoCode);
            if (typeof saved?.needCutlery === 'boolean') setNeedCutlery(saved.needCutlery);
            if (saved?.fulfillmentType === 'delivery' || saved?.fulfillmentType === 'takeaway') setFulfillmentType(saved.fulfillmentType);
          } catch { /* Invalid preferences must not prevent restoring the cart. */ }
        }
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
                  const variantId = withVariant(pid, item.variantId);
                  const lid =
                    item.lineId && !item.lineId.startsWith('undefined') && variantId === item.variantId
                      ? item.lineId
                      : generateCartLineKey(pid, variantId, addons, item.specialInstructions, item.customization);
                  return {
                    productId: pid,
                    variantId,
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

  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify({ promoCode, fulfillmentType, needCutlery })).catch(() => {});
    }
  }, [promoCode, fulfillmentType, needCutlery, isLoaded]);

  const addItem = (item: any) => {
    const productId = item.productId || item.id;
    if (!productId) return;
    const qty = Number(item.quantity) || 1;
    const addonIds = Array.isArray(item.addonIds) ? item.addonIds : [];
    const variantId = withVariant(productId, item.variantId);
    const lineId = generateCartLineKey(
      productId,
      variantId,
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
          variantId,
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
    setPromoCode('');
    setNeedCutlery(false);
  };

  const updateItem = (lineId: string, item: Omit<CartItem, 'lineId'>) => {
    setItems(prev => replaceCartItem(prev, lineId, item));
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
        isLoaded, needCutlery, setNeedCutlery,
        promoCode, setPromoCode, fulfillmentType, setFulfillmentType, updateItem,
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
