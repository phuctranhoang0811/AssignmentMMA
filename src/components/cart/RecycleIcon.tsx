import React from 'react';
import Svg, { Path } from 'react-native-svg';

/* SVG: Green Recycling Emblem with Center Checkmark */
export const RecycleIcon = () => (
  <Svg width={74} height={74} viewBox="0 0 100 100" fill="none">
    {/* Arrow 1: Top / Right */}
    <Path
      d="M38 18 L56 18 C66 18 74 26 74 36 L74 38 L82 32 L75 50 L60 37 L68 40 L68 36 C68 30 63 24 56 24 L38 24 Z"
      fill="#4ADE80"
    />
    {/* Arrow 2: Bottom / Right */}
    <Path
      d="M76 56 L67 73 C62 82 52 86 42 83 L39 82 L45 90 L27 88 L35 72 L37 80 L40 81 C47 83 54 80 58 73 L67 56 Z"
      fill="#4ADE80"
    />
    {/* Arrow 3: Left / Up */}
    <Path
      d="M30 68 L20 51 C15 42 17 32 25 25 L28 23 L22 17 L40 21 L34 39 L30 31 L27 34 C21 39 19 46 23 53 L33 70 Z"
      fill="#4ADE80"
    />
    {/* Center Checkmark */}
    <Path
      d="M45 52 L50 57 L59 45"
      stroke="#16A34A"
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
