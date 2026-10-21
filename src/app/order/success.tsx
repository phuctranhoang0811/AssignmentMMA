import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { CheckCircle2, Clock, ArrowRight, Home } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';

export default function OrderSuccessScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  return (
    <SafeAreaView style={styles.safeArea}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    padding: spacing.xl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.successSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    marginBottom: spacing.base,
  },
  idBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.card,
    alignItems: 'center',
    marginBottom: spacing.xl,
    width: '100%',
  },
  orderId: {
    marginTop: 4,
    letterSpacing: 1,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    padding: spacing.base,
    borderRadius: radius.md,
    width: '100%',
    marginBottom: spacing.base,
  },
  statusTextCol: {
    marginLeft: spacing.md,
    flex: 1,
  },
  note: {
    marginTop: spacing.sm,
  },
  actions: {
    width: '100%',
  },
  mb: {
    marginBottom: spacing.md,
  },
});
