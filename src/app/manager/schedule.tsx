import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Calendar,
  Clock,
  UserPlus,
  X,
  Check,
  Phone,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Lock,
} from 'lucide-react-native';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../state/ToastContext';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { colors } from '../../theme/colors';
import {
  subscribeStoresConfig,
  subscribeStaffStoresMap,
  subscribeStaffSchedules,
  saveStaffSchedule,
  saveShiftStaffForDay,
  formatScheduleDateKey,
  getStaffShiftOnDate,
  DEFAULT_STORE_BRANCHES,
  DEFAULT_WEEKLY_DAYS,
  type SyncedStoreBranch,
  type StaffCustomizationEntry,
  type StaffScheduleRecord,
  type ShiftType,
} from '../../services/storeSync';

const DOW_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;
const DOW_FULL = [
  'Chủ Nhật',
  'Thứ 2',
  'Thứ 3',
  'Thứ 4',
  'Thứ 5',
  'Thứ 6',
  'Thứ 7',
] as const;

const DAY_PILL_WIDTH = 58;
const DAY_PILL_GAP = 8;
const DAY_ITEM_STRIDE = DAY_PILL_WIDTH + DAY_PILL_GAP;
const SCROLL_HORIZONTAL_PADDING = 14;

const WORK_SHIFTS: {
  key: Exclude<ShiftType, 'OFF'>;
  title: string;
  time: string;
  endHour: number;
  color: string;
  bg: string;
  border: string;
}[] = [
  {
    key: 'MORNING',
    title: 'Ca Sáng',
    time: '08:00 - 14:00',
    endHour: 14,
    color: '#1D4ED8',
    bg: '#EFF6FF',
    border: '#BFDBFE',
  },
  {
    key: 'EVENING',
    title: 'Ca Chiều / Tối',
    time: '14:00 - 22:00',
    endHour: 22,
    color: '#B45309',
    bg: '#FFFBEB',
    border: '#FDE68A',
  },
  {
    key: 'FULL',
    title: 'Full ca (Cả ngày)',
    time: '08:00 - 22:00',
    endHour: 22,
    color: '#15803D',
    bg: '#F0FDF4',
    border: '#BBF7D0',
  },
];

