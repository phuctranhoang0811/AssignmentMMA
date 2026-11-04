import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import {
  getDeliverySlots,
  isDeliveryTimeAvailable,
  formatDeliveryTime,
} from '../../utils/deliveryTime';
import { colors } from '../../theme/colors';
import { triggerHaptic } from '../../utils/haptics';

interface DeliveryTimeModalProps {
  visible: boolean;
  onClose: () => void;
  selectedTime: string;
  onSelectTime: (time: string) => void;
}

export function DeliveryTimeModal({
  visible,
  onClose,
  selectedTime,
  onSelectTime,
}: DeliveryTimeModalProps) {
  const insets = useSafeAreaInsets();
  const [tempTime, setTempTime] = useState(selectedTime || 'asap');

  const slots = useMemo(() => (visible ? getDeliverySlots() : []), [visible]);
  const days = useMemo(
    () => [...new Map(slots.map((slot) => [slot.day, slot.dayLabel])).entries()],
    [slots]
  );
  const [selectedDay, setSelectedDay] = useState(days[0]?.[0] || '');

  useEffect(() => {
    if (visible) {
      const valid = isDeliveryTimeAvailable(selectedTime);
      setTempTime(valid ? selectedTime : 'asap');
      const matchedDay = slots.find((slot) => slot.value === selectedTime && !slot.disabled)?.day;
      setSelectedDay(matchedDay || days[0]?.[0] || '');
    }
  }, [visible, selectedTime, slots, days]);

  const handleApply = () => {
    if (!isDeliveryTimeAvailable(tempTime)) {
      setTempTime('asap');
      return;
    }
    triggerHaptic('medium');
    onSelectTime(tempTime);
    onClose();
  };

  const handleSelectSlot = (slotValue: string, disabled: boolean) => {
    if (disabled) return;
    triggerHaptic('light');
    setTempTime(slotValue);
  };

  const daySlots = slots.filter((slot) => slot.day === selectedDay);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop Touchable */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Bottom Sheet Container */}
        <View
          style={[
            styles.sheetContainer,
            { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 16) },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Thời gian nhận</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={22} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View style={styles.body}>
            <TouchableOpacity
              accessibilityRole="radio"
              accessibilityState={{ checked: tempTime === 'asap' }}
              onPress={() => setTempTime('asap')}
              style={[styles.selectorBox, tempTime === 'asap' && styles.slotItemSelected]}
            >
              <Text
                style={[
                  styles.selectorText,
                  tempTime === 'asap' && { color: colors.primary, fontWeight: '700' },
                ]}
              >
                {formatDeliveryTime('asap')}
              </Text>
            </TouchableOpacity>

            <Text style={styles.sectionLabel}>Hoặc hẹn giờ nhận (08:30 - 22:00)</Text>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              {days.map(([day, label]) => (
                <TouchableOpacity
                  key={day}
                  onPress={() => setSelectedDay(day)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: selectedDay === day }}
                  style={[
                    {
                      flex: 1,
                      paddingVertical: 10,
                      alignItems: 'center',
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                    },
                    selectedDay === day && styles.slotItemSelected,
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: selectedDay === day ? '700' : '500',
                      color: selectedDay === day ? colors.primary : '#374151',
                    }}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Time Slot Grid */}
            <ScrollView
              style={styles.slotsScroll}
              contentContainerStyle={styles.slotsGrid}
              showsVerticalScrollIndicator={false}
            >
              {daySlots.map((slot) => {
                const isSelected = tempTime === slot.value && !slot.disabled;
                return (
                  <TouchableOpacity
                    key={slot.value}
                    disabled={slot.disabled}
                    style={[
                      styles.slotItem,
                      slot.disabled && styles.slotItemDisabled,
                      isSelected && styles.slotItemSelected,
                    ]}
                    onPress={() => handleSelectSlot(slot.value, slot.disabled)}
                    activeOpacity={slot.disabled ? 1 : 0.7}
                  >
                    <Text
                      style={[
                        styles.slotText,
                        slot.disabled && styles.slotTextDisabled,
                        isSelected && styles.slotTextSelected,
                      ]}
                    >
                      {slot.time}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Action Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.applyButton}
              activeOpacity={0.85}
              onPress={handleApply}
            >
              <Text style={styles.applyButtonText}>Áp dụng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    maxHeight: '85%',
    paddingTop: 14,
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  body: {
    paddingTop: 14,
    flexShrink: 1,
  },
  sectionLabel: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  selectorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  selectorText: {
    fontSize: 14.5,
    color: '#1F2937',
    fontWeight: '500',
  },
  slotsScroll: {
    maxHeight: 185,
    flexShrink: 1,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 6,
  },
  slotItem: {
    width: '31%',
    height: 42,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  slotItemDisabled: {
    backgroundColor: '#F9FAFB',
    borderColor: '#F3F4F6',
    opacity: 0.5,
  },
  slotItemSelected: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
  },
  slotText: {
    fontSize: 14.5,
    color: '#1F2937',
    fontWeight: '500',
  },
  slotTextDisabled: {
    color: '#9CA3AF',
  },
  slotTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  footer: {
    marginTop: 10,
    paddingTop: 6,
  },
  applyButton: {
    backgroundColor: colors.primary,
    height: 46,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
