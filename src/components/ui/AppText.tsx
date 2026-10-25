import React from 'react';
import { Text, TextProps } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

interface AppTextProps extends TextProps {
  variant?: keyof typeof typography;
  color?: string;
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
}

export const AppText: React.FC<AppTextProps> = ({
  variant = 'body',
  color = colors.textPrimary,
  align = 'left',
  style,
  children,
  ...props
}) => {
  return (
    <Text
      style={[
        typography[variant],
        { color, textAlign: align },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};
