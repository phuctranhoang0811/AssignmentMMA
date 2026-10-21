import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MapPin, Plus, Trash2, CheckCircle2, Home, Briefcase } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { spacing, radius } from '../../theme/spacing';
import { AppText } from '../../components/ui/AppText';
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { UserAddress } from '../../types/user';
import { defaultAddresses } from '../../data/mockUsers';

const ADDRESSES_STORAGE_KEY = '@pizza_time_addresses_v1';

export default function AddressesScreen() {
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLabel, setNewLabel] = useState('Nhà riêng');
  const [newRecipient, setNewRecipient] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(ADDRESSES_STORAGE_KEY);
        if (stored) {
          setAddresses(JSON.parse(stored));
        } else {
          setAddresses(defaultAddresses);
          await AsyncStorage.setItem(ADDRESSES_STORAGE_KEY, JSON.stringify(defaultAddresses));
        }
      } catch {
        setAddresses(defaultAddresses);
      }
    })();
  }, []);

  const saveToStorage = async (list: UserAddress[]) => {
    setAddresses(list);
    await AsyncStorage.setItem(ADDRESSES_STORAGE_KEY, JSON.stringify(list));
  };

  const handleSetDefault = (id: string) => {
    const updated = addresses.map((a) => ({
      ...a,
      isDefault: a.id === id,
    }));
    saveToStorage(updated);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Xóa địa chỉ', 'Bạn có chắc chắn muốn xóa địa chỉ này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          const updated = addresses.filter((a) => a.id !== id);
          saveToStorage(updated);
        },
      },
    ]);
  };

  const handleAddNew = () => {
    if (!newRecipient || !newPhone || !newAddress) {
      Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ các thông tin địa chỉ.');
      return;
    }

    const item: UserAddress = {
      id: `ADDR-${Date.now().toString().slice(-4)}`,
      label: newLabel,
      recipientName: newRecipient,
      phone: newPhone,
      address: newAddress,
      isDefault: addresses.length === 0,
    };

    saveToStorage([item, ...addresses]);
    setShowAddModal(false);
    setNewAddress('');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        title="Sổ địa chỉ"
        showBack
        rightAction={
          <TouchableOpacity
            onPress={() => setShowAddModal(!showAddModal)}
            style={styles.addIconBtn}
          >
            <Plus size={20} color={colors.primary} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {showAddModal && (
          <View style={styles.addBox}>
            <AppText variant="h3" style={{ marginBottom: spacing.md }}>
              Thêm địa chỉ mới
            </AppText>
            <AppInput
              label="Tên người nhận *"
              placeholder="Nguyễn Văn A"
              value={newRecipient}
              onChangeText={setNewRecipient}
            />
            <AppInput
              label="Số điện thoại *"
              placeholder="0901234567"
              keyboardType="phone-pad"
              value={newPhone}
              onChangeText={setNewPhone}
            />
            <AppInput
              label="Địa chỉ chi tiết *"
              placeholder="Số nhà, đường, phường, quận..."
              value={newAddress}
              onChangeText={setNewAddress}
            />
            <AppButton title="Lưu địa chỉ" onPress={handleAddNew} />
          </View>
        )}

        {addresses.map((item) => (
          <View key={item.id} style={styles.addressCard}>
            <View style={styles.cardHeader}>
              <View style={styles.labelRow}>
                {item.label === 'Nhà riêng' ? (
                  <Home size={16} color={colors.primary} />
                ) : (
                  <Briefcase size={16} color={colors.primary} />
                )}
                <AppText variant="bodyMedium" style={{ marginLeft: spacing.xs }}>
                  {item.label}
                </AppText>
                {item.isDefault && (
                  <View style={styles.defaultBadge}>
                    <AppText variant="captionMedium" color={colors.primary}>
                      Mặc định
                    </AppText>
                  </View>
                )}
              </View>

              <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ padding: 4 }}>
                <Trash2 size={16} color={colors.textDisabled} />
              </TouchableOpacity>
            </View>

            <AppText variant="bodyMedium" style={styles.namePhone}>
              {item.recipientName} • {item.phone}
            </AppText>
            <AppText variant="body" color={colors.textSecondary}>
              {item.address}
            </AppText>

            {!item.isDefault && (
              <TouchableOpacity
                onPress={() => handleSetDefault(item.id)}
                style={styles.setDefaultRow}
              >
                <AppText variant="captionMedium" color={colors.primary}>
                  Đặt làm địa chỉ mặc định
                </AppText>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  addIconBtn: {
    padding: spacing.xs,
  },
  addBox: {
    backgroundColor: colors.surface,
    padding: spacing.base,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.base,
  },
  addressCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  defaultBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radius.xs,
    marginLeft: spacing.xs,
  },
  namePhone: {
    marginBottom: 4,
  },
  setDefaultRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
  },
});
