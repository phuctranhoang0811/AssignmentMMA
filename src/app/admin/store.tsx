import React, { useEffect, useState } from 'react';
import { ScrollView, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Alert } from '../../utils/alert';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { useStoreStatus } from '../../services/storeSettings';
import { updateStoreSettings } from '../../services/orderApi';
import { geocodeAddressStrict, getCurrentPhoneLocation } from '../../services/addressService';
import type { DeliveryFeeConfig } from '../../utils/deliveryFee';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const fieldStyle = { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.textPrimary } as const;

type ShippingForm = { storeAddress: string; storeLat: string; storeLng: string; baseKm: string; baseFee: string; perKm: string; maxKm: string; freeOver: string };
const FEE_FIELDS = [
  ['baseKm', 'Số km tính phí cơ bản', '3'], ['baseFee', 'Phí cơ bản (đ)', '15000'], ['perKm', 'Phí mỗi km vượt thêm (đ)', '5000'],
  ['maxKm', 'Giao tối đa (km)', '10'], ['freeOver', 'Miễn phí ship từ đơn (đ, để trống nếu không)', ''],
] as const;

/** Opening hours, the "pause ordering" switch and the shipping price list. Changes apply to every customer within seconds. */
export default function AdminStoreScreen() {
  const router = useRouter();
  const store = useStoreStatus();
  const [acceptingOrders, setAcceptingOrders] = useState(true);
  const [openTime, setOpenTime] = useState('00:00');
  const [closeTime, setCloseTime] = useState('00:00');
  const [closedMessage, setClosedMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [shippingOn, setShippingOn] = useState(false);
  const [shipping, setShipping] = useState<ShippingForm>({ storeAddress: '', storeLat: '', storeLng: '', baseKm: '3', baseFee: '15000', perKm: '5000', maxKm: '10', freeOver: '' });
  const [locating, setLocating] = useState(false);
  const setShippingField = (key: keyof ShippingForm) => (value: string) => setShipping(current => ({ ...current, [key]: value }));

  // Fill the form once from the live document; later edits stay the admin's own.
  useEffect(() => {
    if (loaded) return;
    setAcceptingOrders(store.settings.acceptingOrders);
    setOpenTime(store.settings.openTime);
    setCloseTime(store.settings.closeTime);
    setClosedMessage(store.settings.closedMessage ?? '');
    const fee = store.settings.delivery;
    if (fee) {
      setShippingOn(true);
      setShipping(current => ({ ...current, storeLat: String(fee.storeLat), storeLng: String(fee.storeLng), baseKm: String(fee.baseKm),
        baseFee: String(fee.baseFee), perKm: String(fee.perKm), maxKm: String(fee.maxKm), freeOver: fee.freeOver ? String(fee.freeOver) : '' }));
    }
    setLoaded(true);
  }, [store.settings, loaded]);

  const fillFromAddress = async () => {
    if (!shipping.storeAddress.trim()) { Alert.alert('Chưa có địa chỉ', 'Nhập địa chỉ cửa hàng rồi bấm lại.'); return; }
    setLocating(true);
    try {
      const point = await geocodeAddressStrict(shipping.storeAddress);
      if (!point) { Alert.alert('Không tìm thấy địa chỉ', 'Hãy nhập địa chỉ đầy đủ hơn hoặc dùng vị trí hiện tại.'); return; }
      setShipping(current => ({ ...current, storeLat: point.lat.toFixed(6), storeLng: point.lng.toFixed(6) }));
    } finally { setLocating(false); }
  };
  const fillFromHere = async () => {
    setLocating(true);
    try {
      const here = await getCurrentPhoneLocation();
      if (!here) { Alert.alert('Không lấy được vị trí', 'Hãy cho phép truy cập vị trí hoặc nhập địa chỉ cửa hàng.'); return; }
      setShipping(current => ({ ...current, storeLat: here.coords.lat.toFixed(6), storeLng: here.coords.lng.toFixed(6), storeAddress: current.storeAddress || here.address }));
    } finally { setLocating(false); }
  };

  const save = async () => {
    if (!TIME.test(openTime) || !TIME.test(closeTime)) {
      Alert.alert('Giờ chưa hợp lệ', 'Nhập giờ theo dạng HH:mm, ví dụ 08:00 hoặc 22:30.');
      return;
    }
    let delivery: DeliveryFeeConfig | undefined;
    if (shippingOn) {
      const n = (value: string) => (value.trim() === '' ? NaN : Number(value.replace(',', '.')));
      const freeOver = shipping.freeOver.trim() ? n(shipping.freeOver) : 0;
      const parsed = { storeLat: n(shipping.storeLat), storeLng: n(shipping.storeLng), baseKm: n(shipping.baseKm), baseFee: n(shipping.baseFee),
        perKm: n(shipping.perKm), maxKm: n(shipping.maxKm) };
      if (Object.values(parsed).some(value => !Number.isFinite(value)) || !Number.isFinite(freeOver) || parsed.baseKm < 0 || parsed.maxKm < Math.max(1, parsed.baseKm)) {
        Alert.alert('Bảng phí giao hàng chưa hợp lệ', 'Cần vị trí cửa hàng và các số hợp lệ; khoảng cách tối đa phải lớn hơn quãng đường phí cơ bản.');
        return;
      }
      delivery = { ...parsed, ...(freeOver > 0 ? { freeOver } : {}) };
    }
    setSaving(true);
    try {
      await updateStoreSettings({ acceptingOrders, openTime, closeTime, ...(closedMessage.trim() ? { closedMessage: closedMessage.trim() } : {}),
        ...(delivery ? { delivery } : {}) });
      Alert.alert('Đã lưu', 'Cài đặt cửa hàng đã được cập nhật cho tất cả khách hàng.');
    } catch (failure) {
      Alert.alert('Chưa lưu được', failure instanceof Error ? failure.message : 'Vui lòng thử lại.');
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title="Giờ Mở Cửa & Nhận Đơn" subtitle="Tạm ngưng nhận đơn khi bếp quá tải" showBack onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.base, gap: spacing.base }}>
        <View style={{ backgroundColor: store.open ? colors.successSoft : colors.warningSoft, borderRadius: radius.md, padding: spacing.base }}>
          <AppText variant="bodyMedium" color={store.open ? colors.success : colors.warning}>
            {store.open ? 'Hiện đang nhận đơn' : 'Hiện đang không nhận đơn'}
          </AppText>
          {!store.open && <AppText variant="caption" color={colors.textSecondary}>{store.message}</AppText>}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <AppText variant="bodyMedium">Đang nhận đơn</AppText>
            <AppText variant="caption" color={colors.textSecondary}>Tắt để tạm ngưng ngay lập tức, kể cả trong giờ mở cửa.</AppText>
          </View>
          <Switch value={acceptingOrders} onValueChange={setAcceptingOrders} accessibilityLabel="Đang nhận đơn" />
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="captionMedium">Giờ mở cửa (giờ Việt Nam)</AppText>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <TextInput value={openTime} onChangeText={setOpenTime} placeholder="08:00" accessibilityLabel="Giờ mở cửa" maxLength={5}
              style={[fieldStyle, { flex: 1 }]} />
            <TextInput value={closeTime} onChangeText={setCloseTime} placeholder="22:00" accessibilityLabel="Giờ đóng cửa" maxLength={5}
              style={[fieldStyle, { flex: 1 }]} />
          </View>
          <AppText variant="caption" color={colors.textSecondary}>Giờ đóng cửa sớm hơn giờ mở cửa nghĩa là qua nửa đêm. Hai giờ bằng nhau nghĩa là mở cả ngày.</AppText>
        </View>

        <View style={{ gap: spacing.sm }}>
          <AppText variant="captionMedium">Thông báo cho khách khi tạm ngưng (không bắt buộc)</AppText>
          <TextInput value={closedMessage} onChangeText={setClosedMessage} placeholder="Bếp đang quá tải, quay lại sau 30 phút nhé!" multiline maxLength={200}
            accessibilityLabel="Thông báo khi tạm ngưng"
            style={[fieldStyle, { minHeight: 70, textAlignVertical: 'top' }]} />
        </View>

        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <AppText variant="bodyMedium">Tính phí giao hàng theo km</AppText>
              <AppText variant="caption" color={colors.textSecondary}>Tắt thì đơn giao của cửa hàng không thu phí ship.</AppText>
            </View>
            <Switch value={shippingOn} onValueChange={setShippingOn} accessibilityLabel="Tính phí giao hàng theo km" />
          </View>
          {shippingOn && <>
            <AppText variant="captionMedium">Vị trí cửa hàng</AppText>
            <TextInput value={shipping.storeAddress} onChangeText={setShippingField('storeAddress')} placeholder="Địa chỉ cửa hàng"
              accessibilityLabel="Địa chỉ cửa hàng" style={fieldStyle} />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <AppButton title="Lấy từ địa chỉ" size="sm" variant="outline" isLoading={locating} onPress={() => { void fillFromAddress(); }} style={{ flex: 1 }} />
              <AppButton title="Dùng vị trí hiện tại" size="sm" variant="outline" isLoading={locating} onPress={() => { void fillFromHere(); }} style={{ flex: 1 }} />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <TextInput value={shipping.storeLat} onChangeText={setShippingField('storeLat')} placeholder="Vĩ độ" keyboardType="numbers-and-punctuation"
                accessibilityLabel="Vĩ độ cửa hàng" style={[fieldStyle, { flex: 1 }]} />
              <TextInput value={shipping.storeLng} onChangeText={setShippingField('storeLng')} placeholder="Kinh độ" keyboardType="numbers-and-punctuation"
                accessibilityLabel="Kinh độ cửa hàng" style={[fieldStyle, { flex: 1 }]} />
            </View>
            {FEE_FIELDS.map(([key, label, hint]) => <View key={key} style={{ gap: 4 }}>
              <AppText variant="caption" color={colors.textSecondary}>{label}</AppText>
              <TextInput value={shipping[key]} onChangeText={setShippingField(key)} placeholder={hint} keyboardType="numeric" accessibilityLabel={label} style={fieldStyle} />
            </View>)}
            <AppText variant="caption" color={colors.textSecondary}>
              Khoảng cách là ước tính đường đi từ vị trí cửa hàng tới địa chỉ khách chọn. Mỗi km bắt đầu tính thêm một lần phí.
            </AppText>
          </>}
        </View>

        <AppButton title="Lưu cài đặt" onPress={() => { void save(); }} isLoading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}
