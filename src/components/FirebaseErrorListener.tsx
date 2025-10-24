'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/lib/error-emitter';
import { FirestorePermissionError } from '@/lib/errors';

// This is a client component that listens for 'permission-error' events
// and throws them to be caught by Next.js's error overlay.
// This should be placed in your root layout or a global provider.
export function FirebaseErrorListener() {
  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // Throw the error so Next.js Development Error Overlay can catch it.
      // This provides a much better debugging experience than just console.logging.
      throw error;
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  return null;
}
