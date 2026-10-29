import type { StaffOrder } from '../types/order';

// Managers/admins open the admin portal but can also run the staff portal; the backend accepts every role here.
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER'];
const STAFF_ROLES = [...ADMIN_ROLES, 'EMPLOYEE', 'ROLE_KITCHEN', 'ROLE_RIDER'];
export const isAdminRole = (role?: string) => ADMIN_ROLES.includes(role ?? '');

// Mirrors canSetRole() in firestore.rules: SUPER_ADMIN/ADMIN assign roles, only SUPER_ADMIN touches the admin tier.
const ADMIN_TIER = ['SUPER_ADMIN', 'ADMIN'];
export const canManageRoles = (myRole?: string) => ADMIN_TIER.includes(myRole ?? '');
export const canChangeRole = (myRole: string | undefined, from: string | undefined, to: string) =>
  canManageRoles(myRole) && (myRole === 'SUPER_ADMIN' || (!ADMIN_TIER.includes(from ?? 'USER') && !ADMIN_TIER.includes(to)));
export const isStaffRole = (role?: string) => STAFF_ROLES.includes(role ?? '');

export function loginDestination(role?: string, returnTo?: string) {
  if (isAdminRole(role)) return returnTo === 'staff' ? '/staff/orders' : '/admin/dashboard';
  if (returnTo === 'staff' || isStaffRole(role)) return '/staff/orders';
  if (returnTo === 'checkout') return 'back';
  if (returnTo === 'cart-checkout') return '/checkout';
  if (returnTo === 'profile') return '/(tabs)/profile';
  if (returnTo === 'rewards') return '/(tabs)/rewards';
  if (returnTo === 'menu') return '/(tabs)/menu';
  if (returnTo === 'cart') return '/(tabs)/cart';
  return '/(tabs)/home';
}

export type StaffTab = 'pending' | 'kitchen' | 'completed';
const TAB_STATUSES: Record<StaffTab, string[]> = {
  pending: ['PENDING_CONFIRMATION'],
  kitchen: ['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'],
  completed: ['COMPLETED', 'CANCELLED'],
};

export function filterStaffOrders(orders: StaffOrder[], tab: StaffTab, fulfillment = 'ALL', search = '') {
  const query = search.trim().toLowerCase();
  return orders.filter(order => TAB_STATUSES[tab].includes(order.status) &&
    (fulfillment === 'ALL' || order.fulfillmentType === fulfillment) &&
    (!query || [order.orderCode, order.customer?.fullname, order.customer?.phone]
      .some(value => String(value ?? '').toLowerCase().includes(query))));
}

// Keep the UI actions aligned with backend nextStatus(); Ahamove owns delivery after READY.
export function staffOrderAction(order: StaffOrder) {
  const kitchen: Record<string, string> = {
    PENDING_CONFIRMATION: 'Xác nhận đơn', CONFIRMED: 'Bắt đầu làm món', PREPARING: 'Món đã sẵn sàng',
  };
  if (kitchen[order.status]) return kitchen[order.status];
  if (order.delivery?.provider === 'AHAMOVE') return undefined;
  if (order.status === 'READY') return order.fulfillmentType === 'delivery' ? 'Bắt đầu giao' : 'Khách đã nhận món';
  if (order.status === 'OUT_FOR_DELIVERY') return 'Giao thành công';
  return undefined;
}

export const canRejectStaffOrder = (order: StaffOrder) =>
  ['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY'].includes(order.status) &&
  (!order.delivery || order.delivery.status === 'NOT_REQUESTED');

export function staffOrderTime(createdAt: StaffOrder['createdAt']) {
  if (!createdAt) return undefined;
  const milliseconds = typeof createdAt === 'string' ? Date.parse(createdAt)
    : (createdAt._seconds ?? createdAt.seconds ?? NaN) * 1000;
  return Number.isFinite(milliseconds) ? milliseconds : undefined;
}

export function staffDeliveryTime(value: string) {
  if (value === 'asap') return 'Sớm nhất';
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toLocaleString('vi-VN') : value;
}
