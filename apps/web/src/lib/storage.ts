import type { User } from '../types/models';

const SESSION_KEY = 'inventory-self.session';
const THEME_KEY = 'inventory-self.theme';
const ONBOARDING_WORKSPACE_KEY = 'inventory-self.onboarding-workspace';
const WORKSPACE_ACCESS_KEY = 'inventory-self.workspace-access';

export interface StoredSession {
  token: string;
  user: User | null;
}

interface WorkspaceTokenPayload {
  workspaceName?: string | null;
  cx?: string;
}

export interface StoredWorkspaceAccess {
  workspaceName: string;
  rememberedConnection: string;
  updatedAt: string;
}

function readLocalJson<T>(key: string): T | null {
  const rawValue = localStorage.getItem(key);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function readSessionJson<T>(key: string): T | null {
  const rawValue = sessionStorage.getItem(key);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

function normalizeWorkspaceKey(workspaceName: string) {
  return workspaceName.trim().toLowerCase();
}

function decodeJwtPayload<T>(token: string): T | null {
  const [, payload] = token.split('.');

  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

function getWorkspaceAccessIndex() {
  return readLocalJson<Record<string, StoredWorkspaceAccess>>(WORKSPACE_ACCESS_KEY) ?? {};
}

function setWorkspaceAccessIndex(index: Record<string, StoredWorkspaceAccess>) {
  localStorage.setItem(WORKSPACE_ACCESS_KEY, JSON.stringify(index));
}

export function getStoredSession(): StoredSession | null {
  return readLocalJson<StoredSession>(SESSION_KEY);
}

export function setStoredSession(session: StoredSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function getStoredTheme() {
  return localStorage.getItem(THEME_KEY);
}

export function setStoredTheme(theme: string) {
  localStorage.setItem(THEME_KEY, theme);
}

export function getStoredOnboardingWorkspace() {
  return readSessionJson(ONBOARDING_WORKSPACE_KEY);
}

export function setStoredOnboardingWorkspace(value: unknown) {
  sessionStorage.setItem(ONBOARDING_WORKSPACE_KEY, JSON.stringify(value));
}

export function clearStoredOnboardingWorkspace() {
  sessionStorage.removeItem(ONBOARDING_WORKSPACE_KEY);
}

export function rememberWorkspaceAccessFromToken(token: string) {
  const payload = decodeJwtPayload<WorkspaceTokenPayload>(token);
  const workspaceName = payload?.workspaceName?.trim();
  const rememberedConnection = payload?.cx?.trim();

  if (!workspaceName || !rememberedConnection) {
    return;
  }

  const index = getWorkspaceAccessIndex();
  index[normalizeWorkspaceKey(workspaceName)] = {
    workspaceName,
    rememberedConnection,
    updatedAt: new Date().toISOString()
  };
  setWorkspaceAccessIndex(index);
}

export function getStoredWorkspaceAccess(workspaceName: string) {
  if (!workspaceName.trim()) {
    return null;
  }

  const index = getWorkspaceAccessIndex();
  return index[normalizeWorkspaceKey(workspaceName)] ?? null;
}

export function clearStoredWorkspaceAccess(workspaceName?: string) {
  if (!workspaceName) {
    localStorage.removeItem(WORKSPACE_ACCESS_KEY);
    return;
  }

  const index = getWorkspaceAccessIndex();
  delete index[normalizeWorkspaceKey(workspaceName)];
  setWorkspaceAccessIndex(index);
}
