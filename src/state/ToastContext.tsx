import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { triggerHaptic } from '../utils/haptics';

export type ToastType = 'success' | 'info' | 'error';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  actionText?: string;
  onAction?: () => void;
}

interface ToastContextType {
  showToast: (options: ToastOptions) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  hideToast: () => {},
});

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast(null);
    });
  }, [opacity, translateY]);

  const showToast = useCallback(
    ({
      message,
      type = 'success',
      duration = 2800,
      actionText,
      onAction,
    }: ToastOptions) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      setToast({ message, type, duration, actionText, onAction });

      if (type === 'success') {
        triggerHaptic('success');
      } else if (type === 'error') {
        triggerHaptic('error');
      } else {
        triggerHaptic('light');
      }

      translateY.setValue(-80);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    },
    [hideToast, opacity, translateY]
  );

  const getIcon = () => {
    switch (toast?.type) {
      case 'error':
        return <AlertCircle size={18} color="#EF4444" />;
      case 'info':
        return <Info size={18} color="#3B82F6" />;
      default:
        return <CheckCircle2 size={18} color="#10B981" />;
    }
  };

  const topOffset = Math.max(insets.top + 8, Platform.OS === 'android' ? 36 : 16);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toast && (
        <Animated.View
          style={[
            styles.toastWrapper,
            {
              top: topOffset,
              transform: [{ translateY }],
              opacity,
            },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.toastContainer}>
            <View style={styles.iconWrap}>{getIcon()}</View>
            <Text style={styles.messageText} numberOfLines={2}>
              {toast.message}
            </Text>

            {toast.actionText && toast.onAction && (
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.actionBtn}
                onPress={() => {
                  toast.onAction?.();
                  hideToast();
                }}
              >
                <Text style={styles.actionText}>{toast.actionText}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={hideToast}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={15} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 99999,
  },
  toastContainer: {
    maxWidth: 480,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2024',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  iconWrap: {
    marginRight: 10,
  },
  messageText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginLeft: 8,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    marginLeft: 8,
    padding: 2,
  },
});
