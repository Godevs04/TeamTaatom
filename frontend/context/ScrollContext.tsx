import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface ScrollContextType {
  isScrollingUp: boolean;
  setScrollingUp: (value: boolean) => void;
}

const ScrollContext = createContext<ScrollContextType | undefined>(undefined);

export function ScrollProvider({ children }: { children: React.ReactNode }) {
  const [isScrollingUp, setIsScrollingUp] = useState(false);

  const setScrollingUp = useCallback((value: boolean) => {
    setIsScrollingUp(value);
  }, []);

  const value = useMemo(() => ({ isScrollingUp, setScrollingUp }), [isScrollingUp, setScrollingUp]);

  return (
    <ScrollContext.Provider value={value}>
      {children}
    </ScrollContext.Provider>
  );
}

export function useScroll() {
  const context = useContext(ScrollContext);
  if (!context) {
    throw new Error('useScroll must be used within ScrollProvider');
  }
  return context;
}

