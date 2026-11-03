import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Order, OrderStatus, OrderItemSnapshot } from '../../types/order';
import { CreateOrderInput, OrderService } from '../contracts';
import { firebaseProductService } from './productService';
import { firebasePromoService } from './promoService';
import { calculateOrderTotals, getItemLineUnitPrice } from '../../utils/calculateTotals';
import { demoConfig } from '../../data/mockConfig';
import { initialMockOrders } from '../../data/mockOrders';

function mapDocToOrder(id: string, data: any): Order {
  let createdAt = new Date().toISOString();
  if (data.createdAt?.toDate) {
    createdAt = data.createdAt.toDate().toISOString();
  } else if (typeof data.createdAt === 'string') {
    createdAt = data.createdAt;
  }

  return {
    id,
    createdAt,
    userId: data.userId,
    customer: {
      fullname: data.customerName || data.customer?.fullname || 'Khách hàng',
      phone: data.customerPhone || data.customer?.phone || '',
      email: data.customer?.email,
    },
    fulfillmentType: data.fulfillmentType || 'DELIVERY',
    address: data.deliveryAddress || data.address,
    items: data.items || [],
    status: data.status || 'PENDING_CONFIRMATION',
    paymentMethod: data.paymentMethod || 'COD',
    paymentStatus: data.paymentStatus || 'UNPAID',
    subtotal: Number(data.subtotal || 0),
    discount: Number(data.discount || 0),
    deliveryFee: Number(data.deliveryFee || 0),
    tax: Number(data.tax || 0),
    total: Number(data.totalAmount || data.total || 0),
    statusHistory: data.statusHistory || [],
  } as Order;
}

class FirebaseOrderService implements OrderService {
  async list(userId?: string): Promise<Order[]> {
    try {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      if (!snap.empty) {
        let orders: Order[] = [];
        snap.forEach((d) => {
          orders.push(mapDocToOrder(d.id, d.data()));
        });
        if (userId) {
          orders = orders.filter((o) => !o.userId || o.userId === userId);
        }
        return orders;
      }
    } catch (err: any) {
      console.warn('FirebaseOrderService.list error:', err?.message);
    }
    // Fallback
    if (userId) {
      return initialMockOrders.filter((o) => !o.userId || o.userId === userId);
    }
    return initialMockOrders;
  }

  async getById(id: string): Promise<Order | null> {
    try {
      const snap = await getDoc(doc(db, 'orders', id));
      if (snap.exists()) {
        return mapDocToOrder(snap.id, snap.data());
      }
    } catch (err: any) {
      console.warn('FirebaseOrderService.getById error:', err?.message);
    }
    const found = initialMockOrders.find((o) => o.id === id);
    return found || null;
  }

  async create(input: CreateOrderInput): Promise<Order> {
    // 1. Fetch products map from Firebase for price accuracy
    const allProducts = await firebaseProductService.list();
    const productsMap = allProducts.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {} as Record<string, (typeof allProducts)[0]>);

    // 2. Validate Coupon if provided
    let coupon = null;
    if (input.promoCode) {
      const validation = await firebasePromoService.validate(input.promoCode, 0);
      if (validation.isValid && validation.coupon) {
        coupon = validation.coupon;
      }
    }

    // 3. Calculate Totals
    const totals = calculateOrderTotals(
      input.items,
      productsMap,
      input.fulfillmentType,
      coupon,
      demoConfig.mockTaxRate
    );

    // 4. Build Item Snapshots
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
    const orderId = `PT-2026-${randomSuffix}`;

    const newOrder: Order = {
      id: orderId,
      createdAt: now,
      userId: input.userId,
      customer: input.customer,
      fulfillmentType: input.fulfillmentType,
      address: input.address,
      items: snapshots,
      status: 'PENDING_CONFIRMATION',
      paymentMethod: input.paymentMethod,
      paymentStatus: (input.paymentMethod as any) === 'MOCK_WALLET' ? 'PAID_DEMO' : 'UNPAID',
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

    // 5. Save to Cloud Firestore
    try {
      const orderRef = doc(db, 'orders', orderId);
      await setDoc(orderRef, {
        userId: newOrder.userId || null,
        customerName: newOrder.customer.fullname,
        customerPhone: newOrder.customer.phone,
        customer: newOrder.customer,
        fulfillmentType: newOrder.fulfillmentType,
        deliveryAddress: newOrder.address || null,
        address: newOrder.address || null,
        items: newOrder.items,
        status: newOrder.status,
        paymentMethod: newOrder.paymentMethod,
        paymentStatus: newOrder.paymentStatus,
        subtotal: newOrder.subtotal,
        discount: newOrder.discount,
        deliveryFee: newOrder.deliveryFee,
        tax: newOrder.tax,
        totalAmount: newOrder.total,
        total: newOrder.total,
        statusHistory: newOrder.statusHistory,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      console.warn('FirebaseOrderService.create Firestore write error:', err?.message);
    }

    return newOrder;
  }

  async cancel(id: string): Promise<Order> {
    const order = await this.getById(id);
    if (!order) {
      throw new Error('Không tìm thấy đơn hàng');
    }

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

    try {
      const orderRef = doc(db, 'orders', id);
      await updateDoc(orderRef, {
        status: 'CANCELLED',
        paymentStatus: updatedOrder.paymentStatus,
        statusHistory: updatedOrder.statusHistory,
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      console.warn('FirebaseOrderService.cancel Firestore write error:', err?.message);
    }

    return updatedOrder;
  }

  async advanceDemoStatus(id: string): Promise<Order> {
    const order = await this.getById(id);
    if (!order) {
      throw new Error('Không tìm thấy đơn hàng');
    }

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
      paymentStatus: nextStatus === 'COMPLETED' ? 'PAID_DEMO' : order.paymentStatus,
      statusHistory: [
        ...order.statusHistory,
        {
          status: nextStatus,
          at: new Date().toISOString(),
          note,
        },
      ],
    };

    try {
      const orderRef = doc(db, 'orders', id);
      await updateDoc(orderRef, {
        status: nextStatus,
        paymentStatus: updatedOrder.paymentStatus,
        statusHistory: updatedOrder.statusHistory,
        updatedAt: serverTimestamp(),
      });
    } catch (err: any) {
      console.warn('FirebaseOrderService.advanceDemoStatus Firestore update error:', err?.message);
    }

    return updatedOrder;
  }

  async resetSeed(): Promise<void> {}
}

export const firebaseOrderService = new FirebaseOrderService();
