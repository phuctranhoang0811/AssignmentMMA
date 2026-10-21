import React, { useRef } from 'react';
import {
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
  Animated,
} from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from './AppText';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const AppButton: React.FC<AppButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  icon,
  fullWidth = true,
  style,
  textStyle,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled || isLoading) return;
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 24,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled || isLoading) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const getContainerStyle = (): ViewStyle => {
    let bg: string = colors.primary;
    let border: string = 'transparent';

    if (variant === 'secondary') {
      bg = colors.primarySoft;
    } else if (variant === 'outline') {
      bg = 'transparent';
      border = colors.border;
    } else if (variant === 'ghost') {
      bg = 'transparent';
    } else if (variant === 'danger') {
      bg = colors.error;
    }

    let height = 50;
    let padH: number = spacing.lg;

    if (size === 'sm') {
      height = 38;
      padH = spacing.md;
    } else if (size === 'lg') {
      height = 54;
      padH = spacing.xl;
    }

    return {
      backgroundColor: disabled ? colors.surfaceAlt : bg,
      borderColor: disabled ? colors.border : border,
      borderWidth: variant === 'outline' ? 1.5 : 0,
      height,
      paddingHorizontal: padH,
      borderRadius: radius.md,
      opacity: disabled ? 0.7 : 1,
      width: fullWidth ? '100%' : 'auto',
    };
  };

  const getTextColor = (): string => {
    if (disabled) return colors.textDisabled;
    if (variant === 'primary' || variant === 'danger') return colors.white;
    if (variant === 'secondary') return colors.primary;
    return colors.textPrimary;
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }], width: fullWidth ? '100%' : 'auto' }]}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || isLoading}
        style={[styles.base, getContainerStyle(), style]}
      >
        {isLoading ? (
          <ActivityIndicator color={getTextColor()} size="small" />
        ) : (
          <View style={styles.content}>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            <AppText
              variant={size === 'sm' ? 'captionMedium' : 'button'}
              color={getTextColor()}
              style={textStyle}
            >
              {title}
            </AppText>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
});
