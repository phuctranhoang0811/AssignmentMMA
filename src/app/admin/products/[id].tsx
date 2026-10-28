import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { colors } from '../../../theme/colors';
import { styles } from '../../../styles/adminProducts.styles';
import { mockProducts } from '../../../data/mockProducts';
import { formatCurrency } from '../../../utils/formatCurrency';
import { PIZZA_SIZES, PIZZA_CRUSTS } from '../../../types/pizzaCustomization';

export default function AdminProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [desc, setDesc] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);

  // Cấu hình Kích thước (Size) & Đế (Crust) theo Mục 4.1 SYSTEM_FLOWS
  const [sizeOptions, setSizeOptions] = useState([
    { id: 'small', name: 'Size Nhỏ (7" - 20cm)', extraPrice: 0, enabled: true },
    { id: 'medium', name: 'Size Vừa (9" - 25cm)', extraPrice: 40000, enabled: true },
    { id: 'large', name: 'Size Lớn (12" - 30cm)', extraPrice: 90000, enabled: true },
  ]);

  const [crustOptions, setCrustOptions] = useState([
    { id: 'classic', name: 'Đế mỏng giòn truyền thống', extraPrice: 0, enabled: true },
    { id: 'thick', name: 'Đế dày xốp', extraPrice: 0, enabled: true },
    { id: 'cheese', name: 'Đế viền phô mai béo ngậy', extraPrice: 35000, enabled: true },
    { id: 'sausage', name: 'Đế viền xúc xích phô mai', extraPrice: 45000, enabled: true },
  ]);

  useEffect(() => {
    async function fetchDetail() {
      if (!id) return;
      try {
        const docRef = doc(db, 'products', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setName(data.name || '');
          setPrice(String(data.basePrice || ''));
          setDesc(data.description || '');
          setIsAvailable(data.isAvailable !== false);
          if (data.sizeOptions) setSizeOptions(data.sizeOptions);
          if (data.crustOptions) setCrustOptions(data.crustOptions);
        } else {
          const found = mockProducts.find((p) => p.id === id);
          if (found) {
            setName(found.name);
            setPrice(String(found.basePrice));
            setDesc(found.description);
            setIsAvailable(found.isAvailable !== false);
          }
        }
      } catch (e) {
        const found = mockProducts.find((p) => p.id === id);
        if (found) {
          setName(found.name);
          setPrice(String(found.basePrice));
          setDesc(found.description);
          setIsAvailable(found.isAvailable !== false);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [id]);

  const handleSave = async () => {
    if (!name.trim() || !price.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên và giá');
      return;
    }
    setSaving(true);
    try {
      if (id) {
        const docRef = doc(db, 'products', id);
        await updateDoc(docRef, {
          name: name.trim(),
          basePrice: Number(price),
          description: desc.trim(),
          isAvailable,
          sizeOptions,
          crustOptions,
          updatedAt: serverTimestamp(),
        });
        Alert.alert('Thành công', 'Đã lưu thông tin món ăn, cấu hình Size & Đế');
        router.back();
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không thể lưu món');
    } finally {
      setSaving(false);
    }
  };

  const toggleSizeOption = (index: number) => {
    setSizeOptions(prev =>
      prev.map((opt, i) => (i === index ? { ...opt, enabled: !opt.enabled } : opt))
    );
  };

  const updateSizeExtraPrice = (index: number, val: string) => {
    setSizeOptions(prev =>
      prev.map((opt, i) => (i === index ? { ...opt, extraPrice: Number(val) || 0 } : opt))
    );
  };

  const toggleCrustOption = (index: number) => {
    setCrustOptions(prev =>
      prev.map((opt, i) => (i === index ? { ...opt, enabled: !opt.enabled } : opt))
    );
  };

  const updateCrustExtraPrice = (index: number, val: string) => {
    setCrustOptions(prev =>
      prev.map((opt, i) => (i === index ? { ...opt, extraPrice: Number(val) || 0 } : opt))
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title="Chi Tiết Món" showBack={true} />
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        title="Chi Tiết Món Ăn & Cấu Hình"
        subtitle={`ID: ${id}`}
        showBack={true}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Tên món */}
        <View style={styles.formGroup}>
          <AppText variant="captionSemiBold" style={styles.inputLabel}>
            Tên món ăn *
          </AppText>
          <TextInput
            style={styles.formInput}
            value={name}
            onChangeText={setName}
            placeholder="Ví dụ: Pizza Hải Sản Sốt Pesto"
          />
        </View>

        {/* Giá bán cơ bản & Trạng thái In-Stock */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <AppText variant="captionSemiBold" style={styles.inputLabel}>
              Giá bán cơ bản (VNĐ) *
            </AppText>
            <TextInput
              style={styles.formInput}
              value={price}
              keyboardType="numeric"
              onChangeText={setPrice}
              placeholder="189000"
            />
          </View>
          <View style={{ width: 110, justifyContent: 'center', alignItems: 'center' }}>
            <AppText variant="captionSemiBold" style={styles.inputLabel}>
              {isAvailable ? 'Đang bán' : 'Hết hàng'}
            </AppText>
            <Switch
              value={isAvailable}
              onValueChange={setIsAvailable}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>
        </View>

        {/* Mô tả món */}
        <View style={styles.formGroup}>
          <AppText variant="captionSemiBold" style={styles.inputLabel}>
            Mô tả nguyên liệu
          </AppText>
          <TextInput
            style={[styles.formInput, styles.formInputMultiline]}
            value={desc}
            multiline
            numberOfLines={3}
            onChangeText={setDesc}
            placeholder="Mô tả thành phần, độ cay, hương vị..."
          />
        </View>

        {/* Section: Cấu hình Size (Kích thước) - Theo System Flows 4.1 */}
        <View style={{ marginTop: 8, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <AppText variant="cardTitle" color={colors.textPrimary}>
              Cấu hình Kích Thước (Size)
            </AppText>
            <AppText variant="small" color={colors.textSecondary}>
              Phụ thu (VNĐ)
            </AppText>
          </View>
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
            {sizeOptions.map((opt, idx) => (
              <View
                key={opt.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderBottomWidth: idx < sizeOptions.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <Switch
                  value={opt.enabled}
                  onValueChange={() => toggleSizeOption(idx)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.surface}
                  style={{ transform: [{ scale: 0.8 }] }}
                />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <AppText variant="bodyMedium" color={opt.enabled ? colors.textPrimary : colors.textSecondary}>
                    {opt.name}
                  </AppText>
                </View>
                <TextInput
                  style={[
                    styles.formInput,
                    { width: 100, height: 36, paddingVertical: 4, textAlign: 'right', fontSize: 13 },
                    !opt.enabled && { opacity: 0.5, backgroundColor: colors.border }
                  ]}
                  value={String(opt.extraPrice)}
                  keyboardType="numeric"
                  editable={opt.enabled}
                  onChangeText={(val) => updateSizeExtraPrice(idx, val)}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Section: Cấu hình Đế Bánh (Crust) - Theo System Flows 4.1 */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <AppText variant="cardTitle" color={colors.textPrimary}>
              Cấu hình Loại Đế (Crust)
            </AppText>
            <AppText variant="small" color={colors.textSecondary}>
              Phụ thu (VNĐ)
            </AppText>
          </View>
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
            {crustOptions.map((opt, idx) => (
              <View
                key={opt.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderBottomWidth: idx < crustOptions.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <Switch
                  value={opt.enabled}
                  onValueChange={() => toggleCrustOption(idx)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.surface}
                  style={{ transform: [{ scale: 0.8 }] }}
                />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <AppText variant="bodyMedium" color={opt.enabled ? colors.textPrimary : colors.textSecondary}>
                    {opt.name}
                  </AppText>
                </View>
                <TextInput
                  style={[
                    styles.formInput,
                    { width: 100, height: 36, paddingVertical: 4, textAlign: 'right', fontSize: 13 },
                    !opt.enabled && { opacity: 0.5, backgroundColor: colors.border }
                  ]}
                  value={String(opt.extraPrice)}
                  keyboardType="numeric"
                  editable={opt.enabled}
                  onChangeText={(val) => updateCrustExtraPrice(idx, val)}
                />
              </View>
            ))}
          </View>
        </View>

        <AppButton
          title="Lưu tất cả thay đổi"
          isLoading={saving}
          onPress={handleSave}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
