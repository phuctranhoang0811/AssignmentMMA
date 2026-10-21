import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Truck, Store, MapPin, Tag, Check } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from '../../components/ui/AppText';
import { AppInput } from '../../components/ui/AppInput';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { BottomActionBar } from '../../components/ui/BottomActionBar';
import { useCart } from '../../state/CartContext';
import { useAuth } from '../../state/AuthContext';
import { mockProducts } from '../../data/mockProducts';
import { demoConfig } from '../../data/mockConfig';
import { calculateOrderTotals } from '../../utils/calculateTotals';
import { isValidPhone, isValidName } from '../../utils/validators';
import { promoService } from '../../services';
import { Coupon } from '../../types/user';
import { getCheckoutDraft, updateCheckoutDraft } from '../../state/checkoutDraft';
import { FulfillmentType } from '../../types/order';
import { defaultAddresses } from '../../data/mockUsers';

const productsMap = mockProducts.reduce((acc, p) => {
  acc[p.id] = p;
  return acc;
}, {} as Record<string, (typeof mockProducts)[0]>);

export default function CheckoutDeliveryScreen() {
  const { items } = useCart();
  const { user } = useAuth();
  const draft = getCheckoutDraft();

  const [fulfillment, setFulfillment] = useState<FulfillmentType>(draft.fulfillmentType);
  const [fullname, setFullname] = useState(user?.fullname || draft.fullname || '');
  const [phone, setPhone] = useState(user?.phone || draft.phone || '');
  const [email, setEmail] = useState(user?.email || draft.email || '');
  const [address, setAddress] = useState(draft.address || '');
  const [deliveryNote, setDeliveryNote] = useState(draft.deliveryNote || '');
  const [promoCode, setPromoCode] = useState(draft.promoCode || '');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [promoMessage, setPromoMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totals = calculateOrderTotals(items, productsMap, fulfillment, appliedCoupon);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    const res = await promoService.validate(promoCode, totals.subtotal);
    if (res.isValid && res.coupon) {
      setAppliedCoupon(res.coupon);
      setPromoMessage(res.message || 'Đã áp dụng mã giảm giá thành công!');
    } else {
      setAppliedCoupon(null);
      setPromoMessage(res.message || 'Mã giảm giá không hợp lệ.');
    }
  };

  const handleContinue = () => {
    const errs: Record<string, string> = {};

    if (!isValidName(fullname)) {
      errs.fullname = 'Vui lòng nhập họ và tên (tối thiểu 2 ký tự)';
    }

    if (!isValidPhone(phone)) {
      errs.phone = 'Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)';
    }

    if (fulfillment === 'DELIVERY' && (!address || address.trim().length < 5)) {
      errs.address = 'Vui lòng nhập địa chỉ giao hàng chi tiết';
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    // Save draft
    updateCheckoutDraft({
      fullname: fullname.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      fulfillmentType: fulfillment,
      address: fulfillment === 'DELIVERY' ? address.trim() : demoConfig.restaurant.address,
      deliveryNote: deliveryNote.trim() || undefined,
      promoCode: appliedCoupon ? appliedCoupon.code : undefined,
    });

    router.push('/checkout/payment');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="Thông tin giao nhận" showBack />

      {/* Progress Stepper */}
      <View style={styles.progressRow}>
        <View style={styles.progressItem}>
          <View style={[styles.progressDot, styles.activeDot]}>
            <AppText variant="captionMedium" color={colors.white}>
              1
            </AppText>
          </View>
          <AppText variant="captionMedium" color={colors.primary}>
            Giao nhận
          </AppText>
        </View>
        <View style={styles.progressLine} />
        <View style={styles.progressItem}>
          <View style={styles.progressDot}>
            <AppText variant="captionMedium" color={colors.textDisabled}>
              2
            </AppText>
          </View>
          <AppText variant="caption" color={colors.textSecondary}>
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
        {/* Fulfillment Method Selector */}
        <AppText variant="h3" style={styles.sectionHeading}>
          Hình thức nhận món
        </AppText>
        <View style={styles.fulfillmentRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setFulfillment('DELIVERY')}
            style={[
              styles.fulfillmentCard,
              fulfillment === 'DELIVERY' && styles.activeFulfillmentCard,
            ]}
          >
            <Truck
              size={24}
              color={fulfillment === 'DELIVERY' ? colors.primary : colors.textSecondary}
            />
            <AppText
              variant="bodyMedium"
              color={fulfillment === 'DELIVERY' ? colors.primary : colors.textPrimary}
              style={styles.fulfillmentTitle}
            >
              Giao tận nơi
            </AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              Nóng giòn trong 30-45 phút
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setFulfillment('PICKUP')}
            style={[
              styles.fulfillmentCard,
              fulfillment === 'PICKUP' && styles.activeFulfillmentCard,
            ]}
          >
            <Store
              size={24}
              color={fulfillment === 'PICKUP' ? colors.primary : colors.textSecondary}
            />
            <AppText
              variant="bodyMedium"
              color={fulfillment === 'PICKUP' ? colors.primary : colors.textPrimary}
              style={styles.fulfillmentTitle}
            >
              Đến lấy tại quầy
            </AppText>
            <AppText variant="caption" color={colors.success}>
              Miễn phí giao hàng
            </AppText>
          </TouchableOpacity>
        </View>

        {/* Contact Info */}
        <AppText variant="h3" style={styles.sectionHeading}>
          Thông tin liên hệ
        </AppText>
        <View style={styles.card}>
          <AppInput
            label="Họ và tên người nhận *"
            placeholder="Ví dụ: Nguyễn Văn A"
            value={fullname}
            onChangeText={(t) => {
              setFullname(t);
              setErrors((prev) => ({ ...prev, fullname: '' }));
            }}
            error={errors.fullname}
          />

          <AppInput
            label="Số điện thoại nhận hàng *"
            placeholder="Ví dụ: 0901234567"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(t) => {
              setPhone(t);
              setErrors((prev) => ({ ...prev, phone: '' }));
            }}
            error={errors.phone}
          />

          <AppInput
            label="Email nhận hóa đơn (tùy chọn)"
            placeholder="email@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {/* Delivery / Pickup Specifics */}
        {fulfillment === 'DELIVERY' ? (
          <>
            <AppText variant="h3" style={styles.sectionHeading}>
              Địa chỉ giao hàng
            </AppText>
            <View style={styles.card}>
              <View style={styles.quickAddressRow}>
                <AppText variant="captionMedium" color={colors.textSecondary} style={{ marginBottom: spacing.xs }}>
                  Chọn nhanh từ sổ địa chỉ:
                </AppText>
                <View style={styles.chipsContainer}>
                  {defaultAddresses.map((addr) => (
                    <TouchableOpacity
                      key={addr.id}
                      activeOpacity={0.7}
                      onPress={() => {
                        setAddress(addr.address);
                        setFullname(addr.recipientName);
                        setPhone(addr.phone);
                        setErrors((prev) => ({ ...prev, address: '', fullname: '', phone: '' }));
                      }}
                      style={[
                        styles.quickAddrChip,
                        address === addr.address && styles.activeQuickAddrChip,
                      ]}
                    >
                      <MapPin size={12} color={address === addr.address ? colors.primary : colors.textSecondary} />
                      <AppText
                        variant="caption"
                        color={address === addr.address ? colors.primary : colors.textPrimary}
                        style={{ marginLeft: 4 }}
                      >
                        {addr.label}
                      </AppText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <AppInput
                label="Địa chỉ chi tiết *"
                placeholder="Số nhà, tên đường, phường, quận..."
                value={address}
                onChangeText={(t) => {
                  setAddress(t);
                  setErrors((prev) => ({ ...prev, address: '' }));
                }}
                error={errors.address}
                multiline
                numberOfLines={2}
              />

              <AppInput
                label="Ghi chú giao hàng (tùy chọn)"
                placeholder="Ví dụ: Bấm chuông cửa, gửi bảo vệ..."
                value={deliveryNote}
                onChangeText={setDeliveryNote}
              />
            </View>
          </>
        ) : (
          <>
            <AppText variant="h3" style={styles.sectionHeading}>
              Địa điểm nhận món
            </AppText>
            <View style={[styles.card, styles.pickupInfoBox]}>
              <MapPin size={24} color={colors.primary} />
              <View style={styles.pickupTextCol}>
                <AppText variant="bodyMedium">{demoConfig.restaurant.name}</AppText>
                <AppText variant="caption" color={colors.textSecondary} style={{ marginTop: 2 }}>
                  {demoConfig.restaurant.address}
                </AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  Giờ mở cửa: {demoConfig.restaurant.openingHours}
                </AppText>
              </View>
            </View>
          </>
        )}

        {/* Coupon Code Section */}
        <AppText variant="h3" style={styles.sectionHeading}>
          Mã giảm giá
        </AppText>
        <View style={styles.card}>
          <View style={styles.promoInputRow}>
            <View style={{ flex: 1 }}>
              <AppInput
                placeholder="Nhập mã (PIZZA20, WELCOME30)"
                value={promoCode}
                onChangeText={setPromoCode}
                autoCapitalize="characters"
                containerStyle={{ marginBottom: 0 }}
              />
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleApplyPromo}
              style={styles.applyBtn}
            >
              <AppText variant="captionMedium" color={colors.white}>
                Áp dụng
              </AppText>
            </TouchableOpacity>
          </View>
          {promoMessage ? (
            <AppText
              variant="caption"
              color={appliedCoupon ? colors.success : colors.error}
              style={{ marginTop: spacing.xs }}
            >
              {promoMessage}
            </AppText>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <BottomActionBar
        title="Tiếp tục chọn thanh toán"
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
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  sectionHeading: {
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  fulfillmentRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.base,
  },
  fulfillmentCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.base,
    alignItems: 'flex-start',
  },
  activeFulfillmentCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  fulfillmentTitle: {
    marginTop: spacing.sm,
    marginBottom: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  pickupInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pickupTextCol: {
    marginLeft: spacing.md,
    flex: 1,
  },
  promoInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  applyBtn: {
    backgroundColor: colors.primary,
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAddressRow: {
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickAddrChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeQuickAddrChip: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
});
