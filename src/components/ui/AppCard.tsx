import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, radius, shadows } from '../../theme/spacing';

interface AppCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  variant?: 'elevated' | 'outlined' | 'flat';
}

export const AppCard: React.FC<AppCardProps> = ({
  children,
  style,
  onPress,
  variant = 'outlined',
}) => {
  const getCardStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: colors.surface,
          borderRadius: radius.card,
          ...shadows.sm,
        };
      case 'flat':
        return {
          backgroundColor: colors.surfaceAlt,
          borderRadius: radius.card,
        };
      case 'outlined':
      default:
        return {
          backgroundColor: colors.surface,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.border,
        };
    }
  };

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={[styles.base, getCardStyle(), style]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.base, getCardStyle(), style]}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    padding: spacing.base,
    overflow: 'hidden',
  },
});
