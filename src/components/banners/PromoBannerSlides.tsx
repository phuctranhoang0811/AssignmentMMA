import React from 'react';
import { View, Text, Image } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { colors } from '../../theme/colors';

const BRAND_RED = colors.primary;

export type PromoGroupId = 'cheese_party' | 'member_deals' | 'hot_deals';

export const PROMO_BANNER_DOC_ID = '__PROMO_BANNERS';
export const PROMO_BANNER_STORAGE_KEY = '@fpt_promo_banners_v1';

/* Crisp Vector Pepsi Can Icon for Promotional Banners */
const PepsiCanGraphic = ({ width = 26, height = 52 }: { width?: number; height?: number }) => (
  <Svg width={width} height={height} viewBox="0 0 36 72" fill="none">
    <Rect x="2" y="5" width="32" height="62" rx="5" fill="#004B93" stroke="#FFFFFF" strokeWidth={1.5} />
    <Rect x="6" y="6" width="5" height="60" fill="rgba(255,255,255,0.22)" />
    <Rect x="4" y="2" width="28" height="5" rx="2.5" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth={0.8} />
    <Rect x="5" y="65" width="26" height="4" rx="2" fill="#D1D5DB" />
    <Circle cx="18" cy="36" r="12.5" fill="#FFFFFF" />
    <Path d="M6.5 34C9 26 17 24 28.5 29.5C24 23.5 11.5 23.5 6.5 34Z" fill="#E32934" />
    <Path d="M7 39.5C12.5 44 22.5 44.5 29.5 37.5C27 45.5 13.5 47.5 7 39.5Z" fill="#004B93" />
  </Svg>
);

