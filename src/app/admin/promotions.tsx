import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Alert } from '../../utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Ticket,
  Plus,
  Award,
  X,
  Trash2,
  Sparkles,
} from 'lucide-react-native';
import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';
import { colors } from '../../theme/colors';
import { styles } from '../../styles/adminPromotions.styles';
import { Coupon } from '../../types/user';
import { mockCoupons } from '../../data/mockPromotions';
import { formatCurrency } from '../../utils/formatCurrency';

export default function AdminPromotionsScreen() {
  const router = useRouter();

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [value, setValue] = useState('');
  const [minSubtotal, setMinSubtotal] = useState('150000');
  const [maxDiscount, setMaxDiscount] = useState('50000');
  const [desc, setDesc] = useState('');

  useEffect(() => {
    // Lắng nghe Firestore collection 'coupons'
    const unsub = onSnapshot(
      collection(db, 'coupons'),
      (snapshot: any) => {
        if (!snapshot.empty) {
          const list: (Coupon & { id?: string })[] = [];
          snapshot.forEach((d: any) => {
            const data = d.data();
            list.push({
              code: data.code || '',
              discountType: data.discountType || 'PERCENT',
              value: Number(data.value || 0),
              minSubtotal: Number(data.minSubtotal || 0),
              maxDiscount: data.maxDiscount ? Number(data.maxDiscount) : undefined,
              description: data.description || '',
              expiresAt: data.expiresAt || '31/12/2026',
            });
          });
          setCoupons(list);
        } else {
          setCoupons(mockCoupons);
        }
      },
      (err: any) => {
        console.warn('Lỗi Firestore coupons:', err.message);
        setCoupons(mockCoupons);
      }
    );

    return () => unsub();
  }, []);

  const handleCreateCoupon = async () => {
    if (!code.trim() || !value.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập mã Voucher và giá trị giảm');
      return;
    }

    setIsSubmitting(true);
    try {
      const newCoupon = {
        code: code.trim().toUpperCase(),
        discountType,
        value: Number(value),
        minSubtotal: Number(minSubtotal) || 0,
        maxDiscount: discountType === 'PERCENT' ? Number(maxDiscount) || 50000 : undefined,
        description:
          desc.trim() ||
          `Giảm ${discountType === 'PERCENT' ? `${value}%` : formatCurrency(Number(value))} cho đơn từ ${formatCurrency(Number(minSubtotal))}`,
        expiresAt: '31/12/2026',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'coupons'), newCoupon);
      Alert.alert('Thành công', `Đã phát hành mã ưu đãi ${newCoupon.code}`);
      setModalVisible(false);
      setCode('');
      setValue('');
      setDesc('');
    } catch (e: any) {
      Alert.alert('Lỗi', e.message || 'Không thể tạo mã voucher');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCoupon = (item: Coupon) => {
    Alert.alert('Xóa Voucher', `Bạn có muốn gỡ mã "${item.code}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Gỡ bỏ',
        style: 'destructive',
        onPress: () => {
          setCoupons((prev) => prev.filter((c) => c.code !== item.code));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        title="Khuyến Mãi & FPT Reward"
        subtitle="Quản lý Voucher & Khách hàng thân thiết"
        showBack={true}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Card 1: Quản lý Voucher (Mục 4.3) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <Ticket size={22} color={colors.primary} />
              <AppText variant="cardTitle" color={colors.textPrimary}>
                Mã Giảm Giá Đang Phát Hành
              </AppText>
            </View>
            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => setModalVisible(true)}
            >
              <Plus size={16} color={colors.white} />
              <AppText variant="captionSemiBold" color={colors.white}>
                Tạo mã
              </AppText>
            </TouchableOpacity>
          </View>

          {coupons.map((item, index) => (
            <View key={item.code + index} style={styles.couponItem}>
              <View style={styles.couponTop}>
                <View style={styles.codeBadge}>
                  <AppText variant="captionSemiBold" color={colors.primary}>
                    {item.code}
                  </AppText>
                </View>
                <TouchableOpacity onPress={() => handleDeleteCoupon(item)}>
                  <Trash2 size={16} color={colors.error} />
                </TouchableOpacity>
              </View>

              <AppText
                variant="bodyMedium"
                color={colors.textPrimary}
                style={styles.couponDesc}
              >
                {item.description}
              </AppText>

              <View style={styles.couponMetaRow}>
                <AppText variant="small" color={colors.textSecondary}>
                  Đơn tối thiểu: {formatCurrency(item.minSubtotal)}
                </AppText>
                <AppText variant="small" color={colors.textSecondary}>
                  Hạn dùng: {item.expiresAt || '31/12/2026'}
                </AppText>
              </View>
            </View>
          ))}
        </View>

        {/* Card 2: Cấu hình Loyalty FPT Reward (Mục 4.3) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <Award size={22} color={colors.warning} />
              <AppText variant="cardTitle" color={colors.textPrimary}>
                Hệ Thống Tích Điểm FPT Reward
              </AppText>
            </View>
            <Sparkles size={18} color={colors.warning} />
          </View>

          <AppText variant="caption" color={colors.textSecondary} style={{ marginBottom: 12 }}>
            Quy đổi: Mỗi 10.000 VNĐ chi tiêu tích lũy = 1 điểm FPT Reward. Điểm thưởng dùng để nâng hạng và quy đổi quà tặng độc quyền.
          </AppText>

          {/* Tier 1: Thường */}
          <View style={styles.tierRow}>
            <View style={styles.tierLeft}>
              <View style={[styles.tierBadge, { backgroundColor: colors.surfaceAlt }]}>
                <AppText variant="small" color={colors.textPrimary}>
                  THÀNH VIÊN
                </AppText>
              </View>
              <AppText variant="body" color={colors.textPrimary}>
                0 - 199 điểm
              </AppText>
            </View>
            <AppText variant="captionMedium" color={colors.textSecondary}>
              Tích lũy cơ bản
            </AppText>
          </View>

          {/* Tier 2: Bạc */}
          <View style={styles.tierRow}>
            <View style={styles.tierLeft}>
              <View style={[styles.tierBadge, { backgroundColor: '#E2E8F0' }]}>
                <AppText variant="small" color="#475569">
                  HẠNG BẠC
                </AppText>
              </View>
              <AppText variant="body" color={colors.textPrimary}>
                200 - 499 điểm
              </AppText>
            </View>
            <AppText variant="captionMedium" color={colors.primary}>
              Giảm 5% mọi đơn
            </AppText>
          </View>

          {/* Tier 3: Vàng */}
          <View style={styles.tierRow}>
            <View style={styles.tierLeft}>
              <View style={[styles.tierBadge, { backgroundColor: '#FEF3C7' }]}>
                <AppText variant="small" color="#B45309">
                  HẠNG VÀNG
                </AppText>
              </View>
              <AppText variant="body" color={colors.textPrimary}>
                500 - 999 điểm
              </AppText>
            </View>
            <AppText variant="captionMedium" color={colors.primary}>
              Giảm 10% + Free Ship
            </AppText>
          </View>

          {/* Tier 4: Kim Cương */}
          <View style={[styles.tierRow, { borderBottomWidth: 0 }]}>
            <View style={styles.tierLeft}>
              <View style={[styles.tierBadge, { backgroundColor: colors.primarySoft }]}>
                <AppText variant="small" color={colors.primary}>
                  KIM CƯƠNG
                </AppText>
              </View>
              <AppText variant="body" color={colors.textPrimary}>
                1.000+ điểm
              </AppText>
            </View>
            <AppText variant="captionMedium" color={colors.primary}>
              Giảm 15% + Quà sinh nhật
            </AppText>
          </View>
        </View>
      </ScrollView>

      {/* Modal Tạo Voucher Mới */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <AppText variant="h3" color={colors.textPrimary}>
                Phát Hành Mã Ưu Đãi Mới
              </AppText>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Mã Voucher (Code) *
                </AppText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ví dụ: FPTPIZZA30"
                  autoCapitalize="characters"
                  value={code}
                  onChangeText={setCode}
                />
              </View>

              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Hình thức giảm giá
                </AppText>
                <View style={styles.typeSelectorRow}>
                  <TouchableOpacity
                    style={[
                      styles.typeBtn,
                      discountType === 'PERCENT' && styles.typeBtnActive,
                    ]}
                    onPress={() => setDiscountType('PERCENT')}
                  >
                    <AppText
                      variant="captionMedium"
                      color={
                        discountType === 'PERCENT'
                          ? colors.white
                          : colors.textPrimary
                      }
                    >
                      Phần trăm (%)
                    </AppText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.typeBtn,
                      discountType === 'FIXED' && styles.typeBtnActive,
                    ]}
                    onPress={() => setDiscountType('FIXED')}
                  >
                    <AppText
                      variant="captionMedium"
                      color={
                        discountType === 'FIXED'
                          ? colors.white
                          : colors.textPrimary
                      }
                    >
                      Tiền mặt cố định (VNĐ)
                    </AppText>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  {discountType === 'PERCENT'
                    ? 'Tỷ lệ giảm (%) *'
                    : 'Số tiền giảm (VNĐ) *'}
                </AppText>
                <TextInput
                  style={styles.formInput}
                  placeholder={discountType === 'PERCENT' ? 'Ví dụ: 20' : 'Ví dụ: 30000'}
                  keyboardType="numeric"
                  value={value}
                  onChangeText={setValue}
                />
              </View>

              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Giá trị đơn hàng tối thiểu (VNĐ)
                </AppText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ví dụ: 150000"
                  keyboardType="numeric"
                  value={minSubtotal}
                  onChangeText={setMinSubtotal}
                />
              </View>

              {discountType === 'PERCENT' && (
                <View style={styles.formGroup}>
                  <AppText variant="captionSemiBold" style={styles.inputLabel}>
                    Số tiền giảm tối đa (VNĐ)
                  </AppText>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Ví dụ: 50000"
                    keyboardType="numeric"
                    value={maxDiscount}
                    onChangeText={setMaxDiscount}
                  />
                </View>
              )}

              <View style={styles.formGroup}>
                <AppText variant="captionSemiBold" style={styles.inputLabel}>
                  Mô tả ưu đãi
                </AppText>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ví dụ: Giảm 20% tối đa 50k cho đơn từ 150k"
                  value={desc}
                  onChangeText={setDesc}
                />
              </View>

              <AppButton
                title="Phát hành Voucher"
                isLoading={isSubmitting}
                onPress={handleCreateCoupon}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
