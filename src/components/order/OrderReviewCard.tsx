import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import { Alert } from '../../utils/alert';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from '../ui/AppText';
import { AppButton } from '../ui/AppButton';
import { submitOrderReview } from '../../services/orderApi';

const LABELS = ['Rất tệ', 'Chưa tốt', 'Bình thường', 'Tốt', 'Tuyệt vời'];

// Shown on a completed order. The saved rating comes back through the live order snapshot, so no local state is kept after sending.
export function OrderReviewCard({ orderId, rating }: { orderId: string; rating?: number }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  if (rating) {
    return (
      <View style={styles.card} accessible accessibilityLabel={`Bạn đã đánh giá ${rating} trên 5 sao`}>
        <AppText variant="bodyMedium">Cảm ơn bạn đã đánh giá!</AppText>
        <View style={styles.row}>
          {[1, 2, 3, 4, 5].map(value => (
            <Star key={value} size={22} color={colors.warning} fill={value <= rating ? colors.warning : 'transparent'} />
          ))}
        </View>
      </View>
    );
  }

  const send = async () => {
    if (!stars || sending) return;
    setSending(true);
    try { await submitOrderReview(orderId, stars, comment); }
    catch (failure) { Alert.alert('Chưa gửi được đánh giá', failure instanceof Error ? failure.message : 'Vui lòng thử lại.'); }
    finally { setSending(false); }
  };

  return (
    <View style={styles.card}>
      <AppText variant="bodyMedium">Bạn thấy đơn hàng này thế nào?</AppText>
      <View style={styles.row}>
        {[1, 2, 3, 4, 5].map(value => (
          <TouchableOpacity key={value} onPress={() => setStars(value)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityRole="button" accessibilityLabel={`${value} sao`} accessibilityState={{ selected: value === stars }}>
            <Star size={32} color={colors.warning} fill={value <= stars ? colors.warning : 'transparent'} />
          </TouchableOpacity>
        ))}
      </View>
      {!!stars && <AppText variant="caption" color={colors.textSecondary}>{LABELS[stars - 1]}</AppText>}
      <TextInput value={comment} onChangeText={setComment} placeholder="Góp ý thêm cho cửa hàng (không bắt buộc)"
        placeholderTextColor={colors.textDisabled} multiline maxLength={500} style={styles.input}
        accessibilityLabel="Góp ý cho cửa hàng" />
      <AppButton title="Gửi đánh giá" onPress={() => { void send(); }} isLoading={sending} disabled={!stars} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card,
    padding: spacing.base, marginBottom: 12, gap: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.sm, marginVertical: 4 },
  input: {
    minHeight: 64, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md,
    color: colors.textPrimary, textAlignVertical: 'top',
  },
});
