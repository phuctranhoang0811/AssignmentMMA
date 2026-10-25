import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, RefreshCw, XCircle, FastForward, MapPin, Phone, User } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PriceText } from '../../components/ui/PriceText';
import { OrderTimeline } from '../../components/order/OrderTimeline';
import { useOrders } from '../../state/OrderContext';
import { useCart } from '../../state/CartContext';
import { formatCurrency } from '../../utils/formatCurrency';
import { Order } from '../../types/order';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getOrderById, cancelOrder, advanceOrderStatus } = useOrders();
  const { addItem } = useCart();
  const [order, setOrder] = useState<Order | undefined>(undefined);
  const [isAdvancing, setIsAdvancing] = useState(false);

  useEffect(() => {
    if (id) {
      const o = getOrderById(id);
      setOrder(o);
    }
  }, [id, getOrderById]);

  if (!order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <AppText variant="h3">Chi tiết đơn hàng</AppText>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.centerContainer}>
          <AppText variant="body" color={colors.textSecondary}>
            Đang tải thông tin đơn hàng...
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  const canCancel = order.status === 'PENDING_CONFIRMATION';

  const handleCancel = () => {
    Alert.alert(
      'Hủy đơn hàng',
      'Bạn có chắc chắn muốn hủy đơn hàng này không?',
      [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Xác nhận hủy',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = await cancelOrder(order.id);
              setOrder(updated);
            } catch (err: any) {
              Alert.alert('Không thể hủy', err.message);
            }
          },
        },
      ]
    );
  };

  const handleAdvanceStatus = async () => {
    setIsAdvancing(true);
    try {
      const updated = await advanceOrderStatus(order.id);
      setOrder(updated);
    } catch (err: any) {
      Alert.alert('Lỗi', err.message);
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleReorder = () => {
    order.items.forEach((item) => {
      addItem({
        productId: item.productId,
        addonIds: [],
        quantity: item.quantity,
        specialInstructions: item.note,
      });
    });
    Alert.alert(
      'Đã thêm vào giỏ hàng',
      'Các món từ đơn hàng đã được đưa vào giỏ.',
      [
        { text: 'Đóng', style: 'cancel' },
        { text: 'Xem giỏ hàng', onPress: () => router.push('/(tabs)/cart') },
      ]
    );
  };

  const formattedDate = new Date(order.createdAt).toLocaleDateString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <AppText variant="h3">{order.id}</AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            {formattedDate}
          </AppText>
        </View>
        <StatusBadge status={order.status} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Demo Fast Forward Stepper Control */}
        {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
          <View style={styles.demoControlBox}>
            <View style={styles.demoControlLeft}>
              <FastForward size={18} color={colors.primary} />
              <View style={{ marginLeft: spacing.xs }}>
                <AppText variant="captionMedium" color={colors.primary}>
                  Developer Demo Control
                </AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  Mô phỏng chuyển bước trạng thái tiếp theo
                </AppText>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={isAdvancing}
              onPress={handleAdvanceStatus}
              style={styles.demoAdvanceBtn}
            >
              <AppText variant="captionMedium" color={colors.white}>
                {isAdvancing ? '...' : 'Bước kế →'}
              </AppText>
            </TouchableOpacity>
          </View>
        )}

        {/* Timeline Stepper */}
        <View style={styles.card}>
          <AppText variant="h3" style={styles.cardTitle}>
            Tiến trình đơn hàng
          </AppText>
          <OrderTimeline
            status={order.status}
            fulfillmentType={order.fulfillmentType}
            history={order.statusHistory}
          />
        </View>

        {/* Delivery / Fulfillment Info */}
        <View style={styles.card}>
          <AppText variant="h3" style={styles.cardTitle}>
            Thông tin nhận hàng
          </AppText>
          <View style={styles.infoRow}>
            <User size={16} color={colors.textSecondary} />
            <AppText variant="bodyMedium" style={styles.infoText}>
              {order.customer.fullname}
            </AppText>
          </View>
          <View style={styles.infoRow}>
            <Phone size={16} color={colors.textSecondary} />
            <AppText variant="body" style={styles.infoText}>
              {order.customer.phone}
            </AppText>
          </View>
          <View style={styles.infoRow}>
            <MapPin size={16} color={colors.textSecondary} />
            <AppText variant="body" style={styles.infoText}>
              {order.address}
            </AppText>
          </View>
        </View>

        {/* Items List */}
        <View style={styles.card}>
          <AppText variant="h3" style={styles.cardTitle}>
            Món ăn ({order.items.length})
          </AppText>

          {order.items.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              {item.image && (
                <Image source={{ uri: item.image }} style={styles.itemImage} />
              )}
              <View style={styles.itemDetails}>
                <AppText variant="bodyMedium">
                  {item.quantity}x {item.productName}
                </AppText>
                {(item.variantName || (item.addonNames && item.addonNames.length > 0)) && (
                  <AppText variant="caption" color={colors.textSecondary}>
                    {[item.variantName, ...item.addonNames].filter(Boolean).join(' • ')}
                  </AppText>
                )}
                {item.note && (
                  <AppText variant="caption" color={colors.warning}>
                    Ghi chú: {item.note}
                  </AppText>
                )}
              </View>
              <AppText variant="bodyMedium">
                {formatCurrency(item.lineTotal)}
              </AppText>
            </View>
          ))}
        </View>

        {/* Pricing Breakdown */}
        <View style={styles.card}>
          <AppText variant="h3" style={styles.cardTitle}>
            Chi tiết hóa đơn
          </AppText>

          <View style={styles.summaryRow}>
            <AppText variant="body" color={colors.textSecondary}>
              Tạm tính
            </AppText>
            <AppText variant="bodyMedium">{formatCurrency(order.subtotal)}</AppText>
          </View>

          {order.discount > 0 && (
            <View style={styles.summaryRow}>
              <AppText variant="body" color={colors.success}>
                Giảm giá
              </AppText>
              <AppText variant="bodyMedium" color={colors.success}>
                -{formatCurrency(order.discount)}
              </AppText>
            </View>
          )}

          <View style={styles.summaryRow}>
            <AppText variant="body" color={colors.textSecondary}>
              Phí giao hàng
            </AppText>
            <AppText variant="bodyMedium">
              {order.deliveryFee === 0 ? 'Miễn phí' : formatCurrency(order.deliveryFee)}
            </AppText>
          </View>

          <View style={styles.summaryRow}>
            <AppText variant="body" color={colors.textSecondary}>
              Thuế VAT (10%)
            </AppText>
            <AppText variant="bodyMedium">{formatCurrency(order.tax)}</AppText>
          </View>

          <View style={[styles.summaryRow, styles.totalRow]}>
            <AppText variant="cardTitle">Tổng cộng</AppText>
            <PriceText amount={order.total} size="lg" />
          </View>
        </View>

        {/* Actions Bottom Buttons */}
        <View style={styles.actions}>
          <AppButton
            title="Đặt lại các món này"
            icon={<RefreshCw size={18} color={colors.white} />}
            onPress={handleReorder}
            style={styles.mb}
          />

          {canCancel && (
            <AppButton
              title="Hủy đơn hàng này"
              variant="outline"
              icon={<XCircle size={18} color={colors.error} />}
              onPress={handleCancel}
              textStyle={{ color: colors.error }}
            />
          )}
        </View>
      </ScrollView>
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
  backButton: {
    padding: spacing.xs,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  demoControlBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#FBDCD3',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.base,
  },
  demoControlLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  demoAdvanceBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  cardTitle: {
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemImage: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    marginRight: spacing.md,
  },
  itemDetails: {
    flex: 1,
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
  actions: {
    marginTop: spacing.md,
  },
  mb: {
    marginBottom: spacing.md,
  },
});
