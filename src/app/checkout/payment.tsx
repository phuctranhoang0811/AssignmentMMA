import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Banknote, Wallet, Check, AlertCircle } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { AppText } from '../../components/ui/AppText';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { BottomActionBar } from '../../components/ui/BottomActionBar';
import { styles } from '../../styles/checkoutPayment.styles';
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

