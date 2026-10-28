import React, { useState, useEffect } from 'react';
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
import { X, ChevronDown } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { triggerHaptic } from '../../utils/haptics';

interface DeliveryTimeModalProps {
  visible: boolean;
  onClose: () => void;
  selectedTime: string;
  onSelectTime: (time: string) => void;
}

// Danh sách các khung giờ từ 10:30 đến 21:30 cách nhau 15 phút (theo đúng hình mẫu của bạn)
const DEFAULT_TIME_SLOTS = [
  '10:30', '10:45', '11:00',
  '11:15', '11:30', '11:45',
  '12:00', '12:15', '12:30',
  '12:45', '13:00', '13:15',
  '13:30', '13:45', '14:00',
  '14:15', '14:30', '14:45',
  '15:00', '15:15', '15:30',
  '15:45', '16:00', '16:15',
  '16:30', '16:45', '17:00',
  '17:15', '17:30', '17:45',
  '18:00', '18:15', '18:30',
  '18:45', '19:00', '19:15',
  '19:30', '19:45', '20:00',
  '20:15', '20:30', '20:45',
  '21:00', '21:15', '21:30',
];

export function DeliveryTimeModal({
  visible,
  onClose,
  selectedTime,
  onSelectTime,
}: DeliveryTimeModalProps) {
  const insets = useSafeAreaInsets();
  const [tempTime, setTempTime] = useState(selectedTime || '10:30');

  useEffect(() => {
    if (visible) {
      setTempTime(selectedTime || '10:30');
    }
  }, [visible, selectedTime]);

  const handleApply = () => {
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
            <Text style={styles.sectionLabel}>Thời gian</Text>

            {/* Selector: Hẹn giờ giao */}
            <View style={styles.selectorBox}>
              <Text style={styles.selectorText}>Hẹn giờ giao</Text>
              <ChevronDown size={20} color="#4B5563" />
            </View>

            {/* Time Slot Grid */}
            <ScrollView
              style={styles.slotsScroll}
              contentContainerStyle={styles.slotsGrid}
              showsVerticalScrollIndicator={false}
            >
              {DEFAULT_TIME_SLOTS.map((slot) => {
                const isSelected = tempTime === slot;
                return (
                  <TouchableOpacity
                    key={slot}
                    style={[
                      styles.slotItem,
                      isSelected && styles.slotItemSelected,
                    ]}
                    onPress={() => handleSelectSlot(slot)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.slotText,
                        isSelected && styles.slotTextSelected,
                      ]}
                    >
                      {slot}
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
