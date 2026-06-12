import React from 'react';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, SvgProps } from 'react-native-svg';

export const LOCATION_PIN_SVG = `<svg width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="htmlPinGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#3B82F6" /><stop offset="100%" stop-color="#10B981" /></linearGradient></defs><path d="M15 2C7.27 2 1 8.27 1 16c0 9 14 21 14 21s14-12 14-21c0-7.73-6.27-14-14-14z" fill="url(#htmlPinGrad)" stroke="#FFFFFF" stroke-width="2"/><path d="M 9,21 H 21 V 15 H 18 V 18 H 17 V 14 H 13 V 18 H 12 V 15 H 9 Z M 13.5,21 V 18.5 A 1.5,1.5 0 0,1 16.5,18.5 V 21 Z M 15,14 V 10 L 18,11.5 L 15,13 Z" fill="#FFFFFF" fill-rule="evenodd"/></svg>`;

interface LocationPinProps extends SvgProps {
  width?: number;
  height?: number;
  showLandmark?: boolean;
}

export default function LocationPin({ width = 30, height = 38, showLandmark = true, ...props }: LocationPinProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 30 38" {...props}>
      <Defs>
        <SvgLinearGradient id="pinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#3B82F6" />
          <Stop offset="100%" stopColor="#10B981" />
        </SvgLinearGradient>
      </Defs>
      <Path
        d="M15 2C7.27 2 1 8.27 1 16c0 9 14 21 14 21s14-12 14-21c0-7.73-6.27-14-14-14z"
        fill="url(#pinGrad)"
        stroke="#FFFFFF"
        strokeWidth={2}
      />
      {showLandmark && (
        <Path
          d="M 9,21 H 21 V 15 H 18 V 18 H 17 V 14 H 13 V 18 H 12 V 15 H 9 Z M 13.5,21 V 18.5 A 1.5,1.5 0 0,1 16.5,18.5 V 21 Z M 15,14 V 10 L 18,11.5 L 15,13 Z"
          fill="#FFFFFF"
          fillRule="evenodd"
        />
      )}
    </Svg>
  );
}
