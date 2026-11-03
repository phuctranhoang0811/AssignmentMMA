import { useEffect } from 'react';
import { router } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../state/ToastContext';
import { listenForOrderPush, registerForOrderPush } from '../../services/pushService';

const statusText: Record<string, string> = {
  CONFIRMED: 'đã được cửa hàng xác nhận',
  PREPARING: 'đang được chuẩn bị',
  READY: 'đã sẵn sàng',
  OUT_FOR_DELIVERY: 'đang được giao tới bạn',
  COMPLETED: 'đã hoàn thành',
  CANCELLED: 'đã bị hủy',
};

// Anywhere in the app, tell a customer when staff move one of their orders to a new status.
export function OrderStatusNotifier() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const owner = user && !user.isDemo && (user.role ?? 'USER') === 'USER' ? user.id : undefined;

  useEffect(() => {
    if (!owner) return;
    void registerForOrderPush(owner);
    let stopPush = () => {};
    void listenForOrderPush().then(stop => { stopPush = stop; });
    return () => stopPush();
  }, [owner]);

  useEffect(() => {
    if (!owner) return;
    // The first snapshot is the current state; only later changes are news.
    let known: Map<string, string> | null = null;
    return onSnapshot(query(collection(db, 'orders'), where('userId', '==', owner)), snapshot => {
      const next = new Map(snapshot.docs.map(doc => [doc.id, String(doc.data().status ?? '')]));
      if (known) {
        for (const change of snapshot.docChanges()) {
          if (change.type !== 'modified') continue;
          const status = next.get(change.doc.id)!;
          if (status === known.get(change.doc.id) || !statusText[status]) continue;
          const code = change.doc.data().orderCode ?? change.doc.id.slice(0, 8).toUpperCase();
          showToast({
            message: `Đơn #${code} ${statusText[status]}.`,
            type: status === 'CANCELLED' ? 'error' : 'success',
            actionText: 'Xem',
            onAction: () => router.push({ pathname: '/order/tracking', params: { orderId: change.doc.id } }),
          });
        }
      }
      known = next;
    }, () => {});
  }, [owner, showToast]);

  return null;
}
