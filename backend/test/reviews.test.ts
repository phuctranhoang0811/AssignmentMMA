import { test } from 'node:test';
import assert from 'node:assert/strict';
import { database } from './fakeDb';
import { ReviewStore } from '../src/reviews';

const seed = (status: string, extra: Record<string, unknown> = {}) => {
  const { db, docs } = database();
  docs.set('orders/o1', { userId: 'u1', status, ...extra });
  return { store: new ReviewStore(db), docs };
};

test('the owner reviews a completed order once', async () => {
  const { store, docs } = seed('COMPLETED');
  assert.deepEqual(await store.submit('u1', 'o1', { rating: 5, comment: 'Ngon' }), { orderId: 'o1', rating: 5 });
  assert.equal(docs.get('orders/o1')?.reviewed, true);
  assert.equal(docs.get('order_reviews/o1')?.rating, 5);
  await assert.rejects(store.submit('u1', 'o1', { rating: 1 }), /đã đánh giá/);
});

test('unfinished or someone else\'s orders cannot be reviewed', async () => {
  const { store } = seed('PREPARING');
  await assert.rejects(store.submit('u1', 'o1', { rating: 4 }), /hoàn thành/);
  await assert.rejects(store.submit('intruder', 'o1', { rating: 4 }), /Không tìm thấy/);
  await assert.rejects(store.submit('u1', 'missing', { rating: 4 }), /Không tìm thấy/);
});
