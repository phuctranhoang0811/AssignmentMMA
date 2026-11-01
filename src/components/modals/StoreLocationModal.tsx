import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  StatusBar,
} from 'react-native';
import { Alert } from '../../utils/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, MapPin, XCircle } from 'lucide-react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { triggerHaptic } from '../../utils/haptics';
import {
  searchVietnamAddresses,
  AddressSuggestion,
  getCurrentPhoneLocation,
} from '../../services/addressService';

const BRAND_RED = '#C8102E';

export interface MockStoreItem {
  id: string;
  name: string;
  address: string;
  openingTime: string;
}

export const MOCK_PICKUP_STORES: MockStoreItem[] = [
  {
    id: 'store-lieu-giai',
    name: 'Pizza FPT Liễu Giai (Signature)',
    address: '40 Liễu Giai, Phường Cống Vị, Quận Ba Đình, Hà Nội',
    openingTime: 'Opening time: 10:00 - 22:00',
  },
  {
    id: 'store-thu-duc',
    name: 'Pizza FPT Hiệp Bình Chánh (Signature)',
    address: '240 Phạm Văn Đồng, Phường Hiệp Bình Chánh, TP. Thủ Đức, TP. Hồ Chí Minh',
    openingTime: 'Opening time: 10:00 - 22:00',
  },
];

interface StoreLocationModalProps {
  visible: boolean;
  onClose: () => void;
  currentAddress: string;
  onConfirmAddress: (address: string, fulfillmentType: 'delivery' | 'takeaway') => void;
  initialFulfillment?: 'delivery' | 'takeaway';
  redirectToMenuOnConfirm?: boolean;
}

