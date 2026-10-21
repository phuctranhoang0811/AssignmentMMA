import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { AppText } from './AppText';
import { AppButton } from './AppButton';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionTitle?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionTitle,
  onAction,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <AppText variant="h3" align="center" style={styles.title}>
        {title}
      </AppText>
      {description && (
        <AppText
          variant="body"
          color={colors.textSecondary}
          align="center"
          style={styles.description}
        >
          {description}
        </AppText>
      )}
      {actionTitle && onAction && (
        <View style={styles.actionWrapper}>
          <AppButton
            title={actionTitle}
            onPress={onAction}
            size="md"
            fullWidth={false}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.xl,
  },
  iconContainer: {
    marginBottom: spacing.base,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.lg,
    borderRadius: 999,
  },
  title: {
    marginBottom: spacing.xs,
  },
  description: {
    marginBottom: spacing.lg,
    maxWidth: 280,
  },
  actionWrapper: {
    minWidth: 160,
  },
});
