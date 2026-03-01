import { useEffect, useRef } from 'react';
import { useEnsureViewer, useSeedInitialData } from '@/lib/localBackend';

export function useBootstrap(enabled: boolean) {
  const ensureViewer = useEnsureViewer();
  const seedInitialData = useSeedInitialData();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      try {
        await ensureViewer();
        await seedInitialData({});
      } catch {
        // Best effort bootstrap for demo data.
      }
    })();
  }, [enabled, ensureViewer, seedInitialData]);
}
