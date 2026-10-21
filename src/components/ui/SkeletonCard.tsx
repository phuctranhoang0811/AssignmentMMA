import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ViewStyle, Animated } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';

interface SkeletonProps {
  style?: ViewStyle;
}

export const SkeletonBox: React.FC<{
  width: number | string;
  height: number;
  style?: ViewStyle;
  borderRadius?: number;
}> = ({ width, height, style, borderRadius = radius.sm }) => {
  const opacityAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.85,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacityAnim]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          backgroundColor: '#E4E4DF',
          borderRadius,
          opacity: opacityAnim,
        },
        style,
      ]}
    />
  );
};

export const ProductSkeletonCard: React.FC<SkeletonProps> = ({ style }) => {
  return (
    <View style={[styles.card, style]}>
      <SkeletonBox width="100%" height={130} borderRadius={radius.card} />
      <View style={styles.cardContent}>
        <SkeletonBox width="70%" height={16} style={styles.mb} />
        <SkeletonBox width="90%" height={12} style={styles.mb} />
        <View style={styles.row}>
          <SkeletonBox width={80} height={18} />
          <SkeletonBox width={32} height={32} borderRadius={16} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.base,
  },
  cardContent: {
    paddingTop: spacing.sm,
  },
  mb: {
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
});
