import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors } from '../../theme/colors';

type Props = {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeTone?: 'neutral' | 'accent';
  onPress: () => void;
};

export function CheckoutRow({ icon, title, subtitle, badge, badgeTone = 'neutral', onPress }: Props) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.65} accessibilityRole="button">
      <View style={styles.icon} accessible={false}>{icon}</View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {!!badge && <Text style={[styles.badge, badgeTone === 'accent' && styles.accentBadge]}>{badge}</Text>}
      <ChevronRight size={17} color="#9CA3AF" accessible={false} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingVertical: 12, gap: 12 },
  icon: { width: 24, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 15, fontWeight: '600', color: '#20242A', lineHeight: 21 },
  subtitle: { fontSize: 14, color: '#626B77', lineHeight: 20 },
  badge: { flexShrink: 1, fontSize: 13, fontWeight: '600', color: '#626B77',
    backgroundColor: '#F2F4F6', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7 },
  accentBadge: { color: colors.primary, backgroundColor: '#FFF4EF' },
});
