import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';

const AUDIT_LABELS: Record<string, string> = {
  ORDER_DELIVERY_FAILED: 'Tài xế báo giao thất bại', RIDER_UNASSIGNED: 'Gỡ tài xế khỏi đơn', DELIVERY_CANCELLED_BY_STORE: 'Cửa hàng hủy chuyến giao',
  RIDER_SETTLED: 'Chốt đối soát tài xế',
  STORE_SETTINGS_UPDATED: 'Đổi cài đặt cửa hàng', ORDER_REFUNDED: 'Xác nhận hoàn tiền', ORDER_REJECTED: 'Nhân viên từ chối đơn',
  ORDER_CANCELLED_BY_CUSTOMER: 'Khách hủy đơn', ORDER_AUTO_CANCELLED: 'Hệ thống tự hủy đơn quá hạn', ISSUE_RESOLVED: 'Xử lý phản ánh của khách',
  ROLE_CHANGED: 'Đổi quyền tài khoản', USER_LOCKED: 'Khóa tài khoản', USER_UNLOCKED: 'Mở khóa tài khoản',
  PRODUCT_CREATED: 'Thêm món', PRODUCT_UPDATED: 'Sửa món', PRODUCT_DELETED: 'Xóa món', PRODUCT_STOCK_CHANGED: 'Đổi tình trạng còn hàng',
  COUPON_CREATED: 'Tạo voucher', COUPON_DELETED: 'Gỡ voucher',
};

type Entry = { id: string; actorId: string; action: string; target: string; details?: Record<string, unknown>; at?: { seconds: number } };

/** The 100 most recent admin, staff and system actions that touch money, menu, roles or settings. */
export default function AdminAuditScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => onSnapshot(query(collection(db, 'audit_logs'), orderBy('at', 'desc'), limit(100)),
    snapshot => { setEntries(snapshot.docs.map(doc => ({ ...(doc.data() as Omit<Entry, 'id'>), id: doc.id }))); setLoading(false); },
    () => { setError('Không tải được nhật ký thao tác.'); setLoading(false); }), []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title="Nhật Ký Thao Tác" subtitle="Ai đã làm gì, vào lúc nào" showBack onBack={() => router.back()} />
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> : (
        <FlatList data={entries} keyExtractor={entry => entry.id} contentContainerStyle={{ padding: spacing.base, gap: spacing.sm }}
          ListEmptyComponent={<AppText variant="body" color={error ? colors.error : colors.textSecondary} align="center">{error || 'Chưa có thao tác nào được ghi lại.'}</AppText>}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: 2 }}>
              <AppText variant="bodyMedium">{AUDIT_LABELS[item.action] ?? item.action}</AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                {item.actorId === 'system' ? 'Hệ thống' : `Người thực hiện: ${item.actorId}`} · {item.target}
              </AppText>
              {!!item.at?.seconds && <AppText variant="caption" color={colors.textSecondary}>{new Date(item.at.seconds * 1000).toLocaleString('vi-VN')}</AppText>}
              {!!item.details && Object.keys(item.details).length > 0 && (
                <AppText variant="caption" color={colors.textDisabled} numberOfLines={3}>{JSON.stringify(item.details)}</AppText>
              )}
            </View>
          )} />
      )}
    </SafeAreaView>
  );
}
