'use client';
import { useEffect } from 'react';
import { initTVNavigation } from '@/lib/tv-navigation';

/**
 * Initialises D-pad / arrow-key spatial navigation.
 * Works on TVs, keyboard-only users, and devices without a pointer.
 * Renders nothing — side-effect only.
 */
export default function TVNavigationInit() {
  useEffect(() => {
    initTVNavigation();
  }, []);
  return null;
}
