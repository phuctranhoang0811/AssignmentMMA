import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Alert } from '../../../utils/alert';
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
import { reportAdminAction } from '../../../services/orderApi';
import { PIZZA_CRUSTS, isCustomizablePizza } from '../../../types/pizzaCustomization';
import type { Product, ProductVariant } from '../../../types/product';

export default function AdminProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [desc, setDesc] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);

  // The product's own variants are what customers pay per size (full price, not a surcharge).
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [hasCrusts, setHasCrusts] = useState(false);

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
          setVariants(data.variants ?? []);
          setHasCrusts(isCustomizablePizza(data as Product));
        } else {
          const found = mockProducts.find((p) => p.id === id);
          if (found) {
            setName(found.name);
            setPrice(String(found.basePrice));
            setDesc(found.description);
            setIsAvailable(found.isAvailable !== false);
          }
        }
      } catch {
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
    if (variants.some(v => !(v.price > 0))) {
      Alert.alert('Lỗi', 'Giá mỗi size phải lớn hơn 0');
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
          ...(variants.length ? { variants } : {}),
          updatedAt: serverTimestamp(),
        });
        void reportAdminAction('PRODUCT_UPDATED', `products/${id}`, { name: name.trim(), basePrice: Number(price), isAvailable });
        Alert.alert('Thành công', 'Đã lưu thông tin món ăn và giá theo size');
        router.back();
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không thể lưu món');
    } finally {
      setSaving(false);
    }
  };

  const updateVariantPrice = (index: number, val: string) => {
    setVariants(prev => prev.map((v, i) => (i === index ? { ...v, price: Number(val.replace(/\D/g, '')) || 0 } : v)));
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

        {variants.length > 0 && (
          <View style={{ marginTop: 8, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <AppText variant="cardTitle" color={colors.textPrimary}>
                Giá theo lựa chọn
              </AppText>
              <AppText variant="small" color={colors.textSecondary}>
                Giá bán (VNĐ)
              </AppText>
            </View>
            <AppText variant="small" color={colors.textSecondary} style={{ marginBottom: 8 }}>
              Khách trả đúng giá này khi chọn size/lựa chọn tương ứng; giá cơ bản chỉ dùng để hiển thị.
            </AppText>
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              {variants.map((variant, idx) => (
                <View
                  key={variant.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderBottomWidth: idx < variants.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyMedium" color={colors.textPrimary}>{variant.name}</AppText>
                  </View>
                  <TextInput
                    style={[styles.formInput, { width: 110, height: 36, paddingVertical: 4, textAlign: 'right', fontSize: 13 }]}
                    value={String(variant.price)}
                    keyboardType="numeric"
                    accessibilityLabel={`Giá ${variant.name}`}
                    onChangeText={(val) => updateVariantPrice(idx, val)}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {hasCrusts && (
          <View style={{ marginBottom: 24 }}>
            <AppText variant="cardTitle" color={colors.textPrimary} style={{ marginBottom: 8 }}>
              Phụ thu loại đế (áp dụng cho mọi pizza)
            </AppText>
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 6 }}>
              {PIZZA_CRUSTS.map((crust) => (
                <View key={crust.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText variant="bodyMedium" color={colors.textPrimary}>{crust.name}</AppText>
                  <AppText variant="bodyMedium" color={colors.textSecondary}>
                    {crust.price ? `+${formatCurrency(crust.price)}` : 'Miễn phí'}
                  </AppText>
                </View>
              ))}
              <AppText variant="small" color={colors.textSecondary}>
                Giá đế được cấu hình trong hệ thống, không chỉnh riêng cho từng món.
              </AppText>
            </View>
          </View>
        )}

        <AppButton
          title="Lưu tất cả thay đổi"
          isLoading={saving}
          onPress={handleSave}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
