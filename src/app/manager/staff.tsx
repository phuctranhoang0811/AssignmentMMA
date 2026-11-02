import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Search,
  X,
  Users,
  Phone,
  Mail,
  Truck,
  CheckCircle2,
  Calendar,
} from 'lucide-react-native';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../state/AuthContext';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { colors } from '../../theme/colors';
import {
  subscribeStoresConfig,
  subscribeStaffStoresMap,
  subscribeStaffSchedules,
  subscribeOrderOverrides,
  getStaffShiftOnDate,
  DEFAULT_STORE_BRANCHES,
  type SyncedStoreBranch,
  type StaffCustomizationEntry,
  type StaffScheduleRecord,
  type OrderDispatchOverride,
  type ShiftType,
} from '../../services/storeSync';

const DAY_KEYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const;

const SHIFT_BADGE: Record<ShiftType, { label: string; color: string; bg: string }> = {
  MORNING: { label: 'Hôm nay: Ca Sáng (08:00 - 14:00)', color: '#1D4ED8', bg: '#DBEAFE' },
  EVENING: { label: 'Hôm nay: Ca Tối (14:00 - 22:00)', color: '#B45309', bg: '#FEF3C7' },
  FULL: { label: 'Hôm nay: Full ca (08:00 - 22:00)', color: '#15803D', bg: '#DCFCE7' },
  OFF: { label: 'Hôm nay: Nghỉ ca', color: '#6B7280', bg: '#F3F4F6' },
};

export default function ManagerStaffScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [storesList, setStoresList] = useState<SyncedStoreBranch[]>(DEFAULT_STORE_BRANCHES);
  const [assignedStoreId, setAssignedStoreId] = useState<string | null>(user?.storeId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [rawUsers, setRawUsers] = useState<Record<string, any>[]>([]);
  const [rawOrders, setRawOrders] = useState<Record<string, any>[]>([]);
  const [staffMap, setStaffMap] = useState<Record<string, StaffCustomizationEntry>>({});
  const [schedulesMap, setSchedulesMap] = useState<Record<string, StaffScheduleRecord>>({});
  const [orderOverrides, setOrderOverrides] = useState<Record<string, OrderDispatchOverride>>({});

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
    const unsubOverrides = subscribeOrderOverrides((map) => {
      setOrderOverrides(map);
    });

    return () => {
      unsubStores();
      unsubStaff();
      unsubSchedules();
      unsubOverrides();
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

    const unsubOrders = onSnapshot(
      query(collection(db, 'orders')),
      (snap) => {
        const oList: Record<string, any>[] = [];
        snap.forEach((docSnap) => {
          oList.push({ id: docSnap.id, ...docSnap.data() });
        });
        setRawOrders(oList);
      },
      () => {}
    );

    return () => {
      unsubUsers();
      unsubOrders();
    };
  }, []);

  const currentStore =
    storesList.find((s) => s.id === assignedStoreId) || storesList[0];

  const todayKey = DAY_KEYS[(new Date().getDay() + 6) % 7] || 'T2';

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
      const todayShift: ShiftType = getStaffShiftOnDate(schedulesMap[u.id], new Date());

      // Đếm số đơn đang giao & đã hoàn tất của nhân viên này
      let deliveringCount = 0;
      let completedCount = 0;
      rawOrders.forEach((ord) => {
        const ov = orderOverrides[ord.id];
        const staffId = ov?.assignedStaffId ?? ord.assignedStaffId;
        const status = ov?.status ?? ord.status;
        if (staffId === u.id) {
          if (status === 'OUT_FOR_DELIVERY') deliveringCount++;
          else if (status === 'COMPLETED' || status === 'DELIVERED') completedCount++;
        }
      });

      return {
        id: u.id,
        fullname: String(u.fullName || u.fullname || u.name || 'Nhân viên'),
        email: String(u.email || custom?.email || ''),
        phone: String(custom?.phone || u.phone || ''),
        todayShift,
        deliveringCount,
        completedCount,
      };
    })
    .filter((s) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        s.fullname.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      );
    });

  const workingTodayCount = branchStaff.filter((s) => s.todayShift !== 'OFF').length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader
        title="Nhân viên chi nhánh"
        subtitle={currentStore?.name || 'Chi nhánh Pizza FPT'}
        showBack={false}
      />

      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        {/* Thanh tìm kiếm nhân viên */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            paddingHorizontal: 12,
            height: 44,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 12,
          }}
        >
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            style={{ flex: 1, marginLeft: 8, fontSize: 14, color: colors.textPrimary }}
            placeholder="Tìm tên, số điện thoại hoặc email nhân viên..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* 2 ô tóm tắt nhân sự */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <AppText variant="small" color={colors.textSecondary}>
              Tổng nhân viên quán
            </AppText>
            <AppText variant="price" color={colors.textPrimary} style={{ marginTop: 2 }}>
              {branchStaff.length} người
            </AppText>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <AppText variant="small" color={colors.textSecondary}>
              Đi làm hôm nay ({todayKey})
            </AppText>
            <AppText variant="price" color="#15803D" style={{ marginTop: 2 }}>
              {workingTodayCount} người
            </AppText>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {branchStaff.length === 0 ? (
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                padding: 28,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Users size={28} color={colors.textSecondary} />
              <AppText variant="bodySemiBold" color={colors.textPrimary} style={{ marginTop: 8 }}>
                Không tìm thấy nhân viên nào
              </AppText>
            </View>
          ) : (
            branchStaff.map((staff) => {
              const badge = SHIFT_BADGE[staff.todayShift];
              return (
                <View
                  key={staff.id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  {/* Họ tên + Trạng thái ca hôm nay */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <AppText variant="cardTitle" color={colors.textPrimary} style={{ flex: 1 }}>
                      {staff.fullname}
                    </AppText>
                    <View
                      style={{
                        backgroundColor: badge.bg,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                      }}
                    >
                      <AppText variant="small" color={badge.color} style={{ fontWeight: '700' }}>
                        {badge.label}
                      </AppText>
                    </View>
                  </View>

                  {/* SĐT & Email */}
                  <View style={{ gap: 5, marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Phone size={14} color={colors.textSecondary} />
                      <AppText variant="small" color={colors.textPrimary}>
                        {staff.phone || 'Chưa cập nhật SĐT'}
                      </AppText>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Mail size={14} color={colors.textSecondary} />
                      <AppText variant="small" color={colors.textSecondary}>
                        {staff.email}
                      </AppText>
                    </View>
                  </View>

                  {/* Thống kê đơn giao + Nút sang xếp lịch */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      paddingTop: 10,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Truck size={14} color="#EA580C" />
                        <AppText variant="small" color={colors.textPrimary}>
                          Đang giao: {staff.deliveringCount}
                        </AppText>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <CheckCircle2 size={14} color="#15803D" />
                        <AppText variant="small" color={colors.textPrimary}>
                          Đã giao: {staff.completedCount}
                        </AppText>
                      </View>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => router.replace('/manager/schedule')}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor: colors.primarySoft,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                      }}
                    >
                      <Calendar size={13} color={colors.primary} />
                      <AppText variant="small" color={colors.primary} style={{ fontWeight: '600' }}>
                        Đổi ca làm
                      </AppText>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

