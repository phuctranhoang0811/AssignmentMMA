import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { HttpError } from './domain';

export const reviewInput = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
}).strict();

/** One review per completed order, written only by the backend so ratings cannot be forged or edited. */
export class ReviewStore {
  constructor(private db: Firestore) {}

  async submit(uid: string, orderId: string, input: z.infer<typeof reviewInput>) {
    const orderRef = this.db.collection('orders').doc(orderId);
    const reviewRef = this.db.collection('order_reviews').doc(orderId);
    return this.db.runTransaction(async tx => {
      const order = await tx.get(orderRef);
      const data = order.data();
      if (!order.exists || data?.userId !== uid) throw new HttpError(404, 'Không tìm thấy đơn hàng.');
      if (data.status !== 'COMPLETED') throw new HttpError(409, 'Chỉ đánh giá được đơn đã hoàn thành.');
      if (data.reviewed) throw new HttpError(409, 'Bạn đã đánh giá đơn này rồi.');
      tx.create(reviewRef, { orderId, uid, rating: input.rating, comment: input.comment ?? '', createdAt: Timestamp.now() });
      tx.update(orderRef, { reviewed: true, rating: input.rating });
      return { orderId, rating: input.rating };
    });
  }
}
