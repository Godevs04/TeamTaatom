import React from 'react';
import { Text, TextProps } from 'react-native';
import { useScaledTheme } from '../hooks/useScaledTheme';

interface ScaledTextProps extends TextProps {
  /**
   * Typography style to use (h1, h2, h3, body, caption, small)
   * If not provided, uses body as default
   */
  typography?: 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'small';
  /**
   * Base font size (used if typography is not specified)
   */
  baseFontSize?: number;
}

/**
 * Text component that automatically scales font size based on user preference
 * Use this instead of regular Text component for font size scaling
 */
export const ScaledText: React.FC<ScaledTextProps> = ({ 
  typography, 
  baseFontSize,
  style,
  ...props 
}) => {
  const { typography: scaledTypography, scaleFontSize } = useScaledTheme();
  
  let fontSize: number;
  if (typography) {
    fontSize = scaledTypography[typography].fontSize;
  } else if (baseFontSize) {
    fontSize = scaleFontSize(baseFontSize);
  } else {
    fontSize = scaledTypography.body.fontSize;
  }
  
  return (
    <Text 
      style={[
        { fontSize },
        style
      ]} 
      {...props} 
    />
  );
};

export default ScaledText;
