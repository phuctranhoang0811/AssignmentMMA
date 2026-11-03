import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Alert } from '../../utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Bell, Globe, RotateCcw, AlertTriangle, ChefHat, Sparkles } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { AppText } from '../../components/ui/AppText';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppButton } from '../../components/ui/AppButton';
import { demoConfig } from '../../data/mockConfig';
import { useOrders } from '../../state/OrderContext';
import { useCart } from '../../state/CartContext';
import { styles } from '../../styles/settings.styles';

export default function SettingsScreen() {
  const { resetOrders } = useOrders();
  const { clearCart } = useCart();
  const [notifications, setNotifications] = useState(true);
  const [simulateErrors, setSimulateErrors] = useState(demoConfig.simulatedFailureRate > 0);

  const handleToggleSimulateErrors = (val: boolean) => {
    setSimulateErrors(val);
    demoConfig.simulatedFailureRate = val ? 0.5 : 0;
  };

  const handleResetData = () => {
    Alert.alert(
      'Khôi phục dữ liệu Demo ban đầu',
      'Thao tác này sẽ đặt lại danh sách đơn hàng và làm mới giỏ hàng về mặc định ban đầu.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Khôi phục ngay',
          style: 'destructive',
          onPress: async () => {
            clearCart();
            await resetOrders();
            Alert.alert('Thành công', 'Đã đặt lại dữ liệu demo ban đầu.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="Cài đặt hệ thống" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* General Settings */}
        <View style={styles.section}>
          <AppText variant="captionMedium" color={colors.textSecondary} style={styles.sectionTitle}>
            Cài đặt chung
          </AppText>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Bell size={20} color={colors.textPrimary} />
                <View style={{ marginLeft: spacing.md }}>
                  <AppText variant="bodyMedium">Thông báo đơn hàng</AppText>
                  <AppText variant="caption" color={colors.textSecondary}>
                    Nhận thông báo khi trạng thái thay đổi
                  </AppText>
                </View>
              </View>
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: colors.border, true: colors.primarySoft }}
                thumbColor={notifications ? colors.primary : colors.textDisabled}
              />
            </View>

            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <View style={styles.rowLeft}>
                <Globe size={20} color={colors.textPrimary} />
                <View style={{ marginLeft: spacing.md }}>
                  <AppText variant="bodyMedium">Khu vực & Tiền tệ</AppText>
                  <AppText variant="caption" color={colors.textSecondary}>
                    Việt Nam (VND • {demoConfig.currency})
                  </AppText>
                </View>
              </View>
              <AppText variant="captionMedium" color={colors.primary}>
                vi-VN
              </AppText>
            </View>
          </View>
        </View>

        {/* Demo tools never ship in a release build. */}
        {__DEV__ && (
          <>
        {/* Developer Demo Sandbox */}
        <View style={styles.section}>
          <View style={styles.devHeaderRow}>
            <Sparkles size={16} color={colors.primary} />
            <AppText variant="captionMedium" color={colors.primary} style={{ marginLeft: 4 }}>
              Developer Demo Sandbox
            </AppText>
          </View>

          <View style={[styles.card, styles.devCard]}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <AlertTriangle size={20} color={colors.warning} />
                <View style={{ marginLeft: spacing.md, flex: 1 }}>
                  <AppText variant="bodyMedium">Giả lập lỗi tạo đơn</AppText>
                  <AppText variant="caption" color={colors.textSecondary}>
                    Kiểm tra phản hồi lỗi mạng & không mất giỏ hàng (TC14)
                  </AppText>
                </View>
              </View>
              <Switch
                value={simulateErrors}
                onValueChange={handleToggleSimulateErrors}
                trackColor={{ false: colors.border, true: colors.warningSoft }}
                thumbColor={simulateErrors ? colors.warning : colors.textDisabled}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/staff/orders')}
              style={[styles.row, { borderBottomWidth: 0 }]}
            >
              <View style={styles.rowLeft}>
                <ChefHat size={20} color={colors.primary} />
                <View style={{ marginLeft: spacing.md }}>
                  <AppText variant="bodyMedium" color={colors.primary}>
                    Mở màn hình Staff Demo
                  </AppText>
                  <AppText variant="caption" color={colors.textSecondary}>
                    Xem và quản lý tiến trình làm món trong bếp
                  </AppText>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Reset Demo Data */}
        <View style={styles.section}>
          <AppButton
            title="Khôi phục dữ liệu Demo gốc"
            variant="outline"
            icon={<RotateCcw size={18} color={colors.error} />}
            onPress={handleResetData}
            textStyle={{ color: colors.error }}
          />
          <AppText variant="caption" color={colors.textSecondary} align="center" style={{ marginTop: 8 }}>
            Tải lại 4 đơn mẫu ban đầu & xóa bộ nhớ đệm giả lập
          </AppText>
        </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

