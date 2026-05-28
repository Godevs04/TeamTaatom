import React from 'react';
import { Text, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

interface GradientTextProps {
  text: string;
  style?: TextStyle | TextStyle[];
}

export const GradientText = ({ text, style }: GradientTextProps) => {
  // Aggressively kill any inherited glow/shadow properties
  const noGlowStyle = [
    style, 
    { 
      textShadowColor: 'transparent', 
      textShadowRadius: 0, 
      textShadowOffset: { width: 0, height: 0 },
      elevation: 0 
    }
  ];

  return (
    <MaskedView maskElement={<Text style={[noGlowStyle, { backgroundColor: 'transparent' }]}>{text}</Text>}>
      <LinearGradient colors={['#1C73B4', '#50C878']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={[noGlowStyle, { opacity: 0 }]}>{text}</Text>
      </LinearGradient>
    </MaskedView>
  );
};

export default GradientText;
