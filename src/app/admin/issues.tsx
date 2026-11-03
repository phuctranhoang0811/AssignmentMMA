import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert } from '../../utils/alert';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { ISSUE_TYPES, listIssues, resolveIssue, type OrderIssue } from '../../services/orderApi';

const RESOLUTIONS = [
  { key: 'APOLOGY', label: 'Xin lỗi' },
  { key: 'REFUND', label: 'Hoàn tiền' },
  { key: 'VOUCHER', label: 'Tặng voucher' },
  { key: 'REJECTED', label: 'Từ chối' },
] as const;
const typeLabel = (type: string) => ISSUE_TYPES.find(item => item.key === type)?.label ?? type;

/** Customer problem reports, oldest first. Each one is answered with a resolution and a note the customer sees. */
export default function AdminIssuesScreen() {
  const router = useRouter();
  const [issues, setIssues] = useState<OrderIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<typeof RESOLUTIONS[number]['key']>('APOLOGY');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setIssues(await listIssues('OPEN')); }
    catch (failure) { Alert.alert('Không tải được phản ánh', failure instanceof Error ? failure.message : 'Vui lòng thử lại.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const open = (issue: OrderIssue) => { setOpenId(issue.id); setResolution('APOLOGY'); setNote(''); setAmount(''); };

  const submit = async (issue: OrderIssue) => {
    const refundAmount = Number(amount.replace(/\D/g, ''));
    if (note.trim().length < 3) { Alert.alert('Thiếu nội dung', 'Nhập lời phản hồi cho khách (ít nhất 3 ký tự).'); return; }
    if (resolution === 'REFUND' && !refundAmount) { Alert.alert('Thiếu số tiền', 'Nhập số tiền cần hoàn cho khách.'); return; }
    setBusy(true);
    try {
      await resolveIssue(issue.id, { resolution, note: note.trim(), ...(resolution === 'REFUND' ? { refundAmount } : {}) });
      setOpenId(null);
      await load();
    } catch (failure) {
      Alert.alert('Chưa xử lý được', failure instanceof Error ? failure.message : 'Vui lòng thử lại.');
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title="Phản Ánh Của Khách" subtitle={`${issues.length} phiếu đang chờ xử lý`} showBack onBack={() => router.back()} />
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> : (
        <FlatList data={issues} keyExtractor={issue => issue.id} contentContainerStyle={{ padding: spacing.base, gap: spacing.md }}
          ListEmptyComponent={<AppText variant="body" color={colors.textSecondary} align="center">Không có phản ánh nào đang chờ.</AppText>}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, padding: spacing.base, gap: spacing.sm }}>
              <AppText variant="bodyMedium">Đơn #{item.orderCode ?? item.orderId.slice(0, 8)} · {typeLabel(item.type)}</AppText>
              <AppText variant="body">{item.description}</AppText>
              {!!item.createdAt && <AppText variant="caption" color={colors.textSecondary}>{new Date(item.createdAt).toLocaleString('vi-VN')}</AppText>}
              {openId === item.id ? (
                <>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {RESOLUTIONS.map(option => (
                      <TouchableOpacity key={option.key} onPress={() => setResolution(option.key)} accessibilityRole="button" accessibilityLabel={option.label}
                        accessibilityState={{ selected: option.key === resolution }}
                        style={{ borderWidth: 1, borderColor: option.key === resolution ? colors.primary : colors.border, backgroundColor: option.key === resolution ? colors.primary : 'transparent',
                          borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6 }}>
                        <AppText variant="caption" color={option.key === resolution ? colors.white : colors.textPrimary}>{option.label}</AppText>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {resolution === 'REFUND' && (
                    <TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="Số tiền hoàn (VNĐ)" accessibilityLabel="Số tiền hoàn"
                      style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.textPrimary }} />
                  )}
                  <TextInput value={note} onChangeText={setNote} placeholder="Lời phản hồi gửi cho khách" multiline maxLength={300} accessibilityLabel="Lời phản hồi"
                    style={{ minHeight: 64, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.textPrimary, textAlignVertical: 'top' }} />
                  <AppButton title="Gửi phản hồi" onPress={() => { void submit(item); }} isLoading={busy} />
                  <AppButton title="Đóng" variant="ghost" onPress={() => setOpenId(null)} />
                </>
              ) : <AppButton title="Xử lý" variant="outline" onPress={() => open(item)} />}
            </View>
          )} />
      )}
    </SafeAreaView>
  );
}
