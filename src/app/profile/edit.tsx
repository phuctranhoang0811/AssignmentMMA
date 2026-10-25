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
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronDown, Check } from 'lucide-react-native';
import { useAuth } from '../../state/AuthContext';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateProfile } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [fullname, setFullname] = useState(user?.fullname || 'Huỳnh Ngọc Công Luân');
  const [birthday, setBirthday] = useState(user?.birthday || '01/01/2000');
  const [gender, setGender] = useState(user?.gender || 'Nam');
  const [phone, setPhone] = useState(user?.phone || '84934860591');
  const [email, setEmail] = useState(user?.email || 'luanhuynh296@gmail.com');
  const [showGenderModal, setShowGenderModal] = useState(false);

  const handleToggleEdit = async () => {
    if (isEditing) {
      // Save changes
      try {
        await updateProfile(fullname, phone, birthday, gender, email);
        if (Platform.OS === 'web') {
          alert('Cập nhật hồ sơ thành công!');
        } else {
          Alert.alert('Thành công', 'Cập nhật hồ sơ thành công!');
        }
        setIsEditing(false);
      } catch {
        Alert.alert('Lỗi', 'Không thể lưu thay đổi. Vui lòng thử lại.');
      }
    } else {
      setIsEditing(true);
    }
  };

  const handleSelectGender = (val: string) => {
    setGender(val);
    setShowGenderModal(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={24} color="#1E2024" strokeWidth={2} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Hồ sơ của tôi</Text>

        <TouchableOpacity
          onPress={handleToggleEdit}
          style={styles.actionButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[styles.actionButtonText, isEditing && styles.saveButtonText]}>
            {isEditing ? 'Lưu' : 'Sửa'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Tên */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Tên</Text>
          <View style={[styles.inputBox, isEditing && styles.inputBoxEditing]}>
            <TextInput
              style={styles.inputText}
              value={fullname}
              onChangeText={setFullname}
              editable={isEditing}
              placeholder="Nhập tên"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        {/* Ngày sinh */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Ngày sinh</Text>
          <View style={[styles.inputBox, isEditing && styles.inputBoxEditing]}>
            <TextInput
              style={styles.inputText}
              value={birthday}
              onChangeText={setBirthday}
              editable={isEditing}
              placeholder="DD/MM/YYYY"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        {/* Giới tính */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Giới tính</Text>
          <TouchableOpacity
            style={[styles.inputBox, styles.dropdownBox, isEditing && styles.inputBoxEditing]}
            activeOpacity={isEditing ? 0.7 : 0.9}
            onPress={() => {
              if (isEditing) setShowGenderModal(true);
            }}
          >
            <Text style={styles.inputText}>{gender}</Text>
            <ChevronDown size={18} color="#4A5568" />
          </TouchableOpacity>
        </View>

        {/* Số điện thoại */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Số điện thoại</Text>
          <View style={[styles.inputBox, isEditing && styles.inputBoxEditing]}>
            <TextInput
              style={styles.inputText}
              value={phone}
              onChangeText={setPhone}
              editable={isEditing}
              keyboardType="phone-pad"
              placeholder="Nhập số điện thoại"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        {/* Email */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <View style={[styles.inputBox, isEditing && styles.inputBoxEditing]}>
            <TextInput
              style={styles.inputText}
              value={email}
              onChangeText={setEmail}
              editable={isEditing}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="Nhập email"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>
      </ScrollView>

      {/* Modal chọn Giới tính */}
      <Modal
        visible={showGenderModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGenderModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowGenderModal(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Chọn giới tính</Text>
            {['Nam', 'Nữ', 'Khác'].map((item) => (
              <TouchableOpacity
                key={item}
                style={styles.genderOption}
                onPress={() => handleSelectGender(item)}
              >
                <Text
                  style={[
                    styles.genderOptionText,
                    gender === item && styles.genderOptionSelectedText,
                  ]}
                >
                  {item}
                </Text>
                {gender === item && <Check size={18} color="#CF4226" />}
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
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
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
  actionButton: {
    minWidth: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E2024',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  saveButtonText: {
    color: '#CF4226',
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1E2024',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  inputBox: {
    backgroundColor: '#E1E4EE',
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  inputBoxEditing: {
    backgroundColor: '#EBF0F8',
    borderWidth: 1.5,
    borderColor: '#CF4226',
  },
  dropdownBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputText: {
    fontSize: 15,
    color: '#1E2024',
    padding: 0,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },

  /* Modal chọn giới tính */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E2024',
    marginBottom: 14,
    textAlign: 'center',
  },
  genderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F2',
  },
  genderOptionText: {
    fontSize: 15,
    color: '#1E2024',
  },
  genderOptionSelectedText: {
    color: '#CF4226',
    fontWeight: '700',
  },
});
