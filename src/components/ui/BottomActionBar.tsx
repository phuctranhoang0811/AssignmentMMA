import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { AppButton } from './AppButton';
import { PriceText } from './PriceText';
import { AppText } from './AppText';

interface BottomActionBarProps {
  title: string;
  onPress: () => void;
  price?: number;
  priceLabel?: string;
  isLoading?: boolean;
  disabled?: boolean;
  leftContent?: React.ReactNode;
  style?: ViewStyle;
}

export const BottomActionBar: React.FC<BottomActionBarProps> = ({
  title,
  onPress,
  price,
  priceLabel,
  isLoading = false,
  disabled = false,
  leftContent,
  style,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, spacing.md) },
        style,
      ]}
    >
      <View style={styles.contentRow}>
        {leftContent ? (
          <View style={styles.leftArea}>{leftContent}</View>
        ) : price !== undefined ? (
          <View style={styles.priceArea}>
            {priceLabel && (
              <AppText variant="caption" color={colors.textSecondary}>
                {priceLabel}
              </AppText>
            )}
            <PriceText amount={price} size="lg" />
          </View>
        ) : null}

        <View style={styles.buttonArea}>
          <AppButton
            title={title}
            onPress={onPress}
            isLoading={isLoading}
            disabled={disabled}
            size="lg"
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftArea: {
    marginRight: spacing.base,
  },
  priceArea: {
    marginRight: spacing.base,
  },
  buttonArea: {
    flex: 1,
  },
});
