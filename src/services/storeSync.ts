import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { parseDeliveryFeeConfig, type DeliveryFeeConfig } from '../utils/deliveryFee';

const STORAGE_KEY = '@fpt_stores_config_sync_v2';
const LEGACY_STORES_KEY = '@fpt_stores_branches_v1';

export interface SyncedStoreBranch {
  id: string;
  name: string;
  address: string;
  openingTime: string;
  isActive: boolean;
  lat: number;
  lng: number;
}

export const DEFAULT_STORE_BRANCHES: SyncedStoreBranch[] = [
  {
    id: 'store-lieu-giai',
    name: 'Pizza FPT Liễu Giai (Signature)',
    address: '40 Liễu Giai, Phường Cống Vị, Quận Ba Đình, Hà Nội',
    openingTime: '10:00 - 22:00',
    isActive: true,
    lat: 21.0352,
    lng: 105.8138,
  },
  {
    id: 'store-thu-duc',
    name: 'Pizza FPT Hiệp Bình Chánh (Signature)',
    address: '240 Phạm Văn Đồng, Phường Hiệp Bình Chánh, TP. Thủ Đức, TP. Hồ Chí Minh',
    openingTime: '10:00 - 22:00',
    isActive: true,
    lat: 10.8291,
    lng: 106.7183,
  },
];

export const DEFAULT_DELIVERY_CONFIG: DeliveryFeeConfig = {
  storeLat: 10.8291,
  storeLng: 106.7183,
  baseKm: 3,
  baseFee: 0,
  perKm: 5000,
  maxKm: 10,
  freeOver: 300000,
};

export interface StoreConfigState {
  stores: SyncedStoreBranch[];
  delivery: DeliveryFeeConfig | null;
  shippingEnabled: boolean;
  updatedAtMs: number;
}

let currentState: StoreConfigState = {
  stores: DEFAULT_STORE_BRANCHES,
  delivery: DEFAULT_DELIVERY_CONFIG,
  shippingEnabled: true,
  updatedAtMs: 0,
};

let storageLoaded = false;
let firestoreListening = false;
const listeners = new Set<(state: StoreConfigState) => void>();

export function sanitizeStoreBranch(raw: any, idx = 0): SyncedStoreBranch {
  const rawAddress = String(raw?.address || '');
  const isHanoi =
    rawAddress.toLowerCase().includes('hà nội') ||
    rawAddress.toLowerCase().includes('ba đình') ||
    rawAddress.toLowerCase().includes('liễu giai');
  const fallbackLat = isHanoi ? 21.0352 : 10.8291;
  const fallbackLng = isHanoi ? 105.8138 : 106.7183;

  return {
    id: String(raw?.id || `store-${idx}`),
    name: String(raw?.name || 'Cửa hàng Pizza FPT').trim(),
    address: rawAddress.trim(),
    openingTime: String(raw?.openingTime || '10:00 - 22:00')
      .replace(/^Opening time:\s*/i, '')
      .trim(),
    isActive: raw?.isActive !== false,
    lat: typeof raw?.lat === 'number' && Number.isFinite(raw.lat) ? raw.lat : fallbackLat,
    lng: typeof raw?.lng === 'number' && Number.isFinite(raw.lng) ? raw.lng : fallbackLng,
  };
}

function notifyAll() {
  const snapshot: StoreConfigState = {
    stores: [...currentState.stores],
    delivery: currentState.delivery ? { ...currentState.delivery } : null,
    shippingEnabled: currentState.shippingEnabled,
    updatedAtMs: currentState.updatedAtMs,
  };
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch { }
  });
}

let lastRemoteStoresTs = 0;
let authSyncHooked = false;

