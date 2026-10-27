import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppButton } from '../../components/ui/AppButton';
import { useAuth } from '../../state/AuthContext';
import { advanceStaffOrder, listStaffOrders, rejectStaffOrder, type StaffOrder } from '../../services/orderApi';
import { updateDeliveryOrder } from '../../services/deliveryService';
import { deliveryStatusLabels } from '../../types/delivery';
import { formatCurrency } from '../../utils/formatCurrency';
import { colors } from '../../theme/colors';

const FILTERS = [
  [undefined, 'Tất cả'], ['PENDING_CONFIRMATION', 'Chờ xác nhận'], ['CONFIRMED', 'Đã xác nhận'], ['PREPARING', 'Đang làm'],
  ['READY', 'Sẵn sàng'], ['OUT_FOR_DELIVERY', 'Đang giao'], ['COMPLETED', 'Hoàn thành'], ['CANCELLED', 'Đã hủy'],
] as const;
const STATUS_LABEL: Record<string, string> = Object.fromEntries(FILTERS.filter(([key]) => key).map(([key, label]) => [key!, label]));
const REJECT_REASONS = ['Hết món', 'Ngoài vùng giao hàng', 'Cửa hàng quá tải'];

// Mirrors backend nextStatus(): which button the kitchen sees for each status.
function nextAction(order: StaffOrder) {
  const kitchen: Record<string, string> = { PENDING_CONFIRMATION: 'Xác nhận đơn', CONFIRMED: 'Bắt đầu làm món', PREPARING: 'Món đã sẵn sàng' };
  if (kitchen[order.status]) return kitchen[order.status];
  if (order.delivery?.provider === 'AHAMOVE') return undefined;
  if (order.status === 'READY') return order.fulfillmentType === 'delivery' ? 'Bắt đầu giao' : 'Khách đã nhận món';
  if (order.status === 'OUT_FOR_DELIVERY') return 'Giao thành công';
  return undefined;
}
const canReject = (order: StaffOrder) => ['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY'].includes(order.status) &&
  (!order.delivery || order.delivery.status === 'NOT_REQUESTED');

export default function StaffOrdersScreen() {
  const { user } = useAuth();
  const uid = user?.id;
  const [filter, setFilter] = useState<string | undefined>('PENDING_CONFIRMATION');
  const [result, setResult] = useState<{ key?: string; orders: StaffOrder[] }>({ orders: [] });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const current = useRef(`${uid}:${filter}`);
  current.current = `${uid}:${filter}`;

  const load = useCallback(async () => {
    const key = `${uid}:${filter}`;
    setLoading(true);
    setError('');
    try {
      const orders = await listStaffOrders(filter);
      if (current.current === key) setResult({ key, orders });
    } catch (failure) { if (current.current === key) setError(failure instanceof Error ? failure.message : 'Chưa thể tải đơn.'); }
    finally { setLoading(false); }
  }, [uid, filter]);
  useEffect(() => { void load(); }, [load]);

  const run = async (order: StaffOrder, action: () => Promise<unknown>) => {
    setBusy(order.id);
    try { await action(); await load(); }
    catch (failure) { Alert.alert(`Đơn #${order.orderCode}`, failure instanceof Error ? failure.message : 'Thao tác chưa hoàn tất.'); }
    finally { setBusy(null); }
  };
  const reject = (order: StaffOrder) => Alert.alert(`Từ chối đơn #${order.orderCode}?`, 'Chọn lý do. Đơn đã thanh toán sẽ được đánh dấu chờ hoàn tiền.', [
    ...REJECT_REASONS.map(reason => ({ text: reason, onPress: () => run(order, () => rejectStaffOrder(order.id, reason)) })),
    { text: 'Không', style: 'cancel' as const },
  ]);

  return <SafeAreaView style={local.screen}>
    <ScreenHeader title="Quản lý đơn hàng" subtitle="Bếp & giao hàng" showBack />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={local.filters} style={local.filterBar}>
      {FILTERS.map(([key, label]) => (
        <TouchableOpacity key={label} onPress={() => setFilter(key)} accessibilityRole="button" accessibilityState={{ selected: filter === key }}
          style={[local.chip, filter === key && local.chipActive]}>
          <Text style={[local.chipText, filter === key && local.chipTextActive]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
    {!!error && <Text style={local.error} accessibilityLiveRegion="polite">{error}</Text>}
    {loading && !result.orders.length && <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />}
    <FlatList data={result.key === `${uid}:${filter}` ? result.orders : []} keyExtractor={order => order.id}
      contentContainerStyle={local.list} refreshing={loading} onRefresh={load}
      ListEmptyComponent={loading ? undefined : <Text style={local.empty}>Không có đơn nào. Kéo xuống để tải lại.</Text>}
      renderItem={({ item }) => {
        const action = nextAction(item);
        return <View style={local.card}>
          <View style={local.row}>
            <Text style={local.title}>#{item.orderCode}</Text>
            <Text style={local.badge}>{STATUS_LABEL[item.status] ?? item.status}</Text>
          </View>
          <Text>{item.customer?.fullname} • {item.customer?.phone}</Text>
          <Text>{item.fulfillmentType === 'delivery' ? `Giao: ${item.address}` : 'Nhận tại cửa hàng'}{item.deliveryTime ? ` • ${item.deliveryTime}` : ''}</Text>
          <Text>{item.items?.map(line => `${line.quantity} × ${line.productName}${line.variantName ? ` (${line.variantName})` : ''}`).join(', ')}</Text>
          <Text style={local.total}>{formatCurrency(item.total)} • {item.paymentName ?? ''}{item.paymentStatus === 'REFUND_PENDING' ? ' • Chờ hoàn tiền' : ''}</Text>
          {!!item.delivery && <Text>Ahamove: {deliveryStatusLabels[item.delivery.status]}</Text>}
          {!!action && <AppButton title={action} disabled={busy !== null} isLoading={busy === item.id} onPress={() => run(item, () => advanceStaffOrder(item.id))} />}
          {item.delivery?.provider === 'AHAMOVE' && item.status === 'READY' && item.delivery.status === 'NOT_REQUESTED' &&
            <AppButton title="Gọi tài xế Ahamove" disabled={busy !== null} onPress={() => run(item, () => updateDeliveryOrder(item.id, 'dispatch'))} />}
          {!!item.delivery?.providerOrderId &&
            <AppButton title="Kiểm tra chuyến" variant="outline" disabled={busy !== null} onPress={() => run(item, () => updateDeliveryOrder(item.id, 'refresh'))} />}
          {canReject(item) && <AppButton title="Từ chối đơn" variant="ghost" disabled={busy !== null} onPress={() => reject(item)} />}
        </View>;
      }} />
  </SafeAreaView>;
}
const local = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  filterBar: { flexGrow: 0 }, filters: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: '#374151', fontWeight: '500' }, chipTextActive: { color: colors.white, fontWeight: '700' },
  list: { padding: 16, gap: 12 }, empty: { textAlign: 'center', color: '#6B7280', marginTop: 24 },
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.white, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700' }, total: { fontWeight: '600' },
  badge: { color: colors.primary, fontWeight: '600' }, error: { padding: 16, color: colors.primary },
});
