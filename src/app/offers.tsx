import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Tag, Copy, Check, Clock } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { AppText } from '../components/ui/AppText';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { styles } from '../styles/offers.styles';
import { mockCoupons } from '../data/mockPromotions';
import { updateCheckoutDraft } from '../state/checkoutDraft';
import { useToast } from '../state/ToastContext';
import { triggerHaptic } from '../utils/haptics';

export default function OffersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    updateCheckoutDraft({ promoCode: code });
    setCopiedCode(code);
    triggerHaptic('success');
    showToast({
      message: `Mã ${code} đã được lưu cho đơn hàng tiếp theo`,
      actionText: 'Xem giỏ',
      onAction: () => router.push('/(tabs)/cart'),
    });
    setTimeout(() => setCopiedCode(null), 3000);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="Mã ưu đãi & Voucher" showBack />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 20, 40) },
        ]}
      >
        <AppText variant="captionMedium" color={colors.textSecondary} style={styles.subheading}>
          Các mã giảm giá đang áp dụng cho Pizza Time:
        </AppText>

        {mockCoupons.map((coupon) => {
          const isCopied = copiedCode === coupon.code;
          return (
            <View key={coupon.code} style={styles.couponCard}>
              <View style={styles.leftStub}>
                <Tag size={28} color={colors.primary} />
                <AppText variant="captionMedium" color={colors.primary} style={{ marginTop: 4 }}>
                  {coupon.discountType === 'PERCENT' ? `${coupon.value}% OFF` : 'GIẢM GIÁ'}
                </AppText>
              </View>

              <View style={styles.contentCol}>
                <AppText variant="h3">{coupon.code}</AppText>
                <AppText variant="body" color={colors.textSecondary} style={styles.description}>
                  {coupon.description}
                </AppText>

                <View style={styles.footerRow}>
                  <View style={styles.expiryRow}>
                    <Clock size={12} color={colors.textDisabled} />
                    <AppText variant="caption" color={colors.textDisabled} style={{ marginLeft: 4 }}>
                      HSD: {coupon.expiresAt}
                    </AppText>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleCopyCode(coupon.code)}
                    style={styles.applyButton}
                  >
                    {isCopied ? (
                      <>
                        <Check size={14} color={colors.white} />
                        <AppText variant="captionMedium" color={colors.white} style={{ marginLeft: 4 }}>
                          Đã lưu
                        </AppText>
                      </>
                    ) : (
                      <>
                        <Copy size={14} color={colors.white} />
                        <AppText variant="captionMedium" color={colors.white} style={{ marginLeft: 4 }}>
                          Áp dụng
                        </AppText>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

