import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Banknote, Wallet, Check, AlertCircle } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from '../../components/ui/AppText';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { BottomActionBar } from '../../components/ui/BottomActionBar';
import { useCart } from '../../state/CartContext';
import { mockProducts } from '../../data/mockProducts';
import { mockCoupons } from '../../data/mockPromotions';
import { calculateOrderTotals } from '../../utils/calculateTotals';
import { getCheckoutDraft, updateCheckoutDraft } from '../../state/checkoutDraft';
import { PaymentMethod } from '../../types/order';

const productsMap = mockProducts.reduce((acc, p) => {
  acc[p.id] = p;
  return acc;
}, {} as Record<string, (typeof mockProducts)[0]>);

export default function CheckoutPaymentScreen() {
  const { items } = useCart();
  const draft = getCheckoutDraft();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(draft.paymentMethod || 'COD');

  const coupon = draft.promoCode ? mockCoupons.find((c) => c.code === draft.promoCode) : null;
  const totals = calculateOrderTotals(items, productsMap, draft.fulfillmentType, coupon);

  const handleContinue = () => {
    updateCheckoutDraft({
      paymentMethod: selectedMethod,
    });
    router.push('/checkout/review');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="Phương thức thanh toán" showBack />

      {/* Progress Stepper */}
      <View style={styles.progressRow}>
        <View style={styles.progressItem}>
          <View style={[styles.progressDot, styles.completedDot]}>
            <Check size={14} color={colors.white} />
          </View>
          <AppText variant="captionMedium" color={colors.textSecondary}>
            Giao nhận
          </AppText>
        </View>
        <View style={[styles.progressLine, styles.completedLine]} />
        <View style={styles.progressItem}>
          <View style={[styles.progressDot, styles.activeDot]}>
            <AppText variant="captionMedium" color={colors.white}>
              2
            </AppText>
          </View>
          <AppText variant="captionMedium" color={colors.primary}>
            Thanh toán
          </AppText>
        </View>
        <View style={styles.progressLine} />
        <View style={styles.progressItem}>
          <View style={styles.progressDot}>
            <AppText variant="captionMedium" color={colors.textDisabled}>
              3
            </AppText>
          </View>
          <AppText variant="caption" color={colors.textSecondary}>
            Xác nhận
          </AppText>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Method 1: COD */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setSelectedMethod('COD')}
          style={[
            styles.paymentCard,
            selectedMethod === 'COD' && styles.activePaymentCard,
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <Banknote size={22} color={colors.primary} />
            </View>
            <View style={styles.methodInfo}>
              <AppText variant="bodyMedium">Thanh toán khi nhận hàng (COD)</AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                Thanh toán tiền mặt hoặc chuyển khoản khi nhận món
              </AppText>
            </View>
            <View
              style={[
                styles.radioCircle,
                selectedMethod === 'COD' && styles.selectedRadioCircle,
              ]}
            >
              {selectedMethod === 'COD' && <Check size={12} color={colors.white} />}
            </View>
          </View>
        </TouchableOpacity>

        {/* Method 2: Mock Wallet */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setSelectedMethod('MOCK_WALLET')}
          style={[
            styles.paymentCard,
            selectedMethod === 'MOCK_WALLET' && styles.activePaymentCard,
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <Wallet size={22} color={colors.primary} />
            </View>
            <View style={styles.methodInfo}>
              <View style={styles.titleWithBadge}>
                <AppText variant="bodyMedium">Ví điện tử MoMo / ZaloPay</AppText>
                <View style={styles.demoBadge}>
                  <AppText variant="captionMedium" color={colors.primary}>
                    DEMO
                  </AppText>
                </View>
              </View>
              <AppText variant="caption" color={colors.textSecondary}>
                Mô phỏng thanh toán thành công tức thì
              </AppText>
            </View>
            <View
              style={[
                styles.radioCircle,
                selectedMethod === 'MOCK_WALLET' && styles.selectedRadioCircle,
              ]}
            >
              {selectedMethod === 'MOCK_WALLET' && <Check size={12} color={colors.white} />}
            </View>
          </View>

          {/* Warning / Notice about Demo mode */}
          <View style={styles.demoNoticeBox}>
            <AlertCircle size={16} color={colors.warning} />
            <AppText variant="caption" color={colors.warning} style={styles.demoNoticeText}>
              Chế độ DEMO: Không yêu cầu thông tin thẻ hay tài khoản ngân hàng thật. Hệ thống sẽ mô phỏng giao dịch an toàn.
            </AppText>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <BottomActionBar
        title="Kiểm tra lại đơn hàng"
        price={totals.total}
        priceLabel="Tổng cộng"
        onPress={handleContinue}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressItem: {
    alignItems: 'center',
    width: 70,
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  completedDot: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  activeDot: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  completedLine: {
    backgroundColor: colors.success,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  paymentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  activePaymentCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  methodInfo: {
    flex: 1,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  demoBadge: {
    backgroundColor: '#FFE2D7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.xs,
    marginLeft: spacing.xs,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  selectedRadioCircle: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  demoNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warningSoft,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.md,
  },
  demoNoticeText: {
    marginLeft: spacing.xs,
    flex: 1,
    lineHeight: 16,
  },
});
