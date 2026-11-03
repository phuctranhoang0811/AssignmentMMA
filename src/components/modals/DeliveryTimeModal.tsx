import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { getDeliverySlots, isDeliveryTimeAvailable, formatDeliveryTime } from '../../utils/deliveryTime';
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

  const slots = useMemo(() => visible ? getDeliverySlots() : [], [visible]);
  const days = [...new Map(slots.map(slot => [slot.day, slot.dayLabel])).entries()];
  const [selectedDay, setSelectedDay] = useState(slots[0]?.day || '');

  useEffect(() => {
    if (visible) {
      setTempTime(isDeliveryTimeAvailable(selectedTime) ? selectedTime : 'asap');
      setSelectedDay(slots.find(slot => slot.value === selectedTime)?.day || slots[0]?.day || '');
    }
  }, [visible, selectedTime, slots]);

  const handleApply = () => {
    if (!isDeliveryTimeAvailable(tempTime)) {
      setTempTime('asap');
      return;
    }
    triggerHaptic('medium');
    onSelectTime(tempTime);
    onClose();
  };

  const handleSelectSlot = (slot: string) => {
    triggerHaptic('light');
    setTempTime(slot);
  };

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
              <Text style={styles.selectorText}>{formatDeliveryTime('asap')}</Text>
            </TouchableOpacity>
            <Text style={styles.sectionLabel}>Hoặc hẹn giờ nhận (giờ Việt Nam)</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {days.map(([day, label]) => (
                <TouchableOpacity key={day} onPress={() => setSelectedDay(day)}
                  accessibilityRole="tab" accessibilityState={{ selected: selectedDay === day }}
                  style={[{ flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }, selectedDay === day && styles.slotItemSelected]}>
                  <Text style={{ fontSize: 13, color: selectedDay === day ? colors.primary : '#374151' }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Time Slot Grid */}
            <ScrollView
              style={styles.slotsScroll}
              contentContainerStyle={styles.slotsGrid}
              showsVerticalScrollIndicator={false}
            >
              {slots.filter(slot => slot.day === selectedDay).map((slot) => {
                const isSelected = tempTime === slot.value;
                return (
                  <TouchableOpacity
                    key={slot.value}
                    style={[
                      styles.slotItem,
                      isSelected && styles.slotItemSelected,
                    ]}
                    onPress={() => handleSelectSlot(slot.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.slotText,
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

const windowHeight = Dimensions.get('window').height;

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
    maxHeight: windowHeight * 0.78,
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
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
    paddingTop: 16,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 10,
  },
  selectorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 14,
  },
  selectorText: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
  },
  slotsScroll: {
    maxHeight: 280,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  slotItem: {
    width: '31%',
    height: 46,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  slotItemSelected: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
  },
  slotText: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
  },
  slotTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  footer: {
    marginTop: 14,
    paddingTop: 8,
  },
  applyButton: {
    backgroundColor: colors.primary,
    height: 48,
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