async function pushStoresConfigToFirestore() {
  if (currentState.updatedAtMs <= 0 || !auth.currentUser) return;
  await setDoc(
    doc(db, 'coupons', '__STORES_CONFIG__'),
    {
      expiresAt: '01/01/2000',
      stores: currentState.stores,
      delivery: currentState.delivery,
      shippingEnabled: currentState.shippingEnabled,
      updatedAtMs: currentState.updatedAtMs,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  ).catch(() => { });
}

function ensureAuthSyncHook() {
  if (authSyncHooked) return;
  authSyncHooked = true;
  try {
    onAuthStateChanged(auth, (u) => {
      if (!u) return;
      if (currentState.updatedAtMs > lastRemoteStoresTs) {
        void pushStoresConfigToFirestore();
      }
      if (Object.keys(currentStaffMap).length > 0) {
        void setDoc(
          doc(db, 'coupons', '__STAFF_STORES__'),
          {
            expiresAt: '01/01/2000',
            mapping: currentStaffMap,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => { });
      }
      if (Object.keys(currentSchedulesMap).length > 0) {
        void setDoc(
          doc(db, 'coupons', '__STAFF_SCHEDULES__'),
          {
            expiresAt: '01/01/2000',
            schedules: currentSchedulesMap,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => { });
      }
      if (Object.keys(currentOrdersSyncMap).length > 0) {
        void setDoc(
          doc(db, 'coupons', '__ORDERS_SYNC__'),
          {
            expiresAt: '01/01/2000',
            overrides: currentOrdersSyncMap,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => { });
      }
    });
  } catch { }
}

async function ensureInitialized() {
  ensureAuthSyncHook();
  if (!storageLoaded) {
    storageLoaded = true;
    try {
      const savedJson = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedJson) {
        const parsed = JSON.parse(savedJson);
        if (parsed && Array.isArray(parsed.stores) && parsed.stores.length > 0) {
          currentState = {
            stores: parsed.stores.map((s: any, idx: number) => sanitizeStoreBranch(s, idx)),
            delivery:
              parsed.shippingEnabled === false
                ? null
                : parseDeliveryFeeConfig(parsed.delivery) || DEFAULT_DELIVERY_CONFIG,
            shippingEnabled: parsed.shippingEnabled !== false,
            updatedAtMs: Number(parsed.updatedAtMs || Date.now()),
          };
          notifyAll();
        }
      } else {
        const legacyJson = await AsyncStorage.getItem(LEGACY_STORES_KEY);
        if (legacyJson) {
          const parsedLegacy = JSON.parse(legacyJson);
          if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
            currentState = {
              ...currentState,
              stores: parsedLegacy.map((s: any, idx: number) => sanitizeStoreBranch(s, idx)),
              updatedAtMs: Date.now(),
            };
            notifyAll();
          }
        }
      }
    } catch { }
  }

  if (!firestoreListening) {
    firestoreListening = true;
    try {
      onSnapshot(
        doc(db, 'coupons', '__STORES_CONFIG__'),
        (snap) => {
          const data = snap.data();
          if (!data || !Array.isArray(data.stores) || data.stores.length === 0) {
            if (currentState.updatedAtMs > 0) {
              void pushStoresConfigToFirestore();
            }
            return;
          }
          const remoteTs =
            typeof data.updatedAtMs === 'number'
              ? data.updatedAtMs
              : typeof data.updatedAt?.toMillis === 'function'
                ? data.updatedAt.toMillis()
                : 0;

          lastRemoteStoresTs = remoteTs;

          if (currentState.updatedAtMs > remoteTs) {
            void pushStoresConfigToFirestore();
            return;
          }

          let changed = false;
          if (Array.isArray(data.stores) && data.stores.length > 0) {
            currentState.stores = data.stores.map((s: any, i: number) => sanitizeStoreBranch(s, i));
            changed = true;
          }
          if ('delivery' in data) {
            if (data.delivery === null) {
              currentState.delivery = null;
              currentState.shippingEnabled = false;
            } else {
              const parsedDel = parseDeliveryFeeConfig(data.delivery);
              if (parsedDel) {
                currentState.delivery = parsedDel;
                currentState.shippingEnabled = true;
              }
            }
            changed = true;
          }
          if (changed) {
            if (remoteTs > currentState.updatedAtMs) {
              currentState.updatedAtMs = remoteTs;
            }
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(currentState)).catch(() => { });
            notifyAll();
          }
        },
        () => { }
      );
    } catch { }
  }
}

export function subscribeStoresConfig(listener: (state: StoreConfigState) => void): () => void {
  listeners.add(listener);
  listener({
    stores: [...currentState.stores],
    delivery: currentState.delivery ? { ...currentState.delivery } : null,
    shippingEnabled: currentState.shippingEnabled,
    updatedAtMs: currentState.updatedAtMs,
  });
  void ensureInitialized();
  return () => {
    listeners.delete(listener);
  };
}

export async function saveSyncedStores(nextStores: SyncedStoreBranch[]): Promise<void> {
  const sanitized = nextStores.map((s, idx) => sanitizeStoreBranch(s, idx));
  const nowMs = Date.now();
  currentState = {
    ...currentState,
    stores: sanitized,
    updatedAtMs: nowMs,
  };
  notifyAll();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(currentState)).catch(() => { });
  await setDoc(
    doc(db, 'coupons', '__STORES_CONFIG__'),
    {
      expiresAt: '01/01/2000',
      stores: sanitized,
      updatedAtMs: nowMs,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  ).catch(() => { });
}

export async function saveSyncedShipping(
  delivery: DeliveryFeeConfig | null,
  shippingEnabled: boolean
): Promise<void> {
  const sanitizedDelivery =
    shippingEnabled && delivery
      ? {
        storeLat: Number(delivery.storeLat) || 10.8291,
        storeLng: Number(delivery.storeLng) || 106.7183,
        baseKm: Number(delivery.baseKm) || 0,
        baseFee: Number(delivery.baseFee) || 0,
        perKm: Number(delivery.perKm) || 0,
        maxKm: Number(delivery.maxKm) || 10,
        freeOver: Number(delivery.freeOver || 0),
      }
      : null;
  const nowMs = Date.now();
  currentState = {
    ...currentState,
    delivery: sanitizedDelivery,
    shippingEnabled,
    updatedAtMs: nowMs,
  };
  notifyAll();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(currentState)).catch(() => { });
  await setDoc(
    doc(db, 'coupons', '__STORES_CONFIG__'),
    {
      expiresAt: '01/01/2000',
      delivery: sanitizedDelivery,
      shippingEnabled,
      updatedAtMs: nowMs,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  ).catch(() => { });
}

// ========================================================
// STAFF / USER CUSTOMIZATION SYNC (Store, Phone, Lock, Delete)
// ========================================================
const STAFF_MAP_KEY = '@fpt_staff_stores_sync_v2';

export interface StaffCustomizationEntry {
  storeId?: string | null;
  storeName?: string | null;
  phone?: string;
  email?: string;
  previousRole?: string;
  deleted?: boolean;
}

let currentStaffMap: Record<string, StaffCustomizationEntry> = {};
let staffStorageLoaded = false;
let staffFirestoreListening = false;
const staffListeners = new Set<(map: Record<string, StaffCustomizationEntry>) => void>();

function notifyStaffListeners() {
  const copy = { ...currentStaffMap };
  staffListeners.forEach((fn) => {
    try {
      fn(copy);
    } catch { }
  });
}

async function ensureStaffInitialized() {
  if (!staffStorageLoaded) {
    staffStorageLoaded = true;
    try {
      const saved = await AsyncStorage.getItem(STAFF_MAP_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          currentStaffMap = { ...parsed, ...currentStaffMap };
          notifyStaffListeners();
        }
      }
    } catch { }
  }

  if (!staffFirestoreListening) {
    staffFirestoreListening = true;
    try {
      onSnapshot(
        doc(db, 'coupons', '__STAFF_STORES__'),
        (snap) => {
          const remoteMap = snap.data()?.mapping;
          if (remoteMap && typeof remoteMap === 'object') {
            currentStaffMap = { ...currentStaffMap, ...remoteMap };
            AsyncStorage.setItem(STAFF_MAP_KEY, JSON.stringify(currentStaffMap)).catch(() => { });
            notifyStaffListeners();
          }
        },
        () => { }
      );
    } catch { }
  }
}

