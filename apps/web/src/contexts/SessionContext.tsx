import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';

import { api } from '../lib/api';
import { useAuth } from './AuthContext';

interface SessionContextValue {
  isBootstrapping: boolean;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { token, user, updateUser, setSession } = useAuth();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const bootstrappedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token) {
      bootstrappedTokenRef.current = null;
      updateUser(null);
      setIsBootstrapping(false);
      return;
    }

    if (bootstrappedTokenRef.current === token || user) {
      bootstrappedTokenRef.current = token;
      setIsBootstrapping(false);
      return;
    }

    let cancelled = false;
    bootstrappedTokenRef.current = token;
    setIsBootstrapping(true);

    void (async () => {
      try {
        const { user: currentUser } = await api.auth.me();

        if (!cancelled) {
          updateUser(currentUser);
        }
      } catch {
        if (!cancelled) {
          setSession(null);
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, user, updateUser, setSession]);

  const value = useMemo(
    () => ({
      isBootstrapping,
      refreshSession: async () => {
        if (!token) {
          setSession(null);
          setIsBootstrapping(false);
          return;
        }

        setIsBootstrapping(true);

        try {
          const { user: currentUser } = await api.auth.me();
          updateUser(currentUser);
          bootstrappedTokenRef.current = token;
        } catch {
          setSession(null);
        } finally {
          setIsBootstrapping(false);
        }
      }
    }),
    [isBootstrapping, token, updateUser, setSession]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used inside SessionProvider');
  }

  return context;
}
