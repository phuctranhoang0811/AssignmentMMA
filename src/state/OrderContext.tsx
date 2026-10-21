import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Order } from '../types/order';
import { CreateOrderInput } from '../services/contracts';
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshOrders = useCallback(async () => {
    try {
      const data = await orderService.list();
      setOrders(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshOrders();
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
        orders,
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
