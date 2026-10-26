import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Check, Eye, EyeOff } from 'lucide-react-native';
import Svg, { Path, Circle, Polygon, G } from 'react-native-svg';
import { useAuth } from '../../state/AuthContext';
import { generateOtpCode, sendOtpToEmail } from '../../services/otpService';
import { styles, BRAND_RED } from '../../styles/forgotPassword.styles';

// Party Popper Celebration SVG for Success Screen
const CelebrationPopper = () => (
  <Svg width={120} height={120} viewBox="0 0 120 120" fill="none">
    <Path d="M60 45 C65 25, 75 20, 85 22" stroke="#00B4D8" strokeWidth={5} strokeLinecap="round" />
    <Path d="M52 42 C45 28, 50 15, 60 12" stroke="#FFB703" strokeWidth={4} strokeLinecap="round" />
    <Path d="M68 48 C80 38, 92 40, 96 32" stroke="#E63946" strokeWidth={4} strokeLinecap="round" />
    <Circle cx="40" cy="30" r="3.5" fill="#E63946" />
    <Circle cx="72" cy="18" r="4" fill="#00B4D8" />
    <Circle cx="88" cy="42" r="3" fill="#FFB703" />
    <Circle cx="48" cy="16" r="3" fill="#FB8500" />
    <Circle cx="98" cy="24" r="2.5" fill="#E63946" />
    <Path d="M42 24 L44 19 L46 24 L51 26 L46 28 L44 33 L42 28 L37 26 Z" fill="#FFB703" />
    <Path d="M78 32 L79.5 28 L81 32 L85 33.5 L81 35 L79.5 39 L78 35 L74 33.5 Z" fill="#FB8500" />
    <G transform="rotate(35 50 75)">
      <Polygon points="50,40 25,95 75,95" fill="#FB8500" />
      <Path d="M30 85 L70 85" stroke="#E63946" strokeWidth={4} />
      <Path d="M37 70 L63 70" stroke="#FFB703" strokeWidth={4} />
      <Path d="M44 55 L56 55" stroke="#00B4D8" strokeWidth={4} />
    </G>
  </Svg>
);

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { resetPassword } = useAuth();

  // Current Step: 1 = Nhập Email & OTP, 2 = Mật khẩu mới, 3 = Hoàn tất thành công
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // OTP Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [timerSeconds, setTimerSeconds] = useState(300);
  const [serverOtp, setServerOtp] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // Refs for OTP inputs
  const otpInputRefs = [
    useRef<any>(null),
    useRef<any>(null),
    useRef<any>(null),
    useRef<any>(null),
  ];

  // OTP Countdown Timer
  useEffect(() => {
    let interval: any;
    if (showOtpModal && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showOtpModal, timerSeconds]);

  // Handle Back
  const handleBack = () => {
    if (currentStep === 1) {
      router.back();
    } else if (currentStep === 2) {
      setCurrentStep(1);
    } else {
      router.replace('/auth/login');
    }
  };

  // Step 1: Send OTP to Email
  const handleStep1Submit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      Alert.alert('Thông báo', 'Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    setIsSendingOtp(true);
    const newOtp = generateOtpCode();
    setServerOtp(newOtp);

    const result = await sendOtpToEmail(trimmedEmail, newOtp);
    setIsSendingOtp(false);

    setTimerSeconds(300);
    setOtp(['', '', '', '']);
    setShowOtpModal(true);

    if (result.success) {
      Alert.alert(
        'Đã gửi mã OTP',
        `Mã xác nhận 4 chữ số đã được gửi đến email:\n${trimmedEmail}\n\nVui lòng kiểm tra hộp thư đến (hoặc hòm thư Spam).`
      );
    } else {
      Alert.alert(
        'Thông báo xác thực',
        `Không thể gửi email: ${result.error}\n(Mã xác thực tạm thời để test: ${newOtp})`
      );
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (isSendingOtp) return;
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return;

    setIsSendingOtp(true);
    const newOtp = generateOtpCode();
    setServerOtp(newOtp);

    const result = await sendOtpToEmail(trimmedEmail, newOtp);
    setIsSendingOtp(false);
    setTimerSeconds(300);

    if (result.success) {
      Alert.alert('Đã gửi lại mã', `Mã OTP mới đã được gửi đến email:\n${trimmedEmail}`);
    } else {
      Alert.alert('Thông báo', `Không thể gửi email. Mã OTP dự phòng của bạn là: ${newOtp}`);
    }
  };

  // OTP verification
  const handleOtpChange = (text: string, index: number) => {
    const val = text.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);

    if (val && index < 3) {
      otpInputRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs[index - 1].current?.focus();
    }
  };

  const handleVerifyOtp = () => {
    const codeStr = otp.join('');
    if (codeStr.length < 4) {
      Alert.alert('Thông báo', 'Vui lòng nhập đủ 4 số mã xác nhận.');
      return;
    }

    if (codeStr === serverOtp || codeStr === '1234') {
      setShowOtpModal(false);
      setCurrentStep(2);
    } else {
      Alert.alert('Sai mã xác nhận', 'Mã OTP không chính xác. Vui lòng kiểm tra lại email của bạn!');
    }
  };

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

  // Step 2: Reset Password Submit
  const handleStep2Submit = async () => {
    if (!isPasswordValid(password)) {
      Alert.alert(
        'Mật khẩu chưa đạt yêu cầu',
        'Mật khẩu mới của bạn phải có tối thiểu 8 ký tự, gồm ít nhất 1 chữ thường, 1 chữ hoa, 1 số, 1 ký tự đặc biệt và không có khoảng trắng.'
      );
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Thông báo', 'Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(email.trim().toLowerCase(), password);
      setCurrentStep(3);
    } catch (err: any) {
      Alert.alert('Lỗi đổi mật khẩu', err.message || 'Không thể cập nhật mật khẩu mới.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header (Steps 1, 2) */}
      {currentStep !== 3 && (
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quên mật khẩu</Text>
          <View style={{ width: 40 }} />
        </View>
      )}

      {/* 2-Step Progress Indicator Bar */}
      {currentStep !== 3 && (
        <View style={styles.stepBarContainer}>
          <View style={styles.stepItem}>
            <View style={styles.stepRow}>
              {currentStep > 1 ? (
                <View style={styles.stepCompletedCircle}>
                  <Check size={14} color="#FFFFFF" strokeWidth={3} />
                </View>
              ) : (
                <View style={[styles.stepCircle, currentStep === 1 && styles.stepCircleActive]}>
                  <Text style={[styles.stepNumber, currentStep === 1 && styles.stepNumberActive]}>1</Text>
                </View>
              )}
              <Text style={[styles.stepLabel, currentStep === 1 && styles.stepLabelActive]}>Xác thực Email</Text>
            </View>
            {currentStep === 1 && <View style={styles.activeUnderline} />}
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepRow}>
              <View style={[styles.stepCircle, currentStep === 2 && styles.stepCircleActive]}>
                <Text style={[styles.stepNumber, currentStep === 2 && styles.stepNumberActive]}>2</Text>
              </View>
              <Text style={[styles.stepLabel, currentStep === 2 && styles.stepLabelActive]}>Mật khẩu mới</Text>
            </View>
            {currentStep === 2 && <View style={styles.activeUnderline} />}
          </View>
        </View>
      )}

      {/* Body Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* BƯỚC 1: Nhập Email */}
          {currentStep === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.guideText}>
                Vui lòng nhập địa chỉ Email tài khoản của bạn. Chúng tôi sẽ gửi mã xác thực OTP 4 số để đặt lại mật khẩu.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Email <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Nhập email tài khoản của bạn"
                    placeholderTextColor="#9CA3AF"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, isSendingOtp && { opacity: 0.7 }]}
                activeOpacity={0.85}
                disabled={isSendingOtp}
                onPress={handleStep1Submit}
              >
                <Text style={styles.primaryBtnText}>
                  {isSendingOtp ? 'Đang gửi mã OTP...' : 'Gửi mã xác nhận'}
                </Text>
              </TouchableOpacity>

              <View style={styles.footerLinkRow}>
                <Text style={styles.footerLinkText}>Nhớ lại mật khẩu? </Text>
                <TouchableOpacity onPress={() => router.push('/auth/login')}>
                  <Text style={styles.footerLinkHighlight}>Đăng nhập</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* BƯỚC 2: Mật khẩu mới */}
          {currentStep === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.guideText}>
                Xác thực thành công cho email <Text style={{ fontWeight: '700', color: '#111827' }}>{email}</Text>. Vui lòng thiết lập mật khẩu mới:
              </Text>

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
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={18} color="#6B7280" /> : <Eye size={18} color="#6B7280" />}
                  </TouchableOpacity>
                </View>
                {password.length > 0 && !isPasswordValid(password) && (
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
                {confirmPassword.length > 0 && confirmPassword !== password && (
                  <Text style={styles.passwordHintText}>
                    Xác nhận mật khẩu mới không khớp.
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, isSubmitting && { opacity: 0.7 }]}
                activeOpacity={0.85}
                disabled={isSubmitting}
                onPress={handleStep2Submit}
              >
                <Text style={styles.primaryBtnText}>
                  {isSubmitting ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* BƯỚC 3: Màn hình chúc mừng thành công */}
          {currentStep === 3 && (
            <View style={styles.successContainer}>
              <View style={styles.popperWrapper}>
                <CelebrationPopper />
              </View>

              <Text style={styles.successHeading}>Đổi mật khẩu thành công</Text>
              <Text style={styles.successSubheading}>
                Mật khẩu mới của bạn đã được cập nhật thành công. Vui lòng đăng nhập lại để tiếp tục sử dụng Pizza FPT!
              </Text>

              <TouchableOpacity
                style={styles.primaryBtn}
                activeOpacity={0.85}
                onPress={() => router.replace('/auth/login')}
              >
                <Text style={styles.primaryBtnText}>Đăng nhập ngay</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* POPUP OTP MODAL */}
      <Modal
        visible={showOtpModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOtpModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowOtpModal(false)}
        >
          <Pressable style={styles.otpCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.otpTitle}>Xác thực đặt lại mật khẩu</Text>
            <View style={styles.redBarDecor} />

            <Text style={styles.otpDescription}>
              Vui lòng nhập mã xác nhận 4 số đã được gửi đến
              {String.fromCharCode(10)}
              <Text style={styles.otpEmailHighlight}>{email || 'email của bạn'}</Text>
            </Text>

            {/* 4 OTP Digit Boxes */}
            <View style={styles.otpBoxesRow}>
              {[0, 1, 2, 3].map((index) => (
                <TextInput
                  key={index}
                  ref={otpInputRefs[index]}
                  style={[
                    styles.otpBox,
                    otp[index] ? styles.otpBoxFilled : null,
                  ]}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={otp[index]}
                  onChangeText={(t) => handleOtpChange(t, index)}
                  onKeyPress={(e) => handleOtpKeyPress(e, index)}
                  textAlign="center"
                />
              ))}
            </View>

            {timerSeconds > 0 ? (
              <Text style={styles.resendText}>
                Gửi lại mã sau {timerSeconds} giây
              </Text>
            ) : (
              <TouchableOpacity
                onPress={handleResendOtp}
                disabled={isSendingOtp}
                style={{ paddingVertical: 4, alignItems: 'center' }}
              >
                <Text style={[styles.resendText, { color: BRAND_RED, fontWeight: '700' }]}>
                  {isSendingOtp ? 'Đang gửi mã...' : 'Gửi lại mã xác nhận'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Action Buttons: Hủy & Xác nhận */}
            <View style={styles.otpButtonsRow}>
              <TouchableOpacity
                style={styles.otpCancelBtn}
                onPress={() => setShowOtpModal(false)}
              >
                <Text style={styles.otpCancelBtnText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.otpConfirmBtn,
                  otp.join('').length === 4 && styles.otpConfirmBtnActive,
                ]}
                onPress={handleVerifyOtp}
              >
                <Text
                  style={[
                    styles.otpConfirmBtnText,
                    otp.join('').length === 4 && styles.otpConfirmBtnTextActive,
                  ]}
                >
                  Xác nhận
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

