export type DeliverySlot = { value: string; time: string; day: string; dayLabel: string };
const OFFSET = 7 * 60 * 60 * 1000;
const LEAD_TIME = 45 * 60 * 1000;
const pad = (value: number) => String(value).padStart(2, '0');

// Store hours use Vietnam time, independently of the phone's time zone.
export function getDeliverySlots(now = new Date()): DeliverySlot[] {
  const local = new Date(now.getTime() + OFFSET);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const slots: DeliverySlot[] = [];
  for (let dayIndex = 0; dayIndex < 3; dayIndex++) {
    const date = new Date(midnight + dayIndex * 86400000);
    const day = date.toISOString().slice(0, 10);
    const dayLabel = `${dayIndex === 0 ? 'Hôm nay' : dayIndex === 1 ? 'Ngày mai' : 'Ngày kia'} ${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}`;
    for (let minutes = 630; minutes <= 1290; minutes += 15) {
      const timestamp = date.getTime() + minutes * 60000 - OFFSET;
      if (timestamp < now.getTime() + LEAD_TIME) continue;
      slots.push({ value: new Date(timestamp).toISOString(), day, dayLabel,
        time: `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}` });
    }
  }
  return slots;
}

export function isDeliveryTimeAvailable(value: string, now = new Date()): boolean {
  return value === 'asap' || getDeliverySlots(now).some(slot => slot.value === value);
}

export function formatDeliveryTime(value: string, now = new Date()): string {
  const slots = getDeliverySlots(now);
  const slot = value === 'asap' ? slots[0] : slots.find(candidate => candidate.value === value);
  if (!slot) return 'Chọn lại thời gian nhận';
  return `${value === 'asap' ? 'Sớm nhất: ' : ''}${slot.time} • ${slot.dayLabel}`;
}
