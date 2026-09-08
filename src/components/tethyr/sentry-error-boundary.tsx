import type { ReactElement, ReactNode } from "react";
import * as Sentry from "@sentry/react";

export function SentryErrorBoundary({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactElement;
}) {
  return (
    <Sentry.ErrorBoundary onError={(error) => Sentry.captureException(error)} fallback={fallback}>
      {children}
    </Sentry.ErrorBoundary>
  );
}
