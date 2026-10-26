import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, X } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { AppText } from '../../components/ui/AppText';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PriceText } from '../../components/ui/PriceText';
import { EmptyState } from '../../components/ui/EmptyState';
import { useOrders } from '../../state/OrderContext';
import { Order } from '../../types/order';
import { styles } from '../../styles/staffOrders.styles';

export default function StaffOrdersScreen() {
  const { orders, advanceOrderStatus, cancelOrder } = useOrders();
  const [filterTab, setFilterTab] = useState<'pending' | 'kitchen' | 'completed'>('kitchen');

  const pendingOrders = orders.filter((o) => o.status === 'PENDING_CONFIRMATION');
  const kitchenOrders = orders.filter(
    (o) => o.status === 'CONFIRMED' || o.status === 'PREPARING' || o.status === 'READY' || o.status === 'OUT_FOR_DELIVERY'
  );
  const completedOrders = orders.filter(
    (o) => o.status === 'COMPLETED' || o.status === 'CANCELLED'
  );

  const currentList =
    filterTab === 'pending'
      ? pendingOrders
      : filterTab === 'kitchen'
      ? kitchenOrders
      : completedOrders;

  const handleAction = async (orderId: string, actionType: 'advance' | 'cancel') => {
    try {
      if (actionType === 'advance') {
        await advanceOrderStatus(orderId);
      } else {
        await cancelOrder(orderId);
      }
    } catch (e: any) {
      Alert.alert('Lỗi thao tác', e.message);
    }
  };

  const getActionLabel = (order: Order) => {
    switch (order.status) {
      case 'PENDING_CONFIRMATION':
        return { label: 'Xác nhận đơn', color: colors.primary };
      case 'CONFIRMED':
        return { label: 'Bắt đầu nấu', color: colors.warning };
      case 'PREPARING':
        return { label: 'Món đã sẵn sàng', color: colors.success };
      case 'READY':
        return order.fulfillmentType === 'PICKUP'
          ? { label: 'Giao khách tại quầy', color: colors.success }
          : { label: 'Tài xế nhận giao', color: colors.primary };
      case 'OUT_FOR_DELIVERY':
        return { label: 'Giao thành công', color: colors.success };
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        title="Quản lý đơn hàng (Staff Demo)"
        subtitle="Mô phỏng quy trình nhà bếp & giao nhận"
        showBack
      />

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          onPress={() => setFilterTab('pending')}
          style={[styles.tabBtn, filterTab === 'pending' && styles.activeTabBtn]}
        >
          <AppText
            variant="captionMedium"
            color={filterTab === 'pending' ? colors.primary : colors.textSecondary}
          >
            Chờ duyệt ({pendingOrders.length})
          </AppText>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilterTab('kitchen')}
          style={[styles.tabBtn, filterTab === 'kitchen' && styles.activeTabBtn]}
        >
          <AppText
            variant="captionMedium"
            color={filterTab === 'kitchen' ? colors.primary : colors.textSecondary}
          >
            Bếp & Giao ({kitchenOrders.length})
          </AppText>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilterTab('completed')}
          style={[styles.tabBtn, filterTab === 'completed' && styles.activeTabBtn]}
        >
          <AppText
            variant="captionMedium"
            color={filterTab === 'completed' ? colors.primary : colors.textSecondary}
          >
            Đã xong ({completedOrders.length})
          </AppText>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {currentList.length === 0 ? (
          <EmptyState
            title="Không có đơn hàng nào trong mục này"
            description="Hãy thử chuyển sang tab khác hoặc đặt một đơn mới từ khách hàng nhé!"
          />
        ) : (
          currentList.map((order) => {
            const action = getActionLabel(order);
            return (
              <View key={order.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <AppText variant="cardTitle">{order.id}</AppText>
                    <AppText variant="caption" color={colors.textSecondary}>
                      Khách: {order.customer.fullname} • {order.customer.phone}
                    </AppText>
                    <AppText variant="caption" color={colors.textSecondary}>
                      {order.fulfillmentType === 'DELIVERY' ? 'Giao tận nơi' : 'Lấy tại quầy'} • {order.address}
                    </AppText>
                  </View>
                  <StatusBadge status={order.status} />
                </View>

                {/* Items */}
                <View style={styles.itemsList}>
                  {order.items.map((it, idx) => (
                    <View key={idx} style={styles.itemLine}>
                      <AppText variant="bodyMedium">
                        {it.quantity}x {it.productName}
                      </AppText>
                      {(it.variantName || (it.addonNames && it.addonNames.length > 0)) && (
                        <AppText variant="caption" color={colors.textSecondary}>
                          {[it.variantName, ...it.addonNames].filter(Boolean).join(' • ')}
                        </AppText>
                      )}
                      {it.note && (
                        <AppText variant="caption" color={colors.warning}>
                          Lưu ý: {it.note}
                        </AppText>
                      )}
                    </View>
                  ))}
                </View>

                {/* Footer and Actions */}
                <View style={styles.cardFooter}>
                  <PriceText amount={order.total} size="md" />

                  <View style={styles.actionBtnsRow}>
                    {order.status === 'PENDING_CONFIRMATION' && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleAction(order.id, 'cancel')}
                        style={styles.rejectBtn}
                      >
                        <X size={14} color={colors.error} />
                        <AppText variant="captionMedium" color={colors.error} style={{ marginLeft: 2 }}>
                          Từ chối
                        </AppText>
                      </TouchableOpacity>
                    )}

                    {action && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleAction(order.id, 'advance')}
                        style={[styles.advanceBtn, { backgroundColor: action.color }]}
                      >
                        <Check size={14} color={colors.white} />
                        <AppText variant="captionMedium" color={colors.white} style={{ marginLeft: 4 }}>
                          {action.label}
                        </AppText>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
