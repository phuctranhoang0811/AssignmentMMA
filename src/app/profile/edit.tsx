import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { User, Phone, Mail } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { AppInput } from '../../components/ui/AppInput';
import { AppButton } from '../../components/ui/AppButton';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useAuth } from '../../state/AuthContext';
import { isValidName, isValidPhone } from '../../utils/validators';

export default function EditProfileScreen() {
  const { user, updateProfile } = useAuth();
  const [fullname, setFullname] = useState(user?.fullname || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!isValidName(fullname)) {
      errs.fullname = 'Tên không hợp lệ (tối thiểu 2 ký tự)';
    }
    if (!isValidPhone(phone)) {
      errs.phone = 'Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)';
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setIsLoading(true);
    try {
      await updateProfile(fullname, phone);
      Alert.alert('Thành công', 'Thông tin hồ sơ đã được cập nhật!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="Chỉnh sửa thông tin" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <AppInput
          label="Họ và tên"
          value={fullname}
          onChangeText={(t) => {
            setFullname(t);
            setErrors((prev) => ({ ...prev, fullname: '' }));
          }}
          error={errors.fullname}
          leftIcon={<User size={18} color={colors.textSecondary} />}
        />

        <AppInput
          label="Số điện thoại"
          value={phone}
          onChangeText={(t) => {
            setPhone(t);
            setErrors((prev) => ({ ...prev, phone: '' }));
          }}
          keyboardType="phone-pad"
          error={errors.phone}
          leftIcon={<Phone size={18} color={colors.textSecondary} />}
        />

        <AppInput
          label="Email (Không thể thay đổi)"
          value={user?.email || ''}
          editable={false}
          leftIcon={<Mail size={18} color={colors.textDisabled} />}
          helperText="Email liên kết với tài khoản demo"
        />

        <AppButton
          title="Lưu thay đổi"
          onPress={handleSave}
          isLoading={isLoading}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
  },
});
