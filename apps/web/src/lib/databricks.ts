const IDENTIFIER_MAX_LENGTH = 63;
const FALLBACK_SLUG = 'workspace';

function createStableSuffix(value: string) {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36).padStart(7, '0').slice(0, 7);
}

function normalizeWorkspaceSlug(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  if (!normalized) {
    return null;
  }

  return /^[a-z_]/.test(normalized) ? normalized : `ws_${normalized}`;
}

function buildDerivedIdentifier(prefix: string, slug: string, suffix: string) {
  const maxBaseLength = IDENTIFIER_MAX_LENGTH - prefix.length - suffix.length - 1;
  const trimmedSlug =
    slug.slice(0, Math.max(maxBaseLength, 1)).replace(/_+$/g, '') || FALLBACK_SLUG;

  return `${prefix}${trimmedSlug}_${suffix}`;
}

export interface DerivedDatabricksNamespace {
  catalog: string;
  schema: string;
  slug: string;
}

export function deriveDatabricksNamespace(
  workspaceName: string
): DerivedDatabricksNamespace | null {
  const trimmedWorkspaceName = workspaceName.trim();

  if (!trimmedWorkspaceName) {
    return null;
  }

  const slug = normalizeWorkspaceSlug(trimmedWorkspaceName);

  if (!slug) {
    return null;
  }

  const suffix = createStableSuffix(trimmedWorkspaceName);

  return {
    slug,
    catalog: buildDerivedIdentifier('invself_', slug, suffix),
    schema: buildDerivedIdentifier('inventory_', slug, suffix)
  };
}
