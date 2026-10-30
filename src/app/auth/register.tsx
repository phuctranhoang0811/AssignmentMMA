import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import { Alert } from '../../utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronDown, Check, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../../state/AuthContext';
import { sendOtpToEmail, verifyOtp } from '../../services/otpService';
import { styles, BRAND_RED } from '../../styles/register.styles';
import { CelebrationPopper } from '../../components/auth/CelebrationPopper';


export default function RegisterScreen() {
  const router = useRouter();
  const { registerDemo } = useAuth();

  // Current Step: 1 = Email OTP, 2 = Personal Info, 3 = Password, 4 = Success
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [email, setEmail] = useState('');
  const [fullname, setFullname] = useState('');
  const [birthYear, setBirthYear] = useState('2000');
  const [birthMonth, setBirthMonth] = useState('01');
  const [birthDay, setBirthDay] = useState('01');
  const [gender, setGender] = useState('Nam');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeRewards, setAgreeRewards] = useState(true);
  const [agreeNews, setAgreeNews] = useState(true);

  // OTP Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [timerSeconds, setTimerSeconds] = useState(300);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // Modals for Step 2 Date/Gender
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState<'year' | 'month' | 'day' | null>(null);

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
    } else if (currentStep === 3) {
      setCurrentStep(2);
    } else if (currentStep === 4) {
      router.replace('/(tabs)/home');
    }
  };

  // Step 1: Send OTP to Email
  const handleStep1Submit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      Alert.alert('Thông báo', 'Vui lòng nhập email hợp lệ.');
      return;
    }

    setIsSendingOtp(true);
    const result = await sendOtpToEmail(trimmedEmail);
    setIsSendingOtp(false);
    if (!result.success) {
      Alert.alert('Chưa gửi được mã', result.error);
      return;
    }

    setTimerSeconds(300);
    setOtp(['', '', '', '']);
    setShowOtpModal(true);
    Alert.alert(
      'Đã gửi mã OTP',
      `Mã xác nhận 4 số đã được gửi đến email:\n${trimmedEmail}\n\nVui lòng kiểm tra hộp thư đến (hoặc hòm thư Spam).`
    );
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (isSendingOtp) return;
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return;

    setIsSendingOtp(true);
    const result = await sendOtpToEmail(trimmedEmail);
    setIsSendingOtp(false);
    if (result.success) {
      setTimerSeconds(300);
      Alert.alert('Đã gửi lại mã', `Mã OTP mới đã được gửi đến email:\n${trimmedEmail}`);
    } else {
      Alert.alert('Chưa gửi được mã', result.error);
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

  const handleVerifyOtp = async () => {
    const codeStr = otp.join('');
    if (codeStr.length < 4) {
      Alert.alert('Thông báo', 'Vui lòng nhập đủ 4 số mã xác nhận.');
      return;
    }

    // The code only exists on the server, which checks expiry and limits attempts.
    const result = await verifyOtp(email.trim().toLowerCase(), codeStr);
    if (result.success) {
      setShowOtpModal(false);
      setCurrentStep(2);
    } else {
      Alert.alert('Sai mã xác nhận', result.error);
    }
  };

  // Step 2: Submit Personal Info
  const handleStep2Submit = () => {
    if (!fullname.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập tên của bạn.');
      return;
    }
    const cleanPhone = phone.trim().replace(/[\s.-]/g, '');
    if (!cleanPhone) {
      Alert.alert('Thông báo', 'Vui lòng nhập số điện thoại (bắt buộc).');
      return;
    }
    if (!/^0[0-9]{9}$/.test(cleanPhone)) {
      Alert.alert(
        'Thông báo',
        'Số điện thoại không hợp lệ (phải gồm đúng 10 số và bắt đầu bằng số 0).'
      );
      return;
    }
    setCurrentStep(3);
  };

  const isPasswordValid = (pwd: string) => {
    if (!pwd || pwd.length < 8) return false;
    if (/\s/.test(pwd)) return false;
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
    return hasLower && hasUpper && hasNumber && hasSpecial;
  };

  // Step 3: Register
  const handleStep3Submit = async () => {
    if (!isPasswordValid(password)) {
      Alert.alert(
        'Mật khẩu chưa đạt yêu cầu',
        'Mật khẩu của bạn phải có tối thiểu 8 ký tự, gồm ít nhất 1 chữ thường, 1 chữ hoa, 1 số, 1 ký tự đặc biệt và không có khoảng trắng.'
      );
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Thông báo', 'Xác nhận mật khẩu không khớp.');
      return;
    }
    if (!agreeRewards) {
      Alert.alert('Thông báo', 'Vui lòng đồng ý với điều khoản thành viên.');
      return;
    }

    try {
      const cleanPhone = phone.trim().replace(/[\s.-]/g, '');
      await registerDemo(fullname, email, cleanPhone, password, {
        gender,
        birthday: `${birthDay}/${birthMonth}/${birthYear}`,
        otpCode: otp.join(''),
      });
      setCurrentStep(4);
    } catch (e: any) {
      Alert.alert('Đăng ký thất bại', e.message || 'Có lỗi xảy ra.');
    }
  };

  // Options for pickers
  const years = Array.from({ length: 70 }, (_, i) => String(2010 - i));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header (Steps 1, 2, 3) */}
      {currentStep !== 4 && (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronLeft size={24} color="#1E2024" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tạo tài khoản</Text>
          <View style={{ width: 40 }} />
        </View>
      )}

      {/* Step Indicator Bar (Steps 1, 2, 3) */}
      {currentStep !== 4 && (
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
              <Text style={[styles.stepLabel, currentStep === 1 && styles.stepLabelActive]}>Bước 1</Text>
            </View>
            {currentStep === 1 && <View style={styles.activeUnderline} />}
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepRow}>
              {currentStep > 2 ? (
                <View style={styles.stepCompletedCircle}>
                  <Check size={14} color="#FFFFFF" strokeWidth={3} />
                </View>
              ) : (
                <View style={[styles.stepCircle, currentStep === 2 && styles.stepCircleActive]}>
                  <Text style={[styles.stepNumber, currentStep === 2 && styles.stepNumberActive]}>2</Text>
                </View>
              )}
              <Text style={[styles.stepLabel, currentStep === 2 && styles.stepLabelActive]}>Bước 2</Text>
            </View>
            {currentStep === 2 && <View style={styles.activeUnderline} />}
          </View>

          <View style={styles.stepItem}>
            <View style={styles.stepRow}>
              <View style={[styles.stepCircle, currentStep === 3 && styles.stepCircleActive]}>
                <Text style={[styles.stepNumber, currentStep === 3 && styles.stepNumberActive]}>3</Text>
              </View>
              <Text style={[styles.stepLabel, currentStep === 3 && styles.stepLabelActive]}>Hoàn tất</Text>
            </View>
            {currentStep === 3 && <View style={styles.activeUnderline} />}
          </View>
        </View>
      )}

      {/* Main Body per Step */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ======================================================== */}
          {/* BƯỚC 1: Nhập Email (thay SMS OTP)                        */}
          {/* ======================================================== */}
          {currentStep === 1 && (
            <View style={styles.stepContent}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Email <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Nhập email của bạn"
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
                  {isSendingOtp ? 'Đang gửi mã OTP...' : 'Xác nhận'}
                </Text>
              </TouchableOpacity>

              <View style={styles.footerLinkRow}>
                <Text style={styles.footerLinkText}>Đã có tài khoản? </Text>
                <TouchableOpacity onPress={() => router.push('/auth/login')}>
                  <Text style={styles.footerLinkHighlight}>Đăng nhập</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ======================================================== */}
          {/* BƯỚC 2: Điền thông tin cá nhân                           */}
          {/* ======================================================== */}
          {currentStep === 2 && (
            <View style={styles.stepContent}>
              {/* Tên */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Tên <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Nhập tên của bạn"
                    placeholderTextColor="#9CA3AF"
                    value={fullname}
                    onChangeText={setFullname}
                  />
                </View>
              </View>

              {/* Ngày sinh */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Ngày sinh <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.dateRow}>
                  <TouchableOpacity
                    style={styles.datePickerBtn}
                    onPress={() => setDatePickerType('year')}
                  >
                    <Text style={styles.datePickerBtnText}>{birthYear || 'Năm'}</Text>
                    <ChevronDown size={16} color="#6B7280" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.datePickerBtn}
                    onPress={() => setDatePickerType('month')}
                  >
                    <Text style={styles.datePickerBtnText}>Tháng {birthMonth || ''}</Text>
                    <ChevronDown size={16} color="#6B7280" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.datePickerBtn}
                    onPress={() => setDatePickerType('day')}
                  >
                    <Text style={styles.datePickerBtnText}>Ngày {birthDay || ''}</Text>
                    <ChevronDown size={16} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Giới tính */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Giới tính <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TouchableOpacity
                  style={[styles.inputContainer, styles.dropdownContainer]}
                  onPress={() => setShowGenderPicker(true)}
                >
                  <Text style={styles.textInput}>{gender || 'Chọn giới tính'}</Text>
                  <ChevronDown size={18} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Số điện thoại */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Số điện thoại <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Nhập số điện thoại của bạn"
                    placeholderTextColor="#9CA3AF"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
                activeOpacity={0.85}
                onPress={handleStep2Submit}
              >
                <Text style={styles.primaryBtnText}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ======================================================== */}
          {/* BƯỚC 3: Mật khẩu & Điều khoản                            */}
          {/* ======================================================== */}
          {currentStep === 3 && (
            <View style={styles.stepContent}>
              {/* Mật khẩu */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Mật khẩu <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={[styles.inputContainer, styles.passwordContainer]}>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    placeholder="Vui lòng nhập mật khẩu của bạn"
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

              {/* Xác nhận mật khẩu */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Xác nhận mật khẩu <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={[styles.inputContainer, styles.passwordContainer]}>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    placeholder="Nhập lại mật khẩu của bạn"
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
                    Xác nhận mật khẩu không khớp.
                  </Text>
                )}
              </View>

              {/* Checkboxes */}
              <TouchableOpacity
                style={styles.checkboxRow}
                activeOpacity={0.8}
                onPress={() => setAgreeRewards(!agreeRewards)}
              >
                <View style={[styles.checkboxSquare, agreeRewards && styles.checkboxSquareActive]}>
                  {agreeRewards && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                </View>
                <Text style={styles.checkboxLabel}>
                  Tôi đồng ý tham gia{' '}
                  <Text style={styles.checkboxLink}>Thành viên FPT REWARDS</Text> và chấp nhận{' '}
                  <Text style={styles.checkboxLink}>các điều khoản, điều kiện và chính sách bảo mật của Pizza FPT Vietnam</Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkboxRow}
                activeOpacity={0.8}
                onPress={() => setAgreeNews(!agreeNews)}
              >
                <View style={[styles.checkboxSquare, agreeNews && styles.checkboxSquareActive]}>
                  {agreeNews && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                </View>
                <Text style={styles.checkboxLabel}>
                  Tôi đồng ý nhận tin tức về Pizza FPT qua email và số điện thoại đã đăng ký
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryBtn}
                activeOpacity={0.85}
                onPress={handleStep3Submit}
              >
                <Text style={styles.primaryBtnText}>Đăng ký</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ======================================================== */}
          {/* BƯỚC 4: Hoàn tất chúc mừng thành công                     */}
          {/* ======================================================== */}
          {currentStep === 4 && (
            <View style={styles.successContainer}>
              <View style={styles.popperWrapper}>
                <CelebrationPopper />
              </View>

              <Text style={styles.successHeading}>Cảm ơn bạn đã đăng ký</Text>
              <Text style={styles.successSubheading}>
                Chúc mừng, tài khoản của bạn đã được tạo thành công.
              </Text>

              <TouchableOpacity
                style={styles.primaryBtn}
                activeOpacity={0.85}
                onPress={() => router.replace('/(tabs)/home')}
              >
                <Text style={styles.primaryBtnText}>Quay về trang chủ</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ======================================================== */}
      {/* POPUP OTP MODAL (Xác nhận đăng ký)                       */}
      {/* ======================================================== */}
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
            <Text style={styles.otpTitle}>Xác nhận đăng ký</Text>
            <View style={styles.redBarDecor} />

            <Text style={styles.otpDescription}>
              Vui lòng nhập mã xác nhận đã được gửi đến
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

      {/* Date Picker Modal */}
      <Modal
        visible={datePickerType !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDatePickerType(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDatePickerType(null)}>
          <View style={styles.pickerModalContent}>
            <Text style={styles.modalPickerTitle}>
              Chọn {datePickerType === 'year' ? 'Năm sinh' : datePickerType === 'month' ? 'Tháng sinh' : 'Ngày sinh'}
            </Text>
            <ScrollView style={{ maxHeight: 280 }}>
              {(datePickerType === 'year' ? years : datePickerType === 'month' ? months : days).map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.pickerItem}
                  onPress={() => {
                    if (datePickerType === 'year') setBirthYear(item);
                    if (datePickerType === 'month') setBirthMonth(item);
                    if (datePickerType === 'day') setBirthDay(item);
                    setDatePickerType(null);
                  }}
                >
                  <Text style={styles.pickerItemText}>
                    {datePickerType === 'month' ? `Tháng ${item}` : datePickerType === 'day' ? `Ngày ${item}` : item}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Gender Picker Modal */}
      <Modal
        visible={showGenderPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGenderPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowGenderPicker(false)}>
          <View style={styles.pickerModalContent}>
            <Text style={styles.modalPickerTitle}>Chọn giới tính</Text>
            {['Nam', 'Nữ', 'Khác'].map((item) => (
              <TouchableOpacity
                key={item}
                style={styles.pickerItem}
                onPress={() => {
                  setGender(item);
                  setShowGenderPicker(false);
                }}
              >
                <Text style={[styles.pickerItemText, gender === item && { color: BRAND_RED, fontWeight: '700' }]}>
                  {item}
                </Text>
                {gender === item && <Check size={18} color={BRAND_RED} />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

