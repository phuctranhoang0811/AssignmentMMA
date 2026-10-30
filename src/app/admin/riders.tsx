import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert } from '../../utils/alert';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { formatCurrency } from '../../utils/formatCurrency';
import { getRiderLedger, settleRider, type RiderLedgerRow } from '../../services/orderApi';

/** Per rider: cash collected on delivery against wages owed. Settling closes all of that rider's open trips. */
export default function AdminRidersScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<RiderLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await getRiderLedger()); setError(''); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Chưa tải được dữ liệu.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const confirmSettle = (row: RiderLedgerRow) => {
    const text = row.net >= 0 ? `Thu của ${row.name} ${formatCurrency(row.net)}` : `Trả ${row.name} ${formatCurrency(-row.net)}`;
    Alert.alert('Chốt đối soát?', `${text}\n(${row.trips} chuyến: tiền mặt ${formatCurrency(row.cash)}, tiền công ${formatCurrency(row.earned)}). Chỉ chốt sau khi đã đếm tiền và thanh toán.`, [
      { text: 'Chưa', style: 'cancel' },
      { text: 'Đã xong, chốt', onPress: () => {
        setBusy(row.uid);
        settleRider(row.uid)
          .then(() => load())
          .catch(failure => Alert.alert('Chưa chốt được', failure instanceof Error ? failure.message : 'Vui lòng thử lại.'))
          .finally(() => setBusy(null));
      } },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title="Đối Soát Tài Xế" subtitle="Tiền mặt đã thu và tiền công chưa chốt" showBack onBack={() => router.back()} />
      {!!error && <AppText variant="caption" color={colors.error} style={{ padding: spacing.base }}>{error}</AppText>}
      <FlatList data={rows} keyExtractor={row => row.uid} contentContainerStyle={{ padding: spacing.base, gap: spacing.base }}
        refreshing={loading} onRefresh={() => { void load(); }}
        ListEmptyComponent={loading ? <ActivityIndicator color={colors.primary} /> : <AppText variant="body" color={colors.textSecondary}>Không có chuyến nào cần đối soát.</AppText>}
        renderItem={({ item: row }) => <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.base, gap: spacing.sm, borderWidth: 1, borderColor: colors.border }}>
          <AppText variant="bodyMedium">{row.name}</AppText>
          <AppText variant="caption" color={colors.textSecondary}>{row.trips} chuyến chưa chốt</AppText>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="body">Tiền mặt đang giữ</AppText><AppText variant="bodyMedium" color={colors.error}>{formatCurrency(row.cash)}</AppText>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="body">Tiền công</AppText><AppText variant="bodyMedium" color={colors.success}>{formatCurrency(row.earned)}</AppText>
          </View>
          <AppText variant="bodyMedium" color={row.net >= 0 ? colors.error : colors.success}>
            {row.net >= 0 ? `Tài xế nộp lại: ${formatCurrency(row.net)}` : `Cửa hàng trả tài xế: ${formatCurrency(-row.net)}`}
          </AppText>
          <AppButton title="Chốt đối soát" isLoading={busy === row.uid} disabled={busy !== null} onPress={() => confirmSettle(row)} />
        </View>} />
    </SafeAreaView>
  );
}