/* Slide 1: TIỆC CHEESE — Pizza Phô Mai Kéo X3 Cheese (Brand Primary #CF4226) */
export const CheesePartyBannerSlide = () => (
  <View style={{ flex: 1, backgroundColor: BRAND_RED, position: 'relative', overflow: 'hidden' }}>
    <Svg width="100%" height="100%" viewBox="0 0 360 206" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0 }}>
      <Rect x="0" y="0" width="360" height="206" fill={BRAND_RED} />
      <Rect x="10" y="8" width="68" height="22" stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" fill="none" />
      <Rect x="84" y="8" width="76" height="22" stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" fill="none" />
      <Rect x="166" y="8" width="72" height="22" stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" fill="none" />
      <Rect x="244" y="8" width="84" height="22" stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" fill="none" />
      <Rect x="-14" y="34" width="64" height="22" stroke="rgba(255,255,255,0.14)" strokeWidth="1.2" fill="none" />
      <Rect x="56" y="34" width="74" height="22" stroke="rgba(255,255,255,0.14)" strokeWidth="1.2" fill="none" />
      <Rect x="218" y="34" width="78" height="22" stroke="rgba(255,255,255,0.14)" strokeWidth="1.2" fill="none" />
      <Rect x="302" y="34" width="68" height="22" stroke="rgba(255,255,255,0.14)" strokeWidth="1.2" fill="none" />
      <Circle cx="65" cy="95" r="78" fill="rgba(255,168,76,0.32)" />
      <Path d="M0 128 Q155 78 360 92 L360 206 L0 206 Z" fill="#5B9E31" />
      <Path d="M0 144 Q180 100 360 112 L360 206 L0 206 Z" fill="#4B8825" />
    </Svg>

    <View
      style={{
        position: 'absolute',
        top: 10,
        left: 10,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 8,
        paddingVertical: 3.5,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#FFD2C9',
        zIndex: 5,
      }}
    >
      <Image
        source={require('../../../assets/header_logo.png')}
        style={{ width: 16, height: 16, borderRadius: 8, marginRight: 4 }}
        resizeMode="contain"
      />
      <Text style={{ color: BRAND_RED, fontSize: 10, fontWeight: '900', letterSpacing: 0.3 }}>
        TIỆC CHEESE
      </Text>
    </View>

    <View style={{ position: 'absolute', top: 8, left: 102, right: 14, alignItems: 'center', zIndex: 5 }}>
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: 13,
          fontWeight: '900',
          fontStyle: 'italic',
          letterSpacing: 1.2,
          marginBottom: 2,
          textShadowColor: 'rgba(0,0,0,0.28)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
        }}
      >
        PIZZA
      </Text>
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderWidth: 2.2,
          borderColor: '#111215',
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 3,
          shadowColor: '#000',
          shadowOffset: { width: 2, height: 3 },
          shadowOpacity: 0.35,
          shadowRadius: 0,
          elevation: 4,
        }}
      >
        <Text style={{ color: '#111215', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 }}>
          PHÔ MAI KÉO 🧀
        </Text>
      </View>
    </View>

    <View style={{ position: 'absolute', left: 10, top: 52, width: 126, zIndex: 5 }}>
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 10,
          paddingHorizontal: 8,
          paddingVertical: 4,
          alignSelf: 'flex-start',
          borderWidth: 1.5,
          borderColor: '#FFE0D6',
          marginBottom: 6,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 3,
        }}
      >
        <Text style={{ color: BRAND_RED, fontSize: 13, fontWeight: '900', lineHeight: 14 }}>
          MỚI
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={{ color: '#111215', fontSize: 13, fontWeight: '900' }}>249</Text>
          <Text style={{ color: '#111215', fontSize: 8.5, fontWeight: '800' }}>.000Đ</Text>
          <Text style={{ color: '#4B5563', fontSize: 7.5, fontWeight: '700', marginLeft: 3 }}>CHỈ TỪ</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.92)',
            borderTopWidth: 2.5,
            borderTopColor: BRAND_RED,
            paddingHorizontal: 5,
            paddingVertical: 3,
            borderRadius: 4,
            width: 72,
            marginRight: -8,
            zIndex: 1,
          }}
        >
          <Text style={{ color: '#111215', fontSize: 6.8, fontWeight: '900', lineHeight: 8.5 }}>
            PIZZA{'\n'}PHÔ MAI KÉO{'\n'}BÒ TERIYAKI
          </Text>
        </View>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            borderWidth: 2,
            borderColor: '#D99B52',
            overflow: 'hidden',
            backgroundColor: '#FFF',
            zIndex: 2,
          }}
        >
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=400&q=85' }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.92)',
            borderTopWidth: 2.5,
            borderTopColor: BRAND_RED,
            paddingHorizontal: 5,
            paddingVertical: 3,
            borderRadius: 4,
            width: 72,
            marginRight: -8,
            zIndex: 1,
          }}
        >
          <Text style={{ color: '#111215', fontSize: 6.8, fontWeight: '900', lineHeight: 8.5 }}>
            PIZZA{'\n'}PHÔ MAI KÉO{'\n'}CHICAGO
          </Text>
        </View>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            borderWidth: 2,
            borderColor: '#D99B52',
            overflow: 'hidden',
            backgroundColor: '#FFF',
            zIndex: 2,
          }}
        >
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=85' }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        </View>
      </View>
    </View>

    <View style={{ position: 'absolute', right: 8, bottom: -14, width: 196, height: 158, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          top: 2,
          left: 6,
          backgroundColor: 'rgba(0,0,0,0.45)',
          paddingHorizontal: 7,
          paddingVertical: 2,
          borderRadius: 8,
          zIndex: 6,
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.3 }}>
          PIZZA PHÔ MAI KÉO PEPPERONI
        </Text>
      </View>

      <View
        style={{
          width: 156,
          height: 156,
          borderRadius: 78,
          borderWidth: 5,
          borderColor: '#B85D27',
          overflow: 'hidden',
          backgroundColor: '#FDE68A',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 6,
          elevation: 6,
        }}
      >
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=800&q=85' }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      </View>

      <View
        style={{
          position: 'absolute',
          right: 4,
          bottom: 20,
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 9,
          paddingVertical: 4,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: BRAND_RED,
          transform: [{ rotate: '-6deg' }],
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 7,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: BRAND_RED, fontSize: 13, fontWeight: '900', fontStyle: 'italic', lineHeight: 14 }}>
          X3
        </Text>
        <Text style={{ color: BRAND_RED, fontSize: 10.5, fontWeight: '900', fontStyle: 'italic', lineHeight: 11 }}>
          CHEESE
        </Text>
      </View>
    </View>
  </View>
);

