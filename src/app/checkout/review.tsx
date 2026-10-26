import React, { useState } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Check, MapPin, Phone, User, CreditCard, ShoppingBag } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { AppText } from '../../components/ui/AppText';
import { PriceText } from '../../components/ui/PriceText';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { BottomActionBar } from '../../components/ui/BottomActionBar';
import { styles } from '../../styles/checkoutReview.styles';
import { useCart } from '../../state/CartContext';
import { useOrders } from '../../state/OrderContext';
import { useAuth } from '../../state/AuthContext';
import { mockProducts } from '../../data/mockProducts';
import { mockCoupons } from '../../data/mockPromotions';
import { calculateOrderTotals, getItemLineUnitPrice } from '../../utils/calculateTotals';
import { formatCurrency } from '../../utils/formatCurrency';
import { getCheckoutDraft, resetCheckoutDraft } from '../../state/checkoutDraft';

const productsMap = mockProducts.reduce((acc, p) => {
  acc[p.id] = p;
  return acc;
}, {} as Record<string, (typeof mockProducts)[0]>);

export default function CheckoutReviewScreen() {
  const { items, clearCart } = useCart();
  const { createOrder } = useOrders();
  const { user } = useAuth();
  const draft = getCheckoutDraft();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const coupon = draft.promoCode ? mockCoupons.find((c) => c.code === draft.promoCode) : null;
  const totals = calculateOrderTotals(items, productsMap, draft.fulfillmentType, coupon);

  const handlePlaceOrder = async () => {
    if (isSubmitting) return; // Prevent double tap (BR-10)
    setIsSubmitting(true);

    try {
      const order = await createOrder({
        customer: {
          fullname: draft.fullname,
          phone: draft.phone,
          email: draft.email,
        },
        fulfillmentType: draft.fulfillmentType,
        address: draft.address,
        items,
        promoCode: draft.promoCode,
        paymentMethod: draft.paymentMethod,
        userId: user?.id,
        idempotencyKey: `IDEMP-${Date.now()}`,
      });

      // Clear cart and draft on success
      clearCart();
      resetCheckoutDraft();

      router.replace({
        pathname: '/order/success',
        params: { orderId: order.id },
      });
    } catch (err: any) {
      Alert.alert(
        'Không thể tạo đơn hàng',
        err.message || 'Có lỗi xảy ra trong quá trình đặt món. Giỏ hàng của bạn vẫn được giữ nguyên, vui lòng thử lại!'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="Xác nhận đơn hàng" showBack />

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
          <View style={[styles.progressDot, styles.completedDot]}>
            <Check size={14} color={colors.white} />
          </View>
          <AppText variant="captionMedium" color={colors.textSecondary}>
            Thanh toán
          </AppText>
        </View>
        <View style={[styles.progressLine, styles.completedLine]} />
        <View style={styles.progressItem}>
          <View style={[styles.progressDot, styles.activeDot]}>
            <AppText variant="captionMedium" color={colors.white}>
              3
            </AppText>
          </View>
          <AppText variant="captionMedium" color={colors.primary}>
            Xác nhận
          </AppText>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Contact & Destination Card */}
        <View style={styles.card}>
          <AppText variant="h3" style={styles.cardHeading}>
            {draft.fulfillmentType === 'DELIVERY' ? 'Thông tin giao hàng' : 'Thông tin nhận món'}
          </AppText>

          <View style={styles.infoRow}>
            <User size={16} color={colors.textSecondary} />
            <AppText variant="bodyMedium" style={styles.infoText}>
              {draft.fullname}
            </AppText>
          </View>

          <View style={styles.infoRow}>
            <Phone size={16} color={colors.textSecondary} />
            <AppText variant="body" style={styles.infoText}>
              {draft.phone} {draft.email ? `• ${draft.email}` : ''}
            </AppText>
          </View>

          <View style={styles.infoRow}>
            <MapPin size={16} color={colors.textSecondary} />
            <AppText variant="body" style={styles.infoText}>
              {draft.address}
            </AppText>
          </View>

          {draft.deliveryNote && (
            <AppText variant="caption" color={colors.warning} style={styles.noteText}>
              Ghi chú: {draft.deliveryNote}
            </AppText>
          )}
        </View>

        {/* Payment Method Card */}
        <View style={styles.card}>
          <AppText variant="h3" style={styles.cardHeading}>
            Phương thức thanh toán
          </AppText>
          <View style={styles.infoRow}>
            <CreditCard size={16} color={colors.primary} />
            <AppText variant="bodyMedium" style={styles.infoText}>
              {draft.paymentMethod === 'MOCK_WALLET'
                ? 'Ví điện tử MoMo / ZaloPay (DEMO)'
                : 'Thanh toán tiền mặt khi nhận hàng (COD)'}
            </AppText>
          </View>
        </View>

        {/* Selected Items Card */}
        <View style={styles.card}>
          <View style={styles.itemsHeader}>
            <AppText variant="h3">Món đã chọn ({items.reduce((s, i) => s + i.quantity, 0)})</AppText>
            <ShoppingBag size={18} color={colors.textSecondary} />
          </View>

          {items.map((item) => {
            const product = productsMap[item.productId];
            const variant = product?.variants?.find((v) => v.id === item.variantId);
            const addons = (item.addonIds || [])
              .map((id) => product?.addons?.find((a) => a.id === id)?.name)
              .filter(Boolean);
            const unitPrice = getItemLineUnitPrice(item, product);

            return (
              <View key={item.lineId} style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <AppText variant="bodyMedium">
                    {item.quantity}x {product?.name}
                  </AppText>
                  {(variant || addons.length > 0) && (
                    <AppText variant="caption" color={colors.textSecondary}>
                      {[variant?.name, ...addons].filter(Boolean).join(' • ')}
                    </AppText>
                  )}
                  {item.specialInstructions && (
                    <AppText variant="caption" color={colors.warning}>
                      Note: {item.specialInstructions}
                    </AppText>
                  )}
                </View>
                <AppText variant="bodyMedium">
                  {formatCurrency(unitPrice * item.quantity)}
                </AppText>
              </View>
            );
          })}
        </View>

        {/* Pricing Summary */}
        <View style={styles.card}>
          <AppText variant="h3" style={styles.cardHeading}>
            Chi tiết thanh toán
          </AppText>

          <View style={styles.summaryRow}>
            <AppText variant="body" color={colors.textSecondary}>
              Tạm tính
            </AppText>
            <AppText variant="bodyMedium">{formatCurrency(totals.subtotal)}</AppText>
          </View>

          {totals.discount > 0 && (
            <View style={styles.summaryRow}>
              <AppText variant="body" color={colors.success}>
                Giảm giá ({coupon?.code})
              </AppText>
              <AppText variant="bodyMedium" color={colors.success}>
                -{formatCurrency(totals.discount)}
              </AppText>
            </View>
          )}

          <View style={styles.summaryRow}>
            <AppText variant="body" color={colors.textSecondary}>
              Phí giao hàng
            </AppText>
            <AppText variant="bodyMedium">
              {totals.deliveryFee === 0 ? 'Miễn phí' : formatCurrency(totals.deliveryFee)}
            </AppText>
          </View>

          <View style={styles.summaryRow}>
            <AppText variant="body" color={colors.textSecondary}>
              Thuế VAT (10% mô phỏng)
            </AppText>
            <AppText variant="bodyMedium">{formatCurrency(totals.tax)}</AppText>
          </View>

          <View style={[styles.summaryRow, styles.totalRow]}>
            <AppText variant="cardTitle">Tổng thanh toán</AppText>
            <PriceText amount={totals.total} size="lg" />
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <BottomActionBar
        title="Đặt hàng ngay"
        price={totals.total}
        priceLabel="Tổng thanh toán"
        isLoading={isSubmitting}
        onPress={handlePlaceOrder}
      />
    </SafeAreaView>
  );
}

