import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';

// Sentry is fully gated on the DSN env var: when EXPO_PUBLIC_SENTRY_DSN is
// unset (local dev, CI) every export here is a no-op.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const sentryEnabled = !!SENTRY_DSN;

let initialized = false;

/** Initialize Sentry once at app startup. No-op when no DSN is configured. */
export function initSentry(): void {
  if (!sentryEnabled || initialized) return;
  initialized = true;
  Sentry.init({
    dsn: SENTRY_DSN,
    // Keep performance sampling modest — enough signal without cost blowup.
    tracesSampleRate: 0.2,
    // Never attach user IP / device identifiers as PII.
    sendDefaultPii: false,
    enableAutoSessionTracking: true,
  });
}

/**
 * Wrap the root component with Sentry's error boundary + profiler.
 * Returns the component unchanged when Sentry is disabled.
 */
export function wrapRootComponent<P extends Record<string, unknown>>(
  component: ComponentType<P>,
): ComponentType<P> {
  return sentryEnabled ? Sentry.wrap(component) : component;
}
