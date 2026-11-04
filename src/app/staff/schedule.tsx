import React, { useEffect, useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, ChevronLeft, ChevronRight, Clock, RotateCcw, Store } from 'lucide-react-native';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../state/ToastContext';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { colors } from '../../theme/colors';
import {
  subscribeStaffSchedules,
  subscribeStaffStoresMap,
  subscribeStoresConfig,
  getStaffShiftOnDate,
  formatScheduleDateKey,
  DEFAULT_STORE_BRANCHES,
  type StaffCustomizationEntry,
  type StaffScheduleRecord,
  type SyncedStoreBranch,
  type ShiftType,
} from '../../services/storeSync';

const DOW_LABELS = [
  'Chủ Nhật',
  'Thứ 2',
  'Thứ 3',
  'Thứ 4',
  'Thứ 5',
  'Thứ 6',
  'Thứ 7',
] as const;

const SHIFT_META: Record<
  ShiftType,
  { title: string; time: string; color: string; bg: string; border: string }
> = {
  MORNING: {
    title: 'Ca Sáng',
    time: '08:00 - 14:00',
    color: colors.primary,
    bg: colors.primarySoft,
    border: '#FECACA',
  },
  EVENING: {
    title: 'Ca Chiều / Tối',
    time: '14:00 - 22:00',
    color: colors.primary,
    bg: colors.primarySoft,
    border: '#FECACA',
  },
  FULL: {
    title: 'Full ca (Cả ngày)',
    time: '08:00 - 22:00',
    color: colors.primary,
    bg: colors.primarySoft,
    border: '#FECACA',
  },
  OFF: {
    title: 'Nghỉ (OFF)',
    time: 'Không có ca trực',
    color: colors.textSecondary,
    bg: colors.surfaceAlt,
    border: colors.border,
  },
};

function getWeekDatesByOffset(now: Date, weekOffset: number): Date[] {
  const day = now.getDay(); // 0=CN, 1=T2...
  const diffToMonday = (day === 0 ? -6 : 1 - day) + weekOffset * 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
  const list: Date[] = [];
  for (let i = 0; i < 7; i++) {
    list.push(
      new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
    );
  }
  return list;
}

function formatShortDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function StaffScheduleScreen() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const uid = user?.id;

  const [staffMap, setStaffMap] = useState<Record<string, StaffCustomizationEntry>>({});
  const [schedulesMap, setSchedulesMap] = useState<Record<string, StaffScheduleRecord>>({});
  const [storesList, setStoresList] = useState<SyncedStoreBranch[]>(DEFAULT_STORE_BRANCHES);
  const [weekOffset, setWeekOffset] = useState<number>(0);

  useEffect(() => {
    const unsubStaff = subscribeStaffStoresMap((map) => setStaffMap(map));
    const unsubSchedules = subscribeStaffSchedules((map) => setSchedulesMap(map));
    const unsubStores = subscribeStoresConfig((state) => {
      if (state.stores?.length > 0) setStoresList(state.stores);
    });
    return () => {
      unsubStaff();
      unsubSchedules();
      unsubStores();
    };
  }, []);

  const myStaffEntry = uid ? staffMap[uid] : undefined;
  const effectiveStoreId = myStaffEntry?.storeId || user?.storeId;
  const matchedStore = storesList.find((s) => s.id === effectiveStoreId);
  const effectiveStoreName =
    myStaffEntry?.storeName || matchedStore?.name || user?.storeName || 'Pizza FPT';

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const todayKey = formatScheduleDateKey(now);
  const mySchedule = uid ? schedulesMap[uid] : undefined;
  const todayShift: ShiftType = getStaffShiftOnDate(mySchedule, now);
  const todayMeta = SHIFT_META[todayShift];

  const isDateInCurrentMonth = (d: Date) =>
    d.getMonth() === currentMonth && d.getFullYear() === currentYear;

  const rawWeekDates = getWeekDatesByOffset(now, weekOffset);
  const weekDates = rawWeekDates.filter(isDateInCurrentMonth);

  const canGoPrevWeek = getWeekDatesByOffset(now, weekOffset - 1).some(isDateInCurrentMonth);
  const canGoNextWeek = getWeekDatesByOffset(now, weekOffset + 1).some(isDateInCurrentMonth);

  const currentWeekDates = getWeekDatesByOffset(now, 0).filter(isDateInCurrentMonth);
  const currentWeekWorkingCount = currentWeekDates.filter(
    (d) => getStaffShiftOnDate(mySchedule, d) !== 'OFF'
  ).length;
  const selectedWeekWorkingCount = weekDates.filter(
    (d) => getStaffShiftOnDate(mySchedule, d) !== 'OFF'
  ).length;

  const firstDayOfSlice = weekDates[0] || rawWeekDates[0];
  const lastDayOfSlice = weekDates[weekDates.length - 1] || rawWeekDates[6];
  const weekStartStr = formatShortDate(firstDayOfSlice);
  const weekEndStr = `${formatShortDate(lastDayOfSlice)}/${lastDayOfSlice.getFullYear()}`;
  const monthLabel = `Tháng ${String(currentMonth + 1).padStart(2, '0')}/${currentYear}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader
        title="Lịch làm việc của tôi"
        subtitle={`${effectiveStoreName} • ${user?.fullname || 'Nhân viên'}`}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Thanh chuyển tuần trong tháng hiện tại */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 12,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
                if (!canGoPrevWeek) {
                  showToast({
                    message: `Chỉ được xem lịch làm việc trong ${monthLabel}!`,
                    type: 'info',
                  });
                  return;
                }
                setWeekOffset((prev) => prev - 1);
              }}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: canGoPrevWeek ? 1 : 0.35,
              }}
            >
              <ChevronLeft size={18} color={colors.textPrimary} />
            </TouchableOpacity>

            <View style={{ alignItems: 'center', flex: 1, paddingHorizontal: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AppText variant="cardTitle" color={colors.primary}>
                  Lịch {monthLabel}
                </AppText>
                <View
                  style={{
                    backgroundColor: colors.primarySoft,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 999,
                  }}
                >
                  <AppText variant="captionSemiBold" color={colors.primary}>
                    {selectedWeekWorkingCount}/{weekDates.length} ngày có ca
                  </AppText>
                </View>
              </View>
              <AppText variant="small" color={colors.textSecondary} style={{ marginTop: 2 }}>
                Từ {weekStartStr} đến {weekEndStr}
              </AppText>
            </View>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
                if (!canGoNextWeek) {
                  showToast({
                    message: `Chỉ được xem lịch trong ${monthLabel}, không thể xem tháng sau!`,
                    type: 'info',
                  });
                  return;
                }
                setWeekOffset((prev) => prev + 1);
              }}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: canGoNextWeek ? 1 : 0.35,
              }}
            >
              <ChevronRight size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {weekOffset !== 0 && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setWeekOffset(0)}
              style={{
                marginTop: 10,
                paddingVertical: 8,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 6,
                backgroundColor: colors.primarySoft,
                borderWidth: 1,
                borderColor: colors.primary,
              }}
            >
              <RotateCcw size={14} color={colors.primary} />
              <AppText variant="captionSemiBold" color={colors.primary}>
                Quay lại ngày hôm nay
              </AppText>
            </TouchableOpacity>
          )}
        </View>

        {/* Bảng lịch làm việc theo tuần đang chọn */}
        <AppText
          variant="cardTitle"
          color={colors.textPrimary}
          style={{ marginBottom: 10 }}
        >
          Chi tiết ca làm việc ({weekStartStr} – {weekEndStr})
        </AppText>

        {weekDates.map((d) => {
          const dKey = formatScheduleDateKey(d);
          const isToday = dKey === todayKey;
          const shift = getStaffShiftOnDate(mySchedule, d);
          const meta = SHIFT_META[shift];
          const dowLabel = DOW_LABELS[d.getDay()];
          const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(
            d.getMonth() + 1
          ).padStart(2, '0')}/${d.getFullYear()}`;

          return (
            <View
              key={dKey}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: isToday ? colors.primarySoft : '#FFFFFF',
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 12,
                marginBottom: 9,
                borderWidth: isToday ? 1.5 : 1,
                borderColor: isToday ? colors.primary : colors.border,
              }}
            >
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AppText
                    variant="bodySemiBold"
                    color={isToday ? colors.primary : colors.textPrimary}
                  >
                    {dowLabel}
                  </AppText>
                  {isToday && (
                    <View
                      style={{
                        backgroundColor: colors.primary,
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        borderRadius: 999,
                      }}
                    >
                      <AppText variant="small" color="#FFFFFF" style={{ fontWeight: '700' }}>
                        Hôm nay
                      </AppText>
                    </View>
                  )}
                </View>
                <AppText variant="small" color={colors.textSecondary} style={{ marginTop: 2 }}>
                  Ngày {dateStr}
                </AppText>
              </View>

              <View
                style={{
                  backgroundColor: meta.bg,
                  borderWidth: 1,
                  borderColor: meta.border,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 10,
                  alignItems: 'flex-end',
                }}
              >
                <AppText variant="captionSemiBold" color={meta.color}>
                  {meta.title}
                </AppText>
                <AppText variant="small" color={meta.color}>
                  {meta.time}
                </AppText>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

