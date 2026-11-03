import AsyncStorage from '@react-native-async-storage/async-storage';
import { Order, OrderStatus, OrderItemSnapshot } from '../../types/order';
import { CreateOrderInput, OrderService } from '../contracts';
import { initialMockOrders } from '../../data/mockOrders';
import { mockProducts } from '../../data/mockProducts';
import { mockCoupons } from '../../data/mockPromotions';
import { demoConfig } from '../../data/mockConfig';
import { calculateOrderTotals, getItemLineUnitPrice } from '../../utils/calculateTotals';

const ORDERS_STORAGE_KEY = '@pizza_time_orders_v1';
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const productsMap = mockProducts.reduce((acc, p) => {
  acc[p.id] = p;
  return acc;
}, {} as Record<string, (typeof mockProducts)[0]>);

class MockOrderService implements OrderService {
  private async loadOrders(): Promise<Order[]> {
    try {
      const data = await AsyncStorage.getItem(ORDERS_STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // Fallback
    }
    await AsyncStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(initialMockOrders));
    return [...initialMockOrders];
  }

  private async saveOrders(orders: Order[]): Promise<void> {
    await AsyncStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  }

  async list(userId?: string): Promise<Order[]> {
    await delay(demoConfig.simulatedLatencyMs);
    const orders = await this.loadOrders();
    if (userId) {
      return orders.filter((o) => o.userId === userId);
    }
    return orders;
  }

  async getById(id: string): Promise<Order | null> {
    await delay(demoConfig.simulatedLatencyMs);
    const orders = await this.loadOrders();
    const order = orders.find((o) => o.id === id);
    return order || null;
  }

  async create(input: CreateOrderInput): Promise<Order> {
    if (input.paymentMethod === 'PAYOS') {
      throw new Error('Vui lòng thanh toán payOS qua màn hình QR.');
    }
    await delay(demoConfig.simulatedLatencyMs);

    if (demoConfig.simulatedFailureRate > 0 && Math.random() < demoConfig.simulatedFailureRate) {
      throw new Error('Lỗi giả lập từ hệ thống demo. Vui lòng thử lại!');
    }

    const coupon = input.promoCode ? mockCoupons.find((c) => c.code.toUpperCase() === input.promoCode!.toUpperCase()) : null;
    const totals = calculateOrderTotals(input.items, productsMap, input.fulfillmentType, coupon, demoConfig.mockTaxRate);

    const snapshots: OrderItemSnapshot[] = input.items.map((item) => {
      const product = productsMap[item.productId];
      const variant = product?.variants?.find((v) => v.id === item.variantId);
      const addons = (item.addonIds || [])
        .map((aId) => product?.addons?.find((a) => a.id === aId)?.name)
        .filter(Boolean) as string[];

      const unitPrice = getItemLineUnitPrice(item, product);
      return {
        productId: item.productId,
        productName: product ? product.name : 'Món ăn',
        variantName: variant?.name,
        addonNames: addons,
        note: item.specialInstructions,
        quantity: item.quantity,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
        image: product?.image,
      };
    });

    const now = new Date().toISOString();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newOrder: Order = {
      id: `PT-2026-${randomSuffix}`,
      createdAt: now,
      userId: input.userId,
      customer: input.customer,
      fulfillmentType: input.fulfillmentType,
      needCutlery: input.needCutlery ?? false,
      address: input.address,
      items: snapshots,
      status: 'PENDING_CONFIRMATION',
      paymentMethod: input.paymentMethod,
      paymentStatus: 'UNPAID',
      subtotal: totals.subtotal,
      discount: totals.discount,
      deliveryFee: totals.deliveryFee,
      tax: totals.tax,
      total: totals.total,
      statusHistory: [
        {
          status: 'PENDING_CONFIRMATION',
          at: now,
          note: 'Đơn hàng mới tạo thành công',
        },
      ],
    };

    const currentOrders = await this.loadOrders();
    const updated = [newOrder, ...currentOrders];
    await this.saveOrders(updated);

    return newOrder;
  }

  async cancel(id: string): Promise<Order> {
    await delay(demoConfig.simulatedLatencyMs);
    const orders = await this.loadOrders();
    const index = orders.findIndex((o) => o.id === id);
    if (index === -1) {
      throw new Error('Không tìm thấy đơn hàng');
    }

    const order = orders[index];
    if (order.status !== 'PENDING_CONFIRMATION' && order.status !== 'CONFIRMED') {
      throw new Error('Chỉ có thể hủy đơn khi đang chờ hoặc vừa xác nhận');
    }

    const updatedOrder: Order = {
      ...order,
      status: 'CANCELLED',
      paymentStatus: order.paymentStatus === 'PAID_DEMO' ? 'REFUNDED_DEMO' : order.paymentStatus,
      statusHistory: [
        ...order.statusHistory,
        {
          status: 'CANCELLED',
          at: new Date().toISOString(),
          note: 'Đơn hàng đã được hủy',
        },
      ],
    };

    orders[index] = updatedOrder;
    await this.saveOrders(orders);
    return updatedOrder;
  }

  async advanceDemoStatus(id: string): Promise<Order> {
    await delay(200);
    const orders = await this.loadOrders();
    const index = orders.findIndex((o) => o.id === id);
    if (index === -1) {
      throw new Error('Không tìm thấy đơn hàng');
    }

    const order = orders[index];
    let nextStatus: OrderStatus = order.status;
    let note = '';

    if (order.status === 'PENDING_CONFIRMATION') {
      nextStatus = 'CONFIRMED';
      note = 'Nhà hàng đã xác nhận đơn hàng';
    } else if (order.status === 'CONFIRMED') {
      nextStatus = 'PREPARING';
      note = 'Đầu bếp đang thực hiện món ăn';
    } else if (order.status === 'PREPARING') {
      nextStatus = 'READY';
      note = order.fulfillmentType === 'PICKUP' ? 'Món đã sẵn sàng tại quầy nhận' : 'Món ăn đã đóng gói xong';
    } else if (order.status === 'READY') {
      if (order.fulfillmentType === 'PICKUP') {
        nextStatus = 'COMPLETED';
        note = 'Khách hàng đã nhận món tại cửa hàng';
      } else {
        nextStatus = 'OUT_FOR_DELIVERY';
        note = 'Tài xế đang giao món đến bạn';
      }
    } else if (order.status === 'OUT_FOR_DELIVERY') {
      nextStatus = 'COMPLETED';
      note = 'Đơn hàng giao thành công';
    }

    const updatedOrder: Order = {
      ...order,
      status: nextStatus,
      paymentStatus: nextStatus === 'COMPLETED' && order.paymentMethod === 'COD' ? 'PAID_DEMO' : order.paymentStatus,
      statusHistory: [
        ...order.statusHistory,
        {
          status: nextStatus,
          at: new Date().toISOString(),
          note,
        },
      ],
    };

    orders[index] = updatedOrder;
    await this.saveOrders(orders);
    return updatedOrder;
  }

  async resetSeed(): Promise<void> {
    await this.saveOrders(initialMockOrders);
  }
}

export const mockOrderService = new MockOrderService();
