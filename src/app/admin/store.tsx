import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Store as StoreIcon,
  Plus,
  MapPin,
  Clock,
  Edit3,
  Trash2,
  X,
  XCircle,
  Truck,
  ChevronRight,
} from 'lucide-react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Alert } from '../../utils/alert';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { colors } from '../../theme/colors';
import {
  subscribeStoresConfig,
  saveSyncedStores,
  saveSyncedShipping,
  DEFAULT_STORE_BRANCHES,
  type SyncedStoreBranch,
} from '../../services/storeSync';
import {
  searchVietnamAddresses,
  AddressSuggestion,
  getCurrentPhoneLocation,
  geocodeAddress,
} from '../../services/addressService';
import { triggerHaptic } from '../../utils/haptics';

type StoreBranch = SyncedStoreBranch;

type SubScreen = 'hub' | 'branches' | 'shipping';

export default function AdminStoreScreen() {
  const [activeScreen, setActiveScreen] = useState<SubScreen>('hub');
  const [stores, setStores] = useState<StoreBranch[]>(DEFAULT_STORE_BRANCHES);
  const [loading, setLoading] = useState(false);

  // Cấu hình bảng giá Ship
  const [shippingEnabled, setShippingEnabled] = useState(true);
  const [baseKm, setBaseKm] = useState('3');
  const [baseFee, setBaseFee] = useState('0');
  const [perKm, setPerKm] = useState('5000');
  const [maxKm, setMaxKm] = useState('10');
  const [freeOver, setFreeOver] = useState('300000');
  const [minDeliveryOrder, setMinDeliveryOrder] = useState('50000');
  const [savingShipping, setSavingShipping] = useState(false);

  // Modal Thêm / Sửa cửa hàng
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreBranch | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [openingInput, setOpeningInput] = useState('10:00 - 22:00');
  const [activeInput, setActiveInput] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [suppressSearch, setSuppressSearch] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Đồng bộ danh sách cửa hàng & bảng giá ship qua storeSync (AsyncStorage + Firestore)
  useEffect(() => {
    const unsub = subscribeStoresConfig((state) => {
      setStores(state.stores);
      setShippingEnabled(state.shippingEnabled);
      if (state.delivery) {
        setBaseKm(String(state.delivery.baseKm));
        setBaseFee(String(state.delivery.baseFee));
        setPerKm(String(state.delivery.perKm));
        setMaxKm(String(state.delivery.maxKm));
        setFreeOver(
          typeof state.delivery.freeOver === 'number' && state.delivery.freeOver > 0
            ? String(state.delivery.freeOver)
            : ''
        );
        setMinDeliveryOrder(
          typeof state.delivery.minDeliveryOrder === 'number' && state.delivery.minDeliveryOrder >= 0
            ? String(state.delivery.minDeliveryOrder)
            : '50000'
        );
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Tự động gợi ý địa chỉ Việt Nam giống bên User
  useEffect(() => {
    if (!modalVisible || suppressSearch) {
      setAddressSuggestions([]);
      return;
    }
    const q = addressInput.trim();
    if (q.length < 2) {
      setAddressSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await searchVietnamAddresses(q);
        setAddressSuggestions(results);
      } catch {
        setAddressSuggestions([]);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [addressInput, modalVisible, suppressSearch]);

  const handleSaveShippingConfig = async () => {
    const parseNum = (v: string) =>
      v.trim() === '' ? NaN : Number(v.replace(/\./g, '').replace(',', '.'));
    const parsedBaseKm = parseNum(baseKm);
    const parsedBaseFee = parseNum(baseFee);
    const parsedPerKm = parseNum(perKm);
    const parsedMaxKm = parseNum(maxKm);
    const parsedFreeOver = freeOver.trim() === '' ? 0 : parseNum(freeOver);
    const parsedMinDeliveryOrder =
      minDeliveryOrder.trim() === '' ? 0 : parseNum(minDeliveryOrder);

    if (
      shippingEnabled &&
      (!Number.isFinite(parsedBaseKm) ||
        parsedBaseKm < 0 ||
        !Number.isFinite(parsedBaseFee) ||
        parsedBaseFee < 0 ||
        !Number.isFinite(parsedPerKm) ||
        parsedPerKm < 0 ||
        !Number.isFinite(parsedMaxKm) ||
        parsedMaxKm <= 0 ||
        parsedMaxKm < parsedBaseKm ||
        !Number.isFinite(parsedFreeOver) ||
        parsedFreeOver < 0 ||
        !Number.isFinite(parsedMinDeliveryOrder) ||
        parsedMinDeliveryOrder < 0)
    ) {
      Alert.alert(
        'Thông số chưa hợp lệ',
        'Vui lòng nhập số hợp lệ (Bán kính tối đa phải lớn hơn hoặc bằng số km đầu).'
      );
      return;
    }

    setSavingShipping(true);
    try {
      const primaryStore = stores.find((s) => s.isActive && s.lat && s.lng) || stores[0];
      const defaultLat = primaryStore?.lat ?? 10.8291;
      const defaultLng = primaryStore?.lng ?? 106.7183;

      await saveSyncedShipping(
        shippingEnabled
          ? {
              storeLat: defaultLat,
              storeLng: defaultLng,
              baseKm: parsedBaseKm,
              baseFee: parsedBaseFee,
              perKm: parsedPerKm,
              maxKm: parsedMaxKm,
              ...(parsedFreeOver > 0 ? { freeOver: parsedFreeOver } : { freeOver: 0 }),
              minDeliveryOrder: parsedMinDeliveryOrder,
            }
          : null,
        shippingEnabled
      );
      triggerHaptic('success');
      setActiveScreen('hub');
      Alert.alert(
        'Đã lưu bảng giá ship',
        shippingEnabled
          ? `Áp dụng thành công: ${parsedBaseKm}km đầu ${
              parsedBaseFee === 0 ? 'Miễn phí (0đ)' : `${parsedBaseFee.toLocaleString('vi-VN')}đ`
            }, sau đó +${parsedPerKm.toLocaleString('vi-VN')}đ/km.`
          : 'Đã tắt tính phí giao hàng theo km.'
      );
    } catch (err) {
      Alert.alert(
        'Lỗi lưu bảng giá',
        err instanceof Error ? err.message : 'Vui lòng thử lại.'
      );
    } finally {
      setSavingShipping(false);
    }
  };

  const handleSelectSuggestion = async (item: AddressSuggestion) => {
    triggerHaptic('light');
    setSuppressSearch(true);
    setAddressInput(item.fullAddress);
    setAddressSuggestions([]);
    try {
      const point = await geocodeAddress(item.fullAddress);
      setCoords(point);
    } catch {}
  };

  const handleGetCurrentLocation = async () => {
    triggerHaptic('light');
    setIsLocating(true);
    try {
      const result = await getCurrentPhoneLocation();
      if (result && result.address) {
        setSuppressSearch(true);
        setAddressInput(result.address);
        setCoords(result.coords);
        setAddressSuggestions([]);
        triggerHaptic('success');
      } else {
        Alert.alert(
          'Quyền truy cập vị trí',
          'Vui lòng bật quyền truy cập vị trí trên thiết bị để tự động lấy địa chỉ và tọa độ cửa hàng.'
        );
      }
    } catch {
      // Bỏ qua lỗi
    } finally {
      setIsLocating(false);
    }
  };

  const openAddModal = () => {
    setEditingStore(null);
    setNameInput('');
    setSuppressSearch(false);
    setAddressInput('');
    setAddressSuggestions([]);
    setCoords(null);
    setOpeningInput('10:00 - 22:00');
    setActiveInput(true);
    setModalVisible(true);
  };

  const openEditModal = (branch: StoreBranch) => {
    setEditingStore(branch);
    setNameInput(branch.name);
    setSuppressSearch(true);
    setAddressInput(branch.address);
    setAddressSuggestions([]);
    setCoords(
      typeof branch.lat === 'number' && typeof branch.lng === 'number'
        ? { lat: branch.lat, lng: branch.lng }
        : null
    );
    setOpeningInput(branch.openingTime);
    setActiveInput(branch.isActive);
    setModalVisible(true);
  };

  const handleSaveStore = async () => {
    const trimmedName = nameInput.trim();
    const trimmedAddress = addressInput.trim();
    const trimmedOpening = openingInput.trim() || '10:00 - 22:00';

    if (!trimmedName) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên cửa hàng.');
      return;
    }
    if (!trimmedAddress) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập địa chỉ cửa hàng.');
      return;
    }

    setSaving(true);
    try {
      const resolvedCoords =
        coords ||
        (await Promise.race([
          geocodeAddress(`${trimmedName}, ${trimmedAddress}`),
          new Promise<{ lat: number; lng: number }>((resolve) =>
            setTimeout(() => resolve({ lat: 10.8291, lng: 106.7183 }), 2000)
          ),
        ]));
      const nextStores: StoreBranch[] = editingStore
        ? stores.map((s) =>
            s.id === editingStore.id
              ? {
                  ...s,
                  name: trimmedName,
                  address: trimmedAddress,
                  openingTime: trimmedOpening,
                  isActive: activeInput,
                  lat: resolvedCoords.lat,
                  lng: resolvedCoords.lng,
                }
              : s
          )
        : [
            ...stores,
            {
              id: `store-${Date.now()}`,
              name: trimmedName,
              address: trimmedAddress,
              openingTime: trimmedOpening,
              isActive: activeInput,
              lat: resolvedCoords.lat,
              lng: resolvedCoords.lng,
            },
          ];
      setStores(nextStores);
      await saveSyncedStores(nextStores);
      triggerHaptic('success');
      setModalVisible(false);
    } catch (err) {
      Alert.alert(
        'Lỗi lưu cửa hàng',
        err instanceof Error ? err.message : 'Vui lòng thử lại.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (branch: StoreBranch, nextValue: boolean) => {
    try {
      const nextStores = stores.map((s) =>
        s.id === branch.id ? { ...s, isActive: nextValue } : s
      );
      setStores(nextStores);
      await saveSyncedStores(nextStores);
    } catch {
      Alert.alert('Lỗi', 'Không thể cập nhật trạng thái cửa hàng.');
    }
  };

  const handleDeleteStore = (branch: StoreBranch) => {
    if (stores.length <= 1) {
      Alert.alert('Không thể xóa', 'Hệ thống cần tối thiểu 1 cửa hàng hoạt động.');
      return;
    }
    Alert.alert(
      'Xóa cửa hàng',
      `Bạn có chắc muốn xóa "${branch.name}" khỏi danh sách hiển thị bên khách hàng?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              const nextStores = stores.filter((s) => s.id !== branch.id);
              setStores(nextStores);
              await saveSyncedStores(nextStores);
            } catch {
              Alert.alert('Lỗi', 'Không thể xóa cửa hàng này.');
            }
          },
        },
      ]
    );
  };

  const activeCount = stores.filter((s) => s.isActive).length;

  // ========================================================
  // MÀN HÌNH 1: HUB CHỌN 2 BẢNG NHỎ (CỬA HÀNG & PHÍ SHIP)
  // ========================================================
  if (activeScreen === 'hub') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader
          title="Cửa hàng & Phí Ship"
          subtitle="Chọn mục bạn muốn cấu hình"
          showBack={false}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Bảng nhỏ 1: Quản lý Cửa hàng */}
          <TouchableOpacity
            style={styles.hubCard}
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic('light');
              setActiveScreen('branches');
            }}
          >
            <View style={[styles.hubIconWrap, { backgroundColor: colors.primarySoft }]}>
              <StoreIcon size={24} color={colors.primary} />
            </View>

            <View style={{ flex: 1, paddingHorizontal: 14 }}>
              <AppText variant="cardTitle" color={colors.textPrimary}>
                Hệ thống Cửa hàng
              </AppText>
              <AppText
                variant="caption"
                color={colors.textSecondary}
                style={{ marginTop: 3 }}
              >
                Đang hiển thị {activeCount}/{stores.length} chi nhánh bên Khách hàng
              </AppText>
              <View style={styles.hubBadgeRow}>
                <AppText variant="small" color={colors.primary}>
                  Thêm, sửa địa chỉ GPS & giờ mở cửa
                </AppText>
              </View>
            </View>

            <ChevronRight size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Bảng nhỏ 2: Cài đặt Phí Ship */}
          <TouchableOpacity
            style={styles.hubCard}
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic('light');
              setActiveScreen('shipping');
            }}
          >
            <View style={[styles.hubIconWrap, { backgroundColor: colors.primarySoft }]}>
              <Truck size={24} color={colors.primary} />
            </View>

            <View style={{ flex: 1, paddingHorizontal: 14 }}>
              <AppText variant="cardTitle" color={colors.textPrimary}>
                Bảng giá Phí Ship
              </AppText>
              <AppText
                variant="caption"
                color={colors.textSecondary}
                style={{ marginTop: 3 }}
              >
                {shippingEnabled
                  ? `Dưới ${baseKm || '3'}km: ${
                      Number(baseFee) === 0
                        ? 'Miễn phí'
                        : `${Number(baseFee).toLocaleString('vi-VN')}đ`
                    } • Vượt thêm: +${Number(perKm || 5000).toLocaleString('vi-VN')}đ/km`
                  : 'Đang tắt thu phí giao hàng theo km'}
              </AppText>
              <View style={styles.hubBadgeRow}>
                <AppText variant="small" color={colors.primary}>
                  Cấu hình số km miễn phí & đơn giá mỗi km
                </AppText>
              </View>
            </View>

            <ChevronRight size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ========================================================
  // MÀN HÌNH 2: TRANG CHÍNH THỨC CÀI ĐẶT PHÍ SHIP
  // ========================================================
  if (activeScreen === 'shipping') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader
          title="Bảng giá Phí Ship"
          subtitle="Tự động tính từ chi nhánh gần khách nhất"
          showBack
          onBack={() => setActiveScreen('hub')}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.shippingCard}>
            <View style={styles.shippingHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={[styles.iconBadge, { backgroundColor: colors.primarySoft }]}>
                  <Truck size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="cardTitle" color={colors.textPrimary}>
                    Tính phí giao hàng theo km
                  </AppText>
                  <AppText variant="small" color={colors.textSecondary}>
                    Bật để tự động tính phí ship khi khách chọn Giao hàng tới
                  </AppText>
                </View>
              </View>
              <Switch
                value={shippingEnabled}
                onValueChange={setShippingEnabled}
                trackColor={{ false: '#D1D5DB', true: '#F8B4B4' }}
                thumbColor={shippingEnabled ? colors.primary : '#9CA3AF'}
              />
            </View>

            {shippingEnabled && (
              <View style={{ marginTop: 14, gap: 14 }}>
                <View style={styles.gridRow}>
                  <View style={{ flex: 1, gap: 5 }}>
                    <AppText variant="captionMedium" color={colors.textPrimary}>
                      Số km đầu (km)
                    </AppText>
                    <TextInput
                      value={baseKm}
                      onChangeText={setBaseKm}
                      placeholder="3"
                      keyboardType="numeric"
                      style={styles.input}
                    />
                  </View>

                  <View style={{ flex: 1, gap: 5 }}>
                    <AppText variant="captionMedium" color={colors.textPrimary}>
                      Phí km đầu (0 = Miễn phí)
                    </AppText>
                    <TextInput
                      value={baseFee}
                      onChangeText={setBaseFee}
                      placeholder="0"
                      keyboardType="numeric"
                      style={styles.input}
                    />
                  </View>
                </View>

                <View style={styles.gridRow}>
                  <View style={{ flex: 1, gap: 5 }}>
                    <AppText variant="captionMedium" color={colors.textPrimary}>
                      Phí mỗi km vượt thêm (đ)
                    </AppText>
                    <TextInput
                      value={perKm}
                      onChangeText={setPerKm}
                      placeholder="5000"
                      keyboardType="numeric"
                      style={styles.input}
                    />
                  </View>

                  <View style={{ flex: 1, gap: 5 }}>
                    <AppText variant="captionMedium" color={colors.textPrimary}>
                      Bán kính giao tối đa (km)
                    </AppText>
                    <TextInput
                      value={maxKm}
                      onChangeText={setMaxKm}
                      placeholder="10"
                      keyboardType="numeric"
                      style={styles.input}
                    />
                  </View>
                </View>

                <View style={{ gap: 5 }}>
                  <AppText variant="captionMedium" color={colors.textPrimary}>
                    Đơn tối thiểu giao hàng / Shipper (đ, Nhận tại cửa hàng không giới hạn)
                  </AppText>
                  <TextInput
                    value={minDeliveryOrder}
                    onChangeText={setMinDeliveryOrder}
                    placeholder="50000"
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>

                <View style={{ gap: 5 }}>
                  <AppText variant="captionMedium" color={colors.textPrimary}>
                    Miễn phí ship cho đơn từ (đ, để trống nếu không áp dụng)
                  </AppText>
                  <TextInput
                    value={freeOver}
                    onChangeText={setFreeOver}
                    placeholder="300000"
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>

                <View style={styles.previewBox}>
                  <AppText variant="small" color={colors.textSecondary}>
                    • Đơn tối thiểu giao tận nơi (Shipper):{' '}
                    <AppText variant="captionSemiBold" color={colors.primary}>
                      {Number(minDeliveryOrder) > 0
                        ? `${Number(minDeliveryOrder).toLocaleString('vi-VN')}đ`
                        : 'Không giới hạn'}
                    </AppText>{' '}
                    (Nhận tại cửa hàng: Không giới hạn)
                    {'\n'}• Từ 0 – {baseKm || '3'} km:{' '}
                    <AppText variant="captionSemiBold" color={colors.primary}>
                      {Number(baseFee) === 0
                        ? 'Miễn phí (0đ)'
                        : `${Number(baseFee || 0).toLocaleString('vi-VN')}đ`}
                    </AppText>
                    {'\n'}• Trên {baseKm || '3'} km:{' '}
                    <AppText variant="captionSemiBold" color={colors.primary}>
                      +{Number(perKm || 0).toLocaleString('vi-VN')}đ / km
                    </AppText>
                    {Number(freeOver) > 0
                      ? `\n• Đơn từ ${Number(freeOver).toLocaleString('vi-VN')}đ: Miễn phí ship`
                      : ''}
                  </AppText>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveShippingBtn, savingShipping && { opacity: 0.65 }]}
              activeOpacity={0.85}
              onPress={handleSaveShippingConfig}
              disabled={savingShipping}
            >
              <AppText variant="captionSemiBold" color="#FFFFFF">
                {savingShipping ? 'Đang lưu bảng giá...' : 'Lưu bảng giá ship'}
              </AppText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ========================================================
  // MÀN HÌNH 3: TRANG CHÍNH THỨC QUẢN LÝ CHI NHÁNH CỬA HÀNG
  // ========================================================
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        title="Hệ thống Cửa hàng"
        subtitle={`Đang hiển thị ${activeCount}/${stores.length} chi nhánh bên Khách hàng`}
        showBack
        onBack={() => setActiveScreen('hub')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <AppText variant="bodyMedium" color={colors.textPrimary}>
              Danh sách chi nhánh ({stores.length})
            </AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              Thêm hoặc chỉnh sửa chi nhánh để hiển thị ngay ở mục Mua mang về của User.
            </AppText>
          </View>

          <TouchableOpacity
            style={styles.addBtn}
            activeOpacity={0.85}
            onPress={openAddModal}
          >
            <Plus size={18} color="#FFFFFF" />
            <AppText variant="captionSemiBold" color="#FFFFFF">
              Thêm chi nhánh
            </AppText>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          stores.map((branch) => (
            <View
              key={branch.id}
              style={[
                styles.storeCard,
                !branch.isActive && styles.storeCardInactive,
              ]}
            >
              <View style={styles.storeCardHeader}>
                <View style={styles.storeTitleRow}>
                  <View
                    style={[
                      styles.iconBadge,
                      {
                        backgroundColor: branch.isActive
                          ? colors.primarySoft
                          : colors.surfaceAlt,
                      },
                    ]}
                  >
                    <StoreIcon
                      size={18}
                      color={branch.isActive ? colors.primary : colors.textSecondary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="cardTitle" color={colors.textPrimary}>
                      {branch.name}
                    </AppText>
                    <AppText
                      variant="small"
                      color={branch.isActive ? colors.primary : colors.textSecondary}
                    >
                      {branch.isActive ? '● Đang hiển thị bên User' : '○ Đang ẩn'}
                    </AppText>
                  </View>
                </View>

                <Switch
                  value={branch.isActive}
                  onValueChange={(val) => handleToggleActive(branch, val)}
                  trackColor={{ false: '#D1D5DB', true: '#F8B4B4' }}
                  thumbColor={branch.isActive ? colors.primary : '#9CA3AF'}
                />
              </View>

              <View style={styles.infoRow}>
                <MapPin size={15} color={colors.textSecondary} style={{ marginTop: 2 }} />
                <AppText
                  variant="caption"
                  color={colors.textPrimary}
                  style={{ flex: 1, lineHeight: 19 }}
                >
                  {branch.address}
                </AppText>
              </View>

              <View style={styles.infoRow}>
                <Clock size={15} color={colors.textSecondary} />
                <AppText variant="caption" color={colors.textSecondary}>
                  Opening time: {branch.openingTime}
                </AppText>
              </View>

              <View style={styles.cardFooter}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  activeOpacity={0.75}
                  onPress={() => openEditModal(branch)}
                >
                  <Edit3 size={15} color={colors.primary} />
                  <AppText variant="captionSemiBold" color={colors.primary}>
                    Chỉnh sửa
                  </AppText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn]}
                  activeOpacity={0.75}
                  onPress={() => handleDeleteStore(branch)}
                >
                  <Trash2 size={15} color={colors.error} />
                  <AppText variant="captionSemiBold" color={colors.error}>
                    Xóa
                  </AppText>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal Thêm / Chỉnh sửa Cửa hàng (có gợi ý địa chỉ & GPS giống bên User) */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView
            style={{ width: '100%', maxWidth: 460, maxHeight: '90%' }}
            contentContainerStyle={styles.modalCard}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalHeader}>
              <AppText variant="h3" color={colors.textPrimary}>
                {editingStore ? 'Chỉnh sửa cửa hàng' : 'Thêm cửa hàng mới'}
              </AppText>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGroup}>
              <AppText variant="captionMedium" color={colors.textPrimary}>
                Tên cửa hàng
              </AppText>
              <TextInput
                value={nameInput}
                onChangeText={(txt) => {
                  setNameInput(txt);
                  setCoords(null);
                }}
                placeholder="VD: Pizza FPT Cầu Giấy (Signature)"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
              />
            </View>

            <View style={styles.fieldGroup}>
              <AppText variant="captionMedium" color={colors.textPrimary}>
                Địa chỉ chi tiết (gõ để gợi ý hoặc bấm định vị GPS)
              </AppText>

              <View style={styles.addressSearchBox}>
                <TouchableOpacity
                  style={styles.crosshairBadge}
                  activeOpacity={0.8}
                  onPress={handleGetCurrentLocation}
                  disabled={isLocating}
                  accessibilityRole="button"
                  accessibilityLabel="Lấy vị trí hiện tại"
                >
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Circle cx="12" cy="12" r="7" stroke="#FFFFFF" strokeWidth={2} />
                    <Circle cx="12" cy="12" r="2.5" fill="#FFFFFF" />
                    <Path
                      d="M12 2 L12 5 M12 19 L12 22 M2 12 L5 12 M19 12 L22 12"
                      stroke="#FFFFFF"
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  </Svg>
                </TouchableOpacity>

                <TextInput
                  style={styles.addressSearchInput}
                  value={addressInput}
                  onChangeText={(txt) => {
                    setSuppressSearch(false);
                    setAddressInput(txt);
                    setCoords(null);
                  }}
                  placeholder="Nhập địa chỉ cửa hàng..."
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="search"
                  autoCorrect={false}
                />

                {addressInput.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setSuppressSearch(false);
                      setAddressInput('');
                      setCoords(null);
                      setAddressSuggestions([]);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.clearInputBtn}
                  >
                    <XCircle size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>

              {addressSuggestions.length > 0 && (
                <View style={styles.suggestionsCard}>
                  {addressSuggestions.map((item, index) => (
                    <TouchableOpacity
                      key={item.id || index}
                      style={[
                        styles.suggestionRowItem,
                        index === addressSuggestions.length - 1 && { borderBottomWidth: 0 },
                      ]}
                      activeOpacity={0.65}
                      onPress={() => handleSelectSuggestion(item)}
                    >
                      <View style={styles.suggestionPinBox}>
                        <MapPin size={20} color="#1E2024" strokeWidth={1.8} />
                      </View>
                      <View style={styles.suggestionTextCol}>
                        <AppText
                          variant="bodyMedium"
                          color="#111827"
                          numberOfLines={1}
                        >
                          {item.title}
                        </AppText>
                        <AppText
                          variant="small"
                          color="#6B7280"
                          numberOfLines={1}
                        >
                          {item.subtitle}
                        </AppText>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {coords && (
                <AppText variant="small" color={colors.success}>
                  ✓ Đã lưu tọa độ GPS ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}) phục vụ tính phí shipper
                </AppText>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <AppText variant="captionMedium" color={colors.textPrimary}>
                Giờ mở cửa
              </AppText>
              <TextInput
                value={openingInput}
                onChangeText={setOpeningInput}
                placeholder="VD: 10:00 - 22:00"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <AppText variant="bodyMedium" color={colors.textPrimary}>
                  Hiển thị bên khách hàng
                </AppText>
                <AppText variant="small" color={colors.textSecondary}>
                  Khách có thể chọn chi nhánh này khi Mua mang về
                </AppText>
              </View>
              <Switch
                value={activeInput}
                onValueChange={setActiveInput}
                trackColor={{ false: '#D1D5DB', true: '#F8B4B4' }}
                thumbColor={activeInput ? colors.primary : '#9CA3AF'}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setModalVisible(false)}
              >
                <AppText variant="bodyMedium" color={colors.textSecondary}>
                  Hủy
                </AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveModalBtn, saving && { opacity: 0.6 }]}
                onPress={handleSaveStore}
                disabled={saving}
              >
                <AppText variant="bodyMedium" color="#FFFFFF">
                  {saving ? 'Đang lưu...' : 'Lưu cửa hàng'}
                </AppText>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  hubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hubIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubBadgeRow: {
    marginTop: 6,
  },
  shippingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shippingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  previewBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveShippingBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  storeCardInactive: {
    opacity: 0.65,
    backgroundColor: '#F9FAFB',
  },
  storeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  storeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
  },
  deleteBtn: {
    backgroundColor: '#FEF2F2',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  fieldGroup: {
    marginBottom: 14,
    gap: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14.5,
    color: colors.textPrimary,
    backgroundColor: '#FFFFFF',
  },
  addressSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 3,
  },
  crosshairBadge: {
    width: 42,
    height: 42,
    borderRadius: 6,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressSearchInput: {
    flex: 1,
    fontSize: 14.5,
    color: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  clearInputBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  suggestionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  suggestionRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  suggestionPinBox: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  suggestionTextCol: {
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelModalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveModalBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
});