export function subscribeStaffStoresMap(
  listener: (map: Record<string, StaffCustomizationEntry>) => void
): () => void {
  staffListeners.add(listener);
  listener({ ...currentStaffMap });
  void ensureStaffInitialized();
  return () => {
    staffListeners.delete(listener);
  };
}

export async function saveStaffStoresEntry(
  uid: string,
  entry: Partial<StaffCustomizationEntry>
): Promise<void> {
  const prev = currentStaffMap[uid] || {};
  const merged: StaffCustomizationEntry = {
    storeId: entry.storeId !== undefined ? entry.storeId : prev.storeId ?? null,
    storeName: entry.storeName !== undefined ? entry.storeName : prev.storeName ?? null,
    phone: entry.phone !== undefined ? String(entry.phone) : prev.phone ?? '',
    email: entry.email !== undefined ? String(entry.email).toLowerCase() : prev.email ?? '',
    previousRole: entry.previousRole !== undefined ? String(entry.previousRole) : prev.previousRole ?? 'USER',
    deleted: entry.deleted !== undefined ? Boolean(entry.deleted) : Boolean(prev.deleted),
  };
  currentStaffMap = {
    ...currentStaffMap,
    [uid]: merged,
  };
  notifyStaffListeners();
  await AsyncStorage.setItem(STAFF_MAP_KEY, JSON.stringify(currentStaffMap)).catch(() => { });
  await setDoc(
    doc(db, 'coupons', '__STAFF_STORES__'),
    {
      expiresAt: '01/01/2000',
      mapping: currentStaffMap,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  ).catch(() => { });
}

export async function findStaffEmailByPhone(rawPhone: string): Promise<string | null> {
  const clean = rawPhone.replace(/[\s.-]/g, '').trim();
  if (!clean) return null;
  await ensureStaffInitialized();

  for (const val of Object.values(currentStaffMap)) {
    if (!val?.deleted && val?.phone && val.phone.replace(/[\s.-]/g, '').trim() === clean && val.email) {
      return val.email.toLowerCase();
    }
  }

  try {
    const snap = await getDoc(doc(db, 'coupons', '__STAFF_STORES__'));
    const remoteMap = snap.data()?.mapping;
    if (remoteMap && typeof remoteMap === 'object') {
      currentStaffMap = { ...currentStaffMap, ...remoteMap };
      for (const val of Object.values(currentStaffMap)) {
        if (!val?.deleted && val?.phone && val.phone.replace(/[\s.-]/g, '').trim() === clean && val.email) {
          return val.email.toLowerCase();
        }
      }
    }
  } catch { }

  return null;
}

// ========================================================
// STAFF WEEKLY SCHEDULE SYNC (Manager sắp xếp lịch làm việc)
// ========================================================
const STAFF_SCHEDULE_KEY = '@fpt_staff_schedules_sync_v1';

export type ShiftType = 'MORNING' | 'EVENING' | 'FULL' | 'OFF';

export interface StaffScheduleRecord {
  days: Record<string, ShiftType>; // T2, T3, T4, T5, T6, T7, CN
  note?: string;
  updatedAtMs?: number;
}

export const DEFAULT_WEEKLY_DAYS: Record<string, ShiftType> = {
  T2: 'OFF',
  T3: 'OFF',
  T4: 'OFF',
  T5: 'OFF',
  T6: 'OFF',
  T7: 'OFF',
  CN: 'OFF',
};

let currentSchedulesMap: Record<string, StaffScheduleRecord> = {};
let scheduleStorageLoaded = false;
let scheduleFirestoreListening = false;
const scheduleListeners = new Set<(map: Record<string, StaffScheduleRecord>) => void>();

function notifyScheduleListeners() {
  const copy = { ...currentSchedulesMap };
  scheduleListeners.forEach((fn) => {
    try {
      fn(copy);
    } catch { }
  });
}

async function ensureSchedulesInitialized() {
  if (!scheduleStorageLoaded) {
    scheduleStorageLoaded = true;
    try {
      const saved = await AsyncStorage.getItem(STAFF_SCHEDULE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          currentSchedulesMap = { ...parsed, ...currentSchedulesMap };
          notifyScheduleListeners();
        }
      }
    } catch { }
  }

  if (!scheduleFirestoreListening) {
    scheduleFirestoreListening = true;
    try {
      onSnapshot(
        doc(db, 'coupons', '__STAFF_SCHEDULES__'),
        (snap) => {
          const remoteMap = snap.data()?.schedules;
          if (remoteMap && typeof remoteMap === 'object') {
            currentSchedulesMap = { ...currentSchedulesMap, ...remoteMap };
            AsyncStorage.setItem(STAFF_SCHEDULE_KEY, JSON.stringify(currentSchedulesMap)).catch(() => { });
            notifyScheduleListeners();
          }
        },
        () => { }
      );
    } catch { }
  }
}

