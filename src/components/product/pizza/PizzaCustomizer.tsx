import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Check, Plus, Minus, X } from 'lucide-react-native';
import {
  PizzaSizeId,
  PizzaCustomizationState,
  PIZZA_CRUSTS,
  PIZZA_SAUCES,
  PIZZA_TOPPINGS,
  SPICE_LEVELS,
  BAKING_PREFERENCES,
  CUT_PREFERENCES,
  EXTRA_SAUCE_PRICE,
  MAX_TOPPINGS_COUNT,
  SpiceLevel,
  BakingPreference,
  CutPreference,
} from '../../../types/pizzaCustomization';
import { ProductVariant } from '../../../types/product';
import { formatCurrency } from '../../../utils/formatCurrency';
import { triggerHaptic } from '../../../utils/haptics';
import { styles } from '../../../styles/pizzaCustomizer.styles';

interface PizzaCustomizerProps {
  variants: ProductVariant[];
  selectedVariant: ProductVariant | null;
  onSelectVariant: (variant: ProductVariant) => void;
  customization: PizzaCustomizationState;
  onChangeCustomization: (customization: PizzaCustomizationState) => void;
  ingredients?: string[];
}

export const PizzaCustomizer: React.FC<PizzaCustomizerProps> = ({
  variants,
  selectedVariant,
  onSelectVariant,
  customization,
  onChangeCustomization,
  ingredients = [],
}) => {
  const [activeToppingTab, setActiveToppingTab] = useState<'all' | 'cheese' | 'meat' | 'veggie'>('all');

  const currentSizeId: PizzaSizeId = (selectedVariant?.id as PizzaSizeId) || 'small';

  const handleSizeChange = (variant: ProductVariant) => {
    triggerHaptic('light');
    onSelectVariant(variant);

    const newSizeId = variant.id as PizzaSizeId;
    const currentCrust = PIZZA_CRUSTS.find((c) => c.id === customization.crustId);
    let updatedCrustId = customization.crustId;

    // Check if current crust is supported in new size
    if (currentCrust && !currentCrust.supportedSizes.includes(newSizeId)) {
      updatedCrustId = 'classic-hand-tossed';
      triggerHaptic('warning');
    }

    onChangeCustomization({
      ...customization,
      sizeId: newSizeId,
      crustId: updatedCrustId,
    });
  };

  const handleCrustChange = (crustId: string) => {
    triggerHaptic('light');
    onChangeCustomization({
      ...customization,
      crustId,
    });
  };

  const handleSauceChange = (sauceId: string) => {
    triggerHaptic('light');
    onChangeCustomization({
      ...customization,
      sauceId,
    });
  };

  const handleToggleExtraSauce = () => {
    triggerHaptic('light');
    onChangeCustomization({
      ...customization,
      hasExtraSauce: !customization.hasExtraSauce,
    });
  };

  const handleAddOrIncrementTopping = (toppingId: string) => {
    const existing = customization.toppings.find((t) => t.id === toppingId);
    if (existing) {
      // Increment
      triggerHaptic('light');
      onChangeCustomization({
        ...customization,
        toppings: customization.toppings.map((t) =>
          t.id === toppingId ? { ...t, quantity: t.quantity + 1 } : t
        ),
      });
    } else {
      // Check maximum 5 unique toppings limit
      if (customization.toppings.length >= MAX_TOPPINGS_COUNT) {
        triggerHaptic('warning');
        return;
      }
      triggerHaptic('light');
      onChangeCustomization({
        ...customization,
        toppings: [...customization.toppings, { id: toppingId, quantity: 1 }],
      });
    }
  };

  const handleDecrementTopping = (toppingId: string) => {
    triggerHaptic('light');
    const existing = customization.toppings.find((t) => t.id === toppingId);
    if (!existing) return;

    if (existing.quantity <= 1) {
      onChangeCustomization({
        ...customization,
        toppings: customization.toppings.filter((t) => t.id !== toppingId),
      });
    } else {
      onChangeCustomization({
        ...customization,
        toppings: customization.toppings.map((t) =>
          t.id === toppingId ? { ...t, quantity: t.quantity - 1 } : t
        ),
      });
    }
  };

  const handleToggleRemoveIngredient = (ingredient: string) => {
    triggerHaptic('light');
    const isRemoved = customization.removedIngredients.includes(ingredient);
    onChangeCustomization({
      ...customization,
      removedIngredients: isRemoved
        ? customization.removedIngredients.filter((i) => i !== ingredient)
        : [...customization.removedIngredients, ingredient],
    });
  };

  const filteredToppings = PIZZA_TOPPINGS.filter((t) => {
    if (activeToppingTab === 'all') return true;
    return t.category === activeToppingTab;
  });

  return (
    <View style={styles.container}>
      {/* ======================================================== */}
      {/* NHÓM 1 — CHỌN KÍCH THƯỚC PIZZA                          */}
      {/* ======================================================== */}
      <View style={styles.groupSection}>
        <View style={styles.groupHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.groupTitle}>Chọn kích thước pizza</Text>
          </View>
          <View style={styles.requiredBadge}>
            <Text style={styles.requiredText}>Bắt buộc (1)</Text>
          </View>
        </View>
        <Text style={styles.groupSubtitle}>Kích thước bánh tiêu chuẩn với bảng giá theo từng cỡ</Text>

        <View style={styles.optionsGrid}>
          {variants.map((v) => {
            const isSelected = selectedVariant?.id === v.id;
            const sizeDiameter =
              v.id === 'small' ? '20 cm • 6 miếng' : v.id === 'medium' ? '25 cm • 6-8 miếng' : '30 cm • 8 miếng';
            return (
              <TouchableOpacity
                key={v.id}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                onPress={() => handleSizeChange(v)}
                activeOpacity={0.8}
              >
                <View style={styles.optionLeft}>
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                    {isSelected && <View style={styles.radioInnerDot} />}
                  </View>
                  <View style={styles.optionTextWrap}>
                    <Text style={[styles.optionName, isSelected && styles.optionNameSelected]}>
                      {v.name}
                    </Text>
                    <Text style={styles.optionDesc}>{sizeDiameter}</Text>
                  </View>
                </View>
                <Text style={[styles.priceTag, isSelected && styles.priceTagSelected]}>
                  {formatCurrency(v.price)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ======================================================== */}
      {/* NHÓM 2 — CHỌN LOẠI ĐẾ BÁNH (CRUST)                       */}
      {/* ======================================================== */}
      <View style={styles.groupSection}>
        <View style={styles.groupHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={styles.groupTitle}>Chọn loại đế bánh</Text>
          </View>
          <View style={styles.requiredBadge}>
            <Text style={styles.requiredText}>Bắt buộc (1)</Text>
          </View>
        </View>
        <Text style={styles.groupSubtitle}>
          Đế bánh men tươi nướng giòn rụm hoặc viền phô mai béo ngậy
        </Text>

        <View style={styles.optionsGrid}>
          {PIZZA_CRUSTS.map((crust) => {
            const isSupported = crust.supportedSizes.includes(currentSizeId);
            const isSelected = customization.crustId === crust.id;

            return (
              <TouchableOpacity
                key={crust.id}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                  !isSupported && styles.optionCardDisabled,
                ]}
                disabled={!isSupported}
                onPress={() => handleCrustChange(crust.id)}
                activeOpacity={0.8}
              >
                <View style={styles.optionLeft}>
                  <View
                    style={[
                      styles.radioCircle,
                      isSelected && styles.radioCircleSelected,
                    ]}
                  >
                    {isSelected && <View style={styles.radioInnerDot} />}
                  </View>
                  <View style={styles.optionTextWrap}>
                    <Text style={[styles.optionName, isSelected && styles.optionNameSelected]}>
                      {crust.name}
                    </Text>
                    {crust.description && (
                      <Text style={styles.optionDesc}>{crust.description}</Text>
                    )}
                    {!isSupported && (
                      <Text style={styles.unsupportedHint}>
                        * Chỉ áp dụng cho cỡ Vừa (25cm) và Lớn (30cm)
                      </Text>
                    )}
                  </View>
                </View>
                <Text
                  style={[
                    crust.price === 0 ? styles.priceTagFree : styles.priceTag,
                    isSelected && styles.priceTagSelected,
                  ]}
                >
                  {crust.price === 0 ? 'Miễn phí' : `+${formatCurrency(crust.price)}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ======================================================== */}
      {/* NHÓM 3 — CHỌN SỐT NỀN (BASE SAUCE)                       */}
      {/* ======================================================== */}
      <View style={styles.groupSection}>
        <View style={styles.groupHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={styles.groupTitle}>Chọn sốt nền</Text>
          </View>
          <View style={styles.requiredBadge}>
            <Text style={styles.requiredText}>Bắt buộc (1)</Text>
          </View>
        </View>
        <Text style={styles.groupSubtitle}>Hương vị sốt phủ nền pizza theo công thức độc quyền</Text>

        <View style={styles.optionsGrid}>
          {PIZZA_SAUCES.map((sauce) => {
            const isSelected = customization.sauceId === sauce.id;
            return (
              <TouchableOpacity
                key={sauce.id}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                onPress={() => handleSauceChange(sauce.id)}
                activeOpacity={0.8}
              >
                <View style={styles.optionLeft}>
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                    {isSelected && <View style={styles.radioInnerDot} />}
                  </View>
                  <View style={styles.optionTextWrap}>
                    <Text style={[styles.optionName, isSelected && styles.optionNameSelected]}>
                      {sauce.name}
                    </Text>
                    {sauce.description && (
                      <Text style={styles.optionDesc}>{sauce.description}</Text>
                    )}
                  </View>
                </View>
                <Text
                  style={[
                    sauce.price === 0 ? styles.priceTagFree : styles.priceTag,
                    isSelected && styles.priceTagSelected,
                  ]}
                >
                  {sauce.price === 0 ? 'Miễn phí' : `+${formatCurrency(sauce.price)}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Option: Thêm sốt (+10.000đ) */}
        <TouchableOpacity
          style={styles.extraSauceRow}
          activeOpacity={0.8}
          onPress={handleToggleExtraSauce}
        >
          <View style={styles.extraSauceLeft}>
            <View
              style={[
                styles.checkboxSquare,
                customization.hasExtraSauce && styles.checkboxSquareSelected,
              ]}
            >
              {customization.hasExtraSauce && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
            </View>
            <Text style={styles.extraSauceText}>Phủ thêm nhiều sốt (Extra Sauce)</Text>
          </View>
          <Text style={styles.extraSaucePrice}>+{formatCurrency(EXTRA_SAUCE_PRICE)}</Text>
        </TouchableOpacity>
      </View>

      {/* ======================================================== */}
      {/* NHÓM 4 — TOPPING, CHEESE VÀ PROTEIN                     */}
      {/* ======================================================== */}
      <View style={styles.groupSection}>
        <View style={styles.groupHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <Text style={styles.groupTitle}>Topping, Phô mai & Thịt</Text>
          </View>
          <View style={styles.optionalBadge}>
            <Text style={styles.optionalText}>Tùy chọn</Text>
          </View>
        </View>

        <View style={styles.toppingsCountRow}>
          <Text style={styles.groupSubtitle}>Thêm nguyên liệu ưa thích (Tối đa 5 loại)</Text>
          <View style={styles.toppingsCountBadge}>
            <Text style={styles.toppingsCountText}>
              Đã chọn: {customization.toppings.length}/{MAX_TOPPINGS_COUNT}
            </Text>
          </View>
        </View>

        {/* Category Filter Tabs */}
        <View style={styles.categoryTabsRow}>
          {(
            [
              { id: 'all', label: 'Tất cả' },
              { id: 'cheese', label: '🧀 Phô mai' },
              { id: 'meat', label: '🥩 Thịt & Protein' },
              { id: 'veggie', label: '🥦 Rau củ' },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.categoryTab, activeToppingTab === tab.id && styles.categoryTabActive]}
              onPress={() => setActiveToppingTab(tab.id)}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  activeToppingTab === tab.id && styles.categoryTabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Topping list */}
        {filteredToppings.map((topping) => {
          const selected = customization.toppings.find((t) => t.id === topping.id);
          const isSelected = !!selected;
          const isMaxReached = customization.toppings.length >= MAX_TOPPINGS_COUNT;

          return (
            <View
              key={topping.id}
              style={[styles.toppingItemCard, isSelected && styles.toppingItemCardActive]}
            >
              <View style={styles.toppingItemLeft}>
                <Text style={styles.toppingName}>{topping.name}</Text>
                <Text style={styles.toppingPrice}>+{formatCurrency(topping.price)} / phần</Text>
              </View>

              {isSelected ? (
                <View style={styles.stepperWrap}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => handleDecrementTopping(topping.id)}
                  >
                    <Minus size={14} color="#111827" />
                  </TouchableOpacity>
                  <Text style={styles.stepperQtyText}>{selected.quantity}</Text>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => handleAddOrIncrementTopping(topping.id)}
                  >
                    <Plus size={14} color="#111827" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.addTopBtn, isMaxReached && { opacity: 0.5 }]}
                  disabled={isMaxReached}
                  onPress={() => handleAddOrIncrementTopping(topping.id)}
                >
                  <Text style={styles.addTopBtnText}>+ Thêm</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {/* ======================================================== */}
      {/* NHÓM 5 — TÙY CHỈNH MIỄN PHÍ                             */}
      {/* ======================================================== */}
      <View style={styles.groupSection}>
        <View style={styles.groupHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberText}>5</Text>
            </View>
            <Text style={styles.groupTitle}>Tùy chỉnh miễn phí</Text>
          </View>
          <View style={styles.optionalBadge}>
            <Text style={styles.optionalText}>Miễn phí</Text>
          </View>
        </View>
        <Text style={styles.groupSubtitle}>Cá nhân hóa hương vị và khẩu vị riêng của bạn</Text>

        {/* 1. Mức cay (Spice Level) */}
        <View style={styles.prefSection}>
          <Text style={styles.prefLabel}>Mức cay (Spice Level)</Text>
          <View style={styles.chipsRow}>
            {SPICE_LEVELS.map((sp) => {
              const active = customization.spiceLevel === sp.id;
              return (
                <TouchableOpacity
                  key={sp.id}
                  style={[styles.chipItem, active && styles.chipItemActive]}
                  onPress={() => {
                    triggerHaptic('light');
                    onChangeCustomization({ ...customization, spiceLevel: sp.id as SpiceLevel });
                  }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {sp.icon} {sp.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 2. Baking Preference */}
        <View style={styles.prefSection}>
          <Text style={styles.prefLabel}>Độ nướng bánh (Baking Preference)</Text>
          <View style={styles.chipsRow}>
            {BAKING_PREFERENCES.map((bp) => {
              const active = customization.bakingPreference === bp.id;
              return (
                <TouchableOpacity
                  key={bp.id}
                  style={[styles.chipItem, active && styles.chipItemActive]}
                  onPress={() => {
                    triggerHaptic('light');
                    onChangeCustomization({
                      ...customization,
                      bakingPreference: bp.id as BakingPreference,
                    });
                  }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {bp.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 3. Cut Preference */}
        <View style={styles.prefSection}>
          <Text style={styles.prefLabel}>Cách cắt bánh (Cut Preference)</Text>
          <View style={styles.chipsRow}>
            {CUT_PREFERENCES.map((cp) => {
              const active = customization.cutPreference === cp.id;
              return (
                <TouchableOpacity
                  key={cp.id}
                  style={[styles.chipItem, active && styles.chipItemActive]}
                  onPress={() => {
                    triggerHaptic('light');
                    onChangeCustomization({
                      ...customization,
                      cutPreference: cp.id as CutPreference,
                    });
                  }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {cp.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 4. Remove Ingredients (Xây dựng từ danh sách thực tế của món) */}
        {ingredients && ingredients.length > 0 && (
          <View style={styles.prefSection}>
            <Text style={styles.prefLabel}>Bỏ bớt nguyên liệu (Không tính thêm phí)</Text>
            <View style={styles.removeIngredientsWrap}>
              {ingredients.map((ing) => {
                const isRemoved = customization.removedIngredients.includes(ing);
                return (
                  <TouchableOpacity
                    key={ing}
                    style={[
                      styles.removeIngredientPill,
                      isRemoved && styles.removeIngredientPillActive,
                    ]}
                    onPress={() => handleToggleRemoveIngredient(ing)}
                  >
                    {isRemoved && <X size={13} color="#DC2626" />}
                    <Text
                      style={[
                        styles.removeIngredientText,
                        isRemoved && styles.removeIngredientTextActive,
                      ]}
                    >
                      {isRemoved ? `Bỏ ${ing}` : ing}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* 5. Ghi chú đặc biệt cho bếp (Special Instructions) */}
        <View style={[styles.prefSection, { marginBottom: 0 }]}>
          <Text style={styles.prefLabel}>Ghi chú đặc biệt (Tối đa 150 ký tự)</Text>
          <View style={styles.noteInputWrap}>
            <TextInput
              style={styles.noteInput}
              placeholder="Ví dụ: Nướng kỹ thêm viền bánh, để tương ớt riêng..."
              placeholderTextColor="#9CA3AF"
              maxLength={150}
              multiline
              value={customization.specialInstructions || ''}
              onChangeText={(text) => {
                onChangeCustomization({
                  ...customization,
                  specialInstructions: text,
                });
              }}
            />
            <Text style={styles.charCountText}>
              {(customization.specialInstructions || '').length}/150
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};
