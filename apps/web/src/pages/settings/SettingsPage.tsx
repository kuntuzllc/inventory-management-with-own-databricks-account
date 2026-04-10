import { useEffect, useMemo, useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { Badge, Button, Card, Input } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../lib/api';
import { clearStoredWorkspaceAccess } from '../../lib/storage';
import { deriveDatabricksNamespace } from '../../lib/databricks';
import type { ConnectionStatus, DatabricksConnectionInput } from '../../types/models';

const statusToneMap: Record<ConnectionStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  pending: 'warning',
  connected: 'success',
  failed: 'danger',
  initialized: 'info',
  disconnected: 'neutral'
};

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, setSession } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const connectionQuery = useQuery({
    queryKey: ['databricks-connection'],
    queryFn: api.databricks.getConnection
  });
  const connection = connectionQuery.data?.connection ?? null;
  const [form, setForm] = useState({
    workspaceName: '',
    host: '',
    httpPath: '',
    token: '',
    tablePrefix: ''
  });
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    if (!connection) {
      return;
    }

    setForm({
      workspaceName: connection.workspaceName ?? '',
      host: connection.host,
      httpPath: connection.httpPath,
      token: '',
      tablePrefix: connection.tablePrefix ?? ''
    });
  }, [connection]);

  const derivedNamespace = useMemo(
    () => deriveDatabricksNamespace(form.workspaceName),
    [form.workspaceName]
  );

  const payload = useMemo(() => {
    const result: DatabricksConnectionInput = {
      workspaceName: form.workspaceName,
      host: form.host,
      httpPath: form.httpPath,
      tablePrefix: form.tablePrefix || null
    };

    if (form.token.trim()) {
      result.token = form.token.trim();
    }

    return result;
  }, [form]);

  const refreshConnection = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['databricks-connection'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
    ]);
  };

  const syncSessionToken = (token: string) => {
    if (!user) {
      return;
    }

    setSession({ token, user });
  };

  return (
    <div className="page-section">
      <header className="page-header">
        <div>
          <span className="page-header__eyebrow">Settings</span>
          <h1>Databricks connection</h1>
          <p>
            Your account metadata and inventory tables live in this Databricks workspace. To switch
            to a different workspace entirely, sign out and log back in with the new details.
          </p>
        </div>
        {connection ? (
          <Badge tone={statusToneMap[connection.connectionStatus]}>{connection.connectionStatus}</Badge>
        ) : null}
      </header>

      <Card
        title="Workspace connection"
        description="The current session uses an encrypted Databricks connection token. Updating the token here refreshes your session immediately."
      >
        {connection ? (
          <div className="pill-row">
            <span className="pill">Connection key: {connection.connectionKey.slice(0, 12)}...</span>
          </div>
        ) : null}
        <div className="form-grid">
          <Input
            label="Workspace nickname"
            value={form.workspaceName}
            onChange={(event) =>
              setForm((current) => ({ ...current, workspaceName: event.target.value }))
            }
            placeholder="Acme production warehouse"
            hint="Use the login flow if you need to switch to a different workspace."
            required
            readOnly
          />
          <Input
            label="Databricks host"
            value={form.host}
            onChange={(event) => setForm((current) => ({ ...current, host: event.target.value }))}
            placeholder="dbc-fc271e0e-e88e.cloud.databricks.com"
            hint="Full https URLs are accepted and normalized automatically."
            required
            readOnly
          />
          <Input
            label="SQL warehouse HTTP path"
            value={form.httpPath}
            onChange={(event) =>
              setForm((current) => ({ ...current, httpPath: event.target.value }))
            }
            required
            readOnly
          />
          <Input
            label="Generated catalog"
            value={derivedNamespace?.catalog ?? connection?.catalog ?? ''}
            readOnly
            placeholder="Generated from nickname"
            hint="Created automatically when you initialize the workspace."
          />
          <Input
            label="Generated schema"
            value={derivedNamespace?.schema ?? connection?.schema ?? ''}
            readOnly
            placeholder="Generated from nickname"
            hint="Created automatically inside the generated catalog."
          />
          <Input
            label="Table prefix"
            value={form.tablePrefix}
            onChange={(event) =>
              setForm((current) => ({ ...current, tablePrefix: event.target.value }))
            }
            placeholder="optional_prefix"
          />
          <Input
            label="Personal access token"
            type="password"
            value={form.token}
            onChange={(event) => setForm((current) => ({ ...current, token: event.target.value }))}
            hint={
              connection?.tokenMask
                ? `Saved token: ${connection.tokenMask}`
                : 'Stored encrypted in your Databricks workspace metadata and never returned after save.'
            }
            placeholder={connection?.tokenMask ?? 'Enter a new token'}
          />
        </div>

        <div className="button-row">
          <Button
            loading={busyAction === 'save'}
            onClick={async () => {
              setBusyAction('save');
              try {
                const result = await api.databricks.saveConnection(payload);
                syncSessionToken(result.token);
                showToast({ variant: 'success', title: 'Connection saved' });
                setForm((current) => ({ ...current, token: '' }));
                await refreshConnection();
              } catch (error) {
                showToast({
                  variant: 'error',
                  title: 'Save failed',
                  description:
                    error instanceof Error ? error.message : 'Please review your values.'
                });
              } finally {
                setBusyAction(null);
              }
            }}
          >
            {connection ? 'Update token / prefix' : 'Save connection'}
          </Button>

          <Button
            variant="secondary"
            loading={busyAction === 'test'}
            onClick={async () => {
              setBusyAction('test');
              try {
                const result = await api.databricks.testConnection(payload);
                syncSessionToken(result.token);
                showToast({ variant: 'success', title: result.message });
                await refreshConnection();
              } catch (error) {
                showToast({
                  variant: 'error',
                  title: 'Connection test failed',
                  description:
                    error instanceof Error ? error.message : 'Please review your values.'
                });
              } finally {
                setBusyAction(null);
              }
            }}
          >
            Test connection
          </Button>

          <Button
            variant="ghost"
            loading={busyAction === 'initialize'}
            disabled={!connection}
            onClick={async () => {
              setBusyAction('initialize');
              try {
                const result = await api.databricks.initializeConnection();
                syncSessionToken(result.token);
                showToast({ variant: 'success', title: result.message });
                await refreshConnection();
              } catch (error) {
                showToast({
                  variant: 'error',
                  title: 'Initialization failed',
                  description: error instanceof Error ? error.message : 'Please try again.'
                });
              } finally {
                setBusyAction(null);
              }
            }}
          >
            Initialize tables
          </Button>

          <Button
            variant="danger"
            loading={busyAction === 'disconnect'}
            disabled={!connection}
            onClick={async () => {
              setBusyAction('disconnect');
              try {
                await api.databricks.disconnectConnection();
                setSession(null);
                showToast({ variant: 'success', title: 'Connection removed' });
                navigate('/', { replace: true });
              } catch (error) {
                showToast({
                  variant: 'error',
                  title: 'Disconnect failed',
                  description: error instanceof Error ? error.message : 'Please try again.'
                });
              } finally {
                setBusyAction(null);
              }
            }}
          >
            Disconnect
          </Button>
        </div>
      </Card>
    </div>
  );
}