export function StoreLocationModal({
  visible,
  onClose,
  currentAddress,
  onConfirmAddress,
  initialFulfillment = 'delivery',
  redirectToMenuOnConfirm = true,
}: StoreLocationModalProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 24));
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 12);

  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'takeaway'>(initialFulfillment);
  const [manualAddressInput, setManualAddressInput] = useState(currentAddress);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>(MOCK_PICKUP_STORES[0].id);

  useEffect(() => {
    if (visible) {
      setFulfillmentType(initialFulfillment);
      setAddressSuggestions([]);
      const matchedStore = MOCK_PICKUP_STORES.find(
        (s) => currentAddress?.includes(s.name) || currentAddress?.includes(s.address)
      );
      if (matchedStore) {
        setSelectedStoreId(matchedStore.id);
        if (initialFulfillment === 'delivery') {
          setManualAddressInput('');
        }
      } else {
        setManualAddressInput(currentAddress || '');
      }
    }
  }, [visible, currentAddress, initialFulfillment]);

  // Debounced search for Vietnamese address autocomplete
  useEffect(() => {
    if (!visible || fulfillmentType !== 'delivery') {
      setAddressSuggestions([]);
      return;
    }
    const query = manualAddressInput.trim();
    if (query.length < 2) {
      setAddressSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await searchVietnamAddresses(query);
        setAddressSuggestions(results);
      } catch {
        setAddressSuggestions([]);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [manualAddressInput, visible, fulfillmentType]);

  const handleSelectSuggestion = (item: AddressSuggestion) => {
    triggerHaptic('light');
    setManualAddressInput(item.fullAddress);
    setAddressSuggestions([]);
  };

  const handleGetCurrentLocation = async () => {
    triggerHaptic('light');
    setIsLocating(true);
    try {
      const result = await getCurrentPhoneLocation();
      if (result && result.address) {
        setManualAddressInput(result.address);
        setAddressSuggestions([]);
        triggerHaptic('success');
      } else {
        Alert.alert(
          'Quyền truy cập vị trí',
          'Vui lòng bật quyền truy cập vị trí trong Cài đặt của điện thoại để tự động lấy địa chỉ hiện tại của bạn.',
          [{ text: 'Đóng', style: 'cancel' }]
        );
      }
    } catch {
      // Bỏ qua lỗi
    } finally {
      setIsLocating(false);
    }
  };

  const selectedStore =
    MOCK_PICKUP_STORES.find((s) => s.id === selectedStoreId) || MOCK_PICKUP_STORES[0];

  const needsAddress =
    fulfillmentType === 'delivery' && !(manualAddressInput.trim() || currentAddress);

  const handleConfirm = () => {
    if (needsAddress) return;
    const finalAddress =
      fulfillmentType === 'takeaway'
        ? `${selectedStore.name} - ${selectedStore.address}`
        : manualAddressInput.trim() || currentAddress;
    triggerHaptic('success');
    onConfirmAddress(finalAddress, fulfillmentType);
    onClose();
    if (redirectToMenuOnConfirm) {
      router.push('/(tabs)/menu');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View
        style={[
          styles.modalFullContainer,
          {
            paddingTop: topInset,
            paddingBottom: bottomInset,
          },
        ]}
      >
        {/* Header: <  Tìm cửa hàng gần bạn nhất */}
        <View style={styles.addressModalHeader}>
          <TouchableOpacity
            style={styles.addressModalBackBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Đóng"
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronLeft size={26} color="#1F2937" strokeWidth={2.2} />
          </TouchableOpacity>
          <Text style={styles.addressModalTitle}>Tìm cửa hàng gần bạn nhất</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.modalBodyScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Subtitle */}
          <Text style={styles.introSubtitle}>
            Nhập địa chỉ của bạn để xem các ưu đãi, phiếu giảm giá và khuyến mại tại địa phương.
          </Text>

          {/* Radio Row: ( ) Giao hàng tới   (•) Mua mang về */}
          <View style={styles.radioRow} accessibilityRole="tablist">
            <TouchableOpacity
              style={styles.radioOption}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityState={{ selected: fulfillmentType === 'delivery' }}
              onPress={() => {
                triggerHaptic('light');
                setFulfillmentType('delivery');
              }}
            >
              <View
                style={[
                  styles.radioOuter,
                  fulfillmentType === 'delivery' && styles.radioOuterSelected,
                ]}
              >
                {fulfillmentType === 'delivery' && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioLabel}>Giao hàng tới</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.radioOption}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityState={{ selected: fulfillmentType === 'takeaway' }}
              onPress={() => {
                triggerHaptic('light');
                setFulfillmentType('takeaway');
              }}
            >
              <View
                style={[
                  styles.radioOuter,
                  fulfillmentType === 'takeaway' && styles.radioOuterSelected,
                ]}
              >
                {fulfillmentType === 'takeaway' && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioLabel}>Mua mang về</Text>
            </TouchableOpacity>
          </View>

          {fulfillmentType === 'takeaway' ? (
            <View style={styles.storeCardsWrap}>
              {MOCK_PICKUP_STORES.map((store) => {
                const isSelected = store.id === selectedStore.id;
                return (
                  <TouchableOpacity
                    key={store.id}
                    style={[
                      styles.storeCard,
                      isSelected && styles.storeCardSelected,
                    ]}
                    activeOpacity={0.82}
                    onPress={() => {
                      triggerHaptic('light');
                      setSelectedStoreId(store.id);
                    }}
                  >
                    <Text style={styles.storeNameText}>{store.name}</Text>
                    <Text style={styles.storeAddressText}>{store.address}</Text>
                    <Text style={styles.storeOpeningText}>{store.openingTime}</Text>
                  </TouchableOpacity>
                );
              })}

              {/* Nút Bắt đầu đặt hàng ngay dưới danh sách cửa hàng (bỏ nút Thay đổi cửa hàng) */}
              <TouchableOpacity
                style={styles.confirmAddressBtn}
                onPress={handleConfirm}
                activeOpacity={0.88}
              >
                <Text style={styles.confirmAddressBtnText}>Bắt đầu đặt hàng</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {/* Section: Vị trí của tôi */}
              <Text style={styles.myLocationSectionTitle}>Vị trí của tôi</Text>

              {/* Address Search Bar */}
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
                  value={manualAddressInput}
                  onChangeText={setManualAddressInput}
                  placeholder="Nhập địa chỉ của bạn"
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="search"
                  autoCorrect={false}
                />

                {manualAddressInput.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setManualAddressInput('');
                      setAddressSuggestions([]);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.clearInputBtn}
                  >
                    <XCircle size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Autocomplete Suggestions Dropdown */}
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
                        <MapPin size={22} color="#1E2024" strokeWidth={1.8} />
                      </View>
                      <View style={styles.suggestionTextCol}>
                        <Text style={styles.suggestionTitleText} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.suggestionSubText} numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {!manualAddressInput && addressSuggestions.length === 0 && (
                <Text style={styles.pickupNote}>
                  Gõ tên đường, tòa nhà hoặc bấm biểu tượng định vị để lấy vị trí hiện tại.
                </Text>
              )}

              <TouchableOpacity
                style={[
                  styles.confirmAddressBtn,
                  { marginTop: 20 },
                  needsAddress && { opacity: 0.5 },
                ]}
                onPress={handleConfirm}
                disabled={needsAddress}
                accessibilityState={{ disabled: needsAddress }}
                activeOpacity={0.88}
              >
                <Text style={styles.confirmAddressBtnText}>Bắt đầu đặt hàng</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalFullContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    width: '100%',
    alignSelf: 'center',
  },
  addressModalHeader: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  addressModalBackBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  addressModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    flex: 1,
  },
  modalBodyScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  introSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
    marginTop: 8,
    marginBottom: 18,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
    marginBottom: 18,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: BRAND_RED,
    borderWidth: 1.8,
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: BRAND_RED,
  },
  radioLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  storeCardsWrap: {
    marginTop: 2,
    paddingBottom: 24,
  },
  storeCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  storeCardSelected: {
    borderColor: BRAND_RED,
    borderWidth: 1.5,
    backgroundColor: '#FFFDFD',
  },
  storeNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  storeAddressText: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
    marginBottom: 6,
  },
  storeOpeningText: {
    fontSize: 14,
    color: '#64748B',
  },
  pickupNote: {
    color: '#6B7280',
    lineHeight: 20,
    marginTop: 12,
  },
  myLocationSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 6,
    marginBottom: 12,
  },
  addressSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 3,
    marginBottom: 8,
  },
  crosshairBadge: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: BRAND_RED,
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
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  suggestionPinBox: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  suggestionTextCol: {
    flex: 1,
  },
  suggestionTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
  },
  suggestionSubText: {
    fontSize: 13.5,
    color: '#6B7280',
  },
  confirmAddressBtn: {
    backgroundColor: BRAND_RED,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  confirmAddressBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '600',
  },
});
