import React, { useState, useEffect, useRef, useImperativeHandle } from 'react';
import { View, Platform } from 'react-native';
import { Marker } from '../utils/mapsWrapper';

interface SafeMarkerProps {
  children: React.ReactNode;
  repaintTriggers?: any[];
  [key: string]: any;
}

const SafeMarker = React.forwardRef(({ children, repaintTriggers = [], ...props }: SafeMarkerProps, ref: any) => {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const isMounted = useRef(true);
  const markerRef = useRef<any>(null);

  // iOS is given a slightly longer time (500ms vs 250ms) to ensure custom graphics finish layout/rendering on MapKit
  const repaintDuration = Platform.OS === 'ios' ? 500 : 250;

  useImperativeHandle(ref, () => ({
    repaint: () => {
      setTracksViewChanges(true);
      const timer = setTimeout(() => {
        if (isMounted.current) {
          setTracksViewChanges(false);
        }
      }, repaintDuration);
    },
    // Forward native marker methods if they exist
    animateMarkerToCoordinate: (coor: any, duration: any) => {
      markerRef.current?.animateMarkerToCoordinate?.(coor, duration);
    },
    showCallout: () => {
      markerRef.current?.showCallout?.();
    },
    hideCallout: () => {
      markerRef.current?.hideCallout?.();
    },
    redrawCallout: () => {
      markerRef.current?.redrawCallout?.();
    },
    redraw: () => {
      markerRef.current?.redraw?.();
    }
  }));

  useEffect(() => {
    isMounted.current = true;
    setTracksViewChanges(true);
    const timer = setTimeout(() => {
      if (isMounted.current) {
        setTracksViewChanges(false);
      }
    }, repaintDuration);
    return () => {
      isMounted.current = false;
      clearTimeout(timer);
    };
  }, []);

  const prevTriggers = useRef(repaintTriggers);
  useEffect(() => {
    const hasChanged = repaintTriggers.some((val, idx) => val !== prevTriggers.current[idx]);
    if (hasChanged) {
      prevTriggers.current = repaintTriggers;
      setTracksViewChanges(true);
      const timer = setTimeout(() => {
        if (isMounted.current) {
          setTracksViewChanges(false);
        }
      }, repaintDuration);
      return () => clearTimeout(timer);
    }
  }, [repaintTriggers]);

  if (!Marker) return null;

  // On iOS, we now allow tracksViewChanges to go false dynamically, preventing heavy 
  // rendering overhead on MapKit and fixing disappearing custom markers.
  const activeTracksViewChanges = tracksViewChanges;

  const lastPressTime = useRef(0);
  const handlePress = (event: any) => {
    const now = Date.now();
    if (now - lastPressTime.current < 500) return;
    lastPressTime.current = now;
    if (props.onPress) {
      props.onPress(event);
    }
  };

  const handleSelect = (event: any) => {
    const now = Date.now();
    if (now - lastPressTime.current < 500) return;
    lastPressTime.current = now;
    if (props.onSelect) {
      props.onSelect(event);
    } else if (props.onPress) {
      props.onPress(event);
    }
  };

  return (
    <Marker
      ref={markerRef}
      {...props}
      onPress={handlePress}
      onSelect={handleSelect}
      tracksViewChanges={activeTracksViewChanges}
    >
      <View pointerEvents="none">
        {children}
      </View>
    </Marker>
  );
});

export default React.memo(SafeMarker);
