export type LatLng = { lat: number; lng: number };

/**
 * Shipping price list for orders the store delivers itself. Absent = no shipping fee is charged
 * (the store has not set one up yet), so a fresh install never changes what customers pay.
 */
export type DeliveryFeeConfig = {
  storeLat: number; storeLng: number;
  /** Distance covered by the base fee, in km. */
  baseKm: number; baseFee: number;
  /** Charged for every started km beyond baseKm. */
  perKm: number;
  /** Farther than this is not delivered at all. */
  maxKm: number;
  /** Orders worth at least this much (after discount) ship free. 0 or absent = never. */
  freeOver?: number;
};

// Straight-line distance understates the ride; a flat factor is close enough for a price list.
const ROAD_FACTOR = 1.3;
const EARTH_KM = 6371;
const radians = (degrees: number) => degrees * Math.PI / 180;

/** Estimated road distance in km, rounded up to 0.1. */
export function roadDistanceKm(from: LatLng, to: LatLng): number {
  const dLat = radians(to.lat - from.lat);
  const dLng = radians(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLng / 2) ** 2;
  const straight = 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
  return Math.ceil(straight * ROAD_FACTOR * 10) / 10;
}

/** `fee` is what the customer pays; `riderPay` is what the rider earns for the distance, even when shipping is free for the customer. */
export type DeliveryFeeQuote = { distanceKm: number; fee: number; riderPay: number; outOfRange: boolean; free: boolean };

/** `orderValue` is the food total after discount; `freeShipping` is a free-shipping voucher. */
export function deliveryFeeQuote(config: DeliveryFeeConfig, to: LatLng, orderValue: number, freeShipping = false): DeliveryFeeQuote {
  const distanceKm = roadDistanceKm({ lat: config.storeLat, lng: config.storeLng }, to);
  const outOfRange = distanceKm > config.maxKm;
  const free = freeShipping || (!!config.freeOver && orderValue >= config.freeOver);
  const riderPay = config.baseFee + Math.ceil(Math.max(0, distanceKm - config.baseKm)) * config.perKm;
  return { distanceKm, fee: free ? 0 : riderPay, riderPay, outOfRange, free };
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Reads the price list from a stored document; anything incomplete means "no shipping fee configured". */
export function parseDeliveryFeeConfig(data: unknown): DeliveryFeeConfig | undefined {
  const value = data as Record<string, unknown> | undefined;
  if (!value || !isNumber(value.storeLat) || !isNumber(value.storeLng) || !isNumber(value.baseKm) || !isNumber(value.baseFee) ||
    !isNumber(value.perKm) || !isNumber(value.maxKm)) return undefined;
  return { storeLat: value.storeLat, storeLng: value.storeLng, baseKm: value.baseKm, baseFee: value.baseFee, perKm: value.perKm,
    maxKm: value.maxKm, ...(isNumber(value.freeOver) && value.freeOver > 0 ? { freeOver: value.freeOver } : {}) };
}
