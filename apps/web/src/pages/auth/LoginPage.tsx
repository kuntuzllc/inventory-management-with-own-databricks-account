import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { Button, Card, Input } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useToast } from '../../contexts/ToastContext';
import { getStoredWorkspaceAccess } from '../../lib/storage';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { draft, workspace, setDraft } = useOnboarding();
  const { showToast } = useToast();
  const [workspaceName, setWorkspaceName] = useState(workspace?.workspaceName ?? draft.workspaceName);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/dashboard';
  const rememberedWorkspace = useMemo(
    () => getStoredWorkspaceAccess(workspaceName),
    [workspaceName]
  );

  return (
    <div className="auth-shell">
      <div className="auth-shell__hero">
        <span className="brand-panel__eyebrow">Inventory SaaS</span>
        <h1>Stay ahead of stock, sales, and tax season.</h1>
        <p>
          Sign in with your warehouse nickname, username, and password. This browser will reuse the
          workspace access that was saved during setup.
        </p>
        {workspace ? (
          <p>
            Last workspace: <strong>{workspace.workspaceName ?? 'Databricks workspace'}</strong>
          </p>
        ) : null}
      </div>
      <Card title="Log in" description="Reconnect to your inventory workspace.">
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            setLoading(true);

            try {
              if (!rememberedWorkspace) {
                showToast({
                  variant: 'error',
                  title: 'Workspace not saved on this browser',
                  description:
                    'Set up this warehouse once from the Databricks page on this browser before using the shorter login form.'
                });
                return;
              }

              await login({
                workspaceName,
                username,
                password,
                rememberedConnection: rememberedWorkspace.rememberedConnection
              });
              setDraft({ workspaceName });
              navigate(redirectTo, { replace: true });
            } catch (error) {
              showToast({
                variant: 'error',
                title: 'Login failed',
                description: error instanceof Error ? error.message : 'Please try again.'
              });
            } finally {
              setLoading(false);
            }
          }}
        >
          {rememberedWorkspace ? (
            <p className="auth-shell__footer">
              Saved workspace access found for this browser. Last updated:{' '}
              {new Date(rememberedWorkspace.updatedAt).toLocaleString()}
            </p>
          ) : (
            <p className="auth-shell__footer">
              No saved workspace access found yet. Use the Databricks setup page first.
            </p>
          )}
          <Input
            label="Warehouse nickname"
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.target.value)}
            placeholder="Acme production warehouse"
            required
          />
          <Input
            label="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="inventory_admin"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Button type="submit" loading={loading} disabled={!rememberedWorkspace}>
            Log in
          </Button>
          <p className="auth-shell__footer">
            Need an account? <Link to="/">Create one on the Databricks page</Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
