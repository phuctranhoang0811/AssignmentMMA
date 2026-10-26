import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { CheckCircle2, Clock, ArrowRight, Home } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';
import { styles } from '../../styles/orderSuccess.styles';

export default function OrderSuccessScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

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
            Đã tạo đơn hàng thành công!
          </AppText>

          <View style={styles.idBox}>
            <AppText variant="captionMedium" color={colors.textSecondary}>
              Mã đơn hàng
            </AppText>
            <AppText variant="h2" color={colors.primary} style={styles.orderId}>
              {orderId || 'PT-2026-DEMO'}
            </AppText>
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
            Thời gian dự kiến nhận món: 30-45 phút (Mô phỏng demo)
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

