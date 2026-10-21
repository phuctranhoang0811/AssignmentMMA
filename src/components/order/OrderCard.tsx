import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Order } from '../../types/order';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from '../ui/AppText';
import { StatusBadge } from '../ui/StatusBadge';
import { PriceText } from '../ui/PriceText';

interface OrderCardProps {
  order: Order;
}

export const OrderCard: React.FC<OrderCardProps> = ({ order }) => {
  const handlePress = () => {
    router.push({
      pathname: '/order/[id]',
      params: { id: order.id },
    });
  };

  const formattedDate = new Date(order.createdAt).toLocaleDateString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      style={styles.card}
    >
      <View style={styles.header}>
        <View>
          <AppText variant="cardTitle">{order.id}</AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            {formattedDate} • {order.fulfillmentType === 'DELIVERY' ? 'Giao tận nơi' : 'Tự đến lấy'}
          </AppText>
        </View>
        <StatusBadge status={order.status} />
      </View>

      <View style={styles.itemsPreview}>
        {order.items.slice(0, 2).map((item, index) => (
          <View key={index} style={styles.itemRow}>
            {item.image && (
              <Image source={{ uri: item.image }} style={styles.itemThumbnail} />
            )}
            <View style={styles.itemDetails}>
              <AppText variant="bodyMedium" numberOfLines={1}>
                {item.quantity}x {item.productName}
              </AppText>
              {(item.variantName || (item.addonNames && item.addonNames.length > 0)) && (
                <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>
                  {[item.variantName, ...item.addonNames].filter(Boolean).join(', ')}
                </AppText>
              )}
            </View>
          </View>
        ))}
        {order.items.length > 2 && (
          <AppText variant="caption" color={colors.textSecondary} style={styles.moreItems}>
            + thêm {order.items.length - 2} món khác
          </AppText>
        )}
      </View>

      <View style={styles.footer}>
        <View>
          <AppText variant="caption" color={colors.textSecondary}>
            Tổng thanh toán
          </AppText>
          <PriceText amount={order.total} size="md" />
        </View>
        <View style={styles.detailLink}>
          <AppText variant="captionMedium" color={colors.primary}>
            Chi tiết
          </AppText>
          <ChevronRight size={16} color={colors.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
  },
  itemsPreview: {
    marginVertical: spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  itemThumbnail: {
    width: 36,
    height: 36,
    borderRadius: radius.xs,
    marginRight: spacing.sm,
    backgroundColor: colors.surfaceAlt,
  },
  itemDetails: {
    flex: 1,
  },
  moreItems: {
    marginTop: 2,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  detailLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
