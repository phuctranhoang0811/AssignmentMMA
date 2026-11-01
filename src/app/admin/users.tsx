import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '../../utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Search,
  User as UserIcon,
  Phone,
  Check,
  X,
  Plus,
  Eye,
  EyeOff,
} from 'lucide-react-native';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, onSnapshot, doc, updateDoc, setDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getProvisioningAuth, getProvisioningDb } from '../../services/firebaseProvision';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { colors } from '../../theme/colors';
import { styles } from '../../styles/adminUsers.styles';
import { DemoUser } from '../../types/user';
import { useAuth } from '../../state/AuthContext';
import { canChangeRole } from '../../utils/staff';
import { reportAdminAction } from '../../services/orderApi';
import { MOCK_PICKUP_STORES, type MockStoreItem } from '../../components/modals/StoreLocationModal';
import {
  subscribeStoresConfig,
  subscribeStaffStoresMap,
  saveStaffStoresEntry,
  type StaffCustomizationEntry,
} from '../../services/storeSync';

const ROLE_OPTIONS = [
  { key: 'SUPER_ADMIN', label: 'Admin', desc: 'Toàn quyền cấu hình và quản trị hệ thống' },
  { key: 'STORE_MANAGER', label: 'Manager (Quản lý)', desc: 'Quản lý thực đơn, tồn kho và vận hành ca' },
  { key: 'EMPLOYEE', label: 'Nhân viên', desc: 'Nhận đơn, chuẩn bị món và giao hàng cho khách' },
];

// Chia tài khoản thành từng khu vực rõ ràng theo quyền (tab lọc)
const ROLE_SECTIONS: {
  key: string;
  title: string;
  hint: string;
  color: string;
  match: (role?: string) => boolean;
}[] = [
  {
    key: 'admin',
    title: 'Admin & Quản lý',
    hint: 'Toàn quyền & Quản lý quán',
    color: colors.primary,
    match: (r) => r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'STORE_MANAGER',
  },
  {
    key: 'kitchen',
    title: 'Nhân viên',
    hint: 'Xử lý & giao đơn hàng',
    color: colors.success,
    match: (r) => r === 'EMPLOYEE' || r === 'ROLE_KITCHEN',
  },
  {
    key: 'user',
    title: 'Khách hàng',
    hint: 'Đặt món & tích điểm',
    color: colors.textSecondary,
    match: (r) => (r === 'BLACKLISTED' ? false : true),
  },
  {
    key: 'blocked',
    title: 'Đã khóa',
    hint: 'Hoàn tác mở khóa hoặc xóa vĩnh viễn',
    color: colors.error,
    match: (r) => r === 'BLACKLISTED',
  },
];

// Xác định tài khoản thuộc khu vực nào (ưu tiên nhóm quyền, fallback = Khách hàng)
const sectionKeyForRole = (role?: string): string =>
  ROLE_SECTIONS.find((s) => s.match(role))?.key || 'user';

