import React, { useCallback, useEffect, useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Alert } from '../../utils/alert';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from '../ui/AppText';
import { AppButton } from '../ui/AppButton';
import { ISSUE_TYPES, listOrderIssues, reportOrderIssue, type IssueType, type OrderIssue } from '../../services/orderApi';

const label = (type: string) => ISSUE_TYPES.find(item => item.key === type)?.label ?? type;
const STATUS: Record<OrderIssue['status'], { text: string; color: string }> = {
  OPEN: { text: 'Đang chờ cửa hàng xử lý', color: colors.warning },
  RESOLVED: { text: 'Đã xử lý', color: colors.success },
  REJECTED: { text: 'Không chấp nhận', color: colors.error },
};

/** "Báo vấn đề" on an order that was prepared or delivered, plus the store's answers to earlier reports. */
export function OrderIssueCard({ orderId }: { orderId: string }) {
  const [issues, setIssues] = useState<OrderIssue[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState<IssueType>('MISSING_ITEM');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);

  const reload = useCallback(() => listOrderIssues(orderId).then(setIssues).catch(() => {}), [orderId]);
  useEffect(() => { void reload(); }, [reload]);

  const send = async () => {
    if (description.trim().length < 5 || sending) return;
    setSending(true);
    try {
      await reportOrderIssue(orderId, type, description);
      setFormOpen(false);
      setDescription('');
      Alert.alert('Đã gửi phản ánh', 'Cửa hàng sẽ xem và phản hồi bạn sớm nhất có thể.');
      await reload();
    } catch (failure) {
      Alert.alert('Chưa gửi được phản ánh', failure instanceof Error ? failure.message : 'Vui lòng thử lại.');
    } finally { setSending(false); }
  };

  return (
    <View style={styles.card}>
      <AppText variant="bodyMedium">Đơn hàng có vấn đề?</AppText>
      {issues.map(issue => (
        <View key={issue.id} style={styles.issue}>
          <AppText variant="captionMedium">{label(issue.type)}</AppText>
          <AppText variant="caption" color={STATUS[issue.status].color}>{STATUS[issue.status].text}</AppText>
          {!!issue.resolutionNote && <AppText variant="caption" color={colors.textSecondary}>Cửa hàng: {issue.resolutionNote}</AppText>}
          {!!issue.refundAmount && <AppText variant="caption" color={colors.textSecondary}>Hoàn tiền: {issue.refundAmount.toLocaleString('vi-VN')} ₫</AppText>}
        </View>
      ))}
      {formOpen ? (
        <>
          <View style={styles.types}>
            {ISSUE_TYPES.map(item => (
              <TouchableOpacity key={item.key} onPress={() => setType(item.key)} accessibilityRole="button" accessibilityLabel={item.label}
                accessibilityState={{ selected: item.key === type }} style={[styles.chip, item.key === type && styles.chipActive]}>
                <AppText variant="caption" color={item.key === type ? colors.white : colors.textPrimary}>{item.label}</AppText>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput value={description} onChangeText={setDescription} placeholder="Mô tả vấn đề bạn gặp phải" multiline maxLength={500}
            placeholderTextColor={colors.textDisabled} style={styles.input} accessibilityLabel="Mô tả vấn đề" />
          <AppButton title="Gửi phản ánh" onPress={() => { void send(); }} isLoading={sending} disabled={description.trim().length < 5} />
          <AppButton title="Hủy" variant="ghost" onPress={() => setFormOpen(false)} />
        </>
      ) : (
        <AppButton title="Báo vấn đề" variant="outline" onPress={() => setFormOpen(true)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, padding: spacing.base, marginBottom: 12, gap: spacing.sm },
  issue: { gap: 2, paddingVertical: spacing.xs },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  input: { minHeight: 80, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.textPrimary, textAlignVertical: 'top' },
});
