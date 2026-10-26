import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Path,
  Rect,
  Circle,
  Ellipse,
  G,
} from 'react-native-svg';

export function CouchIllustration({ width = 300, height = 160 }: { width?: number; height?: number }) {
  return (
    <View style={styles.container}>
      <Svg width={width} height={height} viewBox="0 0 300 160" fill="none">
        {/* Couch Shadow */}
        <Ellipse cx="150" cy="148" rx="125" ry="5" fill="#E5E7EB" />

        {/* Couch Wooden Legs */}
        <Rect x="55" y="132" width="10" height="12" fill="#8B4513" rx="2" />
        <Rect x="135" y="132" width="8" height="12" fill="#8B4513" rx="2" />
        <Rect x="235" y="132" width="10" height="12" fill="#8B4513" rx="2" />

        {/* Couch Backrest */}
        <Path
          d="M48 65 C48 55, 60 50, 75 50 L225 50 C240 50, 252 55, 252 65 L252 110 L48 110 Z"
          fill="#FAF9F6"
          stroke="#4A3728"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Couch Left Armrest */}
        <Path
          d="M40 75 C40 68, 50 64, 58 68 C66 72, 66 85, 66 115 L36 115 C36 90, 40 82, 40 75 Z"
          fill="#FFFFFF"
          stroke="#4A3728"
          strokeWidth="2.5"
        />

        {/* Couch Right Armrest */}
        <Path
          d="M260 75 C260 68, 250 64, 242 68 C234 72, 234 85, 234 115 L264 115 C264 90, 260 82, 260 75 Z"
          fill="#FFFFFF"
          stroke="#4A3728"
          strokeWidth="2.5"
        />

        {/* Couch Seat Cushion */}
        <Rect
          x="50"
          y="105"
          width="200"
          height="30"
          rx="8"
          fill="#FFFFFF"
          stroke="#4A3728"
          strokeWidth="2.5"
        />

        {/* Couch Button Tufting Accents */}
        <Path d="M48 85 L44 95 L48 105" stroke="#4A3728" strokeWidth="1.8" fill="none" />
        <Path d="M252 85 L256 95 L252 105" stroke="#4A3728" strokeWidth="1.8" fill="none" />

        {/* ======================================================== */}
        {/* CHARACTER 1: CUTE PIZZA SLICE SITTING ON COUCH          */}
        {/* ======================================================== */}
        <G id="PizzaCharacter">
          {/* Pizza Crust on Top */}
          <Path
            d="M82 48 C85 40, 115 40, 140 46 C143 53, 138 58, 135 60 C110 54, 85 54, 82 48 Z"
            fill="#D2A374"
            stroke="#4A3728"
            strokeWidth="2.2"
          />
          {/* Crust Texture Dots */}
          <Circle cx="95" cy="46" r="1.5" fill="#B07D4F" />
          <Circle cx="108" cy="45" r="1.5" fill="#B07D4F" />
          <Circle cx="122" cy="48" r="1.5" fill="#B07D4F" />

          {/* Pizza Body (Cheese Slice) */}
          <Path
            d="M86 52 L95 110 C98 116, 125 116, 135 110 L134 56 Z"
            fill="#FFF9E6"
            stroke="#4A3728"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />

          {/* Pepperoni Slices on Pizza Body */}
          <Circle cx="126" cy="74" r="10" fill="#D32F2F" stroke="#4A3728" strokeWidth="1.8" />
          <Ellipse cx="118" cy="106" rx="14" ry="7" fill="#D32F2F" stroke="#4A3728" strokeWidth="1.8" />

          {/* Pizza Eyes and Smile */}
          <Circle cx="102" cy="72" r="2.5" fill="#1F2937" />
          <Circle cx="118" cy="72" r="2.5" fill="#1F2937" />
          <Path d="M107 78 Q110 80 113 78" stroke="#4A3728" strokeWidth="1.8" strokeLinecap="round" fill="none" />

          {/* Pizza Little Legs dangling over cushion */}
          <Path d="M98 112 L96 122" stroke="#4A3728" strokeWidth="2.2" strokeLinecap="round" />
          <Path d="M116 112 L116 122" stroke="#4A3728" strokeWidth="2.2" strokeLinecap="round" />
        </G>

        {/* ======================================================== */}
        {/* CHARACTER 2: CUTE CHUBBY TOMATO SITTING ON COUCH       */}
        {/* ======================================================== */}
        <G id="TomatoCharacter">
          {/* Green Leaves/Stem on Top */}
          <Path
            d="M192 68 C188 62, 192 57, 194 56 C196 57, 200 62, 196 68 Z"
            fill="#388E3C"
            stroke="#4A3728"
            strokeWidth="1.8"
          />
          <Path
            d="M194 65 C202 61, 206 63, 207 65 C204 67, 198 67, 194 65 Z"
            fill="#388E3C"
            stroke="#4A3728"
            strokeWidth="1.5"
          />
          <Path
            d="M194 65 C186 61, 182 63, 181 65 C184 67, 190 67, 194 65 Z"
            fill="#388E3C"
            stroke="#4A3728"
            strokeWidth="1.5"
          />

          {/* Tomato Round Body */}
          <Circle
            cx="194"
            cy="88"
            r="26"
            fill="#E53935"
            stroke="#4A3728"
            strokeWidth="2.2"
          />

          {/* Tomato Cheeks Highlight */}
          <Circle cx="178" cy="90" r="4" fill="#FF8A80" opacity={0.6} />
          <Circle cx="210" cy="90" r="4" fill="#FF8A80" opacity={0.6} />

          {/* Tomato Eyes & Smile */}
          <Circle cx="184" cy="85" r="2.8" fill="#1F2937" />
          <Circle cx="204" cy="85" r="2.8" fill="#1F2937" />
          <Path d="M191 92 Q194 95 197 92" stroke="#4A3728" strokeWidth="2" strokeLinecap="round" fill="none" />

          {/* Tomato Little Hands resting */}
          <Path d="M170 94 Q162 98 160 102" stroke="#4A3728" strokeWidth="2" strokeLinecap="round" fill="none" />
          <Path d="M218 94 Q226 98 228 102" stroke="#4A3728" strokeWidth="2" strokeLinecap="round" fill="none" />

          {/* Tomato Little Legs dangling over cushion */}
          <Path d="M184 114 L182 122" stroke="#4A3728" strokeWidth="2.2" strokeLinecap="round" />
          <Path d="M204 114 L204 122" stroke="#4A3728" strokeWidth="2.2" strokeLinecap="round" />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
});
