import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';

interface MarqueeTextProps {
  text: string;
  style?: any;
  containerStyle?: any;
  icon?: React.ReactNode;
}

export const MarqueeText = React.memo(({ text, style, containerStyle, icon }: MarqueeTextProps) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    animatedValue.setValue(0);
    if (textWidth > 0 && containerWidth > 0 && textWidth > containerWidth) {
      const offset = textWidth - containerWidth + 24; // 24px extra buffer
      
      const startAnimation = () => {
        Animated.loop(
          Animated.sequence([
            Animated.delay(1500),
            Animated.timing(animatedValue, {
              toValue: -offset,
              duration: offset * 30, // 30ms per pixel
              useNativeDriver: true,
            }),
            Animated.delay(1500),
            Animated.timing(animatedValue, {
              toValue: 0,
              duration: offset * 30,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };

      startAnimation();
    }
    return () => {
      animatedValue.stopAnimation();
    };
  }, [textWidth, containerWidth, text]);

  const onTextLayout = (e: any) => {
    const { width } = e.nativeEvent.layout;
    setTextWidth(width);
  };

  const onContainerLayout = (e: any) => {
    const { width } = e.nativeEvent.layout;
    setContainerWidth(width);
  };

  return (
    <View 
      style={[{ flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }, containerStyle]}
      onLayout={onContainerLayout}
    >
      {icon}
      <View style={{ overflow: 'hidden', flex: 1, marginLeft: icon ? 6 : 0 }}>
        <Animated.View
          style={{
            flexDirection: 'row',
            transform: [{ translateX: animatedValue }],
            alignSelf: 'flex-start',
          }}
        >
          <Text
            style={[style, { flexShrink: 0, flexGrow: 0 }]}
            onLayout={onTextLayout}
            numberOfLines={1}
          >
            {text}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
});

MarqueeText.displayName = 'MarqueeText';
