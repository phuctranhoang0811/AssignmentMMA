import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, MapPin, Map, XCircle } from 'lucide-react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { triggerHaptic } from '../../utils/haptics';
import { searchVietnamAddresses, AddressSuggestion } from '../../services/addressService';

const BRAND_RED = '#CF4226';

interface StoreLocationModalProps {
  visible: boolean;
  onClose: () => void;
  currentAddress: string;
  onConfirmAddress: (address: string, fulfillmentType: 'delivery' | 'takeaway') => void;
  initialFulfillment?: 'delivery' | 'takeaway';
}

export function StoreLocationModal({
  visible,
  onClose,
  currentAddress,
  onConfirmAddress,
  initialFulfillment = 'delivery',
}: StoreLocationModalProps) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 24));
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 12);

  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'takeaway'>(initialFulfillment);
  const [manualAddressInput, setManualAddressInput] = useState(currentAddress);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (visible) {
      setManualAddressInput(currentAddress || '');
      setFulfillmentType(initialFulfillment);
      setAddressSuggestions([]);
    }
  }, [visible, currentAddress, initialFulfillment]);

  // Debounced search for Vietnamese address autocomplete
  useEffect(() => {
    if (!visible) {
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
        setIsSearching(true);
        const results = await searchVietnamAddresses(query);
        setAddressSuggestions(results);
      } catch {
        setAddressSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [manualAddressInput, visible]);

  const handleSelectSuggestion = (item: AddressSuggestion) => {
    triggerHaptic('light');
    setManualAddressInput(item.fullAddress);
    setAddressSuggestions([]);
  };

  const handleChooseFromMap = () => {
    triggerHaptic('light');
    Alert.alert(
      'Chọn từ bản đồ',
      'Đã định vị thành công vị trí hiện tại của bạn tại TP. Hồ Chí Minh.',
      [
        {
          text: 'Xác nhận vị trí này',
          onPress: () => {
            setManualAddressInput(
              '29 Đường 48, Khu phố 6, P. Hiệp Bình Chánh, TP. Thủ Đức, TP. Hồ Chí Minh'
            );
            setAddressSuggestions([]);
          },
        },
        { text: 'Đóng', style: 'cancel' },
      ]
    );
  };

  const handleConfirm = () => {
    const finalAddress = manualAddressInput.trim() || currentAddress;
    triggerHaptic('success');
    onConfirmAddress(finalAddress, fulfillmentType);
    onClose();
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
        {/* Header */}
        <View style={styles.addressModalHeader}>
          <TouchableOpacity
            style={styles.addressModalBackBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronLeft size={28} color="#111827" strokeWidth={2.4} />
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
          <Text style={styles.addressModalSubtitle}>
            Nhập địa chỉ của bạn để xem các ưu đãi, phiếu giảm giá và khuyến mại tại địa phương.
          </Text>

          {/* Fulfillment Mode Radio */}
          <View style={styles.fulfillmentRadioGroup}>
            <TouchableOpacity
              style={styles.fulfillmentRadioItem}
              onPress={() => setFulfillmentType('delivery')}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.radioCircle,
                  fulfillmentType === 'delivery' && styles.radioCircleActive,
                ]}
              >
                {fulfillmentType === 'delivery' && <View style={styles.radioDot} />}
              </View>
              <Text style={styles.fulfillmentText}>Giao hàng tới</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fulfillmentRadioItem}
              onPress={() => setFulfillmentType('takeaway')}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.radioCircle,
                  fulfillmentType === 'takeaway' && styles.radioCircleActive,
                ]}
              >
                {fulfillmentType === 'takeaway' && <View style={styles.radioDot} />}
              </View>
              <Text style={styles.fulfillmentText}>Mua mang về</Text>
            </TouchableOpacity>
          </View>

          {/* Section: Vị trí của tôi */}
          <Text style={styles.myLocationSectionTitle}>Vị trí của tôi</Text>

          {/* Address Search Bar */}
          <View style={styles.addressSearchBox}>
            <View style={styles.crosshairBadge}>
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
            </View>

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

          {/* Action: Chọn từ bản đồ */}
          <TouchableOpacity
            style={styles.chooseFromMapBtn}
            activeOpacity={0.7}
            onPress={handleChooseFromMap}
          >
            <Map size={22} color={BRAND_RED} strokeWidth={2} />
            <Text style={styles.chooseFromMapText}>Chọn từ bản đồ</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Confirm Button */}
        <View style={styles.modalBottomBar}>
          <TouchableOpacity
            style={styles.confirmAddressBtn}
            onPress={handleConfirm}
            activeOpacity={0.88}
          >
            <Text style={styles.confirmAddressBtnText}>Bắt đầu đặt hàng</Text>
          </TouchableOpacity>
        </View>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  addressModalBackBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  addressModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    flex: 1,
  },
  modalBodyScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  addressModalSubtitle: {
    fontSize: 13.5,
    color: '#4B5563',
    lineHeight: 20,
    marginTop: 14,
    marginBottom: 16,
  },
  fulfillmentRadioGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  fulfillmentRadioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 28,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  radioCircleActive: {
    borderColor: BRAND_RED,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BRAND_RED,
  },
  fulfillmentText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  myLocationSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
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
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  suggestionRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  suggestionPinBox: {
    marginRight: 12,
  },
  suggestionTextCol: {
    flex: 1,
  },
  suggestionTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  suggestionSubText: {
    fontSize: 12.5,
    color: '#6B7280',
  },
  chooseFromMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 6,
    marginBottom: 20,
  },
  chooseFromMapText: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND_RED,
    marginLeft: 8,
  },
  modalBottomBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  confirmAddressBtn: {
    backgroundColor: BRAND_RED,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmAddressBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
