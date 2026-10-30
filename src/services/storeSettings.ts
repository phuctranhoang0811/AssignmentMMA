import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { parseDeliveryFeeConfig } from '../utils/deliveryFee';
import { defaultStoreSettings, storeStatus, type StoreSettings, type StoreStatus } from '../utils/storeHours';

// Anything that is not a well-formed settings document means "no hours set yet": open all day.
export function parseStoreSettings(data: Record<string, unknown> | undefined): StoreSettings {
  if (!data || typeof data.acceptingOrders !== 'boolean' || typeof data.openTime !== 'string' || typeof data.closeTime !== 'string') {
    return defaultStoreSettings;
  }
  return { acceptingOrders: data.acceptingOrders, openTime: data.openTime, closeTime: data.closeTime,
    closedMessage: typeof data.closedMessage === 'string' ? data.closedMessage : '', delivery: parseDeliveryFeeConfig(data.delivery) };
}

/** Live store hours and the pause switch. Re-evaluated every 30 seconds so "closed" appears without a refresh. */
export function useStoreStatus(): StoreStatus & { settings: StoreSettings } {
  const [settings, setSettings] = useState<StoreSettings>(defaultStoreSettings);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => onSnapshot(doc(db, 'settings', 'store'),
    snapshot => setSettings(parseStoreSettings(snapshot.data())),
    () => setSettings(defaultStoreSettings)), []);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return { ...storeStatus(settings, now), settings };
}
