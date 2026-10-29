import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { CheckCircle2, Clock, ArrowRight, Home } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';
import { styles } from '../../styles/orderSuccess.styles';
import { formatCurrency } from '../../utils/formatCurrency';

export default function OrderSuccessScreen() {
  const { orderId, orderCode, total } = useLocalSearchParams<{ orderId: string; orderCode?: string; total?: string }>();
  const paid = !!total;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
        bounces={false}
      >
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <CheckCircle2 size={56} color={colors.success} />
          </View>

          <AppText variant="h1" align="center" style={styles.title}>
            {paid ? 'Thanh toán thành công!' : 'Đã tạo đơn hàng thành công!'}
          </AppText>

          <View style={styles.idBox}>
            <View style={styles.row}>
              <AppText variant="captionMedium" color={colors.textSecondary}>Mã đơn hàng</AppText>
              <AppText variant="bodyMedium" numberOfLines={1} style={styles.orderId}>
                #{orderCode || orderId?.slice(0, 8).toUpperCase() || 'PT-2026-DEMO'}
              </AppText>
            </View>
            {paid && <View style={[styles.row, styles.rowDivider]}>
              <AppText variant="captionMedium" color={colors.textSecondary}>Đã thanh toán</AppText>
              <AppText variant="h3" color={colors.primary}>{formatCurrency(Number(total))}</AppText>
            </View>}
          </View>

          <View style={styles.statusBox}>
            <Clock size={20} color={colors.warning} />
            <View style={styles.statusTextCol}>
              <AppText variant="bodyMedium">Trạng thái: Chờ xác nhận</AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                Nhà hàng đang chuẩn bị tiếp nhận đơn hàng của bạn.
              </AppText>
            </View>
          </View>

          <AppText variant="caption" color={colors.textSecondary} align="center" style={styles.note}>
            Thời gian dự kiến nhận món: 30–45 phút
          </AppText>
        </View>

        <View style={styles.actions}>
          <AppButton
            title="Theo dõi đơn hàng"
            icon={<ArrowRight size={18} color={colors.white} />}
            onPress={() => {
              if (orderId) {
                router.replace({
                  pathname: '/order/[id]',
                  params: { id: orderId },
                });
              } else {
                router.replace('/(tabs)/orders');
              }
            }}
            style={styles.mb}
          />

          <AppButton
            title="Về trang chủ"
            variant="outline"
            icon={<Home size={18} color={colors.textPrimary} />}
            onPress={() => router.replace('/(tabs)/home')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

