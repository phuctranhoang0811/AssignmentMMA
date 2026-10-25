import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../../state/AuthContext';

const BRAND_RED = '#CF4226';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { changePassword } = useAuth();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password validation helper
  const isPasswordValid = (pwd: string) => {
    if (!pwd || pwd.length < 8) return false;
    if (/\s/.test(pwd)) return false;
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
    return hasLower && hasUpper && hasNumber && hasSpecial;
  };

  const handleSubmit = async () => {
    if (!oldPassword) {
      Alert.alert('Thông báo', 'Vui lòng nhập mật khẩu hiện tại của bạn.');
      return;
    }
    if (!isPasswordValid(newPassword)) {
      Alert.alert(
        'Mật khẩu chưa đạt yêu cầu',
        'Mật khẩu mới phải có tối thiểu 8 ký tự, gồm ít nhất 1 chữ thường, 1 chữ hoa, 1 số, 1 ký tự đặc biệt và không có khoảng trắng.'
      );
      return;
    }
    if (oldPassword === newPassword) {
      Alert.alert('Thông báo', 'Mật khẩu mới không được trùng với mật khẩu hiện tại.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Thông báo', 'Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword(oldPassword, newPassword);
      Alert.alert('Thành công', 'Mật khẩu của bạn đã được cập nhật thành công!', [
        {
          text: 'Đồng ý',
          onPress: () => router.back(),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Lỗi đổi mật khẩu', err.message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đổi mật khẩu</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Mật khẩu hiện tại */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Mật khẩu hiện tại <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={[styles.inputContainer, styles.passwordContainer]}>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                placeholder="Nhập mật khẩu hiện tại của bạn"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showOldPassword}
                value={oldPassword}
                onChangeText={setOldPassword}
              />
              <TouchableOpacity onPress={() => setShowOldPassword(!showOldPassword)}>
                {showOldPassword ? <EyeOff size={18} color="#6B7280" /> : <Eye size={18} color="#6B7280" />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Mật khẩu mới */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Mật khẩu mới <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={[styles.inputContainer, styles.passwordContainer]}>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                placeholder="Nhập mật khẩu mới của bạn"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                {showNewPassword ? <EyeOff size={18} color="#6B7280" /> : <Eye size={18} color="#6B7280" />}
              </TouchableOpacity>
            </View>
            {newPassword.length > 0 && !isPasswordValid(newPassword) && (
              <Text style={styles.passwordHintText}>
                Mật khẩu của bạn phải có tối thiểu 8 ký tự, phải chứa ít nhất một chữ thường, một chữ hoa, một số, một ký tự đặc biệt và không được có khoảng trắng.
              </Text>
            )}
          </View>

          {/* Xác nhận mật khẩu mới */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Xác nhận mật khẩu mới <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={[styles.inputContainer, styles.passwordContainer]}>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                placeholder="Nhập lại mật khẩu mới của bạn"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                {showConfirmPassword ? <EyeOff size={18} color="#6B7280" /> : <Eye size={18} color="#6B7280" />}
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && confirmPassword !== newPassword && (
              <Text style={styles.passwordHintText}>
                Xác nhận mật khẩu mới không khớp.
              </Text>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.primaryBtn, isSubmitting && { opacity: 0.7 }]}
            activeOpacity={0.85}
            disabled={isSubmitting}
            onPress={handleSubmit}
          >
            <Text style={styles.primaryBtnText}>
              {isSubmitting ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  requiredStar: {
    color: BRAND_RED,
  },
  inputContainer: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textInput: {
    fontSize: 15,
    color: '#111827',
    padding: 0,
  },
  passwordHintText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 6,
    lineHeight: 18,
  },
  primaryBtn: {
    height: 48,
    backgroundColor: BRAND_RED,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    shadowColor: BRAND_RED,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
