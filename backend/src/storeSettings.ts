import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { HttpError } from './domain';
import { defaultStoreSettings, storeStatus, type StoreSettings } from '../../src/utils/storeHours';
import { isAdminRole } from '../../src/utils/staff';
import { recordAudit } from './audit';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const deliveryFeeInput = z.object({
  storeLat: z.number().min(-90).max(90), storeLng: z.number().min(-180).max(180),
  baseKm: z.number().min(0).max(50), baseFee: z.number().int().min(0).max(500_000),
  perKm: z.number().int().min(0).max(100_000), maxKm: z.number().min(1).max(100),
  freeOver: z.number().int().min(0).max(50_000_000).optional(),
}).strict().refine(x => x.maxKm >= x.baseKm, 'Khoảng cách tối đa phải lớn hơn quãng đường phí cơ bản.');
const settingsFields = {
  acceptingOrders: z.boolean(), openTime: time, closeTime: time, closedMessage: z.string().trim().max(200).optional(),
  delivery: deliveryFeeInput.optional(),
};
export const storeSettingsInput = z.object(settingsFields).strict();
// The stored document also carries updatedAt/updatedBy, which the strict input schema would reject.
const storedSettings = z.object(settingsFields);

const CACHE_MS = 15_000;

/** Opening hours and the "pause ordering" switch, stored in settings/store and enforced on every order-creating route. */
export class StoreSettingsStore {
  private cached?: { at: number; value: StoreSettings };
  constructor(private db: Firestore, private clock: () => number = Date.now) {}

  async get(): Promise<StoreSettings> {
    if (this.cached && this.clock() - this.cached.at < CACHE_MS) return this.cached.value;
    const parsed = storedSettings.safeParse((await this.db.collection('settings').doc('store').get()).data());
    const value = parsed.success ? parsed.data : defaultStoreSettings;
    this.cached = { at: this.clock(), value };
    return value;
  }

  async assertOpen() {
    const status = storeStatus(await this.get(), new Date(this.clock()));
    if (!status.open) throw new HttpError(403, status.message, 'STORE_CLOSED');
  }

  async update(uid: string, input: z.infer<typeof storeSettingsInput>) {
    if (!isAdminRole((await this.db.collection('users').doc(uid).get()).data()?.role)) {
      throw new HttpError(403, 'Chỉ quản trị viên được đổi cài đặt cửa hàng.');
    }
    const previous = await this.get();
    await this.db.collection('settings').doc('store').set({ ...input, updatedAt: Timestamp.now(), updatedBy: uid });
    this.cached = undefined;
    await recordAudit(this.db, { actorId: uid, action: 'STORE_SETTINGS_UPDATED', target: 'settings/store', details: { before: previous, after: input } });
    return input;
  }
}
