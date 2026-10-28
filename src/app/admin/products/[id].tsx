import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
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

export default function AdminProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [desc, setDesc] = useState('');

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
        } else {
          const found = mockProducts.find((p) => p.id === id);
          if (found) {
            setName(found.name);
            setPrice(String(found.basePrice));
            setDesc(found.description);
          }
        }
      } catch (e) {
        const found = mockProducts.find((p) => p.id === id);
        if (found) {
          setName(found.name);
          setPrice(String(found.basePrice));
          setDesc(found.description);
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
          updatedAt: serverTimestamp(),
        });
        Alert.alert('Thành công', 'Đã lưu thông tin chi tiết');
        router.back();
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không thể lưu món');
    } finally {
      setSaving(false);
    }
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
        title="Chi Tiết Món Ăn"
        subtitle={`ID: ${id}`}
        showBack={true}
      />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.formGroup}>
          <AppText variant="captionSemiBold" style={styles.inputLabel}>
            Tên món
          </AppText>
          <TextInput
            style={styles.formInput}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.formGroup}>
          <AppText variant="captionSemiBold" style={styles.inputLabel}>
            Giá cơ bản
          </AppText>
          <TextInput
            style={styles.formInput}
            value={price}
            keyboardType="numeric"
            onChangeText={setPrice}
          />
        </View>

        <View style={styles.formGroup}>
          <AppText variant="captionSemiBold" style={styles.inputLabel}>
            Mô tả
          </AppText>
          <TextInput
            style={[styles.formInput, styles.formInputMultiline]}
            value={desc}
            multiline
            numberOfLines={4}
            onChangeText={setDesc}
          />
        </View>

        <AppButton
          title="Lưu thay đổi"
          isLoading={saving}
          onPress={handleSave}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