/* Slide 2: THÀNH VIÊN — Giảm thêm cho Thành Viên tới 70.000 VNĐ (Brand Primary #CF4226) */
export const MemberDealsBannerSlide = () => (
  <View style={{ flex: 1, backgroundColor: '#FFFFFF', position: 'relative', overflow: 'hidden' }}>
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 64, backgroundColor: BRAND_RED }}>
      <Svg width="100%" height="100%" viewBox="0 0 360 64" preserveAspectRatio="none">
        <Rect x="0" y="0" width="360" height="64" fill={BRAND_RED} />
        {[0, 60, 120, 180, 240, 300].map((x) => (
          <Rect key={`r1-${x}`} x={x} y="0" width="30" height="32" fill="#B5371F" />
        ))}
        {[30, 90, 150, 210, 270, 330].map((x) => (
          <Rect key={`r2-${x}`} x={x} y="32" width="30" height="32" fill="#B5371F" />
        ))}
      </Svg>
    </View>

    <View
      style={{
        position: 'absolute',
        top: 8,
        left: 118,
        width: 68,
        height: 68,
        borderRadius: 34,
        borderWidth: 3,
        borderColor: '#FFFFFF',
        backgroundColor: '#F3F4F6',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.16,
        shadowRadius: 5,
        elevation: 4,
        zIndex: 2,
      }}
    >
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=85' }}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
      />
    </View>

    <View style={{ position: 'absolute', top: 14, right: 64, transform: [{ rotate: '16deg' }], zIndex: 2 }}>
      <PepsiCanGraphic width={28} height={56} />
    </View>

    <View
      style={{
        position: 'absolute',
        left: 12,
        top: 14,
        width: 96,
        height: 158,
        borderRadius: 14,
        borderWidth: 2.5,
        borderColor: '#3E2723',
        backgroundColor: '#FFFFFF',
        transform: [{ rotate: '-9deg' }],
        paddingHorizontal: 6,
        paddingTop: 8,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 5,
        elevation: 3,
        zIndex: 3,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
        <Image
          source={require('../../../assets/header_logo.png')}
          style={{ width: 16, height: 16, borderRadius: 8, marginRight: 3 }}
          resizeMode="contain"
        />
        <Image
          source={require('../../../assets/pizza_fpt_brand_text.png')}
          style={{ width: 52, height: 13 }}
          resizeMode="contain"
        />
      </View>
      <Text style={{ color: '#3E2723', fontSize: 7.8, fontWeight: '900', textAlign: 'center' }}>
        GIẢM THÊM CHO
      </Text>
      <Text
        style={{
          color: BRAND_RED,
          fontSize: 15,
          fontWeight: '900',
          lineHeight: 16,
          textAlign: 'center',
          marginTop: 1,
        }}
      >
        THÀNH{'\n'}VIÊN
      </Text>
    </View>

    <View
      style={{
        position: 'absolute',
        left: 66,
        top: 64,
        width: 186,
        height: 82,
        backgroundColor: BRAND_RED,
        borderRadius: 10,
        transform: [{ rotate: '-12deg' }],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 14,
        borderWidth: 1.5,
        borderColor: '#FFE4DE',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.24,
        shadowRadius: 6,
        elevation: 6,
        zIndex: 5,
      }}
    >
      <View style={{ position: 'absolute', left: -5, top: 12, bottom: 12, justifyContent: 'space-between' }}>
        {[0, 1, 2, 3].map((n) => (
          <View key={`l-${n}`} style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#FFFFFF' }} />
        ))}
      </View>
      <View style={{ position: 'absolute', right: -5, top: 12, bottom: 12, justifyContent: 'space-between' }}>
        {[0, 1, 2, 3].map((n) => (
          <View key={`r-${n}`} style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#FFFFFF' }} />
        ))}
      </View>

      <Text style={{ color: '#FFFDF7', fontSize: 12, fontWeight: '900', fontStyle: 'italic', alignSelf: 'flex-end', marginBottom: 12, marginRight: 2 }}>
        TỚI
      </Text>
      <Text style={{ color: '#FFFDF7', fontSize: 48, fontWeight: '900', fontStyle: 'italic', lineHeight: 52, letterSpacing: -1 }}>
        70
      </Text>
      <View style={{ marginLeft: 3, justifyContent: 'center' }}>
        <Text style={{ color: '#FFFDF7', fontSize: 17, fontWeight: '900', fontStyle: 'italic', lineHeight: 18 }}>
          .000
        </Text>
        <Text style={{ color: '#FFFDF7', fontSize: 19, fontWeight: '900', fontStyle: 'italic', lineHeight: 20 }}>
          VNĐ
        </Text>
        <Text style={{ color: '#FFE8E2', fontSize: 6.5, fontWeight: '800', marginTop: 1 }}>
          ÁP DỤNG CHO COMBO
        </Text>
      </View>
    </View>

    <View
      style={{
        position: 'absolute',
        right: -12,
        bottom: 4,
        width: 138,
        height: 138,
        borderRadius: 69,
        borderWidth: 4,
        borderColor: '#D98A46',
        overflow: 'hidden',
        backgroundColor: '#FDE68A',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 6,
        elevation: 7,
        zIndex: 6,
      }}
    >
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1590947132387-155cc02f3212?auto=format&fit=crop&w=800&q=85' }}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
      />
    </View>
  </View>
);

/* Slide 3: DEAL HOT 70% — Deal Nóng 70% Áp dụng cho Pizza thứ 2 (Brand Primary #CF4226) */
export const HotDealsBannerSlide = () => (
  <View style={{ flex: 1, backgroundColor: '#FFFFFF', position: 'relative', overflow: 'hidden' }}>
    <View
      style={{
        position: 'absolute',
        left: 24,
        right: 18,
        top: 76,
        bottom: 10,
        backgroundColor: BRAND_RED,
        borderRadius: 10,
      }}
    />

    <View
      style={{
        position: 'absolute',
        left: 12,
        top: 12,
        width: 120,
        height: 76,
        backgroundColor: BRAND_RED,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 3,
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900', lineHeight: 25, letterSpacing: 0.5 }}>
        DEAL
      </Text>
      <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900', lineHeight: 26, letterSpacing: 0.5 }}>
        NÓNG
      </Text>
    </View>

    <View style={{ position: 'absolute', left: 28, top: 88, zIndex: 4 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 7.8, fontWeight: '800', lineHeight: 10.5, textAlign: 'center' }}>
        Mua 01 Pizza và 02 Nước{'\n'}Ưu đãi Pizza thứ hai Giảm 70%
      </Text>
    </View>

    <View style={{ position: 'absolute', left: 138, top: 6, zIndex: 3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Text style={{ color: BRAND_RED, fontSize: 54, fontWeight: '900', lineHeight: 56, letterSpacing: -1.5 }}>
          70
        </Text>
        <Text style={{ color: BRAND_RED, fontSize: 22, fontWeight: '900', marginTop: 4, marginLeft: 1 }}>
          %
        </Text>
      </View>
      <Text style={{ color: '#111215', fontSize: 8.8, fontWeight: '900', marginTop: -4 }}>
        Áp dụng cho Pizza thứ 2
      </Text>
    </View>

    <View style={{ position: 'absolute', top: 8, right: 44, transform: [{ rotate: '10deg' }], zIndex: 2 }}>
      <PepsiCanGraphic width={24} height={48} />
    </View>
    <View style={{ position: 'absolute', top: 16, right: 24, transform: [{ rotate: '14deg' }], zIndex: 2 }}>
      <PepsiCanGraphic width={24} height={48} />
    </View>

    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 20, height: 10, flexDirection: 'row', zIndex: 2 }}>
      {Array.from({ length: 24 }).map((_, idx) => (
        <View
          key={idx}
          style={{
            flex: 1,
            height: 10,
            backgroundColor: idx % 2 === 0 ? BRAND_RED : '#FFFFFF',
            opacity: 0.9,
          }}
        />
      ))}
    </View>

    <View
      style={{
        position: 'absolute',
        left: 62,
        bottom: -8,
        width: 112,
        height: 112,
        borderRadius: 56,
        borderWidth: 4.5,
        borderColor: '#7C3F19',
        overflow: 'hidden',
        backgroundColor: '#FDE68A',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.28,
        shadowRadius: 5,
        elevation: 5,
        zIndex: 5,
      }}
    >
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=700&q=85' }}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
      />
    </View>

    <View
      style={{
        position: 'absolute',
        right: -6,
        bottom: 12,
        width: 132,
        height: 132,
        borderRadius: 66,
        borderWidth: 4.5,
        borderColor: '#7C3F19',
        overflow: 'hidden',
        backgroundColor: '#FDE68A',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 6,
        zIndex: 6,
      }}
    >
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=700&q=85' }}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
      />
    </View>
  </View>
);

export const PromoBannerContent = ({
  groupId,
  customImageUrl,
}: {
  groupId: string;
  customImageUrl?: string;
}) => {
  if (customImageUrl && customImageUrl.trim().length > 0) {
    return (
      <Image
        source={{ uri: customImageUrl }}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
      />
    );
  }
  if (groupId === 'member_deals') return <MemberDealsBannerSlide />;
  if (groupId === 'hot_deals') return <HotDealsBannerSlide />;
  return <CheesePartyBannerSlide />;
};

