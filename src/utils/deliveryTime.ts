export type DeliverySlot = {
  value: string;
  time: string;
  day: string;
  dayLabel: string;
  disabled: boolean;
};

const OFFSET = 7 * 60 * 60 * 1000;
const LEAD_TIME = 20 * 60 * 1000;
const pad = (value: number) => String(value).padStart(2, '0');

// Luôn hiện đầy đủ các khung giờ (08:30 - 22:00) của Hôm nay và Ngày mai.
// Các khung giờ đã qua trong ngày Hôm nay được đánh dấu disabled = true để làm mờ và khóa chọn.
export function getDeliverySlots(now = new Date()): DeliverySlot[] {
  const local = new Date(now.getTime() + OFFSET);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const slots: DeliverySlot[] = [];

  for (let dayIndex = 0; dayIndex < 2; dayIndex++) {
    const date = new Date(midnight + dayIndex * 86400000);
    const day = date.toISOString().slice(0, 10);
    const dayLabel = `${dayIndex === 0 ? 'Hôm nay' : 'Ngày mai'} ${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}`;

    // 510 = 08:30, 1320 = 22:00 (10h tối đóng cửa)
    for (let minutes = 510; minutes <= 1320; minutes += 15) {
      const timestamp = date.getTime() + minutes * 60000 - OFFSET;
      const disabled = timestamp < now.getTime() + LEAD_TIME;
      slots.push({
        value: new Date(timestamp).toISOString(),
        day,
        dayLabel,
        time: `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`,
        disabled,
      });
    }
  }

  return slots;
}

export function isDeliveryTimeAvailable(value: string, now = new Date()): boolean {
  return (
    value === 'asap' ||
    getDeliverySlots(now).some((slot) => slot.value === value && !slot.disabled)
  );
}

export function formatDeliveryTime(value: string, now = new Date()): string {
  const slots = getDeliverySlots(now);
  const slot =
    value === 'asap'
      ? slots.find((candidate) => !candidate.disabled)
      : slots.find((candidate) => candidate.value === value && !candidate.disabled);
  if (!slot) return 'Chọn lại thời gian nhận';
  return `${value === 'asap' ? 'Sớm nhất: ' : ''}${slot.time} • ${slot.dayLabel}`;
}
