import { useRef, useCallback } from 'react';
import { useScroll } from '../context/ScrollContext';

export function useScrollToHideNav() {
  const { setScrollingUp } = useScroll();
  const lastScrollY = useRef(0);
  const scrollThreshold = 50; // Minimum scroll distance to trigger hide/show

  const handleScroll = useCallback((event: any) => {
    // Scroll state updates are currently disabled to prevent full-app re-renders during active scrolling.
    // FloatingTabBar and headers do not consume isScrollingUp, so this state was dead but caused heavy lag.
    /*
    if (event.target !== event.currentTarget) {
      return;
    }
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDifference = currentScrollY - lastScrollY.current;

    // Only update if scroll difference is significant
    if (Math.abs(scrollDifference) > scrollThreshold) {
      if (scrollDifference > 0 && currentScrollY > scrollThreshold) {
        // Scrolling down (content going up) - hide navbar
        setScrollingUp(true);
      } else if (scrollDifference < 0) {
        // Scrolling up (content going down) - show navbar
        setScrollingUp(false);
      }
      lastScrollY.current = currentScrollY;
    }
    */
  }, []);

  return { handleScroll };
}

