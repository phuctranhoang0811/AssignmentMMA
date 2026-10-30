import React from 'react';
import Svg, { Path, Polygon, Circle, G } from 'react-native-svg';

// Party Popper Celebration SVG for Step 4
export const CelebrationPopper = () => (
  <Svg width={120} height={120} viewBox="0 0 120 120" fill="none">
    {/* Confetti streamers */}
    <Path d="M60 45 C65 25, 75 20, 85 22" stroke="#00B4D8" strokeWidth={5} strokeLinecap="round" />
    <Path d="M52 42 C45 28, 50 15, 60 12" stroke="#FFB703" strokeWidth={4} strokeLinecap="round" />
    <Path d="M68 48 C80 38, 92 40, 96 32" stroke="#E63946" strokeWidth={4} strokeLinecap="round" />

    {/* Stars / Confetti dots */}
    <Circle cx="40" cy="30" r="3.5" fill="#E63946" />
    <Circle cx="72" cy="18" r="4" fill="#00B4D8" />
    <Circle cx="88" cy="42" r="3" fill="#FFB703" />
    <Circle cx="48" cy="16" r="3" fill="#FB8500" />
    <Circle cx="98" cy="24" r="2.5" fill="#E63946" />

    {/* Sparkle Stars */}
    <Path d="M42 24 L44 19 L46 24 L51 26 L46 28 L44 33 L42 28 L37 26 Z" fill="#FFB703" />
    <Path d="M78 32 L79.5 28 L81 32 L85 33.5 L81 35 L79.5 39 L78 35 L74 33.5 Z" fill="#FB8500" />

    {/* Party Cone with Stripes */}
    <G transform="rotate(35 50 75)">
      {/* Base Cone */}
      <Polygon points="50,40 25,95 75,95" fill="#FB8500" />
      {/* Red Stripes */}
      <Polygon points="40,62 33,78 67,78 60,62" fill="#E63946" />
      <Polygon points="46,48 43,55 57,55 54,48" fill="#E63946" />
      <Polygon points="28,88 25,95 75,95 72,88" fill="#E63946" />
    </G>
  </Svg>
);
