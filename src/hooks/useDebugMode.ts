import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

export function useDebugMode(debugEnabledFromUser: boolean | undefined) {
  const location = useLocation();

  return useMemo(() => {
    const params = new URLSearchParams(location.search);
    const queryDebugRequested = params.get('debug') === '1';

    const nonProdDebug = queryDebugRequested && !import.meta.env.PROD;
    const adminDebug = queryDebugRequested && !!debugEnabledFromUser;

    return !!debugEnabledFromUser || nonProdDebug || adminDebug;
  }, [debugEnabledFromUser, location.search]);
}
