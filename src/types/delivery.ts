export type DeliveryStatus = 'NOT_REQUESTED' | 'SEARCHING' | 'ASSIGNED' | 'PICKED_UP' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
export type Delivery = {
  provider: 'AHAMOVE'; environment: 'staging'; serviceId: string; status: DeliveryStatus;
  quotedFee: number; providerOrderId?: string; providerStatus?: string; actualFee?: number;
  trackingUrl?: string; driverName?: string; driverPhone?: string; updatedAt?: string;
};
export type DeliveryQuote = {
  id: string; expiresAt: string; provider: 'AHAMOVE'; environment: 'staging';
  pricing: { subtotal: number; discount: number; deliveryFee: number; tax: number; total: number };
  pickupName: string; pickupAddress: string;
};
export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  NOT_REQUESTED: 'Chờ cửa hàng gọi tài xế', SEARCHING: 'Đang tìm tài xế', ASSIGNED: 'Tài xế đã nhận chuyến',
  PICKED_UP: 'Tài xế đã lấy món, đang giao', DELIVERED: 'Đã giao món', FAILED: 'Giao chưa thành công, cửa hàng đang xử lý',
  CANCELLED: 'Chuyến giao đã hủy, cửa hàng đang xử lý',
};
