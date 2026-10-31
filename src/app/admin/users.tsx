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
import { useRouter } from 'expo-router';
import {
  Search,
  User as UserIcon,
  Phone,
  Check,
  X,
  Plus,
} from 'lucide-react-native';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, onSnapshot, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getProvisioningAuth } from '../../services/firebaseProvision';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { colors } from '../../theme/colors';
import { styles } from '../../styles/adminUsers.styles';
import { DemoUser } from '../../types/user';
import { useAuth } from '../../state/AuthContext';
import { canChangeRole } from '../../utils/staff';
import { reportAdminAction } from '../../services/orderApi';

const ROLE_OPTIONS = [
  { key: 'SUPER_ADMIN', label: 'Admin', desc: 'Toàn quyền cấu hình và quản trị hệ thống' },
  { key: 'STORE_MANAGER', label: 'Manager (Quản lý)', desc: 'Quản lý thực đơn, tồn kho và vận hành ca' },
  { key: 'EMPLOYEE', label: 'Kitchen (Nhân viên bếp)', desc: 'Nhận đơn, nấu món và bàn giao shipper' },
  { key: 'ROLE_RIDER', label: 'Rider (Tài xế giao hàng)', desc: 'Nhận đơn và giao hàng tận nơi' },
  { key: 'USER', label: 'User (Khách hàng)', desc: 'Đặt món và tích điểm thành viên' },
];

// Chia tài khoản thành từng khu vực rõ ràng theo quyền (tab lọc)
const ROLE_SECTIONS: {
  key: string;
  title: string;
  hint: string;
  color: string;
  match: (role?: string) => boolean;
}[] = [
  { key: 'admin', title: 'Admin', hint: 'Toàn quyền hệ thống', color: colors.primary, match: (r) => r === 'SUPER_ADMIN' || r === 'ADMIN' },
  { key: 'manager', title: 'Quản lý', hint: 'Vận hành cửa hàng', color: colors.warning, match: (r) => r === 'STORE_MANAGER' },
  { key: 'kitchen', title: 'Bếp', hint: 'Nhận đơn & nấu món', color: colors.success, match: (r) => r === 'EMPLOYEE' || r === 'ROLE_KITCHEN' },
  { key: 'rider', title: 'Tài xế', hint: 'Giao hàng', color: '#1D4ED8', match: (r) => r === 'ROLE_RIDER' },
  { key: 'user', title: 'Khách hàng', hint: 'Đặt món & tích điểm', color: colors.textSecondary, match: (r) => r === 'BLACKLISTED' ? false : true },
  { key: 'blocked', title: 'Đã khóa', hint: 'Không đặt được đơn', color: colors.error, match: (r) => r === 'BLACKLISTED' },
];

// Xác định tài khoản thuộc khu vực nào (ưu tiên nhóm quyền, fallback = Khách hàng)
const sectionKeyForRole = (role?: string): string =>
  ROLE_SECTIONS.find((s) => s.match(role))?.key || 'user';

