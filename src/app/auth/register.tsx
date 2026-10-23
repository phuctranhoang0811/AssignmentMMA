import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronDown, Check, CheckSquare, Square, Eye, EyeOff } from 'lucide-react-native';
import Svg, { Path, Polygon, Circle, Rect, G } from 'react-native-svg';
import { useAuth } from '../../state/AuthContext';

const BRAND_RED = '#CF4226';

// Party Popper Celebration SVG for Step 4
const CelebrationPopper = () => (
  <Svg width={120} height={120} viewBox="0 0 120 120" fill="none">
    {/* Confetti streamers */}
    <Path d="M60 45 C65 25, 75 20, 85 22" stroke="#00B4D8" strokeWidth={5} strokeLinecap="round" />
    <Path d="M52 42 C45 28, 50 15, 60 12" stroke="#FFB703" strokeWidth={4} strokeLinecap="round" />
    <Path d="M68 48 C80 38, 92 40, 96 32" stroke="#E63946" strokeWidth={4} strokeLinecap="round" />
    
    {/* Stars / Confetti dots */}
    <Circle cx="40" cy="30" r="3.5" fill="#E63946" />
    <Circle cx="72" cy="18" r="4" fill="#00B4D8" />
    <Circle cx="88" cy="42" r="3" fill="#FFB703" />
    <Circle cx="48" cy="16" r="3" fill="#FB8500" />
    <Circle cx="98" cy="24" r="2.5" fill="#E63946" />

    {/* Sparkle Stars */}
    <Path d="M42 24 L44 19 L46 24 L51 26 L46 28 L44 33 L42 28 L37 26 Z" fill="#FFB703" />
    <Path d="M78 32 L79.5 28 L81 32 L85 33.5 L81 35 L79.5 39 L78 35 L74 33.5 Z" fill="#FB8500" />

    {/* Party Cone with Stripes */}
    <G transform="rotate(35 50 75)">
      {/* Base Cone */}
      <Polygon points="50,40 25,95 75,95" fill="#FB8500" />
      {/* Red Stripes */}
      <Polygon points="40,62 33,78 67,78 60,62" fill="#E63946" />
      <Polygon points="46,48 43,55 57,55 54,48" fill="#E63946" />
      <Polygon points="28,88 25,95 75,95 72,88" fill="#E63946" />
    </G>
  </Svg>
);

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
  const [timerSeconds, setTimerSeconds] = useState(296);

  // Modals for Step 2 Date/Gender
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState<'year' | 'month' | 'day' | null>(null);

  // Refs for OTP inputs
  const otpInputRefs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
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
  const handleStep1Submit = () => {
    if (!email || !email.includes('@')) {
      Alert.alert('Thông báo', 'Vui lòng nhập email hợp lệ.');
      return;
    }
    setTimerSeconds(296);
    setOtp(['', '', '', '']);
    setShowOtpModal(true);
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
    // Success -> proceed to Step 2
    setShowOtpModal(false);
    setCurrentStep(2);
  };

  // Step 2: Submit Personal Info
  const handleStep2Submit = () => {
    if (!fullname.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập tên của bạn.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập số điện thoại.');
      return;
    }
    setCurrentStep(3);
  };

  // Step 3: Register
  const handleStep3Submit = async () => {
    if (!password || password.length < 8) {
      Alert.alert('Thông báo', 'Mật khẩu phải có tối thiểu 8 ký tự.');
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
      await registerDemo(fullname, email, phone);
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
                style={styles.primaryBtn}
                activeOpacity={0.85}
                onPress={handleStep1Submit}
              >
                <Text style={styles.primaryBtnText}>Xác nhận</Text>
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
                <Text style={styles.passwordHintText}>
                  Mật khẩu của bạn phải có tối thiểu 8 ký tự, phải chứa ít nhất một chữ thường, một chữ hoa, một số, một ký tự đặc biệt và không được có khoảng trắng.
                </Text>
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

            <Text style={styles.resendText}>
              Gửi lại mã sau {timerSeconds} giây
            </Text>

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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E2024',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },

  /* Step Indicator Bar */
  stepBarContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
  },
  stepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  stepCircleActive: {
    backgroundColor: BRAND_RED,
    borderColor: BRAND_RED,
  },
  stepCompletedCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BRAND_RED,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  stepNumberActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  stepLabelActive: {
    color: BRAND_RED,
    fontWeight: '700',
  },
  activeUnderline: {
    height: 2.5,
    width: '100%',
    backgroundColor: BRAND_RED,
  },

  /* Scroll and Content */
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  stepContent: {
    width: '100%',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14.5,
    fontWeight: '500',
    color: '#1E2024',
    marginBottom: 8,
  },
  requiredStar: {
    color: BRAND_RED,
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  dropdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textInput: {
    fontSize: 15,
    color: '#1E2024',
    padding: 0,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  passwordHintText: {
    fontSize: 12,
    color: BRAND_RED,
    lineHeight: 17,
    marginTop: 6,
  },

  /* Date Row in Step 2 */
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  datePickerBtn: {
    flex: 1,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  datePickerBtnText: {
    fontSize: 14,
    color: '#1E2024',
  },

  /* Checkboxes in Step 3 */
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  checkboxSquare: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
    backgroundColor: '#FFFFFF',
  },
  checkboxSquareActive: {
    backgroundColor: BRAND_RED,
    borderColor: BRAND_RED,
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    flex: 1,
  },
  checkboxLink: {
    textDecorationLine: 'underline',
    color: '#1F2937',
  },

  /* Primary Button */
  primaryBtn: {
    backgroundColor: BRAND_RED,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footerLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerLinkText: {
    fontSize: 14,
    color: '#4B5563',
  },
  footerLinkHighlight: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND_RED,
  },

  /* Step 4 Celebration */
  successContainer: {
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  popperWrapper: {
    marginBottom: 24,
  },
  successHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111215',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubheading: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111215',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },

  /* OTP Modal Popup */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  otpCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 18,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  otpTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111215',
  },
  redBarDecor: {
    width: 44,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: BRAND_RED,
    marginTop: 8,
    marginBottom: 14,
  },
  otpDescription: {
    fontSize: 13.5,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  otpEmailHighlight: {
    fontWeight: '700',
    color: '#111215',
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  otpBox: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    fontSize: 22,
    fontWeight: '700',
    color: '#111215',
    backgroundColor: '#FFFFFF',
  },
  otpBoxFilled: {
    borderColor: BRAND_RED,
  },
  resendText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 20,
  },
  otpButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  otpCancelBtn: {
    width: '47%',
    height: 44,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: BRAND_RED,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpCancelBtnText: {
    color: BRAND_RED,
    fontSize: 15,
    fontWeight: '700',
  },
  otpConfirmBtn: {
    width: '47%',
    height: 44,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpConfirmBtnActive: {
    backgroundColor: BRAND_RED,
  },
  otpConfirmBtnText: {
    color: '#9CA3AF',
    fontSize: 15,
    fontWeight: '700',
  },
  otpConfirmBtnTextActive: {
    color: '#FFFFFF',
  },

  /* Picker Modals */
  pickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 280,
  },
  modalPickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111215',
    textAlign: 'center',
    marginBottom: 12,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerItemText: {
    fontSize: 15,
    color: '#1F2937',
  },
});
