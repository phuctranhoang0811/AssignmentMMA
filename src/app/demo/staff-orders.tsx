import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, X, Clock, ChefHat, Package, Bike, Store, Banknote } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { AppText } from '../../components/ui/AppText';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PriceText } from '../../components/ui/PriceText';
import { EmptyState } from '../../components/ui/EmptyState';
import { useOrders } from '../../state/OrderContext';
import { Order, OrderStatus } from '../../types/order';
import { styles } from '../../styles/staffOrders.styles';

type KitchenSection = {
  status: OrderStatus;
  title: string;
  hint: string;
  icon: React.ReactNode;
};

const KITCHEN_SECTIONS: KitchenSection[] = [
  {
    status: 'CONFIRMED',
    title: 'Chờ nấu',
    hint: 'Đã xác nhận, chờ bếp nhận đơn',
    icon: <Clock size={16} color={colors.textSecondary} />,
  },
  {
    status: 'PREPARING',
    title: 'Đang nấu',
    hint: 'Nướng bánh & kiểm tra chất lượng',
    icon: <ChefHat size={16} color={colors.warning} />,
  },
  {
    status: 'READY',
    title: 'Sẵn sàng bàn giao',
    hint: 'Đóng hộp kèm dụng cụ, giao shipper hoặc khách tại quầy',
    icon: <Package size={16} color={colors.success} />,
  },
  {
    status: 'OUT_FOR_DELIVERY',
    title: 'Đang giao',
    hint: 'Shipper đang trên đường giao',
    icon: <Bike size={16} color={colors.primary} />,
  },
];

const formatElapsed = (iso: string) => {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} phút trước`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h} giờ trước` : `${Math.floor(h / 24)} ngày trước`;
};

export default function StaffOrdersScreen() {
  const { orders, advanceOrderStatus, cancelOrder } = useOrders();
  const [filterTab, setFilterTab] = useState<'pending' | 'kitchen' | 'completed'>('kitchen');
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const runAction = async (orderId: string, actionType: 'advance' | 'cancel') => {
    if (busyId) return;
    setBusyId(orderId);
    try {
      if (actionType === 'advance') {
        await advanceOrderStatus(orderId);
      } else {
        await cancelOrder(orderId);
      }
    } catch (e: any) {
      if (Platform.OS === 'web') {
        window.alert(`Lỗi thao tác: ${e.message}`);
      } else {
        Alert.alert('Lỗi thao tác', e.message);
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleAction = (order: Order, actionType: 'advance' | 'cancel') => {
    // Bước cuối: nhắc nhân viên thu tiền COD trước khi hoàn tất đơn
    const isFinalStep =
      actionType === 'advance' &&
      (order.status === 'OUT_FOR_DELIVERY' ||
        (order.status === 'READY' && order.fulfillmentType === 'PICKUP'));
    if (isFinalStep && order.paymentMethod === 'COD' && order.paymentStatus !== 'PAID_DEMO') {
      const message = `Vui lòng thu ${order.total.toLocaleString('vi-VN')}đ từ khách trước khi hoàn tất đơn.`;
      if (Platform.OS === 'web') {
        // Alert.alert không hiển thị trên web nên dùng window.confirm
        if (window.confirm(`Thu tiền mặt (COD)\n${message}\n\nĐã thu tiền và hoàn tất đơn?`)) {
          runAction(order.id, 'advance');
        }
        return;
      }
      Alert.alert('Thu tiền mặt (COD)', message, [
        { text: 'Chưa thu', style: 'cancel' },
        { text: 'Đã thu & hoàn tất', onPress: () => runAction(order.id, 'advance') },
      ]);
      return;
    }
    runAction(order.id, actionType);
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

  const renderOrderCard = (order: Order) => {
    const action = getActionLabel(order);
    const isBusy = busyId === order.id;
    const showCodBanner =
      filterTab === 'kitchen' && order.paymentMethod === 'COD' && order.paymentStatus !== 'PAID_DEMO';
    const startedAt = order.statusHistory[order.statusHistory.length - 1]?.at ?? order.createdAt;

    return (
      <View key={order.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <AppText variant="cardTitle">{order.id}</AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              Khách: {order.customer.fullname} • {order.customer.phone}
            </AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              {order.fulfillmentType === 'DELIVERY' ? (
                <Bike size={12} color={colors.textSecondary} />
              ) : (
                <Store size={12} color={colors.textSecondary} />
              )}
              <AppText variant="caption" color={colors.textSecondary} style={{ marginLeft: 4, flex: 1 }}>
                {order.fulfillmentType === 'DELIVERY' ? 'Giao tận nơi' : 'Lấy tại quầy'}
                {order.address ? ` • ${order.address}` : ''}
              </AppText>
            </View>
            {filterTab === 'kitchen' && (
              <AppText variant="caption" color={colors.textSecondary} style={{ marginTop: 2 }}>
                Cập nhật {formatElapsed(startedAt)}
              </AppText>
            )}
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
              {it.customizationSummary && it.customizationSummary.length > 0 && (
                <AppText variant="caption" color={colors.textSecondary}>
                  {it.customizationSummary.join(' • ')}
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

        {showCodBanner && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surfaceAlt,
              borderRadius: 8,
              padding: 8,
              marginTop: 4,
            }}
          >
            <Banknote size={14} color={colors.warning} />
            <AppText variant="captionMedium" color={colors.warning} style={{ marginLeft: 6 }}>
              COD: thu {order.total.toLocaleString('vi-VN')}đ khi giao
            </AppText>
          </View>
        )}

        {/* Footer and Actions */}
        <View style={styles.cardFooter}>
          <PriceText amount={order.total} size="md" />

          <View style={styles.actionBtnsRow}>
            {(order.status === 'PENDING_CONFIRMATION' || order.status === 'CONFIRMED') && (
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={isBusy}
                onPress={() => handleAction(order, 'cancel')}
                style={[styles.rejectBtn, isBusy && { opacity: 0.5 }]}
              >
                <X size={14} color={colors.error} />
                <AppText variant="captionMedium" color={colors.error} style={{ marginLeft: 2 }}>
                  {order.status === 'CONFIRMED' ? 'Hủy' : 'Từ chối'}
                </AppText>
              </TouchableOpacity>
            )}

            {action && (
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={isBusy}
                onPress={() => handleAction(order, 'advance')}
                style={[styles.advanceBtn, { backgroundColor: action.color }, isBusy && { opacity: 0.6 }]}
              >
                {isBusy ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Check size={14} color={colors.white} />
                )}
                <AppText variant="captionMedium" color={colors.white} style={{ marginLeft: 4 }}>
                  {action.label}
                </AppText>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderKitchen = () => {
    if (kitchenOrders.length === 0) return null;
    return KITCHEN_SECTIONS.map((section) => {
      const list = kitchenOrders.filter((o) => o.status === section.status);
      if (list.length === 0) return null;
      return (
        <View key={section.status} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
            {section.icon}
            <AppText variant="cardTitle" style={{ marginLeft: 6 }}>
              {section.title} ({list.length})
            </AppText>
          </View>
          <AppText variant="caption" color={colors.textSecondary} style={{ marginBottom: 8 }}>
            {section.hint}
          </AppText>
          {list.map(renderOrderCard)}
        </View>
      );
    });
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
        ) : filterTab === 'kitchen' ? (
          renderKitchen()
        ) : (
          currentList.map(renderOrderCard)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
