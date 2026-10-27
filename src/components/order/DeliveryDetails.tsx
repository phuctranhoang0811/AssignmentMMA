import React from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import * as Linking from 'expo-linking';
import { deliveryStatusLabels, type Delivery } from '../../types/delivery';
import { updateDeliveryOrder } from '../../services/deliveryService';
import { styles } from '../../styles/orderTracking.styles';

export function DeliveryDetails({ orderId, delivery }: { orderId: string; delivery: Delivery }) {
  const [busy, setBusy] = React.useState(false);
  const refresh = async () => {
    setBusy(true);
    try { await updateDeliveryOrder(orderId, 'refresh'); }
    catch (error) { Alert.alert('Ahamove', error instanceof Error ? error.message : 'Chưa thể cập nhật chuyến.'); }
    finally { setBusy(false); }
  };
  const openTracking = async () => {
    try {
      const url = new URL(delivery.trackingUrl ?? '');
      if (url.protocol !== 'https:' || !['expressstg.ahamove.com', 'express.ahamove.com'].includes(url.hostname) || url.username || url.password) return;
      await Linking.openURL(url.href);
    } catch { Alert.alert('Ahamove', 'Chưa thể mở liên kết theo dõi.'); }
  };
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoCardTitle}>Ahamove • Thử nghiệm</Text>
      <Text style={styles.infoText}>{deliveryStatusLabels[delivery.status] || 'Đang cập nhật'}</Text>
      {!!delivery.driverName && <Text style={styles.infoText}>Tài xế: {delivery.driverName}</Text>}
      {!!delivery.driverPhone && <Text style={styles.infoText}>Điện thoại: {delivery.driverPhone}</Text>}
      {!!delivery.providerOrderId && <Text style={styles.infoText}>Mã chuyến: {delivery.providerOrderId}</Text>}
      {!!delivery.trackingUrl && <TouchableOpacity onPress={openTracking} accessibilityRole="link">
        <Text style={styles.infoText}>Mở hành trình Ahamove</Text>
      </TouchableOpacity>}
      {delivery.status !== 'NOT_REQUESTED' && <TouchableOpacity onPress={refresh} disabled={busy}
        accessibilityRole="button" accessibilityState={{ busy, disabled: busy }}>
        <Text style={styles.infoText}>{busy ? 'Đang kiểm tra…' : 'Kiểm tra trạng thái chuyến'}</Text>
      </TouchableOpacity>}
    </View>
  );
}
