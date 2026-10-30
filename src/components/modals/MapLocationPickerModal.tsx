import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '../../utils/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, User } from 'lucide-react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { triggerHaptic } from '../../utils/haptics';
import {
  getAddressFromCoordinates,
  geocodeAddress,
  reverseGeocodeLocation,
  getCurrentPhoneLocation,
} from '../../services/addressService';

// Sử dụng WebView cho mobile (iOS / Android)
let WebViewComponent: any = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Load native WebView only on mobile; web uses the fallback below.
    WebViewComponent = require('react-native-webview').WebView;
  } catch {
    WebViewComponent = null;
  }
}

const BRAND_RED = '#CF4226';

/* Target Crosshair Icon for Floating Location Button */
const RedCrosshairIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="7" stroke={BRAND_RED} strokeWidth={2} />
    <Circle cx="12" cy="12" r="2.5" fill={BRAND_RED} />
    <Path
      d="M12 2 L12 5 M12 19 L12 22 M2 12 L5 12 M19 12 L22 12"
      stroke={BRAND_RED}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

// HTML cố định bên ngoài component để WebView KHÔNG BỊ reload lại liên tục
const MAP_HTML = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #e5e3df; }
      .leaflet-control-attribution, .leaflet-control-zoom { display: none !important; }
      .leaflet-tile { will-change: transform; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      var map = L.map('map', {
        center: [10.8428, 106.7285], // Mặc định tại Đường 48, TP. Thủ Đức, TP.HCM
        zoom: 18,
        maxZoom: 20,
        zoomControl: false,
        attributionControl: false,
        fadeAnimation: false
      });

      // Lớp bản đồ Google Maps hiện đại sắc nét với tiếng Việt đầy đủ
      L.tileLayer('https://mt1.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        keepBuffer: 16
      }).addTo(map);

      window.map = map;

      var isUserInteracting = false;
      var mapContainer = map.getContainer();
      mapContainer.addEventListener('touchstart', function() {
        isUserInteracting = true;
      }, { passive: true });
      mapContainer.addEventListener('mousedown', function() {
        isUserInteracting = true;
      }, { passive: true });

      var debounceTimer = null;
      function onMoveEnded() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
          if (isUserInteracting) {
            var center = map.getCenter();
            var message = JSON.stringify({
              type: 'location_changed',
              lat: Number(center.lat.toFixed(5)),
              lng: Number(center.lng.toFixed(5))
            });
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(message);
            }
          }
        }, 150);
      }

      map.on('moveend', onMoveEnded);
    </script>
  </body>
  </html>
