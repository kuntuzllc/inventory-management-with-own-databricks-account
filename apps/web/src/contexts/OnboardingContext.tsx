import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';

import {
  clearStoredOnboardingWorkspace,
  getStoredOnboardingWorkspace,
  setStoredOnboardingWorkspace
} from '../lib/storage';
import type {
  DatabricksConnectionMatch,
  StoredOnboardingWorkspace
} from '../types/models';

type OnboardingDraft = {
  workspaceName: string;
  host: string;
  httpPath: string;
  token: string;
  tablePrefix: string;
};

interface OnboardingContextValue {
  draft: OnboardingDraft;
  workspace: StoredOnboardingWorkspace | null;
  setDraft: (patch: Partial<OnboardingDraft>) => void;
  applyMatch: (match: DatabricksConnectionMatch, patch?: Partial<OnboardingDraft>) => void;
  clearToken: () => void;
  clearWorkspace: () => void;
}

const blankDraft: OnboardingDraft = {
  workspaceName: '',
  host: '',
  httpPath: '',
  token: '',
  tablePrefix: ''
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const storedWorkspace = getStoredOnboardingWorkspace() as StoredOnboardingWorkspace | null;
  const [draft, setDraftState] = useState<OnboardingDraft>(() => ({
    ...blankDraft,
    workspaceName: storedWorkspace?.workspaceName ?? '',
    host: storedWorkspace?.host ?? '',
    httpPath: storedWorkspace?.httpPath ?? '',
    tablePrefix: storedWorkspace?.tablePrefix ?? ''
  }));
  const [workspace, setWorkspace] = useState<StoredOnboardingWorkspace | null>(storedWorkspace);

  useEffect(() => {
    if (!workspace) {
      clearStoredOnboardingWorkspace();
      return;
    }

    setStoredOnboardingWorkspace(workspace);
  }, [workspace]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      draft,
      workspace,
      setDraft: (patch) => {
        setDraftState((current) => ({
          ...current,
          ...patch
        }));
      },
      applyMatch: (match, patch) => {
        const nextDraft = {
          ...draft,
          ...patch
        };
        setDraftState(nextDraft);
        setWorkspace({
          connectionKey: match.connectionKey,
          workspaceName: match.workspaceName ?? nextDraft.workspaceName ?? null,
          host: nextDraft.host,
          httpPath: nextDraft.httpPath,
          catalog: match.catalog,
          schema: match.schema,
          tablePrefix: nextDraft.tablePrefix || null,
          hasMatch: match.hasMatch
        });
      },
      clearToken: () => {
        setDraftState((current) => ({
          ...current,
          token: ''
        }));
      },
      clearWorkspace: () => {
        setDraftState(blankDraft);
        setWorkspace(null);
      }
    }),
    [draft, workspace]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);

  if (!context) {
    throw new Error('useOnboarding must be used inside OnboardingProvider');
  }

  return context;
}
