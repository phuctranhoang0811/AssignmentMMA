import React from 'react';
import { View, StyleSheet, TextStyle } from 'react-native';
import { formatCurrency } from '../../utils/formatCurrency';
import { AppText } from './AppText';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface PriceTextProps {
  amount: number;
  originalAmount?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  style?: TextStyle;
}

export const PriceText: React.FC<PriceTextProps> = ({
  amount,
  originalAmount,
  size = 'md',
  color = colors.primary,
  style,
}) => {
  const getVariant = () => {
    switch (size) {
      case 'sm':
        return 'bodyMedium';
      case 'lg':
        return 'priceLarge';
      case 'md':
      default:
        return 'price';
    }
  };

  return (
    <View style={styles.container}>
      <AppText variant={getVariant()} color={color} style={style}>
        {formatCurrency(amount)}
      </AppText>
      {originalAmount && originalAmount > amount ? (
        <AppText
          variant="caption"
          color={colors.textDisabled}
          style={styles.originalPrice}
        >
          {formatCurrency(originalAmount)}
        </AppText>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  originalPrice: {
    textDecorationLine: 'line-through',
    marginLeft: spacing.xs,
  },
});
