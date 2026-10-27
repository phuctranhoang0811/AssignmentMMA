import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Order } from '../types/order';
import { CreateOrderInput } from '../services/contracts';
import { useAuth } from './AuthContext';
import { orderService } from '../services';

interface OrderContextType {
  orders: Order[];
  isLoading: boolean;
  refreshOrders: () => Promise<void>;
  createOrder: (input: CreateOrderInput) => Promise<Order>;
  cancelOrder: (id: string) => Promise<Order>;
  advanceOrderStatus: (id: string) => Promise<Order>;
  getOrderById: (id: string) => Order | undefined;
  resetOrders: () => Promise<void>;
}

const OrderContext = createContext<OrderContextType>({} as OrderContextType);

export const OrderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const owner = user?.isDemo ? user.id : undefined;
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshOrders = useCallback(async () => {
    try {
      if (!owner) { setOrders([]); return; }
      const data = await orderService.list(owner);
      if (currentOwner.current === owner) setOrders(data);
    } finally {
      setIsLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    setOrders([]);
    void refreshOrders().catch(() => {});
  }, [refreshOrders]);

  const createOrder = async (input: CreateOrderInput): Promise<Order> => {
    const newOrder = await orderService.create(input);
    setOrders((prev) => [newOrder, ...prev]);
    return newOrder;
  };

  const cancelOrder = async (id: string): Promise<Order> => {
    const updated = await orderService.cancel(id);
    setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
    return updated;
  };

  const advanceOrderStatus = async (id: string): Promise<Order> => {
    const updated = await orderService.advanceDemoStatus(id);
    setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
    return updated;
  };

  const getOrderById = (id: string): Order | undefined => {
    return orders.find((o) => o.id === id);
  };

  const resetOrders = async () => {
    setIsLoading(true);
    await orderService.resetSeed?.();
    await refreshOrders();
  };

  return (
    <OrderContext.Provider
      value={{
        orders: currentOwner.current === owner && owner ? orders.filter(order => order.userId === owner) : [],
        isLoading,
        refreshOrders,
        createOrder,
        cancelOrder,
        advanceOrderStatus,
        getOrderById,
        resetOrders,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};

export const useOrders = () => useContext(OrderContext);
