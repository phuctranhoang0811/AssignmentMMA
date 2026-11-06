import React from 'react';
import { Text, TextProps } from 'react-native';

export const StyledText: React.FC<TextProps> = (props) => {
  return <Text {...props} />;
};

export default StyledText;

