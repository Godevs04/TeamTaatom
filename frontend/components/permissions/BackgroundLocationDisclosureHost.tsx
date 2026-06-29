import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackgroundLocationDisclosureModal } from './BackgroundLocationDisclosureModal';
import {
  registerBackgroundLocationDisclosureHandler,
  type BackgroundLocationDisclosureResult,
} from '../../services/backgroundLocationDisclosure';

type Resolver = (value: BackgroundLocationDisclosureResult) => void;

/**
 * Mount once near the app root. Registers the prominent disclosure modal so
 * journey tracking can await user consent before the OS background-location prompt.
 */
export function BackgroundLocationDisclosureHost() {
  const [visible, setVisible] = useState(false);
  const resolverRef = useRef<Resolver | null>(null);

  const finish = useCallback((result: BackgroundLocationDisclosureResult) => {
    setVisible(false);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(result);
  }, []);

  useEffect(() => {
    registerBackgroundLocationDisclosureHandler(() => {
      return new Promise<BackgroundLocationDisclosureResult>((resolve) => {
        resolverRef.current = resolve;
        setVisible(true);
      });
    });

    return () => {
      registerBackgroundLocationDisclosureHandler(null);
      resolverRef.current = null;
    };
  }, []);

  return (
    <BackgroundLocationDisclosureModal
      visible={visible}
      onAccept={() => finish('accept')}
      onDecline={() => finish('decline')}
    />
  );
}
