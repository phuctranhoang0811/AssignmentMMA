import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppButton } from '../../components/ui/AppButton';
import { useAuth } from '../../state/AuthContext';
import { listDeliveryOrders, updateDeliveryOrder, type StaffDeliveryOrder } from '../../services/deliveryService';
import { deliveryStatusLabels } from '../../types/delivery';
import { formatCurrency } from '../../utils/formatCurrency';
import { colors } from '../../theme/colors';

export default function DeliveriesScreen() {
  const { user } = useAuth();
  const uid = user?.id;
  const [result, setResult] = useState<{ uid?: string; orders: StaffDeliveryOrder[] }>({ orders: [] });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const currentUid = useRef(uid);
  currentUid.current = uid;
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const orders = await listDeliveryOrders();
      if (currentUid.current === uid) setResult({ uid, orders });
    } catch (failure) { if (currentUid.current === uid) setError(failure instanceof Error ? failure.message : 'Chưa thể tải đơn.'); }
    finally { setLoading(false); }
  }, [uid]);
  useEffect(() => { void load(); }, [load]);
  const act = async (order: StaffDeliveryOrder, action: 'advance' | 'dispatch' | 'refresh') => {
    setBusy(order.id);
    try { await updateDeliveryOrder(order.id, action); await load(); }
    catch (failure) { Alert.alert('Ahamove', failure instanceof Error ? failure.message : 'Thao tác chưa hoàn tất.'); }
    finally { setBusy(null); }
  };
  const actions: Record<string, string> = { PENDING_CONFIRMATION: 'Xác nhận đơn', CONFIRMED: 'Bắt đầu làm món', PREPARING: 'Món đã sẵn sàng' };
  return <SafeAreaView style={local.screen}>
    <ScreenHeader title="Bếp & giao Ahamove" subtitle="Staging • Không đặt chuyến thật" showBack />
    {!!error && <Text style={local.error} accessibilityLiveRegion="polite">{error}</Text>}
    {loading && <ActivityIndicator color={colors.primary} />}
    <FlatList data={result.uid === user?.id ? result.orders : []} keyExtractor={order => order.id}
      contentContainerStyle={local.list} refreshing={loading} onRefresh={load}
      ListEmptyComponent={<Text>Chưa có đơn Ahamove. Kéo xuống để tải lại.</Text>}
      renderItem={({ item }) => <View style={local.card}>
        <Text style={local.title}>#{item.orderCode}</Text>
        <Text>{item.customer.fullname} • {item.customer.phone}</Text>
        <Text>{item.address}</Text>
        <Text>{item.items.map(line => `${line.quantity} × ${line.productName}`).join(', ')}</Text>
        <Text>{formatCurrency(item.total)} • {item.status}</Text>
        <Text>{deliveryStatusLabels[item.delivery.status]}</Text>
        {!!actions[item.status] && <AppButton title={actions[item.status]} disabled={busy !== null} onPress={() => act(item, 'advance')} />}
        {item.status === 'READY' && item.delivery.status === 'NOT_REQUESTED' && <AppButton title="Gọi / kiểm tra tài xế staging" disabled={busy !== null} onPress={() => act(item, 'dispatch')} />}
        {!!item.delivery.providerOrderId && <AppButton title="Kiểm tra chuyến" variant="outline" disabled={busy !== null} onPress={() => act(item, 'refresh')} />}
      </View>} />
  </SafeAreaView>;
}
const local = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, list: { padding: 16, gap: 12 },
  card: { padding: 16, borderRadius: 16, backgroundColor: colors.white, gap: 10 },
  title: { fontSize: 17, fontWeight: '700' }, error: { padding: 16, color: colors.primary },
});
