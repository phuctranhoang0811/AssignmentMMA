import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';
import { ProductVariant } from '../../types/product';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from '../ui/AppText';
import { formatCurrency } from '../../utils/formatCurrency';

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedId?: string;
  onSelect: (variant: ProductVariant) => void;
}

export const VariantSelector: React.FC<VariantSelectorProps> = ({
  variants,
  selectedId,
  onSelect,
}) => {
  if (!variants || variants.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <AppText variant="h3">Chọn kích cỡ</AppText>
        <View style={styles.requiredBadge}>
          <AppText variant="captionMedium" color={colors.primary}>
            Bắt buộc
          </AppText>
        </View>
      </View>

      <View style={styles.optionsList}>
        {variants.map((variant) => {
          const isSelected = variant.id === selectedId;
          return (
            <TouchableOpacity
              key={variant.id}
              activeOpacity={0.8}
              onPress={() => onSelect(variant)}
              style={[
                styles.optionCard,
                isSelected && styles.selectedOptionCard,
              ]}
            >
              <View style={styles.leftRow}>
                <View
                  style={[
                    styles.radioCircle,
                    isSelected && styles.selectedRadioCircle,
                  ]}
                >
                  {isSelected && <Check size={12} color={colors.white} />}
                </View>
                <AppText
                  variant="bodyMedium"
                  color={isSelected ? colors.primary : colors.textPrimary}
                >
                  {variant.name}
                </AppText>
              </View>

              <AppText
                variant="bodyMedium"
                color={isSelected ? colors.primary : colors.textPrimary}
              >
                {formatCurrency(variant.price)}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  requiredBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  optionsList: {
    gap: spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.base,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  selectedOptionCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  selectedRadioCircle: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
});
