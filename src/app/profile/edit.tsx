import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { Alert } from '../../utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronDown, Check } from 'lucide-react-native';
import { useAuth } from '../../state/AuthContext';
import { styles } from '../../styles/profileEdit.styles';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateProfile } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [fullname, setFullname] = useState(user?.fullname || '');
  const [birthday, setBirthday] = useState(user?.birthday || '01/01/2000');
  const [gender, setGender] = useState(user?.gender || 'Nam');
  const phone = user?.phone || '';
  const email = user?.email || '';
  const [showGenderModal, setShowGenderModal] = useState(false);

  const handleToggleEdit = async () => {
    if (isEditing) {
      // Save changes (chỉ cho phép sửa Tên, Ngày sinh, Giới tính; giữ nguyên SĐT và Email)
      try {
        await updateProfile(fullname.trim() || fullname, phone, birthday, gender, email);
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

        {/* Số điện thoại (Không cho phép chỉnh sửa) */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Số điện thoại</Text>
          <View style={[styles.inputBox, isEditing && { opacity: 0.65 }]}>
            <TextInput
              style={[styles.inputText, isEditing && { color: '#6B7280' }]}
              value={phone}
              editable={false}
              selectTextOnFocus={false}
              keyboardType="phone-pad"
              placeholder="Chưa cập nhật số điện thoại"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        {/* Email (Không cho phép chỉnh sửa) */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <View style={[styles.inputBox, isEditing && { opacity: 0.65 }]}>
            <TextInput
              style={[styles.inputText, isEditing && { color: '#6B7280' }]}
              value={email}
              editable={false}
              selectTextOnFocus={false}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="Chưa cập nhật email"
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
