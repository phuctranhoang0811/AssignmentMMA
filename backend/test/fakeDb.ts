import assert from 'node:assert/strict';
import type { Firestore } from 'firebase-admin/firestore';

// Transaction fixture exercises the real stores and rejects reads after writes like Firestore.
export function database(products: Record<string, Record<string, unknown>> = {}) {
  const docs = new Map<string, Record<string, unknown>>();
  type Ref = { path: string; id: string; get: () => Promise<ReturnType<typeof snapshot>>; create: (value: Record<string, unknown>) => Promise<void>; update: (value: Record<string, unknown>) => Promise<void> };
  function reference(name: string, id: string): Ref {
    const path = `${name}/${id}`;
    return { path, id, get: async () => snapshot(reference(name, id), docs),
      create: async value => { assert.ok(!docs.has(path)); docs.set(path, value); },
      update: async value => { assert.ok(docs.has(path)); docs.set(path, { ...docs.get(path), ...value }); } };
  }
  function snapshot(ref: Ref, source: typeof docs) { return { ref, id: ref.id, exists: source.has(ref.path), data: () => source.get(ref.path) }; }
  // Equality queries with a limit, enough for the stores' lookups.
  type Query = { name: string; filters: [string, unknown][]; max: number };
  function query(name: string, filters: [string, unknown][] = [], max = Infinity) {
    const spec: Query = { name, filters, max };
    return { spec, where: (field: string, _op: '==', value: unknown) => query(name, [...filters, [field, value]], max),
      limit: (n: number) => query(name, filters, n), get: async () => run(spec, docs) };
  }
  function run({ name, filters, max }: Query, source: typeof docs) {
    const found = [...source.keys()].filter(path => path.startsWith(`${name}/`) && path.split('/').length === 2)
      .filter(path => filters.every(([field, value]) => source.get(path)?.[field] === value)).slice(0, max)
      .map(path => snapshot(reference(name, path.slice(name.length + 1)), source));
    return { docs: found, empty: found.length === 0, size: found.length };
  }
  let tail = Promise.resolve();
  const db = {
    collection: (name: string) => ({ doc: (id: string) => reference(name, id), ...query(name) }),
    getAll: async (...refs: Ref[]) => refs.map(ref => snapshot(ref, docs)),
    runTransaction: async <T>(callback: (tx: unknown) => Promise<T>) => {
      const before = tail;
      let release!: () => void;
      tail = new Promise<void>(resolve => { release = resolve; });
      await before;
      const staged = new Map(docs);
      let wrote = false;
      try {
        const result = await callback({
          get: async (target: Ref | { spec: Query }) => {
            assert.equal(wrote, false, 'read after write');
            return 'spec' in target ? run(target.spec, staged) : snapshot(target, staged);
          },
          getAll: async (...refs: Ref[]) => { assert.equal(wrote, false); return refs.map(ref => snapshot(ref, staged)); },
          create: (ref: Ref, value: Record<string, unknown>) => { wrote = true; assert.ok(!staged.has(ref.path)); staged.set(ref.path, value); },
          update: (ref: Ref, value: Record<string, unknown>) => { wrote = true; assert.ok(staged.has(ref.path)); staged.set(ref.path, { ...staged.get(ref.path), ...value }); },
          set: (ref: Ref, value: Record<string, unknown>) => { wrote = true; staged.set(ref.path, value); },
          delete: (ref: Ref) => { wrote = true; staged.delete(ref.path); },
        });
        docs.clear(); for (const [key, value] of staged) docs.set(key, value);
        return result;
      } finally { release(); }
    },
  } as unknown as Firestore;
  docs.set('products/pizza', { name: 'Pizza', categoryId: 'pizza', basePrice: 100000, variants: [], addons: [], isAvailable: true });
  for (const [id, value] of Object.entries(products)) docs.set(`products/${id}`, value);
  return { db, docs };
}
