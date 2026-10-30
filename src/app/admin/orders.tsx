import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Phone,
  User as UserIcon,
  Ban,
  RotateCcw,
} from 'lucide-react-native';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { markOrderRefunded, rejectStaffOrder } from '../../services/orderApi';
import { Alert } from '../../utils/alert';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { colors } from '../../theme/colors';
import { styles } from '../../styles/adminOrders.styles';
import { Order, OrderStatus } from '../../types/order';
import { formatCurrency } from '../../utils/formatCurrency';

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'REFUND_PENDING', label: 'Chờ hoàn tiền' },
  { key: 'PENDING_CONFIRMATION', label: 'Chờ duyệt' },
  { key: 'CONFIRMED', label: 'Xác nhận' },
  { key: 'PREPARING', label: 'Đang nấu' },
  { key: 'READY', label: 'Sẵn sàng' },
  { key: 'OUT_FOR_DELIVERY', label: 'Đang giao' },
  { key: 'COMPLETED', label: 'Hoàn tất' },
  { key: 'CANCELLED', label: 'Đã hủy' },
];

const PAID: string[] = ['PAID', 'PAID_DEMO'];
const REFUNDED: string[] = ['REFUNDED', 'REFUNDED_DEMO'];

export default function AdminOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');

  useEffect(() => {
    let unsub = () => {};
    try {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      unsub = onSnapshot(
        q,
        (snapshot: any) => {
          if (!snapshot.empty) {
            const list: Order[] = [];
            snapshot.forEach((d: any) => {
              const data = d.data();
              list.push({
                id: d.id,
                createdAt: data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
                userId: data.userId,
                customer: {
                  fullname: data.customerName || data.customer?.fullname || 'Khách hàng',
                  phone: data.customerPhone || data.customer?.phone || '',
                  email: data.customer?.email,
                },
                fulfillmentType: data.fulfillmentType || 'DELIVERY',
                address: data.deliveryAddress || data.address,
                items: data.items || [],
                status: data.status || 'PENDING_CONFIRMATION',
                paymentMethod: data.paymentMethod || 'COD',
                paymentStatus: data.paymentStatus || 'UNPAID',
                subtotal: Number(data.subtotal || 0),
                discount: Number(data.discount || 0),
                deliveryFee: Number(data.deliveryFee || 0),
                tax: Number(data.tax || 0),
                total: Number(data.totalAmount || data.total || 0),
                statusHistory: data.statusHistory || [],
                cancelReason: data.cancelReason || '',
                refundDueAt: data.refundDueAt?.toMillis?.() ?? (data.refundDueAt?.seconds ? data.refundDueAt.seconds * 1000 : undefined),
              } as Order);
            });
            setOrders(list);
          } else {
            setOrders([]);
          }
          setLoading(false);
        },
        (err: any) => {
          // Showing demo orders here would look like real data; say what failed instead.
          setOrders([]);
          setLoading(false);
          Alert.alert('Không tải được đơn hàng', err.message);
        }
      );
    } catch {
      setOrders([]);
      setLoading(false);
    }
    return () => unsub();
  }, []);

  // Override / Hủy đơn — Mục 4.2 SYSTEM_FLOWS
  const handleCancelOrder = (order: Order) => {
    Alert.alert(
      'Hủy Đơn (Admin Override)',
      `Xác nhận hủy đơn #${order.id.slice(-6).toUpperCase()} của khách ${order.customer.fullname}?\n\nThao tác này không thể hoàn tác.`,
      [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Hủy ngay',
          style: 'destructive',
          onPress: async () => {
            // Through the backend: keeps status history and flags paid orders for refund.
            try {
              await rejectStaffOrder(order.id, 'Admin can thiệp hủy đơn');
              Alert.alert('Đã hủy', `Đơn hàng #${order.id.slice(-6).toUpperCase()} đã được hủy.`);
            } catch (e) {
              Alert.alert('Chưa hủy được đơn', e instanceof Error ? e.message : 'Vui lòng thử lại.');
            }
          },
        },
      ]
    );
  };

  // Admin đã hoàn tiền thủ công cho khách — REFUND_PENDING → REFUNDED
  const [refundTarget, setRefundTarget] = useState<Order | null>(null);
  const [refundNote, setRefundNote] = useState('');
  const [refunding, setRefunding] = useState(false);
  const handleRefund = (order: Order) => { setRefundNote(''); setRefundTarget(order); };
  const confirmRefund = async () => {
    if (!refundTarget || refunding) return;
    setRefunding(true);
    try {
      await markOrderRefunded(refundTarget.id, refundNote);
      Alert.alert('Đã ghi nhận hoàn tiền', `Đơn đã được đánh dấu hoàn ${formatCurrency(refundTarget.total)} cho khách. Khách sẽ nhận thông báo.`);
      setRefundTarget(null);
    } catch (e) {
      Alert.alert('Chưa ghi nhận được', e instanceof Error ? e.message : 'Vui lòng thử lại.');
    } finally { setRefunding(false); }
  };

  // Refund queue: paid orders that were cancelled, longest-waiting first so nobody's money sits unattended.
  const refundQueue = orders.filter(o => o.paymentStatus === 'REFUND_PENDING')
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const filteredOrders = filterStatus === 'ALL'
    ? orders
    : filterStatus === 'REFUND_PENDING'
      ? refundQueue
      : orders.filter(o => o.status === filterStatus);

  // Same limits as the backend's reject(): not once the order is out for delivery or done.
  const canCancel = (status: OrderStatus) =>
    !['COMPLETED', 'CANCELLED', 'OUT_FOR_DELIVERY'].includes(status);

  const canRefund = (order: Order) => order.paymentStatus === 'REFUND_PENDING';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        title="Giám Sát Đơn Hàng"
        subtitle="Override & Hoàn tiền (Admin can thiệp)"
        showBack={true}
        onBack={() => router.back()}
      />

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={styles.filterRow}
        >
          {STATUS_FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterPill, filterStatus === f.key && styles.filterPillActive]}
              activeOpacity={0.7}
              onPress={() => setFilterStatus(f.key)}
            >
              <AppText
                variant="captionSemiBold"
                color={filterStatus === f.key ? colors.white : colors.textPrimary}
              >
                {f.label}{f.key === 'REFUND_PENDING' && refundQueue.length > 0 ? ` (${refundQueue.length})` : ''}
              </AppText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <AppText variant="bodyMedium" color={colors.textSecondary}>
                {filterStatus === 'REFUND_PENDING' ? 'Không có đơn nào đang chờ hoàn tiền' : 'Không có đơn nào'}
              </AppText>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.orderCard,
                item.status === 'PENDING_CONFIRMATION' && styles.orderCardUrgent,
              ]}
            >
              {/* Card Header: Order ID & Status */}
              <View style={styles.orderHeader}>
                <View style={styles.orderHeaderLeft}>
                  <View style={styles.orderMeta}>
                    <AppText variant="cardTitle" color={colors.textPrimary}>
                      #{item.id.slice(-6).toUpperCase()}
                    </AppText>
                    <View
                      style={[
                        styles.paymentBadge,
                        {
                          backgroundColor:
                            PAID.includes(item.paymentStatus)
                              ? colors.successSoft
                              : REFUNDED.includes(item.paymentStatus)
                              ? colors.primarySoft
                              : colors.warningSoft,
                        },
                      ]}
                    >
                      <AppText
                        variant="small"
                        color={
                          PAID.includes(item.paymentStatus)
                            ? colors.success
                            : REFUNDED.includes(item.paymentStatus)
                            ? colors.primary
                            : colors.warning
                        }
                      >
                        {PAID.includes(item.paymentStatus)
                          ? 'Đã thanh toán'
                          : REFUNDED.includes(item.paymentStatus)
                          ? 'Đã hoàn tiền'
                          : item.paymentStatus === 'REFUND_PENDING'
                          ? 'Chờ hoàn tiền'
                          : 'Chưa thanh toán'}
                      </AppText>
                    </View>
                  </View>
                  <AppText variant="small" color={colors.textSecondary}>
                    {new Date(item.createdAt).toLocaleString('vi-VN')}
                  </AppText>
                </View>
                <StatusBadge status={item.status} />
              </View>

              {/* Customer Info */}
              <View style={styles.customerRow}>
                <UserIcon size={14} color={colors.textSecondary} />
                <AppText variant="bodyMedium" color={colors.textPrimary}>
                  {item.customer.fullname}
                </AppText>
                {item.customer.phone ? (
                  <>
                    <AppText variant="caption" color={colors.textSecondary}>
                      •
                    </AppText>
                    <Phone size={13} color={colors.textSecondary} />
                    <AppText variant="caption" color={colors.textSecondary}>
                      {item.customer.phone}
                    </AppText>
                  </>
                ) : null}
              </View>

              {/* Order Items Summary */}
              <View style={styles.itemsList}>
                {item.items.map((prod, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <AppText variant="caption" color={colors.textPrimary} style={{ flex: 1 }}>
                      {prod.quantity}x {prod.productName || 'Pizza'}
                      {(prod as any).selectedSize || prod.variantName ? ` (${(prod as any).selectedSize || prod.variantName})` : ''}
                      {(prod as any).selectedCrust ? ` - ${(prod as any).selectedCrust}` : ''}
                    </AppText>
                    <AppText variant="captionMedium" color={colors.textPrimary}>
                      {formatCurrency(prod.lineTotal || (prod.unitPrice * prod.quantity))}
                    </AppText>
                  </View>
                ))}
              </View>

              {/* Total & Fulfillment */}
              <View style={styles.totalRow}>
                <AppText variant="caption" color={colors.textSecondary}>
                  {item.fulfillmentType === 'DELIVERY' ? 'Giao tận nơi' : 'Lấy tại quầy'} • {item.paymentMethod}
                </AppText>
                <AppText variant="price" color={colors.primary}>
                  {formatCurrency(item.total)}
                </AppText>
              </View>

              {item.paymentStatus === 'REFUND_PENDING' && (
                <View style={{ gap: 2 }}>
                  {!!(item as any).cancelReason && (
                    <AppText variant="caption" color={colors.textSecondary}>Lý do hủy: {(item as any).cancelReason}</AppText>
                  )}
                  {!!(item as any).refundDueAt && (
                    <AppText variant="captionMedium" color={Date.now() > (item as any).refundDueAt ? colors.error : colors.warning}>
                      {Date.now() > (item as any).refundDueAt ? 'QUÁ HẠN hoàn tiền' : 'Hạn hoàn tiền'}: {new Date((item as any).refundDueAt).toLocaleString('vi-VN')}
                    </AppText>
                  )}
                </View>
              )}

              {/* Admin Actions: Can thiệp Hủy / Hoàn tiền */}
              {(canCancel(item.status) || canRefund(item)) && (
                <View style={styles.actionRow}>
                  {canCancel(item.status) && (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      activeOpacity={0.8}
                      onPress={() => handleCancelOrder(item)}
                    >
                      <Ban size={15} color={colors.error} />
                      <AppText variant="captionSemiBold" color={colors.error}>
                        Hủy đơn (Override)
                      </AppText>
                    </TouchableOpacity>
                  )}

                  {canRefund(item) && (
                    <TouchableOpacity
                      style={styles.refundBtn}
                      activeOpacity={0.8}
                      onPress={() => handleRefund(item)}
                    >
                      <RotateCcw size={15} color={colors.warning} />
                      <AppText variant="captionSemiBold" color={colors.warning}>
                        Đã hoàn tiền cho khách
                      </AppText>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        />
      )}

      <Modal visible={!!refundTarget} transparent animationType="fade" onRequestClose={() => setRefundTarget(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, gap: 12 }}>
            <AppText variant="h3">Xác nhận đã hoàn tiền</AppText>
            {!!refundTarget && (
              <AppText variant="body" color={colors.textSecondary}>
                Hoàn {formatCurrency(refundTarget.total)} cho đơn #{refundTarget.id.slice(-6).toUpperCase()} của {refundTarget.customer.fullname}.
              </AppText>
            )}
            <TextInput value={refundNote} onChangeText={setRefundNote} placeholder="Ghi chú: mã giao dịch, ngân hàng (không bắt buộc)"
              accessibilityLabel="Ghi chú hoàn tiền" maxLength={300}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.textPrimary }} />
            <TouchableOpacity onPress={() => { void confirmRefund(); }} disabled={refunding} accessibilityRole="button" accessibilityLabel="Xác nhận hoàn tiền"
              style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', opacity: refunding ? 0.6 : 1 }}>
              <AppText variant="bodyMedium" color={colors.white}>Xác nhận hoàn tiền</AppText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setRefundTarget(null)} accessibilityRole="button" accessibilityLabel="Hủy" style={{ padding: 10, alignItems: 'center' }}>
              <AppText variant="body" color={colors.textSecondary}>Hủy</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
