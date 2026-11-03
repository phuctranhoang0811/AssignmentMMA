import React, { useState } from 'react';
import { Image, ImageStyle, StyleProp, View } from 'react-native';
import { UtensilsCrossed } from 'lucide-react-native';
import { colors } from '../../theme/colors';

// Remote menu photos can disappear (two Unsplash links already 404'd); show a neutral placeholder instead of a blank box.
export function ProductImage({ uri, style, iconSize = 40 }: { uri?: string; style: StyleProp<ImageStyle>; iconSize?: number }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (!uri || failedUri === uri) {
    return (
      <View style={[style as object, { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }]}
        accessibilityLabel="Ảnh món ăn chưa có">
        <UtensilsCrossed size={iconSize} color={colors.primary} strokeWidth={1.6} />
      </View>
    );
  }
  return <Image source={{ uri }} style={style} resizeMode="cover" onError={() => setFailedUri(uri)} />;
}
