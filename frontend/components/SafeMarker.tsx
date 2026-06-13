import React, { useState, useEffect, useRef, useImperativeHandle } from 'react';
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

  useImperativeHandle(ref, () => ({
    repaint: () => {
      setTracksViewChanges(true);
      const timer = setTimeout(() => {
        if (isMounted.current) {
          setTracksViewChanges(false);
        }
      }, 250);
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
    }, 250);
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
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [repaintTriggers]);

  if (!Marker) return null;

  return (
    <Marker ref={markerRef} {...props} tracksViewChanges={tracksViewChanges}>
      {children}
    </Marker>
  );
});

export default React.memo(SafeMarker);
