import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RewardStore } from '../src/rewards';
import { redeemFromWallet, type RewardWallet } from '../../src/data/rewards';

function fixture() {
  const docs = new Map<string, any>([['users/a', { rewardPoints: 100 }], ['users/b', { rewardPoints: 70 }]]);
  const snapshot = (path: string) => ({ exists: docs.has(path), data: () => docs.get(path) });
  const collection = (path: string): any => ({
    doc: (id: string) => ({ path: `${path}/${id}`, get: async () => snapshot(`${path}/${id}`),
      collection: (name: string) => collection(`${path}/${id}/${name}`) }),
    get: async () => ({ docs: [...docs].filter(([key]) => key.startsWith(`${path}/`))
      .map(([, value]) => ({ data: () => value })) }),
  });
  let queue = Promise.resolve();
  let failWrite = false;
  const db = { collection, runTransaction: (callback: any) => {
    const operation = queue.then(async () => {
      const staged = new Map(docs);
      const result = await callback({
        get: async (ref: any) => snapshot(ref.path),
        update: (ref: any, value: object) => staged.set(ref.path, { ...staged.get(ref.path), ...value }),
        create: (ref: any, value: object) => {
          if (failWrite) throw new Error('write failed');
          assert.equal(staged.has(ref.path), false);
          staged.set(ref.path, value);
        },
      });
      docs.clear(); for (const [key, value] of staged) docs.set(key, value);
      return result;
    });
    queue = operation.then(() => {}, () => {});
    return operation;
  } };
  return { store: new RewardStore(db as unknown as ConstructorParameters<typeof RewardStore>[0]), docs,
    fail: () => { failWrite = true; } };
}

test('reward retry charges once and keeps gifts isolated by account', async () => {
  const { store } = fixture();
  const [first, retry] = await Promise.all([
    store.redeem('a', 'R01', 'same-request-key'), store.redeem('a', 'R01', 'same-request-key'),
  ]);
  assert.equal(first.points, 70);
  assert.equal(retry.points, 70);
  assert.equal(retry.gifts.length, 1);
  assert.equal(retry.gifts[0].points, 30);
  assert.deepEqual(await store.wallet('b'), { points: 70, gifts: [] });
  await assert.rejects(store.redeem('a', 'R02', 'same-request-key'), /không khớp/);
});

test('insufficient points and failed gift write leave the wallet unchanged', async () => {
  const f = fixture();
  await assert.rejects(f.store.redeem('a', 'R07', 'expensive-request'), /chưa đủ điểm/);
  assert.deepEqual(await f.store.wallet('a'), { points: 100, gifts: [] });
  f.fail();
  await assert.rejects(f.store.redeem('a', 'R01', 'failed-request'), /write failed/);
  assert.deepEqual(await f.store.wallet('a'), { points: 100, gifts: [] });
});

test('distinct requests cannot spend more points than available', async () => {
  const { store } = fixture();
  const results = await Promise.allSettled([store.redeem('b', 'R04', 'first-request'), store.redeem('b', 'R04', 'second-request')]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await store.wallet('b')).points, 0);
});

test('catalog validation rejects unknown rewards and invalid balances', () => {
  const wallet: RewardWallet = { points: 100, gifts: [] };
  assert.throws(() => redeemFromWallet(wallet, 'fake', 'key', 'today'), /không còn/);
  assert.throws(() => redeemFromWallet({ ...wallet, points: NaN }, 'R01', 'key', 'today'), /chưa đủ/);
});