export default function AdminUsersScreen() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // Tab khu vực đang xem: 'all' hoặc key trong ROLE_SECTIONS
  const [activeSection, setActiveSection] = useState('all');

  // Modal Tùy chỉnh tài khoản
  const [selectedUser, setSelectedUser] = useState<DemoUser | null>(null);
  const [roleModalVisible, setRoleModalVisible] = useState(false);

  // Modal cấp tài khoản nhân viên mới
  const [createVisible, setCreateVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cPassword, setCPassword] = useState('Staff@123');
  const [showCreatePassword, setShowCreatePassword] = useState(true);
  const [cRole, setCRole] = useState('EMPLOYEE');
  const [storesList, setStoresList] = useState<MockStoreItem[]>(MOCK_PICKUP_STORES);
  const [cStoreId, setCStoreId] = useState<string>(MOCK_PICKUP_STORES[0].id);
  const [editStoreId, setEditStoreId] = useState<string>(MOCK_PICKUP_STORES[0].id);
  const [editRole, setEditRole] = useState<string>('EMPLOYEE');
  const [editPhone, setEditPhone] = useState<string>('');
  const [staffStoreMap, setStaffStoreMap] = useState<Record<string, StaffCustomizationEntry>>({});

  useEffect(() => {
    const unsubStores = subscribeStoresConfig((state) => {
      const list: MockStoreItem[] = state.stores
        .filter((d) => d && d.isActive !== false && d.name)
        .map((d, idx) => ({
          id: String(d.id || `store-${idx}`),
          name: String(d.name),
          address: String(d.address || ''),
          openingTime: String(d.openingTime || '10:00 - 22:00'),
        }));
      if (list.length > 0) {
        setStoresList(list);
        setCStoreId((prev) => (list.some((s) => s.id === prev) ? prev : list[0].id));
      }
    });
    const unsubStaffMap = subscribeStaffStoresMap((map) => {
      setStaffStoreMap(map);
    });
    return () => {
      unsubStores();
      unsubStaffMap();
    };
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'users'),
      (snapshot: any) => {
        if (!snapshot.empty) {
          const list: DemoUser[] = [];
          snapshot.forEach((d: any) => {
            const data = d.data();
            list.push({
              id: d.id,
              fullname: data.fullName || data.fullname || 'Người dùng',
              email: data.email || '',
              phone: data.phone || '',
              role: data.role || 'USER',
              storeId: data.storeId || data.branchId || undefined,
              storeName: data.storeName || undefined,
              rewardPoints: data.rewardPoints || 0,
              isDemo: false,
            });
          });
          setUsers(list);
        } else {
          setUsers([]);
        }
        setLoading(false);
      },
      (err: any) => {
        console.warn('Lỗi Firestore users:', err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const handleOpenRoleModal = (u: DemoUser) => {
    setSelectedUser(u);
    const initialRole =
      u.role === 'SUPER_ADMIN' || u.role === 'STORE_MANAGER' || u.role === 'EMPLOYEE'
        ? u.role
        : 'EMPLOYEE';
    setEditRole(initialRole);
    setEditStoreId(u.storeId || storesList[0]?.id || MOCK_PICKUP_STORES[0].id);
    setEditPhone(u.phone || '');
    setRoleModalVisible(true);
  };

  const handleUpdateRole = async (newRole?: string) => {
    if (!selectedUser) return;
    const targetRole = newRole || editRole;
    const needsStore = targetRole === 'STORE_MANAGER' || targetRole === 'EMPLOYEE';
    const pickedStore = needsStore
      ? storesList.find((s) => s.id === editStoreId) || storesList[0] || MOCK_PICKUP_STORES[0]
      : null;
    const cleanPhone = editPhone.trim();
    try {
      if (targetRole !== selectedUser.role) {
        const userRef = doc(db, 'users', selectedUser.id);
        await updateDoc(userRef, {
          role: targetRole,
          updatedAt: serverTimestamp(),
        });
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id
            ? {
                ...u,
                role: targetRole,
                phone: cleanPhone || u.phone,
                storeId: pickedStore ? pickedStore.id : undefined,
                storeName: pickedStore ? pickedStore.name : undefined,
              }
            : u
        )
      );
      void reportAdminAction('ROLE_CHANGED', `users/${selectedUser.id}`, {
        from: selectedUser.role ?? 'USER',
        to: targetRole,
      });
      await saveStaffStoresEntry(selectedUser.id, {
        storeId: pickedStore ? pickedStore.id : null,
        storeName: pickedStore ? pickedStore.name : null,
        phone: cleanPhone,
        email: selectedUser.email,
      });
      Alert.alert(
        'Đã lưu tùy chỉnh',
        `Đã cập nhật ${selectedUser.fullname}: ${formatRoleLabel(targetRole)}${pickedStore ? ` • ${pickedStore.name}` : ''}.`
      );
    } catch (e: any) {
      Alert.alert('Chưa cập nhật được', e?.message || 'Vui lòng thử lại.');
    } finally {
      setRoleModalVisible(false);
    }
  };

  const handleToggleBlacklist = (u: DemoUser) => {
    const isBlocked = u.role === 'BLACKLISTED';
    const restoredRole = staffStoreMap[u.id]?.previousRole || 'USER';
    const nextRole = isBlocked ? restoredRole : 'BLACKLISTED';

    Alert.alert(
      isBlocked ? 'Hoàn tác mở khóa' : 'Khóa tài khoản',
      isBlocked
        ? `Hoàn tác khóa và đưa tài khoản ${u.fullname} (${u.phone || u.email}) trở lại hoạt động bình thường?`
        : `Chuyển tài khoản ${u.fullname} (${u.phone || u.email}) sang bảng Đã khóa?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: isBlocked ? 'Hoàn tác' : 'Khóa tài khoản',
          style: isBlocked ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', u.id), { role: nextRole, updatedAt: serverTimestamp() });
              if (!isBlocked) {
                await saveStaffStoresEntry(u.id, {
                  previousRole: u.role || 'USER',
                });
              }
              setUsers((prev) =>
                prev.map((item) => (item.id === u.id ? { ...item, role: nextRole } : item))
              );
              void reportAdminAction(isBlocked ? 'USER_UNLOCKED' : 'USER_LOCKED', `users/${u.id}`);
            } catch (e: any) {
              Alert.alert('Chưa cập nhật được', e?.message || 'Vui lòng thử lại.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteLockedUser = (u: DemoUser) => {
    Alert.alert(
      'Xóa vĩnh viễn tài khoản',
      `Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản ${u.fullname} (${u.email || u.phone}) khỏi hệ thống?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa vĩnh viễn',
          style: 'destructive',
          onPress: async () => {
            try {
              await saveStaffStoresEntry(u.id, {
                deleted: true,
              });
              setUsers((prev) => prev.filter((item) => item.id !== u.id));
              Alert.alert('Đã xóa', `Đã xóa tài khoản ${u.fullname} khỏi danh sách.`);
            } catch (e: any) {
              Alert.alert('Chưa xóa được', e?.message || 'Vui lòng thử lại.');
            }
          },
        },
      ]
    );
  };

  const handleOpenCreateModal = () => {
    setCName('');
    setCEmail('');
    setCPhone('');
    setCPassword('Staff@123');
    setCRole('EMPLOYEE');
    setCStoreId(storesList[0]?.id || MOCK_PICKUP_STORES[0].id);
    setCreateVisible(true);
  };

  // Tạo tài khoản đăng nhập (Firebase Auth) + hồ sơ quyền (Firestore) cho nhân viên.
  const handleCreateAccount = async () => {
    const email = cEmail.trim().toLowerCase();
    const name = cName.trim();
    const cleanPhone = cPhone.trim();
    if (!name || !email || !cPassword.trim()) {
      Alert.alert('Thiếu thông tin', 'Cần nhập họ tên, email và mật khẩu cho nhân viên.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Email không hợp lệ', 'Ví dụ dạng đúng: ten.nhanvien@pizzafpt.com');
      return;
    }
    if (cPassword.trim().length < 6) {
      Alert.alert('Mật khẩu quá ngắn', 'Mật khẩu cần tối thiểu 6 ký tự.');
      return;
    }

    setIsCreating(true);
    const provisionAuth = getProvisioningAuth();
    try {
      const cred = await createUserWithEmailAndPassword(provisionAuth, email, cPassword.trim());
      const uid = cred.user.uid;

      const provisionDb = getProvisioningDb();
      const pickedStore =
        cRole !== 'SUPER_ADMIN'
          ? storesList.find((s) => s.id === cStoreId) || storesList[0] || MOCK_PICKUP_STORES[0]
          : null;
      const baseUserDoc = {
        uid,
        email,
        fullName: name,
        role: 'USER',
        rewardPoints: 0,
        welcomePending: true,
        emailVerified: false,
        createdAt: serverTimestamp(),
      };
      let createdWithPhone = false;
      if (/^0[0-9]{9}$/.test(cleanPhone)) {
        try {
          const batch = writeBatch(provisionDb);
          batch.set(doc(provisionDb, 'phone_numbers', cleanPhone), { uid });
          batch.set(doc(provisionDb, 'users', uid), { ...baseUserDoc, phone: cleanPhone });
          await batch.commit();
          createdWithPhone = true;
        } catch {
          createdWithPhone = false;
        }
      }
      if (!createdWithPhone) {
        await setDoc(doc(provisionDb, 'users', uid), {
          ...baseUserDoc,
          phone: '',
        });
      }
      if (cRole !== 'USER') {
        await updateDoc(doc(db, 'users', uid), {
          role: cRole,
          updatedAt: serverTimestamp(),
        });
      }
      await saveStaffStoresEntry(uid, {
        storeId: pickedStore ? pickedStore.id : null,
        storeName: pickedStore ? pickedStore.name : null,
        phone: cleanPhone,
        email,
      });

      void reportAdminAction('ACCOUNT_CREATED', `users/${uid}`, { name, email, role: cRole });
      setCreateVisible(false);
      Alert.alert(
        'Đã cấp tài khoản',
        `${name} (${email})\nQuyền: ${formatRoleLabel(cRole)}${pickedStore ? `\nQuán: ${pickedStore.name}` : ''}\nMật khẩu: ${cPassword.trim()}\n\nGửi thông tin này cho nhân viên để đăng nhập.`
      );
    } catch (e: any) {
      const msg =
        e?.code === 'auth/email-already-in-use'
          ? 'Email này đã có tài khoản. Dùng email khác hoặc bấm "Tùy chỉnh" trên tài khoản cũ.'
          : e?.message || 'Không thể tạo tài khoản, vui lòng thử lại.';
      Alert.alert('Chưa tạo được tài khoản', msg);
    } finally {
      await signOut(provisionAuth).catch(() => {});
      setIsCreating(false);
    }
  };

  // Loại bỏ hoàn toàn các tài khoản ROLE_RIDER và các tài khoản đã xóa vĩnh viễn
  const searchedUsers = users
    .filter((u) => u.role !== 'ROLE_RIDER' && staffStoreMap[u.id]?.deleted !== true)
    .map((u) => {
      const m = staffStoreMap[u.id];
      const resolvedStoreId = m?.storeId ? m.storeId : u.storeId;
      const liveStore = resolvedStoreId
        ? storesList.find((s) => s.id === resolvedStoreId)
        : undefined;
      const resolvedStoreName =
        liveStore?.name || (m?.storeName ? m.storeName : u.storeName);
      return {
        ...u,
        storeId: resolvedStoreId,
        storeName: u.role === 'SUPER_ADMIN' || u.role === 'USER' ? undefined : resolvedStoreName,
        phone: m?.phone || u.phone || '',
      };
    })
    .filter((u) => {
      const q = searchQuery.toLowerCase();
      return (
        u.fullname.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.includes(q)
      );
    });

  // Tài khoản đang hoạt động (không tính tài khoản đã khóa)
  const activeOnlyUsers = searchedUsers.filter((u) => u.role !== 'BLACKLISTED');

  // Số tài khoản từng khu vực (gắn lên tab)
  const sectionCounts = ROLE_SECTIONS.map((sec) => ({
    ...sec,
    count: searchedUsers.filter((u) => sectionKeyForRole(u.role) === sec.key).length,
  }));

  // Ở tab 'all' chỉ hiện tài khoản đang hoạt động; tài khoản Đã khóa chỉ hiện riêng trong tab 'blocked'
  const filteredUsers =
    activeSection === 'all'
      ? activeOnlyUsers
      : searchedUsers.filter((u) => sectionKeyForRole(u.role) === activeSection);

  const activeSectionMeta = ROLE_SECTIONS.find((s) => s.key === activeSection);

  const formatRoleLabel = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return 'Admin';
      case 'STORE_MANAGER':
        return 'Manager';
      case 'EMPLOYEE':
      case 'ROLE_KITCHEN':
        return 'Nhân viên';
      case 'BLACKLISTED':
        return 'Đã khóa';
      default:
        return 'User';
    }
  };

  const getRoleBadgeColor = (role?: string) => {
    if (role === 'SUPER_ADMIN') return { bg: colors.primarySoft, text: colors.primary };
    if (role === 'STORE_MANAGER') return { bg: colors.warningSoft, text: colors.warning };
    if (role === 'EMPLOYEE' || role === 'ROLE_KITCHEN') return { bg: colors.successSoft, text: colors.success };
    if (role === 'BLACKLISTED') return { bg: colors.errorSoft, text: colors.error };
    return { bg: colors.surfaceAlt, text: colors.textSecondary };
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        title="Tài khoản"
        subtitle="Quản lý Khách hàng & Nhân viên"
        showBack={false}
      />

      {/* Search Input + nút cấp tài khoản */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchRow}>
          <View style={[styles.searchInputWrap, { flex: 1 }]}>
            <Search size={18} color={colors.textSecondary} />
            <TextInput
              placeholder="Tìm theo tên, email hoặc số điện thoại..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {(me?.role === 'SUPER_ADMIN' || me?.role === 'ADMIN') && (
            <TouchableOpacity
              style={styles.addAccountBtn}
              activeOpacity={0.8}
              onPress={handleOpenCreateModal}
              accessibilityRole="button"
              accessibilityLabel="Cấp tài khoản nhân viên mới"
            >
              <Plus size={20} color={colors.white} strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tab lọc khu vực quyền */}
      <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={styles.sectionTabsRow}
        >
          <TouchableOpacity
            style={[styles.sectionTab, activeSection === 'all' && styles.sectionTabActive]}
            activeOpacity={0.7}
            onPress={() => setActiveSection('all')}
          >
            <AppText
              variant="captionMedium"
              color={activeSection === 'all' ? colors.white : colors.textPrimary}
            >
              Tất cả · {activeOnlyUsers.length}
            </AppText>
          </TouchableOpacity>

          {sectionCounts.map((sec) => {
            const isActive = activeSection === sec.key;
            return (
              <TouchableOpacity
                key={sec.key}
                style={[
                  styles.sectionTab,
                  isActive && [styles.sectionTabActive, { backgroundColor: sec.color, borderColor: sec.color }],
                ]}
                activeOpacity={0.7}
                onPress={() => setActiveSection(sec.key)}
              >
                <AppText
                  variant="captionMedium"
                  color={isActive ? colors.white : colors.textPrimary}
                >
                  {sec.title} · {sec.count}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Danh sách khu vực đang chọn */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            !activeSectionMeta ? undefined : (
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionDot, { backgroundColor: activeSectionMeta.color }]} />
                <AppText variant="bodySemiBold" color={colors.textPrimary}>
                  {activeSectionMeta.title}
                </AppText>
                <AppText variant="small" color={colors.textSecondary}>
                  · {activeSectionMeta.hint}
                </AppText>
              </View>
            )
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <AppText variant="bodyMedium" color={colors.textSecondary}>
                {users.length === 0
                  ? 'Chưa có tài khoản nào. Tài khoản đăng ký mới sẽ xuất hiện ở đây.'
                  : activeSection === 'all'
                    ? 'Không tìm thấy tài khoản đang hoạt động phù hợp với từ khóa.'
                    : activeSection === 'blocked'
                      ? 'Hiện không có tài khoản nào đang bị khóa.'
                      : `Chưa có ai ở khu vực ${activeSectionMeta?.title || ''}. Bấm "Tùy chỉnh" để chuyển nhân sự vào đây.`}
              </AppText>
            </View>
          }
          renderItem={({ item }) => {
            const badgeStyle = getRoleBadgeColor(item.role);
            const isLockedCard = item.role === 'BLACKLISTED';

            return (
              <View style={styles.userCard}>
                <View style={styles.userTopRow}>
                  <View style={styles.userInfoLeft}>
                    <View style={styles.userAvatarBox}>
                      <UserIcon size={22} color={colors.primary} />
                    </View>
                    <View style={styles.userTextCol}>
                      <AppText variant="cardTitle" color={colors.textPrimary}>
                        {item.fullname}
                      </AppText>
                      <AppText variant="caption" color={colors.textSecondary}>
                        {item.email}{item.storeName ? `\n📍 ${item.storeName}` : ''}
                      </AppText>
                    </View>
                  </View>

                  <View style={[styles.roleBadge, { backgroundColor: badgeStyle.bg }]}>
                    <AppText variant="small" color={badgeStyle.text}>
                      {formatRoleLabel(item.role)}
                    </AppText>
                  </View>
                </View>

                {/* Details & Actions */}
                <View style={styles.userDetailsRow}>
                  <View style={styles.detailItem}>
                    <Phone size={14} color={colors.textSecondary} />
                    <AppText variant="small" color={colors.textSecondary}>
                      {item.phone || 'Chưa cập nhật SĐT'}
                    </AppText>
                  </View>

                  {item.id !== me?.id && canChangeRole(me?.role, item.role, 'USER') && (
                    <View style={styles.actionBtnsRow}>
                      {isLockedCard ? (
                        <>
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: colors.successSoft, borderColor: colors.success }]}
                            onPress={() => handleToggleBlacklist(item)}
                          >
                            <AppText variant="small" color={colors.success}>
                              Hoàn tác
                            </AppText>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: colors.errorSoft, borderColor: colors.error }]}
                            onPress={() => handleDeleteLockedUser(item)}
                          >
                            <AppText variant="small" color={colors.error}>
                              Xóa
                            </AppText>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => handleOpenRoleModal(item)}
                          >
                            <AppText variant="small" color={colors.textPrimary}>
                              Tùy chỉnh
                            </AppText>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => handleToggleBlacklist(item)}
                          >
                            <AppText variant="small" color={colors.textSecondary}>
                              Khóa
                            </AppText>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Modal Cấp Tài Khoản Nhân Viên Mới */}
      <Modal
        visible={createVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <AppText variant="h3" color={colors.textPrimary} style={styles.modalTitle}>
                  Cấp Tài Khoản Nhân Viên
                </AppText>
                <TouchableOpacity onPress={() => setCreateVisible(false)}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <AppText variant="caption" color={colors.textSecondary} style={styles.modalSubtitle}>
                Tạo email đăng nhập + quyền, gửi thông tin cho nhân viên tự đăng nhập app
              </AppText>

              <TextInput
                style={styles.formInput}
                placeholder="Họ và tên *"
                value={cName}
                onChangeText={setCName}
              />
              <TextInput
                style={styles.formInput}
                placeholder="Email đăng nhập * (VD: thi.nv@pizzaht.vn)"
                value={cEmail}
                onChangeText={setCEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={styles.formInput}
                placeholder="Số điện thoại"
                value={cPhone}
                onChangeText={setCPhone}
                keyboardType="phone-pad"
              />
              <View style={{ position: 'relative', justifyContent: 'center' }}>
                <TextInput
                  style={[styles.formInput, { paddingRight: 44 }]}
                  placeholder="Mật khẩu * (tối thiểu 6 ký tự)"
                  value={cPassword}
                  onChangeText={setCPassword}
                  autoCapitalize="none"
                  secureTextEntry={!showCreatePassword}
                />
                <TouchableOpacity
                  onPress={() => setShowCreatePassword((prev) => !prev)}
                  style={{ position: 'absolute', right: 14, top: 12, padding: 4 }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {showCreatePassword ? (
                    <EyeOff size={18} color={colors.textSecondary} />
                  ) : (
                    <Eye size={18} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>

              <AppText variant="captionSemiBold" color={colors.textSecondary} style={{ marginTop: 8, marginBottom: 6 }}>
                Quyền khi tạo
              </AppText>
              {ROLE_OPTIONS.map((opt) => {
                const isSelected = cRole === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.roleOptionItem, isSelected && styles.roleOptionActive]}
                    activeOpacity={0.7}
                    onPress={() => setCRole(opt.key)}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <AppText
                        variant="bodySemiBold"
                        color={isSelected ? colors.primary : colors.textPrimary}
                      >
                        {opt.label}
                      </AppText>
                      <AppText variant="small" color={colors.textSecondary}>
                        {opt.desc}
                      </AppText>
                    </View>
                    {isSelected && <Check size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}

              {cRole !== 'SUPER_ADMIN' && (
                <View style={{ marginTop: 10 }}>
                  <AppText variant="captionSemiBold" color={colors.textSecondary} style={{ marginBottom: 6 }}>
                    Thuộc quán / chi nhánh *
                  </AppText>
                  {storesList.map((st) => {
                    const active = cStoreId === st.id;
                    return (
                      <TouchableOpacity
                        key={st.id}
                        style={[styles.roleOptionItem, active && styles.roleOptionActive]}
                        activeOpacity={0.7}
                        onPress={() => setCStoreId(st.id)}
                      >
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <AppText variant="bodySemiBold" color={active ? colors.primary : colors.textPrimary}>
                            {st.name}
                          </AppText>
                          <AppText variant="small" color={colors.textSecondary} numberOfLines={1}>
                            {st.address}
                          </AppText>
                        </View>
                        {active && <Check size={18} color={colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    height: 46,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => setCreateVisible(false)}
                >
                  <AppText variant="captionSemiBold" color={colors.textPrimary}>
                    Hủy
                  </AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    height: 46,
                    borderRadius: 12,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isCreating ? 0.6 : 1,
                  }}
                  activeOpacity={0.8}
                  onPress={handleCreateAccount}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <AppText variant="captionSemiBold" color={colors.white}>
                      Tạo tài khoản
                    </AppText>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Tùy Chỉnh Tài Khoản (Đổi cửa hàng, SĐT, Quyền) */}
      <Modal
        visible={roleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRoleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 540 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <AppText variant="h3" color={colors.textPrimary} style={styles.modalTitle}>
                  Tùy Chỉnh Tài Khoản
                </AppText>
                <TouchableOpacity onPress={() => setRoleModalVisible(false)}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <AppText variant="caption" color={colors.textSecondary} style={styles.modalSubtitle}>
                Điều chỉnh cửa hàng, số điện thoại & vai trò cho {selectedUser?.fullname} ({selectedUser?.email})
              </AppText>

              <AppText variant="captionSemiBold" color={colors.textSecondary} style={{ marginBottom: 6 }}>
                Số điện thoại liên hệ
              </AppText>
              <TextInput
                style={styles.formInput}
                placeholder="Nhập số điện thoại (VD: 0901234567)"
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
              />

              <AppText variant="captionSemiBold" color={colors.textSecondary} style={{ marginTop: 4, marginBottom: 6 }}>
                Vai trò / Chức vụ
              </AppText>
              {ROLE_OPTIONS.filter((opt) => canChangeRole(me?.role, selectedUser?.role, opt.key)).map((opt) => {
                const isSelected = editRole === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.roleOptionItem,
                      isSelected && styles.roleOptionActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => setEditRole(opt.key)}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <AppText
                        variant="bodySemiBold"
                        color={isSelected ? colors.primary : colors.textPrimary}
                      >
                        {opt.label}
                      </AppText>
                      <AppText variant="small" color={colors.textSecondary}>
                        {opt.desc}
                      </AppText>
                    </View>
                    {isSelected && <Check size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}

              {editRole !== 'SUPER_ADMIN' && (
                <View style={{ marginTop: 8 }}>
                  <AppText variant="captionSemiBold" color={colors.textSecondary} style={{ marginBottom: 6 }}>
                    Điều chuyển sang quán / chi nhánh
                  </AppText>
                  {storesList.map((st) => {
                    const active = editStoreId === st.id;
                    return (
                      <TouchableOpacity
                        key={st.id}
                        style={[styles.roleOptionItem, active && styles.roleOptionActive]}
                        activeOpacity={0.7}
                        onPress={() => setEditStoreId(st.id)}
                      >
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <AppText variant="bodySemiBold" color={active ? colors.primary : colors.textPrimary}>
                            {st.name}
                          </AppText>
                          <AppText variant="small" color={colors.textSecondary} numberOfLines={1}>
                            {st.address}
                          </AppText>
                        </View>
                        {active && <Check size={18} color={colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    height: 46,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => setRoleModalVisible(false)}
                >
                  <AppText variant="captionSemiBold" color={colors.textPrimary}>
                    Hủy
                  </AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    height: 46,
                    borderRadius: 12,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  activeOpacity={0.8}
                  onPress={() => handleUpdateRole(editRole)}
                >
                  <AppText variant="captionSemiBold" color={colors.white}>
                    Lưu thay đổi
                  </AppText>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