export default function ManagerScheduleScreen() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth(); // 0..11
  const todayDateNum = today.getDate(); // 1..31
  const todayDateKey = formatScheduleDateKey(today);

  const [storesList, setStoresList] = useState<SyncedStoreBranch[]>(DEFAULT_STORE_BRANCHES);
  const [assignedStoreId, setAssignedStoreId] = useState<string | null>(user?.storeId || null);

  // Tháng / năm đang xem và ngày đang chọn (mặc định là Hôm nay)
  const [viewYear, setViewYear] = useState<number>(todayYear);
  const [viewMonth, setViewMonth] = useState<number>(todayMonth);
  const [selectedDayNum, setSelectedDayNum] = useState<number>(todayDateNum);
  const [monthPickerOpen, setMonthPickerOpen] = useState<boolean>(false);

  const dayScrollRef = useRef<any>(null);
  const [stripWidth, setStripWidth] = useState<number>(360);

  const [loading, setLoading] = useState(true);
  const [rawUsers, setRawUsers] = useState<Record<string, any>[]>([]);
  const [staffMap, setStaffMap] = useState<Record<string, StaffCustomizationEntry>>({});
  const [schedulesMap, setSchedulesMap] = useState<Record<string, StaffScheduleRecord>>({});

  // Modal chọn nhân viên thêm vào Ca của ngày đang chọn
  const [addingShiftKey, setAddingShiftKey] = useState<Exclude<ShiftType, 'OFF'> | null>(null);
  const [pickedStaffIds, setPickedStaffIds] = useState<string[]>([]);
  const [savingShift, setSavingShift] = useState(false);

  // Cuộn đưa ngày mục tiêu ra chính giữa thanh ngang
  const centerDayInStrip = useCallback(
    (dayNumber: number, containerW: number, animated = true) => {
      if (!dayScrollRef.current || containerW <= 0) return;
      const itemCenter =
        SCROLL_HORIZONTAL_PADDING + (dayNumber - 1) * DAY_ITEM_STRIDE + DAY_PILL_WIDTH / 2;
      const targetX = Math.max(0, itemCenter - containerW / 2);
      dayScrollRef.current.scrollTo({ x: targetX, animated });
    },
    []
  );

  // Tự động cuộn ngày hôm nay (hoặc ngày đang chọn) ra giữa màn hình khi mở
  useEffect(() => {
    const timer = setTimeout(() => {
      centerDayInStrip(selectedDayNum, stripWidth, true);
    }, 120);
    return () => clearTimeout(timer);
  }, [viewYear, viewMonth, selectedDayNum, stripWidth, centerDayInStrip]);

  const handleStripLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - stripWidth) > 2) {
      setStripWidth(w);
      setTimeout(() => {
        centerDayInStrip(selectedDayNum, w, false);
      }, 60);
    }
  };

  useEffect(() => {
    const unsubStores = subscribeStoresConfig((state) => {
      const active = state.stores.filter((s) => s.isActive !== false);
      const list = active.length > 0 ? active : state.stores;
      if (list.length > 0) setStoresList(list);
    });
    const unsubStaff = subscribeStaffStoresMap((map) => {
      setStaffMap(map);
      if (user?.id && map[user.id]?.storeId) {
        setAssignedStoreId(map[user.id].storeId!);
      } else if (user?.storeId) {
        setAssignedStoreId(user.storeId);
      }
    });
    const unsubSchedules = subscribeStaffSchedules((map) => {
      setSchedulesMap(map);
    });

    return () => {
      unsubStores();
      unsubStaff();
      unsubSchedules();
    };
  }, [user?.id, user?.storeId]);

  useEffect(() => {
    const unsubUsers = onSnapshot(
      query(collection(db, 'users')),
      (snap) => {
        const list: Record<string, any>[] = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        setRawUsers(list);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return () => unsubUsers();
  }, []);

  const currentStore =
    storesList.find((s) => s.id === assignedStoreId) || storesList[0];

  // Số ngày trong tháng đang xem (28, 29, 30 hoặc 31 ngày)
  const daysInViewMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const safeSelectedDayNum = Math.min(selectedDayNum, daysInViewMonth);
  const selectedDateObj = new Date(viewYear, viewMonth, safeSelectedDayNum);
  const selectedDateKey = formatScheduleDateKey(selectedDateObj);
  const selectedDowName = DOW_FULL[selectedDateObj.getDay()];
  const isSelectedToday = selectedDateKey === todayDateKey;

  const todayMidnight = new Date(todayYear, todayMonth, todayDateNum, 0, 0, 0, 0);
  const selectedMidnight = new Date(viewYear, viewMonth, safeSelectedDayNum, 0, 0, 0, 0);
  const isPastDate = selectedMidnight.getTime() < todayMidnight.getTime();
  const nowMinutes = today.getHours() * 60 + today.getMinutes();

  const getShiftLockInfo = (shiftKey: Exclude<ShiftType, 'OFF'>) => {
    if (isPastDate) {
      return { locked: true, label: 'Đã qua ngày' };
    }
    if (isSelectedToday) {
      const meta = WORK_SHIFTS.find((w) => w.key === shiftKey);
      if (meta && nowMinutes >= meta.endHour * 60) {
        return { locked: true, label: 'Đã qua ca' };
      }
    }
    return { locked: false, label: '' };
  };

  const monthDaysList = Array.from({ length: daysInViewMonth }, (_, i) => {
    const dayNum = i + 1;
    const dObj = new Date(viewYear, viewMonth, dayNum);
    const dKey = formatScheduleDateKey(dObj);
    const dowLabel = DOW_SHORT[dObj.getDay()];
    return {
      dayNum,
      dObj,
      dKey,
      dowLabel,
      isToday: dKey === todayDateKey,
    };
  });

  const branchStaff = rawUsers
    .filter((u) => {
      const custom = staffMap[u.id];
      if (custom?.deleted || u.role === 'BLACKLISTED' || u.role === 'ROLE_RIDER') return false;
      const isStaff = u.role === 'EMPLOYEE' || u.role === 'ROLE_KITCHEN';
      if (!isStaff) return false;
      const uStoreId = custom?.storeId !== undefined ? custom.storeId : u.storeId;
      if (uStoreId && currentStore) {
        return uStoreId === currentStore.id;
      }
      return true;
    })
    .map((u) => {
      const custom = staffMap[u.id];
      const schedRecord = schedulesMap[u.id];
      const days: Record<string, ShiftType> = {
        ...DEFAULT_WEEKLY_DAYS,
        ...(schedRecord?.days || {}),
      };
      return {
        id: u.id,
        fullname: String(u.fullName || u.fullname || u.name || 'Nhân viên'),
        phone: String(custom?.phone || u.phone || ''),
        days,
        schedRecord,
      };
    });

  // Chỉ hiển thị những nhân viên CHƯA được xếp vào bất kỳ ca nào trong ngày đang chọn
  const availableStaffForDate = branchStaff.filter((s) => {
    const sh = getStaffShiftOnDate(s.schedRecord, selectedDateObj);
    return !sh || sh === 'OFF';
  });

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
      setSelectedDayNum(1);
    } else {
      const nextM = viewMonth - 1;
      setViewMonth(nextM);
      setSelectedDayNum(
        viewYear === todayYear && nextM === todayMonth ? todayDateNum : 1
      );
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
      setSelectedDayNum(1);
    } else {
      const nextM = viewMonth + 1;
      setViewMonth(nextM);
      setSelectedDayNum(
        viewYear === todayYear && nextM === todayMonth ? todayDateNum : 1
      );
    }
  };

  const handleJumpToToday = () => {
    setViewYear(todayYear);
    setViewMonth(todayMonth);
    setSelectedDayNum(todayDateNum);
    setMonthPickerOpen(false);
    setTimeout(() => {
      centerDayInStrip(todayDateNum, stripWidth, true);
    }, 80);
  };

  const handleOpenAddStaffModal = (shiftKey: Exclude<ShiftType, 'OFF'>) => {
    const lockInfo = getShiftLockInfo(shiftKey);
    if (lockInfo.locked) {
      showToast({
        message: `${lockInfo.label} nên không thể thay đổi lịch làm việc nữa!`,
        type: 'error',
      });
      return;
    }
    setPickedStaffIds([]);
    setAddingShiftKey(shiftKey);
  };

  const togglePickStaff = (staffId: string) => {
    setPickedStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  };

  const handleConfirmSaveShift = async () => {
    if (!addingShiftKey) return;
    if (pickedStaffIds.length === 0) {
      showToast({
        message: 'Vui lòng tick chọn ít nhất 1 nhân viên để thêm vào ca!',
        type: 'error',
      });
      return;
    }
    setSavingShift(true);
    try {
      await saveShiftStaffForDay(selectedDateKey, addingShiftKey, pickedStaffIds);
      const shiftMeta = WORK_SHIFTS.find((s) => s.key === addingShiftKey);
      showToast({
        message: `Đã thêm ${pickedStaffIds.length} nhân viên vào ${shiftMeta?.title} ngày ${String(
          safeSelectedDayNum
        ).padStart(2, '0')}/${String(viewMonth + 1).padStart(2, '0')}!`,
        type: 'success',
      });
      setAddingShiftKey(null);
    } finally {
      setSavingShift(false);
    }
  };

  const handleRemoveStaffFromDay = async (
    staff: (typeof branchStaff)[number],
    shiftKey: Exclude<ShiftType, 'OFF'>
  ) => {
    const lockInfo = getShiftLockInfo(shiftKey);
    if (lockInfo.locked) {
      showToast({
        message: `${lockInfo.label} nên không thể thay đổi lịch làm việc nữa!`,
        type: 'error',
      });
      return;
    }
    const nextDays = {
      ...staff.days,
      [selectedDateKey]: 'OFF' as ShiftType,
    };
    await saveStaffSchedule(staff.id, nextDays);
    showToast({
      message: `Đã gỡ ${staff.fullname} khỏi lịch ngày ${String(safeSelectedDayNum).padStart(
        2,
        '0'
      )}/${String(viewMonth + 1).padStart(2, '0')}`,
      type: 'info',
    });
  };

  const totalScheduledOnSelectedDate = branchStaff.filter((s) => {
    const sh = getStaffShiftOnDate(s.schedRecord, selectedDateObj);
    return sh && sh !== 'OFF';
  }).length;

  const activeShiftMeta = WORK_SHIFTS.find((s) => s.key === addingShiftKey);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader
        title="Xếp lịch làm việc"
        subtitle={currentStore?.name || 'Chi nhánh Pizza FPT'}
        showBack={false}
      />

      {/* KHUNG CHỌN THÁNG & THANH NGÀY KÉO NGANG TRỌN 1 THÁNG */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          paddingTop: 10,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
        onLayout={handleStripLayout}
      >
        {/* Hàng trên: Chọn Tháng / Năm + Nút Về Hôm nay */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 14,
            marginBottom: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={handlePrevMonth}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronLeft size={18} color={colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setMonthPickerOpen((prev) => !prev)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                height: 32,
                borderRadius: 8,
                backgroundColor: colors.primarySoft,
              }}
            >
              <Calendar size={15} color={colors.primary} />
              <AppText variant="bodySemiBold" color={colors.primary}>
                Tháng {String(viewMonth + 1).padStart(2, '0')} / {viewYear}
              </AppText>
              {monthPickerOpen ? (
                <ChevronUp size={16} color={colors.primary} />
              ) : (
                <ChevronDown size={16} color={colors.primary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={handleNextMonth}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronRight size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleJumpToToday}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: isSelectedToday ? colors.primary : colors.surfaceAlt,
              borderWidth: 1,
              borderColor: isSelectedToday ? colors.primary : colors.border,
            }}
          >
            <AppText
              variant="small"
              color={isSelectedToday ? '#FFFFFF' : colors.primary}
              style={{ fontWeight: '700' }}
            >
              Hôm nay ({String(todayDateNum).padStart(2, '0')}/{String(todayMonth + 1).padStart(2, '0')})
            </AppText>
          </TouchableOpacity>
        </View>

        {/* Bảng xổ xuống chọn nhanh Tháng 1 -> Tháng 12 */}
        {monthPickerOpen && (
          <View
            style={{
              marginHorizontal: 14,
              marginBottom: 12,
              padding: 12,
              borderRadius: 14,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <TouchableOpacity
                onPress={() => setViewYear((y) => y - 1)}
                style={{ paddingHorizontal: 10, paddingVertical: 4 }}
              >
                <AppText variant="captionSemiBold" color={colors.primary}>
                  ← Năm {viewYear - 1}
                </AppText>
              </TouchableOpacity>
              <AppText variant="bodySemiBold" color={colors.textPrimary}>
                Năm {viewYear}
              </AppText>
              <TouchableOpacity
                onPress={() => setViewYear((y) => y + 1)}
                style={{ paddingHorizontal: 10, paddingVertical: 4 }}
              >
                <AppText variant="captionSemiBold" color={colors.primary}>
                  Năm {viewYear + 1} →
                </AppText>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {Array.from({ length: 12 }, (_, mIdx) => {
                const isCurrentMonth = mIdx === viewMonth;
                return (
                  <TouchableOpacity
                    key={mIdx}
                    activeOpacity={0.75}
                    onPress={() => {
                      setViewMonth(mIdx);
                      const nextDay =
                        viewYear === todayYear && mIdx === todayMonth ? todayDateNum : 1;
                      setSelectedDayNum(nextDay);
                      setMonthPickerOpen(false);
                    }}
                    style={{
                      width: '23%',
                      flexGrow: 1,
                      alignItems: 'center',
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: isCurrentMonth ? colors.primary : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: isCurrentMonth ? colors.primary : colors.border,
                    }}
                  >
                    <AppText
                      variant="small"
                      color={isCurrentMonth ? '#FFFFFF' : colors.textPrimary}
                      style={{ fontWeight: isCurrentMonth ? '700' : '500' }}
                    >
                      Tháng {mIdx + 1}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Thanh Ngày kéo ngang 1 tháng (01 -> 30/31) */}
        <ScrollView
          ref={dayScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: SCROLL_HORIZONTAL_PADDING,
            gap: DAY_PILL_GAP,
          }}
        >
          {monthDaysList.map((item) => {
            const isSelected = item.dayNum === safeSelectedDayNum;
            const isToday = item.isToday;
            const countOnDay = branchStaff.filter((s) => {
              const sh = getStaffShiftOnDate(s.schedRecord, item.dObj);
              return sh && sh !== 'OFF';
            }).length;

            // Ngày hôm nay và ngày đang chọn nổi bật bằng màu chủ đạo (colors.primary)
            const bg = isSelected
              ? colors.primary
              : isToday
                ? colors.primarySoft
                : colors.surface;
            const borderCol = isSelected || isToday ? colors.primary : colors.border;

            return (
              <TouchableOpacity
                key={item.dKey}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedDayNum(item.dayNum);
                  centerDayInStrip(item.dayNum, stripWidth, true);
                }}
                style={{
                  width: DAY_PILL_WIDTH,
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderRadius: 14,
                  backgroundColor: bg,
                  borderWidth: isSelected || isToday ? 1.8 : 1,
                  borderColor: borderCol,
                }}
              >
                <AppText
                  variant="small"
                  color={
                    isSelected
                      ? '#FFFFFF'
                      : isToday
                        ? colors.primary
                        : colors.textSecondary
                  }
                  style={{ fontSize: 10, fontWeight: isToday || isSelected ? '700' : '500' }}
                >
                  {isToday ? 'H.Nay' : item.dowLabel}
                </AppText>

                <AppText
                  variant="bodySemiBold"
                  color={
                    isSelected
                      ? '#FFFFFF'
                      : isToday
                        ? colors.primary
                        : colors.textPrimary
                  }
                  style={{ marginTop: 2, fontSize: 15 }}
                >
                  {String(item.dayNum).padStart(2, '0')}
                </AppText>

                <AppText
                  variant="small"
                  color={
                    isSelected
                      ? '#FFFFFF'
                      : countOnDay > 0
                        ? '#15803D'
                        : isToday
                          ? colors.primary
                          : colors.textSecondary
                  }
                  style={{ fontSize: 9, marginTop: 2, fontWeight: countOnDay > 0 ? '700' : '400' }}
                >
                  {countOnDay > 0 ? `${countOnDay} NV` : 'Trống'}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Tiêu đề Ngày đang chọn */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: isSelectedToday ? colors.primary : colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Calendar size={18} color={colors.primary} />
              <AppText variant="cardTitle" color={colors.textPrimary}>
                {selectedDowName}, {String(safeSelectedDayNum).padStart(2, '0')}/
                {String(viewMonth + 1).padStart(2, '0')}/{viewYear}
                {isSelectedToday ? ' (Hôm nay)' : ''}
              </AppText>
            </View>
            <AppText variant="captionSemiBold" color={colors.primary}>
              Đã xếp: {totalScheduledOnSelectedDate} NV
            </AppText>
          </View>

          {/* 3 Khung Ca làm việc của ngày đang chọn */}
          {WORK_SHIFTS.map((shift) => {
            const staffInThisShift = branchStaff.filter(
              (s) => getStaffShiftOnDate(s.schedRecord, selectedDateObj) === shift.key
            );
            const lockInfo = getShiftLockInfo(shift.key);

            return (
              <View
                key={shift.key}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: lockInfo.locked ? 0.88 : 1,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View
                        style={{
                          backgroundColor: shift.bg,
                          borderColor: shift.border,
                          borderWidth: 1,
                          paddingHorizontal: 10,
                          paddingVertical: 3,
                          borderRadius: 999,
                        }}
                      >
                        <AppText variant="captionSemiBold" color={shift.color}>
                          {shift.title}
                        </AppText>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Clock size={13} color={colors.textSecondary} />
                        <AppText variant="small" color={colors.textSecondary}>
                          {shift.time}
                        </AppText>
                      </View>
                    </View>
                  </View>

                  {lockInfo.locked ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor: colors.surfaceAlt,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Lock size={12} color={colors.textSecondary} />
                      <AppText variant="small" color={colors.textSecondary} style={{ fontWeight: '600' }}>
                        {lockInfo.label}
                      </AppText>
                    </View>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleOpenAddStaffModal(shift.key)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor: colors.primary,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                      }}
                    >
                      <UserPlus size={14} color="#FFFFFF" />
                      <AppText variant="small" color="#FFFFFF" style={{ fontWeight: '700' }}>
                        + Thêm nhân viên
                      </AppText>
                    </TouchableOpacity>
                  )}
                </View>

                {staffInThisShift.length === 0 ? (
                  <TouchableOpacity
                    activeOpacity={lockInfo.locked ? 1 : 0.75}
                    onPress={() => {
                      if (!lockInfo.locked) handleOpenAddStaffModal(shift.key);
                    }}
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: 12,
                      paddingVertical: 16,
                      paddingHorizontal: 12,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderStyle: 'dashed',
                      borderColor: colors.border,
                    }}
                  >
                    <AppText variant="small" color={colors.textSecondary}>
                      Chưa có nhân viên trực {shift.title} ngày{' '}
                      {String(safeSelectedDayNum).padStart(2, '0')}/
                      {String(viewMonth + 1).padStart(2, '0')}
                    </AppText>
                    {lockInfo.locked ? (
                      <AppText
                        variant="small"
                        color={colors.textSecondary}
                        style={{ marginTop: 2 }}
                      >
                        ({lockInfo.label} – Không thể chỉnh sửa)
                      </AppText>
                    ) : (
                      <AppText
                        variant="small"
                        color={colors.primary}
                        style={{ marginTop: 2, fontWeight: '600' }}
                      >
                        Bấm &quot;+ Thêm nhân viên&quot; để chọn người vào ca
                      </AppText>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={{ gap: 8 }}>
                    {staffInThisShift.map((staff) => (
                      <View
                        key={staff.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: colors.surface,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <AppText variant="bodySemiBold" color={colors.textPrimary}>
                            {staff.fullname}
                          </AppText>
                          {!!staff.phone && (
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                marginTop: 2,
                              }}
                            >
                              <Phone size={11} color={colors.textSecondary} />
                              <AppText variant="small" color={colors.textSecondary}>
                                {staff.phone}
                              </AppText>
                            </View>
                          )}
                        </View>

                        {lockInfo.locked ? (
                          <View
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 6,
                              backgroundColor: colors.surfaceAlt,
                            }}
                          >
                            <AppText variant="small" color={colors.textSecondary}>
                              Đã chốt
                            </AppText>
                          </View>
                        ) : (
                          <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={() => handleRemoveStaffFromDay(staff, shift.key)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 8,
                              backgroundColor: '#FEF2F2',
                              borderWidth: 1,
                              borderColor: '#FECACA',
                            }}
                          >
                            <Trash2 size={13} color="#DC2626" />
                            <AppText variant="small" color="#DC2626" style={{ fontWeight: '600' }}>
                              Gỡ
                            </AppText>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* MODAL CHỌN NHÂN VIÊN THÊM VÀO CA CỦA NGÀY ĐANG CHỌN */}
      <Modal
        visible={!!addingShiftKey}
        transparent
        animationType="slide"
        onRequestClose={() => setAddingShiftKey(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
              maxHeight: '82%',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <AppText variant="h3" color={colors.textPrimary}>
                  Thêm nhân viên vào {activeShiftMeta?.title}
                </AppText>
                <AppText variant="small" color={colors.textSecondary}>
                  {selectedDowName}, {String(safeSelectedDayNum).padStart(2, '0')}/
                  {String(viewMonth + 1).padStart(2, '0')}/{viewYear} • {activeShiftMeta?.time}
                </AppText>
              </View>
              <TouchableOpacity onPress={() => setAddingShiftKey(null)}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginVertical: 10,
              }}
            >
              <AppText variant="small" color={colors.textSecondary}>
                Nhân viên chưa có ca trong ngày ({availableStaffForDate.length} người):
              </AppText>
              {availableStaffForDate.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    if (pickedStaffIds.length === availableStaffForDate.length) {
                      setPickedStaffIds([]);
                    } else {
                      setPickedStaffIds(availableStaffForDate.map((s) => s.id));
                    }
                  }}
                >
                  <AppText variant="captionSemiBold" color={colors.primary}>
                    {pickedStaffIds.length === availableStaffForDate.length
                      ? 'Bỏ chọn hết'
                      : 'Chọn tất cả'}
                  </AppText>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {availableStaffForDate.length === 0 ? (
                <View
                  style={{
                    padding: 24,
                    borderRadius: 12,
                    backgroundColor: colors.surface,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <AppText variant="bodySemiBold" color={colors.textPrimary}>
                    Tất cả nhân viên đã có ca trực trong ngày này
                  </AppText>
                  <AppText
                    variant="small"
                    color={colors.textSecondary}
                    style={{ marginTop: 4, textAlign: 'center' }}
                  >
                    Nếu muốn đổi ca cho nhân viên nào, hãy bấm nút &quot;Gỡ&quot; nhân viên đó ở ca hiện tại trước.
                  </AppText>
                </View>
              ) : (
                availableStaffForDate.map((staff) => {
                  const isChecked = pickedStaffIds.includes(staff.id);

                  return (
                    <TouchableOpacity
                      key={staff.id}
                      activeOpacity={0.75}
                      onPress={() => togglePickStaff(staff.id)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 13,
                        borderRadius: 12,
                        marginBottom: 8,
                        borderWidth: 1.5,
                        borderColor: isChecked ? colors.primary : colors.border,
                        backgroundColor: isChecked ? colors.primarySoft : '#FFFFFF',
                      }}
                    >
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <AppText
                          variant="bodySemiBold"
                          color={isChecked ? colors.primary : colors.textPrimary}
                        >
                          {staff.fullname}
                        </AppText>
                        {!!staff.phone && (
                          <AppText variant="small" color={colors.textSecondary} style={{ marginTop: 2 }}>
                            SĐT: {staff.phone}
                          </AppText>
                        )}
                      </View>

                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          borderWidth: 1.5,
                          borderColor: isChecked ? colors.primary : colors.border,
                          backgroundColor: isChecked ? colors.primary : '#FFFFFF',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isChecked && <Check size={15} color="#FFFFFF" />}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setAddingShiftKey(null)}
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppText variant="bodySemiBold" color={colors.textPrimary}>
                  Hủy
                </AppText>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                disabled={savingShift || availableStaffForDate.length === 0}
                onPress={handleConfirmSaveShift}
                style={{
                  flex: 1.5,
                  height: 46,
                  borderRadius: 12,
                  backgroundColor:
                    availableStaffForDate.length === 0 ? colors.border : colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppText
                  variant="bodySemiBold"
                  color={availableStaffForDate.length === 0 ? colors.textSecondary : '#FFFFFF'}
                >
                  {savingShift ? 'Đang lưu...' : `Thêm vào ca (${pickedStaffIds.length})`}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
