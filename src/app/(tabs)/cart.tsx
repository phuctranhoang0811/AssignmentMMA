import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Trash2, ShoppingBag, ArrowRight } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from '../../components/ui/AppText';
import { PriceText } from '../../components/ui/PriceText';
import { QuantityStepper } from '../../components/ui/QuantityStepper';
import { EmptyState } from '../../components/ui/EmptyState';
import { BottomActionBar } from '../../components/ui/BottomActionBar';
import { useCart } from '../../state/CartContext';
import { mockProducts } from '../../data/mockProducts';
import { getItemLineUnitPrice, calculateOrderTotals } from '../../utils/calculateTotals';
import { formatCurrency } from '../../utils/formatCurrency';

const productsMap = mockProducts.reduce((acc, p) => {
  acc[p.id] = p;
  return acc;
}, {} as Record<string, (typeof mockProducts)[0]>);

export default function CartScreen() {
  const { items, updateQuantity, removeItem, clearCart } = useCart();

  const handleClearConfirm = () => {
    Alert.alert(
      'Xóa toàn bộ giỏ hàng',
      'Bạn có chắc chắn muốn xóa tất cả món ăn trong giỏ không?',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xóa hết', style: 'destructive', onPress: clearCart },
      ]
    );
  };

  const totals = calculateOrderTotals(items, productsMap, 'DELIVERY');

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <AppText variant="h1">Giỏ hàng</AppText>
        </View>
        <EmptyState
          icon={<ShoppingBag size={48} color={colors.primary} />}
          title="Giỏ hàng của bạn đang trống"
          description="Hãy chọn những chiếc pizza nướng củi thơm lừng và mì Ý tuyệt hảo nhé!"
          actionTitle="Khám phá thực đơn"
          onAction={() => router.push('/(tabs)/menu')}
          style={{ flex: 1 }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <AppText variant="h1">Giỏ hàng</AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            {items.reduce((s, i) => s + i.quantity, 0)} phần món ăn
          </AppText>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleClearConfirm}
          style={styles.clearBtn}
        >
          <Trash2 size={16} color={colors.error} />
          <AppText variant="captionMedium" color={colors.error} style={{ marginLeft: 4 }}>
            Xóa hết
          </AppText>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Cart Item Rows */}
        <View style={styles.itemsList}>
          {items.map((item) => {
            const product = productsMap[item.productId];
            const variant = product?.variants?.find((v) => v.id === item.variantId);
            const addons = (item.addonIds || [])
              .map((id) => product?.addons?.find((a) => a.id === id)?.name)
              .filter(Boolean);

            const unitPrice = getItemLineUnitPrice(item, product);
            const lineTotal = unitPrice * item.quantity;

            return (
              <View key={item.lineId} style={styles.itemCard}>
                <Image
                  source={{ uri: product?.image }}
                  style={styles.itemImage}
                  resizeMode="cover"
                />

                <View style={styles.itemInfo}>
                  <View style={styles.titleRow}>
                    <AppText variant="cardTitle" numberOfLines={1} style={{ flex: 1 }}>
                      {product?.name || 'Món ăn'}
                    </AppText>
                    <TouchableOpacity
                      onPress={() => removeItem(item.lineId)}
                      style={styles.removeIcon}
                    >
                      <Trash2 size={16} color={colors.textDisabled} />
                    </TouchableOpacity>
                  </View>

                  {/* Variant & Addons tags */}
                  {(variant || addons.length > 0) && (
                    <AppText variant="caption" color={colors.textSecondary} style={styles.optionsText}>
                      {[variant?.name, ...addons].filter(Boolean).join(' • ')}
                    </AppText>
                  )}

                  {/* Special Note */}
                  {item.specialInstructions && (
                    <AppText variant="caption" color={colors.warning} style={styles.noteText}>
                      Ghi chú: {item.specialInstructions}
                    </AppText>
                  )}

                  <View style={styles.bottomRow}>
                    <PriceText amount={lineTotal} size="md" />
                    <QuantityStepper
                      value={item.quantity}
                      min={1}
                      max={20}
                      size="sm"
                      onChange={(newQty) => updateQuantity(item.lineId, newQty)}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Pricing Summary Card */}
        <View style={styles.summaryCard}>
          <AppText variant="h3" style={styles.summaryTitle}>
            Tóm tắt chi phí
          </AppText>

          <View style={styles.summaryRow}>
            <AppText variant="body" color={colors.textSecondary}>
              Tạm tính
            </AppText>
            <AppText variant="bodyMedium">{formatCurrency(totals.subtotal)}</AppText>
          </View>

          <View style={styles.summaryRow}>
            <AppText variant="body" color={colors.textSecondary}>
              Phí giao hàng (ước tính)
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
        title="Tiếp tục đặt hàng"
        price={totals.total}
        priceLabel="Tổng thanh toán"
        onPress={() => router.push('/checkout')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  itemsList: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  itemImage: {
    width: 76,
    height: 76,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    marginRight: spacing.md,
  },
  itemInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  removeIcon: {
    padding: spacing.xs,
  },
  optionsText: {
    marginTop: 2,
  },
  noteText: {
    marginTop: 2,
    fontStyle: 'italic',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },
  summaryTitle: {
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
    marginBottom: 0,
  },
});
