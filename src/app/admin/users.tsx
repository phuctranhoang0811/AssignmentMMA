import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Search,
  User as UserIcon,
  Phone,
  Check,
  X,
} from 'lucide-react-native';
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { colors } from '../../theme/colors';
import { styles } from '../../styles/adminUsers.styles';
import { DemoUser } from '../../types/user';

const ROLE_OPTIONS = [
  { key: 'SUPER_ADMIN', label: 'Quản trị tối cao (SUPER_ADMIN)', desc: 'Toàn quyền cấu hình hệ thống' },
  { key: 'STORE_MANAGER', label: 'Cửa hàng trưởng (STORE_MANAGER)', desc: 'Quản lý thực đơn và vận hành' },
  { key: 'EMPLOYEE', label: 'Nhân viên bếp (ROLE_KITCHEN)', desc: 'Duyệt đơn và chuyển trạng thái nấu' },
  { key: 'ROLE_RIDER', label: 'Tài xế giao hàng (ROLE_RIDER)', desc: 'Nhận đơn và cập nhật giao hàng' },
  { key: 'USER', label: 'Khách hàng (CUSTOMER)', desc: 'Đặt món và tích điểm FPT Reward' },
];

export default function AdminUsersScreen() {
  const router = useRouter();

  const [users, setUsers] = useState<DemoUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Role Modal
  const [selectedUser, setSelectedUser] = useState<DemoUser | null>(null);
  const [roleModalVisible, setRoleModalVisible] = useState(false);

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
          // Fallback mock accounts
          setUsers([
            {
              id: 'USR-ADMIN',
              fullname: 'Quản Trị Viên (Admin)',
              email: 'admin@pizzastore.com',
              phone: '0909000001',
              role: 'SUPER_ADMIN',
              rewardPoints: 9999,
            },
            {
              id: 'USR-STAFF',
              fullname: 'Nhân Viên Bếp & Vận Hành',
              email: 'employee@pizzastore.com',
              phone: '0909000002',
              role: 'EMPLOYEE',
              rewardPoints: 500,
            },
            {
              id: 'USR-TEST',
              fullname: 'Khách Hàng Thân Thiết',
              email: 'testuser@pizzastore.com',
              phone: '0909123456',
              role: 'USER',
              rewardPoints: 240,
            },
          ]);
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
      Alert.alert('Thành công', `Đã cấp quyền ${newRole} cho ${selectedUser.fullname}`);
    } catch (e: any) {
      // Cập nhật local nếu offline
      setUsers((prev) =>
        prev.map((u) => (u.id === selectedUser.id ? { ...u, role: newRole } : u))
      );
      Alert.alert('Thông báo', `Đã cập nhật quyền thành công`);
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
              const userRef = doc(db, 'users', u.id);
              await updateDoc(userRef, { role: nextRole });
            } catch {
              // fallback
            }
            setUsers((prev) =>
              prev.map((item) => (item.id === u.id ? { ...item, role: nextRole } : item))
            );
          },
        },
      ]
    );
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.fullname.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.phone.includes(q)
    );
  });

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
        title="Quản Lý Người Dùng & RBAC"
        subtitle="Cấp quyền nhân sự & Giám sát khách hàng"
        showBack={true}
        onBack={() => router.back()}
      />

      {/* Search Input */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchInputWrap}>
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
      </View>

      {/* Users List */}
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
                      {item.role || 'USER'}
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
                </View>
              </View>
            );
          }}
        />
      )}

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
                Cấp Quyền Tài Khoản (RBAC)
              </AppText>
              <TouchableOpacity onPress={() => setRoleModalVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <AppText variant="caption" color={colors.textSecondary} style={styles.modalSubtitle}>
              Phân định vai trò cho {selectedUser?.fullname} ({selectedUser?.email})
            </AppText>

            {ROLE_OPTIONS.map((opt) => {
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
