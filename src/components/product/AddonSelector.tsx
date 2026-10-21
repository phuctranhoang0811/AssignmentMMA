import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';
import { ProductAddon } from '../../types/product';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from '../ui/AppText';
import { formatCurrency } from '../../utils/formatCurrency';

interface AddonSelectorProps {
  addons: ProductAddon[];
  selectedIds: string[];
  onToggle: (addonId: string) => void;
}

export const AddonSelector: React.FC<AddonSelectorProps> = ({
  addons,
  selectedIds,
  onToggle,
}) => {
  if (!addons || addons.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <AppText variant="h3">Món thêm / Topping</AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          Không bắt buộc
        </AppText>
      </View>

      <View style={styles.optionsList}>
        {addons.map((addon) => {
          const isSelected = selectedIds.includes(addon.id);
          return (
            <TouchableOpacity
              key={addon.id}
              activeOpacity={0.8}
              onPress={() => onToggle(addon.id)}
              style={[
                styles.optionCard,
                isSelected && styles.selectedOptionCard,
              ]}
            >
              <View style={styles.leftRow}>
                <View
                  style={[
                    styles.checkbox,
                    isSelected && styles.selectedCheckbox,
                  ]}
                >
                  {isSelected && <Check size={12} color={colors.white} />}
                </View>
                <AppText
                  variant="body"
                  color={isSelected ? colors.primary : colors.textPrimary}
                >
                  {addon.name}
                </AppText>
              </View>

              <AppText
                variant="bodyMedium"
                color={isSelected ? colors.primary : colors.textSecondary}
              >
                +{formatCurrency(addon.price)}
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
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.xs,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  selectedCheckbox: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
});
