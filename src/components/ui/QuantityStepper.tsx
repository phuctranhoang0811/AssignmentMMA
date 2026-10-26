import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from './AppText';
import { triggerHaptic } from '../../utils/haptics';

interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (newValue: number) => void;
  size?: 'sm' | 'md';
}

export const QuantityStepper: React.FC<QuantityStepperProps> = ({
  value,
  min = 1,
  max = 20,
  onChange,
  size = 'md',
}) => {
  const isMin = value <= min;
  const isMax = value >= max;

  const btnSize = size === 'sm' ? 28 : 34;
  const iconSize = size === 'sm' ? 14 : 16;

  const handleDecrement = () => {
    if (isMin) return;
    triggerHaptic('light');
    onChange(value - 1);
  };

  const handleIncrement = () => {
    if (isMax) return;
    triggerHaptic('light');
    onChange(value + 1);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.7}
        disabled={isMin}
        onPress={handleDecrement}
        style={[
          styles.button,
          { width: btnSize, height: btnSize, borderRadius: radius.sm },
          isMin && styles.disabledButton,
        ]}
      >
        <Minus
          size={iconSize}
          color={isMin ? colors.textDisabled : colors.textPrimary}
        />
      </TouchableOpacity>

      <View style={styles.textContainer}>
        <AppText variant={size === 'sm' ? 'captionMedium' : 'bodyMedium'}>
          {value}
        </AppText>
      </View>

      <TouchableOpacity
        activeOpacity={0.7}
        disabled={isMax}
        onPress={handleIncrement}
        style={[
          styles.button,
          { width: btnSize, height: btnSize, borderRadius: radius.sm },
          isMax && styles.disabledButton,
        ]}
      >
        <Plus
          size={iconSize}
          color={isMax ? colors.textDisabled : colors.textPrimary}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: 'transparent',
  },
  textContainer: {
    paddingHorizontal: spacing.md,
    minWidth: 32,
    alignItems: 'center',
  },
});
