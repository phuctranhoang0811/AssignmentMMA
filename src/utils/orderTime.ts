const clock = (time: Date) => time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

// A time the customer scheduled is shown as chosen; "soonest" orders get a 30-45 minute window from the order time.
export function estimatedWindow(order: { deliveryTime?: unknown; createdAt?: any }) {
  const chosen = String(order.deliveryTime ?? '');
  if (chosen && !/sớm nhất|giao ngay/i.test(chosen)) return chosen;
  const placed = order.createdAt?.seconds ? order.createdAt.seconds * 1000 : Date.parse(order.createdAt);
  if (!placed) return chosen || 'Sớm nhất';
  return `${clock(new Date(placed + 30 * 60000))} – ${clock(new Date(placed + 45 * 60000))} (dự kiến)`;
}