export default function AdminUsersScreen() {
  const router = useRouter();

  const { user: me } = useAuth();
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // Tab khu vực đang xem: 'all' hoặc key trong ROLE_SECTIONS
  const [activeSection, setActiveSection] = useState('all');

  // Role Modal
  const [selectedUser, setSelectedUser] = useState<DemoUser | null>(null);
  const [roleModalVisible, setRoleModalVisible] = useState(false);

  // Modal cấp tài khoản nhân viên mới
  const [createVisible, setCreateVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cPassword, setCPassword] = useState('Staff@12345');
  const [cRole, setCRole] = useState('EMPLOYEE');

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
              rewardPoints: data.rewardPoints || 0,
              isDemo: false,
            });
          });
          setUsers(list);
        } else {
          // No accounts means an empty list, not made-up people the admin could try to edit.
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
    setRoleModalVisible(true);
  };

  const handleUpdateRole = async (newRole: string) => {
    if (!selectedUser) return;
    try {
      const userRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userRef, {
        role: newRole,
        updatedAt: serverTimestamp(),
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === selectedUser.id ? { ...u, role: newRole } : u))
      );
      void reportAdminAction('ROLE_CHANGED', `users/${selectedUser.id}`, { from: selectedUser.role ?? 'USER', to: newRole });
      Alert.alert('Thành công', `Đã chuyển ${selectedUser.fullname} sang khu vực ${formatRoleLabel(newRole)}.`);
    } catch (e: any) {
      Alert.alert('Chưa cập nhật được quyền', e?.message || 'Vui lòng thử lại.');
    } finally {
      setRoleModalVisible(false);
    }
  };

  const handleToggleBlacklist = (u: DemoUser) => {
    const isBlocked = u.role === 'BLACKLISTED';
    const nextRole = isBlocked ? 'USER' : 'BLACKLISTED';

    Alert.alert(
      isBlocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản (Blacklist)',
      isBlocked
        ? `Mở khóa cho số điện thoại ${u.phone || u.email}?`
        : `Chặn tài khoản ${u.fullname} (${u.phone}) khỏi hệ thống đặt hàng?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: isBlocked ? 'Mở khóa' : 'Khóa ngay',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', u.id), { role: nextRole, updatedAt: serverTimestamp() });
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

  const handleOpenCreateModal = () => {
    setCName('');
    setCEmail('');
    setCPhone('');
    setCPassword('Staff@12345');
    setCRole('EMPLOYEE');
    setCreateVisible(true);
  };

  // Tạo tài khoản đăng nhập (Firebase Auth) + hồ sơ quyền (Firestore) cho nhân viên.
  // Chạy trên auth instance phụ để admin KHÔNG bị đăng nhập thành tài khoản vừa tạo.
  const handleCreateAccount = async () => {
    const email = cEmail.trim().toLowerCase();
    const name = cName.trim();
    if (!name || !email || !cPassword.trim()) {
      Alert.alert('Thiếu thông tin', 'Cần nhập họ tên, email và mật khẩu cho nhân viên.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Email không hợp lệ', 'Ví dụ dạng đúng: ten.nhanvien@pizzaht.vn');
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

      await setDoc(doc(db, 'users', uid), {
        uid,
        email,
        fullName: name,
        phone: cPhone.trim(),
        role: cRole,
        rewardPoints: 0,
        welcomePending: false,
        emailVerified: true, // nhân viên do admin cấp thì bỏ qua bước xác minh OTP
        isStaffAccount: true,
        createdAt: serverTimestamp(),
      });

      void reportAdminAction('ACCOUNT_CREATED', `users/${uid}`, { name, email, role: cRole });
      setCreateVisible(false);
      Alert.alert(
        'Đã cấp tài khoản',
        `${name} (${email})\nQuyền: ${formatRoleLabel(cRole)}\nMật khẩu: ${cPassword.trim()}\n\nGửi thông tin này cho nhân viên để đăng nhập.`
      );
    } catch (e: any) {
      const msg =
        e?.code === 'auth/email-already-in-use'
          ? 'Email này đã có tài khoản. Dùng email khác hoặc "Đổi quyền" cho tài khoản cũ.'
          : e?.message || 'Không thể tạo tài khoản, vui lòng thử lại.';
      Alert.alert('Chưa tạo được tài khoản', msg);
    } finally {
      // Đăng xuất instance phụ để phiên admin luôn nguyên vẹn
      await signOut(provisionAuth).catch(() => {});
      setIsCreating(false);
    }
  };

  const searchedUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.fullname.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.phone.includes(q)
    );
  });

  // Số tài khoản từng khu vực (gắn lên tab)
  const sectionCounts = ROLE_SECTIONS.map((sec) => ({
    ...sec,
    count: searchedUsers.filter((u) => sectionKeyForRole(u.role) === sec.key).length,
  }));

  const filteredUsers =
    activeSection === 'all'
      ? searchedUsers
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
        return 'Kitchen';
      case 'ROLE_RIDER':
        return 'Rider';
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
        title="Quản Lý Người Dùng"
        subtitle="Phân quyền tài khoản & Giám sát khách hàng"
        showBack={true}
        onBack={() => router.back()}
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
              Tất cả · {searchedUsers.length}
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
            !activeSectionMeta ? null : (
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
                    ? 'Không tìm thấy tài khoản phù hợp với từ khóa.'
                    : `Chưa có ai ở khu vực ${activeSectionMeta?.title || ''}. Bấm "Đổi quyền" để chuyển người vào đây.`}
              </AppText>
            </View>
          }
          renderItem={({ item }) => {
            const badgeStyle = getRoleBadgeColor(item.role);

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
                        {item.email}
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

                  {/* Managers view users only; admins cannot change themselves or (unless SUPER_ADMIN) other admins. */}
                  {item.id !== me?.id && canChangeRole(me?.role, item.role, 'USER') && (
                  <View style={styles.actionBtnsRow}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleOpenRoleModal(item)}
                    >
                      <AppText variant="small" color={colors.textPrimary}>
                        Đổi quyền
                      </AppText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        item.role === 'BLACKLISTED' && { backgroundColor: colors.errorSoft },
                      ]}
                      onPress={() => handleToggleBlacklist(item)}
                    >
                      <AppText
                        variant="small"
                        color={item.role === 'BLACKLISTED' ? colors.error : colors.textSecondary}
                      >
                        {item.role === 'BLACKLISTED' ? 'Đã khóa' : 'Khóa'}
                      </AppText>
                    </TouchableOpacity>
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
              placeholder="Số điện thoại (tùy chọn)"
              value={cPhone}
              onChangeText={setCPhone}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.formInput}
              placeholder="Mật khẩu * (tối thiểu 6 ký tự)"
              value={cPassword}
              onChangeText={setCPassword}
              autoCapitalize="none"
              secureTextEntry
            />

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

      {/* Role Picker Modal */}
      <Modal
        visible={roleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRoleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText variant="h3" color={colors.textPrimary} style={styles.modalTitle}>
                Cấp Quyền Tài Khoản
              </AppText>
              <TouchableOpacity onPress={() => setRoleModalVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <AppText variant="caption" color={colors.textSecondary} style={styles.modalSubtitle}>
              Phân định vai trò cho {selectedUser?.fullname} ({selectedUser?.email})
            </AppText>

            {ROLE_OPTIONS.filter(opt => canChangeRole(me?.role, selectedUser?.role, opt.key)).map((opt) => {
              const isSelected = selectedUser?.role === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.roleOptionItem,
                    isSelected && styles.roleOptionActive,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleUpdateRole(opt.key)}
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
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
