import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  X,
  Users,
  Phone,
  Mail,
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
  getStaffShiftOnDate,
  DEFAULT_STORE_BRANCHES,
  type SyncedStoreBranch,
  type StaffCustomizationEntry,
  type StaffScheduleRecord,
  type ShiftType,
} from '../../services/storeSync';

const DAY_KEYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const;

const SHIFT_BADGE: Record<ShiftType, { label: string; color: string; bg: string }> = {
  MORNING: { label: 'Ca Sáng (08:00 - 14:00)', color: colors.primary, bg: colors.primarySoft },
  EVENING: { label: 'Ca Tối (14:00 - 22:00)', color: colors.primary, bg: colors.primarySoft },
  FULL: { label: 'Full ca (08:00 - 22:00)', color: colors.primary, bg: colors.primarySoft },
  OFF: { label: 'Nghỉ ca', color: colors.textSecondary, bg: colors.surfaceAlt },
};

export default function ManagerStaffScreen() {
  const { user } = useAuth();

  const [storesList, setStoresList] = useState<SyncedStoreBranch[]>(DEFAULT_STORE_BRANCHES);
  const [assignedStoreId, setAssignedStoreId] = useState<string | null>(user?.storeId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [rawUsers, setRawUsers] = useState<Record<string, any>[]>([]);
  const [staffMap, setStaffMap] = useState<Record<string, StaffCustomizationEntry>>({});
  const [schedulesMap, setSchedulesMap] = useState<Record<string, StaffScheduleRecord>>({});

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

    return () => {
      unsubUsers();
    };
  }, []);

  const currentStore =
    storesList.find((s) => s.id === assignedStoreId) || storesList[0];

  const todayKey = DAY_KEYS[(new Date().getDay() + 6) % 7] || 'T2';

  const combinedUsers = (() => {
    const byId = new Map<string, Record<string, any>>();
    rawUsers.forEach((u) => byId.set(String(u.id), u));
    Object.entries(staffMap).forEach(([uid, m]) => {
      if (!m || m.deleted || byId.has(uid)) return;
      byId.set(uid, {
        id: uid,
        fullName: m.fullName || 'Nhân viên',
        email: m.email || '',
        phone: m.phone || '',
        role: m.role || 'EMPLOYEE',
        storeId: m.storeId || undefined,
        storeName: m.storeName || undefined,
      });
    });
    return Array.from(byId.values());
  })();

  const branchStaff = combinedUsers
    .filter((u) => {
      const custom = staffMap[u.id];
      const effRole = custom?.role || u.role;
      if (custom?.deleted || effRole === 'BLACKLISTED' || effRole === 'ROLE_RIDER') return false;
      const isStaff = effRole === 'EMPLOYEE' || effRole === 'ROLE_KITCHEN';
      if (!isStaff) return false;
      const uStoreId = custom?.storeId !== undefined ? custom.storeId : u.storeId;
      const uStoreName = custom?.storeName || u.storeName || '';
      if (currentStore) {
        if (uStoreId && uStoreId === currentStore.id) return true;
        if (uStoreName && uStoreName === currentStore.name) return true;
        if (uStoreId || uStoreName) return false;
      }
      return true;
    })
    .map((u) => {
      const custom = staffMap[u.id];
      const todayShift: ShiftType = getStaffShiftOnDate(schedulesMap[u.id], new Date());

      return {
        id: u.id,
        fullname: String(custom?.fullName || u.fullName || u.fullname || u.name || 'Nhân viên'),
        email: String(u.email || custom?.email || ''),
        phone: String(custom?.phone || u.phone || ''),
        todayShift,
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
            <AppText variant="price" color={colors.primary} style={{ marginTop: 2 }}>
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
                      gap: 8,
                    }}
                  >
                    <AppText variant="cardTitle" color={colors.textPrimary} style={{ flex: 1 }} numberOfLines={1}>
                      {staff.fullname}
                    </AppText>
                    <View
                      style={{
                        backgroundColor: badge.bg,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        flexShrink: 0,
                      }}
                    >
                      <AppText variant="small" color={badge.color} style={{ fontWeight: '700' }}>
                        {badge.label}
                      </AppText>
                    </View>
                  </View>

                  {/* SĐT & Email */}
                  <View style={{ gap: 5 }}>
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
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