export function subscribeStaffSchedules(
  listener: (map: Record<string, StaffScheduleRecord>) => void
): () => void {
  scheduleListeners.add(listener);
  listener({ ...currentSchedulesMap });
  void ensureSchedulesInitialized();
  return () => {
    scheduleListeners.delete(listener);
  };
}

export async function saveStaffSchedule(
  uid: string,
  days: Record<string, ShiftType>,
  note?: string
): Promise<void> {
  const prev = currentSchedulesMap[uid];
  const record: StaffScheduleRecord = {
    days: { ...DEFAULT_WEEKLY_DAYS, ...(prev?.days || {}), ...days },
    note: note !== undefined ? note : prev?.note || '',
    updatedAtMs: Date.now(),
  };
  currentSchedulesMap = {
    ...currentSchedulesMap,
    [uid]: record,
  };
  notifyScheduleListeners();
  await AsyncStorage.setItem(STAFF_SCHEDULE_KEY, JSON.stringify(currentSchedulesMap)).catch(() => { });
  await setDoc(
    doc(db, 'coupons', '__STAFF_SCHEDULES__'),
    {
      expiresAt: '01/01/2000',
      schedules: currentSchedulesMap,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  ).catch(() => { });
}

export function formatScheduleDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getStaffShiftOnDate(
  record: StaffScheduleRecord | undefined,
  d: Date
): ShiftType {
  if (!record?.days) return 'OFF';
  const dateKey = formatScheduleDateKey(d);
  if (record.days[dateKey]) {
    return record.days[dateKey];
  }
  const dowKeys = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const dowKey = dowKeys[(d.getDay() + 6) % 7];
  if (dowKey && record.days[dowKey]) {
    return record.days[dowKey];
  }
  return 'OFF';
}

export async function saveShiftStaffForDay(
  dayKey: string,
  shiftType: ShiftType,
  selectedStaffIds: string[]
): Promise<void> {
  const nextMap = { ...currentSchedulesMap };
  const nowMs = Date.now();

  selectedStaffIds.forEach((uid) => {
    const prev = nextMap[uid];
    const prevDays = { ...DEFAULT_WEEKLY_DAYS, ...(prev?.days || {}) };
    prevDays[dayKey] = shiftType;
    nextMap[uid] = {
      days: prevDays,
      note: prev?.note || '',
      updatedAtMs: nowMs,
    };
  });

  currentSchedulesMap = nextMap;
  notifyScheduleListeners();
  await AsyncStorage.setItem(STAFF_SCHEDULE_KEY, JSON.stringify(currentSchedulesMap)).catch(() => { });
  await setDoc(
    doc(db, 'coupons', '__STAFF_SCHEDULES__'),
    {
      expiresAt: '01/01/2000',
      schedules: currentSchedulesMap,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  ).catch(() => { });
}

// ========================================================
// ORDER DISPATCH & STATUS OVERRIDES SYNC (Manager nhận đơn & phát cho nhân viên đi giao)
// ========================================================
const ORDERS_SYNC_KEY = '@fpt_orders_dispatch_sync_v1';

export interface OrderDispatchOverride {
  status?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  assignedStaffPhone?: string;
  cancelReason?: string;
  paymentStatus?: string;
  updatedAtMs?: number;
}

let currentOrdersSyncMap: Record<string, OrderDispatchOverride> = {};
let ordersSyncLoaded = false;
let ordersSyncListening = false;
const ordersSyncListeners = new Set<(map: Record<string, OrderDispatchOverride>) => void>();

function notifyOrdersSyncListeners() {
  const copy = { ...currentOrdersSyncMap };
  ordersSyncListeners.forEach((fn) => {
    try {
      fn(copy);
    } catch { }
  });
}

async function ensureOrdersSyncInitialized() {
  if (!ordersSyncLoaded) {
    ordersSyncLoaded = true;
    try {
      const saved = await AsyncStorage.getItem(ORDERS_SYNC_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          currentOrdersSyncMap = { ...parsed, ...currentOrdersSyncMap };
          notifyOrdersSyncListeners();
        }
      }
    } catch { }
  }

  if (!ordersSyncListening) {
    ordersSyncListening = true;
    try {
      onSnapshot(
        doc(db, 'coupons', '__ORDERS_SYNC__'),
        (snap) => {
          const remoteMap = snap.data()?.overrides;
          if (remoteMap && typeof remoteMap === 'object') {
            currentOrdersSyncMap = { ...currentOrdersSyncMap, ...remoteMap };
            AsyncStorage.setItem(ORDERS_SYNC_KEY, JSON.stringify(currentOrdersSyncMap)).catch(() => { });
            notifyOrdersSyncListeners();
          }
        },
        () => { }
      );
    } catch { }
  }
}

export function subscribeOrderOverrides(
  listener: (map: Record<string, OrderDispatchOverride>) => void
): () => void {
  ordersSyncListeners.add(listener);
  listener({ ...currentOrdersSyncMap });
  void ensureOrdersSyncInitialized();
  return () => {
    ordersSyncListeners.delete(listener);
  };
}

export async function saveOrderOverride(
  orderId: string,
  patch: Partial<OrderDispatchOverride>
): Promise<void> {
  const prev = currentOrdersSyncMap[orderId] || {};
  const merged: OrderDispatchOverride = {
    ...prev,
    ...patch,
    updatedAtMs: Date.now(),
  };
  currentOrdersSyncMap = {
    ...currentOrdersSyncMap,
    [orderId]: merged,
  };
  notifyOrdersSyncListeners();
  await AsyncStorage.setItem(ORDERS_SYNC_KEY, JSON.stringify(currentOrdersSyncMap)).catch(() => { });
  await setDoc(
    doc(db, 'coupons', '__ORDERS_SYNC__'),
    {
      expiresAt: '01/01/2000',
      overrides: currentOrdersSyncMap,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  ).catch(() => { });

  // Đồng thời thử cập nhật trực tiếp trên document orders/{orderId} nếu được phép
  const firestorePatch: Record<string, any> = {
    updatedAt: serverTimestamp(),
  };
  if (patch.status) firestorePatch.status = patch.status;
  if (patch.paymentStatus) firestorePatch.paymentStatus = patch.paymentStatus;
  if (patch.cancelReason) firestorePatch.cancelReason = patch.cancelReason;
  if (patch.assignedStaffId !== undefined) firestorePatch.assignedStaffId = patch.assignedStaffId;
  if (patch.assignedStaffName !== undefined) firestorePatch.assignedStaffName = patch.assignedStaffName;
  if (patch.assignedStaffPhone !== undefined) firestorePatch.assignedStaffPhone = patch.assignedStaffPhone;

  await updateDoc(doc(db, 'orders', orderId), firestorePatch).catch(() => { });
}
