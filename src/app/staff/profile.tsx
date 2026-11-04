import React, { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  Store,
  UserRound,
} from 'lucide-react-native';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { auth } from '../../services/firebase';
import { useAuth } from '../../state/AuthContext';
import { useToast } from '../../state/ToastContext';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';
import { colors } from '../../theme/colors';
import {
  subscribeStaffStoresMap,
  subscribeStoresConfig,
  DEFAULT_STORE_BRANCHES,
  type StaffCustomizationEntry,
  type SyncedStoreBranch,
} from '../../services/storeSync';

export default function StaffProfileScreen() {
  const router = useRouter();
  const { user, logout, changePassword } = useAuth();
  const { showToast } = useToast();
  const uid = user?.id;

  const [staffMap, setStaffMap] = useState<Record<string, StaffCustomizationEntry>>({});
  const [storesList, setStoresList] = useState<SyncedStoreBranch[]>(DEFAULT_STORE_BRANCHES);

  // Đổi mật khẩu
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwError, setPwError] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  // Kiểm tra mật khẩu chuẩn giống bên User (tối thiểu 8 ký tự, chữ thường, chữ hoa, số, ký tự đặc biệt, không khoảng trắng)
  const isPasswordValid = (pwd: string) => {
    if (!pwd || pwd.length < 8) return false;
    if (/\s/.test(pwd)) return false;
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
    return hasLower && hasUpper && hasNumber && hasSpecial;
  };

  // Đăng xuất
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const unsubStaff = subscribeStaffStoresMap((map) => setStaffMap(map));
    const unsubStores = subscribeStoresConfig((state) => {
      if (state.stores?.length > 0) setStoresList(state.stores);
    });
    return () => {
      unsubStaff();
      unsubStores();
    };
  }, []);

  const myStaffEntry = uid ? staffMap[uid] : undefined;
  const effectiveStoreId = myStaffEntry?.storeId || user?.storeId;
  const matchedStore = storesList.find((s) => s.id === effectiveStoreId);
  const effectiveStoreName =
    myStaffEntry?.storeName || matchedStore?.name || user?.storeName || 'Pizza FPT';

  const displayPhone = myStaffEntry?.phone || user?.phone || 'Chưa cập nhật';
  const displayEmail =
    myStaffEntry?.email || user?.email || auth.currentUser?.email || 'Chưa cập nhật';
  const displayName = myStaffEntry?.fullName || user?.fullname || 'Nhân viên';

  const handleChangePassword = async () => {
    setPwError('');
    if (!currentPassword) {
      setPwError('Vui lòng nhập mật khẩu hiện tại của bạn.');
      return;
    }
    if (!isPasswordValid(newPassword)) {
      setPwError(
        'Mật khẩu mới phải có tối thiểu 8 ký tự, gồm ít nhất 1 chữ thường, 1 chữ hoa, 1 số, 1 ký tự đặc biệt và không có khoảng trắng.'
      );
      return;
    }
    if (newPassword === currentPassword) {
      setPwError('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setChangingPw(true);
    try {
      if (typeof changePassword === 'function') {
        await changePassword(currentPassword, newPassword);
      } else {
        const fbUser = auth.currentUser;
        if (!fbUser || !fbUser.email) {
          throw new Error('Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.');
        }
        const cred = EmailAuthProvider.credential(fbUser.email, currentPassword);
        await reauthenticateWithCredential(fbUser, cred);
        await updatePassword(fbUser, newPassword);
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast({
        message: 'Mật khẩu của bạn đã được cập nhật thành công!',
        type: 'success',
      });
    } catch (err: any) {
      const code = String(err?.code || '');
      if (
        code.includes('wrong-password') ||
        code.includes('invalid-credential') ||
        code.includes('invalid-login-credentials')
      ) {
        setPwError('Mật khẩu hiện tại không chính xác.');
      } else {
        setPwError(err?.message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại.');
      }
    } finally {
      setChangingPw(false);
    }
  };

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      setLogoutModalVisible(false);
      router.replace('/(tabs)/home');
    } catch {
      showToast({ message: 'Chưa thể đăng xuất, vui lòng thử lại.', type: 'error' });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader
        title="Hồ sơ Nhân viên"
        subtitle={`${effectiveStoreName} • ${displayName}`}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Thẻ Thông tin cá nhân */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: '#FBD5CC',
              }}
            >
              <UserRound size={26} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="cardTitle" color={colors.textPrimary}>
                {displayName}
              </AppText>
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: colors.primarySoft,
                  paddingHorizontal: 9,
                  paddingVertical: 3,
                  borderRadius: 999,
                  marginTop: 4,
                }}
              >
                <AppText variant="small" color={colors.primary} style={{ fontWeight: '700' }}>
                  Nhân viên chi nhánh (STAFF)
                </AppText>
              </View>
            </View>
          </View>

          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingTop: 12,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Store size={16} color={colors.primary} />
              <AppText variant="small" color={colors.textSecondary}>
                Chi nhánh làm việc:
              </AppText>
              <AppText variant="bodySemiBold" color={colors.textPrimary} style={{ flex: 1 }}>
                {effectiveStoreName}
              </AppText>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Phone size={16} color={colors.textSecondary} />
              <AppText variant="small" color={colors.textSecondary}>
                Số điện thoại:
              </AppText>
              <AppText variant="bodySemiBold" color={colors.textPrimary}>
                {displayPhone}
              </AppText>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Mail size={16} color={colors.textSecondary} />
              <AppText variant="small" color={colors.textSecondary}>
                Email đăng nhập:
              </AppText>
              <AppText variant="bodySemiBold" color={colors.textPrimary} style={{ flex: 1 }}>
                {displayEmail}
              </AppText>
            </View>
          </View>
        </View>

        {/* Thẻ Đổi mật khẩu */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <KeyRound size={18} color={colors.primary} />
            <AppText variant="cardTitle" color={colors.textPrimary}>
              Đổi mật khẩu tài khoản
            </AppText>
          </View>
          <AppText variant="small" color={colors.textSecondary} style={{ marginBottom: 14 }}>
            Đặt mật khẩu riêng để bảo vệ tài khoản nhân viên của bạn.
          </AppText>

          {/* Mật khẩu hiện tại */}
          <AppText variant="captionSemiBold" color={colors.textPrimary} style={{ marginBottom: 6 }}>
            Mật khẩu hiện tại <AppText variant="captionSemiBold" color={colors.primary}>*</AppText>
          </AppText>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 12,
              height: 44,
              marginBottom: 12,
            }}
          >
            <TextInput
              value={currentPassword}
              onChangeText={(t) => {
                setCurrentPassword(t);
                if (pwError) setPwError('');
              }}
              placeholder="Nhập mật khẩu hiện tại của bạn"
              placeholderTextColor={colors.textDisabled}
              secureTextEntry={!showCurrentPw}
              style={{ flex: 1, fontSize: 14, color: colors.textPrimary }}
            />
            <TouchableOpacity onPress={() => setShowCurrentPw((v) => !v)}>
              {showCurrentPw ? (
                <EyeOff size={18} color={colors.textSecondary} />
              ) : (
                <Eye size={18} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>

          {/* Mật khẩu mới */}
          <AppText variant="captionSemiBold" color={colors.textPrimary} style={{ marginBottom: 6 }}>
            Mật khẩu mới <AppText variant="captionSemiBold" color={colors.primary}>*</AppText>
          </AppText>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 12,
              height: 44,
              marginBottom: newPassword.length > 0 && !isPasswordValid(newPassword) ? 6 : 12,
            }}
          >
            <TextInput
              value={newPassword}
              onChangeText={(t) => {
                setNewPassword(t);
                if (pwError) setPwError('');
              }}
              placeholder="Nhập mật khẩu mới của bạn"
              placeholderTextColor={colors.textDisabled}
              secureTextEntry={!showNewPw}
              style={{ flex: 1, fontSize: 14, color: colors.textPrimary }}
            />
            <TouchableOpacity onPress={() => setShowNewPw((v) => !v)}>
              {showNewPw ? (
                <EyeOff size={18} color={colors.textSecondary} />
              ) : (
                <Eye size={18} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>
          {newPassword.length > 0 && !isPasswordValid(newPassword) && (
            <AppText
              variant="small"
              color={colors.primary}
              style={{ marginBottom: 12, lineHeight: 18 }}
            >
              Mật khẩu của bạn phải có tối thiểu 8 ký tự, phải chứa ít nhất một chữ thường, một chữ hoa, một số, một ký tự đặc biệt và không được có khoảng trắng.
            </AppText>
          )}

          {/* Xác nhận mật khẩu mới */}
          <AppText variant="captionSemiBold" color={colors.textPrimary} style={{ marginBottom: 6 }}>
            Xác nhận mật khẩu mới <AppText variant="captionSemiBold" color={colors.primary}>*</AppText>
          </AppText>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 12,
              height: 44,
              marginBottom:
                confirmPassword.length > 0 && confirmPassword !== newPassword ? 6 : 12,
            }}
          >
            <TextInput
              value={confirmPassword}
              onChangeText={(t) => {
                setConfirmPassword(t);
                if (pwError) setPwError('');
              }}
              placeholder="Nhập lại mật khẩu mới của bạn"
              placeholderTextColor={colors.textDisabled}
              secureTextEntry={!showConfirmPw}
              style={{ flex: 1, fontSize: 14, color: colors.textPrimary }}
            />
            <TouchableOpacity onPress={() => setShowConfirmPw((v) => !v)}>
              {showConfirmPw ? (
                <EyeOff size={18} color={colors.textSecondary} />
              ) : (
                <Eye size={18} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>
          {confirmPassword.length > 0 && confirmPassword !== newPassword && (
            <AppText
              variant="small"
              color={colors.primary}
              style={{ marginBottom: 12, lineHeight: 18 }}
            >
              Xác nhận mật khẩu mới không khớp.
            </AppText>
          )}

          {!!pwError && (
            <View
              style={{
                backgroundColor: '#FEF2F2',
                borderWidth: 1,
                borderColor: '#FECACA',
                borderRadius: 10,
                padding: 10,
                marginBottom: 12,
              }}
            >
              <AppText variant="small" color="#DC2626">
                {pwError}
              </AppText>
            </View>
          )}

          <AppButton
            title="Cập nhật mật khẩu"
            isLoading={changingPw}
            onPress={handleChangePassword}
          />
        </View>

        {/* Nút Đăng xuất */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setLogoutModalVisible(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: '#FEF2F2',
            borderWidth: 1,
            borderColor: '#FECACA',
            paddingVertical: 13,
            borderRadius: 12,
          }}
        >
          <LogOut size={18} color="#DC2626" />
          <AppText variant="bodySemiBold" color="#DC2626">
            Đăng xuất tài khoản
          </AppText>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal xác nhận đăng xuất */}
      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 20,
              width: '100%',
              maxWidth: 400,
              alignSelf: 'center',
            }}
          >
            <AppText variant="h3" color={colors.textPrimary} style={{ marginBottom: 6 }}>
              Đăng xuất ca làm?
            </AppText>
            <AppText variant="small" color={colors.textSecondary} style={{ marginBottom: 16 }}>
              Bạn có chắc chắn muốn đăng xuất khỏi tài khoản nhân viên {displayName} không?
            </AppText>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <AppButton
                title="Hủy"
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => setLogoutModalVisible(false)}
              />
              <AppButton
                title="Đăng xuất"
                variant="danger"
                style={{ flex: 1 }}
                isLoading={loggingOut}
                onPress={handleConfirmLogout}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

