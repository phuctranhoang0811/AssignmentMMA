import React, { useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ReceiptText, Sparkles } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from '../../components/ui/AppText';
import { OrderCard } from '../../components/order/OrderCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { useOrders } from '../../state/OrderContext';

type TabSegment = 'active' | 'history';

export default function OrdersScreen() {
  const { orders, refreshOrders } = useOrders();
  const [activeTab, setActiveTab] = useState<TabSegment>('active');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshOrders();
    setRefreshing(false);
  };

  const activeOrders = orders.filter(
    (o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED'
  );

  const historyOrders = orders.filter(
    (o) => o.status === 'COMPLETED' || o.status === 'CANCELLED'
  );

  const currentList = activeTab === 'active' ? activeOrders : historyOrders;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <AppText variant="h1">Đơn hàng của bạn</AppText>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/demo/staff-orders')}
          style={styles.staffDemoBtn}
        >
          <Sparkles size={14} color={colors.primary} />
          <AppText variant="captionMedium" color={colors.primary} style={{ marginLeft: 4 }}>
            Staff Demo
          </AppText>
        </TouchableOpacity>
      </View>

      {/* Segment Tabs */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveTab('active')}
          style={[styles.segmentBtn, activeTab === 'active' && styles.activeSegmentBtn]}
        >
          <AppText
            variant="bodyMedium"
            color={activeTab === 'active' ? colors.primary : colors.textSecondary}
          >
            Đang xử lý ({activeOrders.length})
          </AppText>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveTab('history')}
          style={[styles.segmentBtn, activeTab === 'history' && styles.activeSegmentBtn]}
        >
          <AppText
            variant="bodyMedium"
            color={activeTab === 'history' ? colors.primary : colors.textSecondary}
          >
            Lịch sử ({historyOrders.length})
          </AppText>
        </TouchableOpacity>
      </View>

      {/* Orders List */}
      {currentList.length === 0 ? (
        <EmptyState
          icon={<ReceiptText size={48} color={colors.primary} />}
          title={
            activeTab === 'active'
              ? 'Không có đơn hàng nào đang xử lý'
              : 'Chưa có đơn hàng nào trong lịch sử'
          }
          description="Khám phá ngay thực đơn hấp dẫn với các món pizza nướng củi giòn rụm và mì Ý tuyệt hảo!"
          actionTitle="Đặt món ngay"
          onAction={() => router.push('/(tabs)/menu')}
          style={{ flex: 1 }}
        />
      ) : (
        <FlatList
          data={currentList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => <OrderCard order={item} />}
        />
      )}
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  staffDemoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    padding: 3,
    marginBottom: spacing.base,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  activeSegmentBtn: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 110,
  },
});
