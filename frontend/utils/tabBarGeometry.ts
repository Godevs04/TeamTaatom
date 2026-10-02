import { useSyncExternalStore } from 'react';

export type TabBarGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

let current: TabBarGeometry | null = null;
const listeners = new Set<() => void>();

export function setTabBarGeometry(next: TabBarGeometry | null) {
  if (
    current &&
    next &&
    Math.abs(current.x - next.x) < 0.5 &&
    Math.abs(current.y - next.y) < 0.5 &&
    Math.abs(current.width - next.width) < 0.5 &&
    Math.abs(current.height - next.height) < 0.5
  ) {
    return;
  }
  current = next;
  listeners.forEach((l) => l());
}

export function getTabBarGeometry() {
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Window-space frame of the floating tab bar, or null until it has been measured. */
export function useTabBarGeometry() {
  return useSyncExternalStore(subscribe, getTabBarGeometry, getTabBarGeometry);
}
