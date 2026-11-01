import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { parseDeliveryFeeConfig, type DeliveryFeeConfig } from '../utils/deliveryFee';

const STORAGE_KEY = '@fpt_stores_config_sync_v2';

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
    } catch {}
  });
}

async function ensureInitialized() {
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
      }
    } catch {}
  }

  if (!firestoreListening) {
    firestoreListening = true;
    try {
      onSnapshot(
        doc(db, 'coupons', '__STORES_CONFIG__'),
        (snap) => {
          const data = snap.data();
          if (!data) return;
          const remoteTs =
            typeof data.updatedAtMs === 'number'
              ? data.updatedAtMs
              : typeof data.updatedAt?.toMillis === 'function'
                ? data.updatedAt.toMillis()
                : 0;

          if (remoteTs > 0 && currentState.updatedAtMs > remoteTs) {
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
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(currentState)).catch(() => {});
            notifyAll();
          }
        },
        () => {}
      );
    } catch {}
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
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(currentState)).catch(() => {});
  await setDoc(
    doc(db, 'coupons', '__STORES_CONFIG__'),
    {
      expiresAt: '01/01/2000',
      stores: sanitized,
      updatedAtMs: nowMs,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  ).catch(() => {});
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
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(currentState)).catch(() => {});
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
  ).catch(() => {});
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
    } catch {}
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
    } catch {}
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
            AsyncStorage.setItem(STAFF_MAP_KEY, JSON.stringify(currentStaffMap)).catch(() => {});
            notifyStaffListeners();
          }
        },
        () => {}
      );
    } catch {}
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
  await AsyncStorage.setItem(STAFF_MAP_KEY, JSON.stringify(currentStaffMap)).catch(() => {});
  await setDoc(
    doc(db, 'coupons', '__STAFF_STORES__'),
    {
      expiresAt: '01/01/2000',
      mapping: currentStaffMap,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  ).catch(() => {});
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
  } catch {}

  return null;
}
