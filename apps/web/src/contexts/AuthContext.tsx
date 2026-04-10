import {
  createContext,
  startTransition,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';

import { api, configureApi } from '../lib/api';
import {
  clearStoredSession,
  getStoredSession,
  rememberWorkspaceAccessFromToken,
  setStoredSession,
  type StoredSession
} from '../lib/storage';
import type { DatabricksConnectionInput, User } from '../types/models';

interface AuthContextValue {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (payload: {
    workspaceName: string;
    username: string;
    password: string;
    rememberedConnection: string;
  }) => Promise<void>;
  signUp: (payload: {
    username: string;
    password: string;
    databricksConnection: DatabricksConnectionInput & { token: string };
  }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User | null) => void;
  setSession: (session: StoredSession | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const storedSession = getStoredSession();
  const [token, setToken] = useState<string | null>(storedSession?.token ?? null);
  const [user, setUser] = useState<User | null>(storedSession?.user ?? null);

  useLayoutEffect(() => {
    configureApi({
      getToken: () => token,
      onUnauthorized: () => {
        startTransition(() => {
          setToken(null);
          setUser(null);
          clearStoredSession();
        });
      }
    });
  }, [token]);

  const setSession = (session: StoredSession | null) => {
    startTransition(() => {
      setToken(session?.token ?? null);
      setUser(session?.user ?? null);
    });

    if (session) {
      rememberWorkspaceAccessFromToken(session.token);
      setStoredSession(session);
    } else {
      clearStoredSession();
    }
  };

  const login = async (payload: {
    workspaceName: string;
    username: string;
    password: string;
    rememberedConnection: string;
  }) => {
    const session = await api.auth.login(payload);
    setSession(session);
  };

  const signUp = async (payload: {
    username: string;
    password: string;
    databricksConnection: DatabricksConnectionInput & { token: string };
  }) => {
    const session = await api.auth.signUp(payload);
    setSession(session);
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } finally {
      setSession(null);
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      login,
      signUp,
      logout,
      updateUser: (nextUser) => {
        setUser(nextUser);

        if (token) {
          setStoredSession({
            token,
            user: nextUser
          });
        }
      },
      setSession
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