`;

// Constant source reference để ngăn webview re-render
const MAP_SOURCE = { html: MAP_HTML };

// Component WebView được memoize để không bao giờ bị load lại khi state địa chỉ thay đổi
const LeafletMap = React.memo(function LeafletMap({
  webViewRef,
  onMessage,
}: {
  webViewRef: React.RefObject<any>;
  onMessage: (event: any) => void;
}) {
  if (!WebViewComponent) {
    return (
      <View style={styles.webFallbackMap}>
        <Text style={{ color: '#4B5563', fontSize: 14 }}>
          Bản đồ vị trí tương tác
        </Text>
      </View>
    );
  }

  return (
    <WebViewComponent
      ref={webViewRef}
      source={MAP_SOURCE}
      style={styles.webView}
      onMessage={onMessage}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
      startInLoadingState={false}
      scrollEnabled={false}
      bounces={false}
    />
  );
});

interface MapLocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirmLocation: (address: string) => void;
  initialAddress?: string;
}

export function MapLocationPickerModal({
  visible,
  onClose,
  onConfirmLocation,
  initialAddress,
}: MapLocationPickerModalProps) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 24));
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 12);

  const webViewRef = useRef<any>(null);
  const [selectedAddress, setSelectedAddress] = useState(
    initialAddress || '29 Đường 48, Khu phố 6, P. Hiệp Bình Chánh, TP. Thủ Đức, TP. Hồ Chí Minh'
  );
  const [isLocating, setIsLocating] = useState(false);
  const initialAddressRef = useRef(initialAddress);

  useEffect(() => {
    initialAddressRef.current = initialAddress;
  }, [initialAddress]);

  useEffect(() => {
    if (visible) {
      const addr =
        (initialAddress && initialAddress.trim()) ||
        '29 Đường 48, Khu phố 6, P. Hiệp Bình Chánh, TP. Thủ Đức, TP. Hồ Chí Minh';
      setSelectedAddress(addr);

      // Phân giải tọa độ GPS thực tế của bất kỳ địa chỉ nào người dùng nhập
      geocodeAddress(addr).then((targetCoords) => {
        setTimeout(() => {
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`
              if (window.map) {
                window.map.setView([${targetCoords.lat}, ${targetCoords.lng}], 18, { animate: false });
              }
              true;
            `);
          }
        }, 300);
      });
    }
  }, [visible, initialAddress]);

  const handleMessage = useCallback(async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'location_changed') {
        const { lat, lng } = data;
        // 1. Phản hồi nhanh lập tức để UI mượt mà
        const immediateAddr = getAddressFromCoordinates(lat, lng, initialAddressRef.current);
        setSelectedAddress(immediateAddr);

        // 2. Tra cứu địa chỉ thực tế chính xác qua Geocoder của thiết bị (Apple Maps / Google)
        const preciseAddr = await reverseGeocodeLocation(lat, lng, immediateAddr);
        if (preciseAddr) {
          setSelectedAddress(preciseAddr);
        }
      }
    } catch {
      // Bỏ qua lỗi
    }
  }, []);

  const handleCenterUserLocation = async () => {
    triggerHaptic('light');
    setIsLocating(true);
    try {
      const result = await getCurrentPhoneLocation();
      if (result) {
        const { coords, address } = result;
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            if (window.map) {
              window.map.setView([${coords.lat}, ${coords.lng}], 18, { animate: true });
            }
            true;
          `);
        }
        setSelectedAddress(address);
        triggerHaptic('success');
      } else {
        Alert.alert(
          'Quyền truy cập vị trí',
          'Vui lòng bật quyền truy cập vị trí trong Cài đặt của điện thoại để tự động định vị vị trí hiện tại của bạn.',
          [{ text: 'Đóng', style: 'cancel' }]
        );
      }
    } catch {
      // Bỏ qua lỗi
    } finally {
      setIsLocating(false);
    }
  };

  const handleConfirm = () => {
    triggerHaptic('success');
    onConfirmLocation(selectedAddress);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View
        style={[
          styles.modalContainer,
          {
            paddingTop: topInset,
            paddingBottom: bottomInset,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronLeft size={28} color="#111827" strokeWidth={2.4} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Địa chỉ nhận hàng</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Map Container */}
        <View style={styles.mapArea}>
          <LeafletMap webViewRef={webViewRef} onMessage={handleMessage} />

          {/* Center Pin Marker (User Teardrop Pin) */}
          <View style={styles.centerPinWrap} pointerEvents="none">
            <View style={styles.pinBubble}>
              <View style={styles.pinInnerCircle}>
                <User size={18} color="#111827" strokeWidth={2.4} />
              </View>
            </View>
            <View style={styles.pinPointer} />
            <View style={styles.pinShadow} />
          </View>

          {/* Google Watermark on bottom-left */}
          <View style={styles.googleWatermarkWrap} pointerEvents="none">
            <Text style={styles.googleWatermarkText}>Google</Text>
          </View>

          {/* Floating Target Location Button on bottom-right (GPS định vị điện thoại) */}
          <TouchableOpacity
            style={styles.floatingLocateBtn}
            activeOpacity={0.88}
            onPress={handleCenterUserLocation}
            disabled={isLocating}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color="#CF4226" />
            ) : (
              <RedCrosshairIcon />
            )}
          </TouchableOpacity>
        </View>

        {/* Bottom Card (Chọn địa điểm giao hàng của bạn) */}
        <View style={styles.bottomCard}>
          <Text style={styles.bottomCardTitle}>Chọn địa điểm giao hàng của bạn</Text>
          <Text style={styles.bottomCardSubtitle}>Kéo và thả để chọn vị trí chính xác</Text>

          <View style={styles.addressBox}>
            <Text style={styles.addressBoxText} numberOfLines={2}>
              {selectedAddress}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.confirmLocationBtn}
            activeOpacity={0.88}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmLocationBtnText}>Xác nhận vị trí</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    flex: 1,
  },
  mapArea: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#cce0e8',
  },
  webView: {
    flex: 1,
    backgroundColor: '#cce0e8',
  },
  webFallbackMap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
  },

  /* Center Pin Marker */
  centerPinWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -46,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  pinBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E2024',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  pinInnerCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinPointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#1E2024',
    marginTop: -1,
  },
  pinShadow: {
    width: 14,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    marginTop: 2,
  },

  /* Google Watermark */
  googleWatermarkWrap: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    zIndex: 5,
  },
  googleWatermarkText: {
    fontSize: 16,
    fontWeight: '800',
    color: 'rgba(55, 65, 81, 0.75)',
    letterSpacing: -0.5,
  },

  /* Floating Target Location Button */
  floatingLocateBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
    zIndex: 5,
  },

  /* Bottom Card */
  bottomCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  bottomCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  bottomCardSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  addressBox: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    marginBottom: 14,
    minHeight: 46,
    justifyContent: 'center',
  },
  addressBoxText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  confirmLocationBtn: {
    backgroundColor: BRAND_RED,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmLocationBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
