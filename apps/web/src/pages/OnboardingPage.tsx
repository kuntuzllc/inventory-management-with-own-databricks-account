import { useMemo, useState } from 'react';
import { Boxes } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { Button, Input } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useOnboarding } from '../contexts/OnboardingContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../lib/api';
import { deriveDatabricksNamespace } from '../lib/databricks';

const setupSteps = [
  { key: 'workspace', label: 'Workspace', caption: 'Nickname and connection' },
  { key: 'access', label: 'Access', caption: 'Token and namespace' },
  { key: 'account', label: 'Account', caption: 'Username and password' }
] as const;

export function OnboardingPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { draft, workspace, setDraft, applyMatch, clearWorkspace, clearToken } = useOnboarding();
  const { showToast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const derivedNamespace = useMemo(
    () => deriveDatabricksNamespace(draft.workspaceName),
    [draft.workspaceName]
  );

  const workspaceReady = Boolean(
    draft.workspaceName.trim() && draft.host.trim() && draft.httpPath.trim() && derivedNamespace
  );
  const accessReady = Boolean(draft.token.trim());
  const accountReady = Boolean(
    form.username.trim() && form.password.trim() && form.confirmPassword.trim()
  );

  const canVisitStep = (stepIndex: number) => {
    if (stepIndex <= currentStep) {
      return true;
    }

    if (stepIndex === 1) {
      return workspaceReady;
    }

    if (stepIndex === 2) {
      return workspaceReady && accessReady;
    }

    return false;
  };

  const resetWizard = () => {
    clearWorkspace();
    setForm({
      username: '',
      password: '',
      confirmPassword: ''
    });
    setCurrentStep(0);
  };

  const validateWorkspaceStep = () => {
    if (!draft.workspaceName.trim()) {
      showToast({
        variant: 'error',
        title: 'Workspace nickname required',
        description: 'Enter a nickname so we can generate the Databricks catalog and schema.'
      });
      return false;
    }

    if (!draft.host.trim() || !draft.httpPath.trim()) {
      showToast({
        variant: 'error',
        title: 'Workspace details required',
        description: 'Enter the Databricks host and SQL warehouse HTTP path to continue.'
      });
      return false;
    }

    if (!derivedNamespace) {
      showToast({
        variant: 'error',
        title: 'Workspace nickname invalid',
        description: 'Use letters or numbers in the nickname so we can generate the namespace.'
      });
      return false;
    }

    return true;
  };

  const validateAccessStep = () => {
    if (!draft.token.trim()) {
      showToast({
        variant: 'error',
        title: 'Token required for first-time setup',
        description:
          'Enter your Databricks personal access token so we can initialize the required tables.'
      });
      return false;
    }

    return true;
  };

  const handleNext = async () => {
    if (currentStep === 0) {
      if (!validateWorkspaceStep()) {
        return;
      }

      setCurrentStep(1);
      return;
    }

    if (currentStep === 1) {
      if (!validateWorkspaceStep() || !validateAccessStep()) {
        return;
      }

      setLoading(true);

      try {
        const payload = {
          workspaceName: draft.workspaceName,
          host: draft.host,
          httpPath: draft.httpPath,
          tablePrefix: draft.tablePrefix || null,
          ...(draft.token ? { token: draft.token } : {})
        };

        const match = await api.databricks.identifyConnection(payload);
        applyMatch(match);

        if (match.hasMatch) {
          showToast({
            variant: 'info',
            title: 'Workspace already linked',
            description:
              'Log in with the warehouse nickname, username, and password for this workspace on this browser.'
          });
          navigate('/login');
          return;
        }

        setCurrentStep(2);
      } catch (error) {
        showToast({
          variant: 'error',
          title: 'Workspace lookup failed',
          description:
            error instanceof Error ? error.message : 'Please review your Databricks details.'
        });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="auth-shell auth-shell--onboarding">
      <section className="card onboarding-card">
        <div className="onboarding-card__brand">
          <span className="onboarding-card__logo">
            <Boxes size={18} />
          </span>
          <span className="onboarding-card__brand-text">InventorySelf</span>
        </div>

        <header className="onboarding-card__intro">
          <h1>Set up your Databricks workspace</h1>
          <p>
            Connect Databricks, generate the catalog and schema from your workspace nickname, and
            create your username and password in one guided setup flow.
          </p>
          {workspace ? (
            <div className="pill-row">
              <span className="pill">
                Last workspace key: {workspace.connectionKey.slice(0, 12)}...
              </span>
            </div>
          ) : null}
        </header>

        <div className="onboarding-progress" aria-label="Setup progress">
          {setupSteps.map((step, index) => {
            const state =
              index < currentStep ? 'complete' : index === currentStep ? 'active' : 'pending';

            return (
              <button
                key={step.key}
                type="button"
                className={`onboarding-progress__item onboarding-progress__item--${state}`}
                onClick={() => {
                  if (canVisitStep(index)) {
                    setCurrentStep(index);
                  }
                }}
                disabled={!canVisitStep(index)}
                aria-current={index === currentStep ? 'step' : undefined}
              >
                <div className="onboarding-progress__meta">
                  <span className="onboarding-progress__label">{step.label}</span>
                  <span className="onboarding-progress__caption">{step.caption}</span>
                </div>
                <div className="onboarding-progress__line" />
              </button>
            );
          })}
        </div>

        <form
          className="onboarding-form"
          onSubmit={async (event) => {
            event.preventDefault();

            if (currentStep !== 2) {
              return;
            }

            setLoading(true);

            try {
              if (!validateWorkspaceStep() || !validateAccessStep()) {
                return;
              }

              if (form.password !== form.confirmPassword) {
                showToast({
                  variant: 'error',
                  title: 'Passwords do not match'
                });
                return;
              }

              await signUp({
                username: form.username,
                password: form.password,
                databricksConnection: {
                  workspaceName: draft.workspaceName,
                  host: draft.host,
                  httpPath: draft.httpPath,
                  token: draft.token,
                  tablePrefix: draft.tablePrefix || null
                }
              });

              clearToken();
              navigate('/dashboard', { replace: true });
            } catch (error) {
              showToast({
                variant: 'error',
                title: 'Account creation failed',
                description:
                  error instanceof Error
                    ? error.message
                    : 'Please review your Databricks details and account fields.'
              });
            } finally {
              setLoading(false);
            }
          }}
        >
          {currentStep === 0 ? (
            <section className="onboarding-form__section onboarding-form__section--workspace">
              <div className="onboarding-form__section-copy">
                <span className="onboarding-form__section-kicker">Workspace</span>
                <h2>Workspace details</h2>
                <p>
                  Add your Databricks connection details. The catalog and schema are generated
                  automatically from the workspace nickname.
                </p>
              </div>

              <div className="onboarding-grid">
                <div className="onboarding-grid__full">
                  <Input
                    autoFocus
                    label="Workspace nickname"
                    value={draft.workspaceName}
                    onChange={(event) => setDraft({ workspaceName: event.target.value })}
                    placeholder="Acme production warehouse"
                    hint="We derive the catalog and schema from this nickname automatically."
                    required
                  />
                </div>
                <div className="onboarding-grid__full">
                  <Input
                    label="Databricks host"
                    value={draft.host}
                    onChange={(event) => setDraft({ host: event.target.value })}
                    placeholder="dbc-fc271e0e-e88e.cloud.databricks.com"
                    hint="You can paste either the full https URL or just the hostname."
                    required
                  />
                </div>
                <div className="onboarding-grid__full">
                  <Input
                    label="SQL warehouse HTTP path"
                    value={draft.httpPath}
                    onChange={(event) => setDraft({ httpPath: event.target.value })}
                    required
                  />
                </div>
              </div>
            </section>
          ) : null}

          {currentStep === 1 ? (
            <section className="onboarding-form__section onboarding-form__section--access">
              <div className="onboarding-form__section-copy">
                <span className="onboarding-form__section-kicker">Access</span>
                <h2>Token and namespace</h2>
                <p>
                  Review the generated namespace and add the personal access token needed for
                  first-time initialization.
                </p>
              </div>

              <div className="onboarding-grid">
                <Input
                  label="Generated catalog"
                  value={derivedNamespace?.catalog ?? ''}
                  readOnly
                  placeholder="Generated from nickname"
                  hint="Created automatically during Databricks initialization."
                />
                <Input
                  label="Generated schema"
                  value={derivedNamespace?.schema ?? ''}
                  readOnly
                  placeholder="Generated from nickname"
                  hint="Created automatically inside the generated catalog."
                />
                <Input
                  label="Table prefix"
                  value={draft.tablePrefix}
                  onChange={(event) => setDraft({ tablePrefix: event.target.value })}
                  placeholder="optional_prefix"
                />
                <div className="onboarding-grid__full">
                  <Input
                    autoFocus
                    label="Personal access token"
                    type="password"
                    value={draft.token}
                    onChange={(event) => setDraft({ token: event.target.value })}
                    hint="Needed for first-time setup and saved as an encrypted workspace bundle on this browser so the shorter login form can work."
                  />
                </div>
              </div>
            </section>
          ) : null}

          {currentStep === 2 ? (
            <section className="onboarding-form__section onboarding-form__section--account">
              <div className="onboarding-form__section-copy">
                <span className="onboarding-form__section-kicker">Account</span>
                <h2>Create your login</h2>
                <p>
                  You will use the warehouse nickname, username, and password each time you return on this browser.
                </p>
              </div>

              <div className="onboarding-grid onboarding-grid--account">
                <div className="onboarding-grid__full">
                  <Input
                    autoFocus
                    label="Username"
                    value={form.username}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, username: event.target.value }))
                    }
                    placeholder="inventory_admin"
                    hint="Use letters, numbers, and underscores only."
                    required
                  />
                </div>
                <Input
                  label="Password"
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, password: event.target.value }))
                  }
                  hint="Use at least 8 characters with upper/lower case letters and a number."
                  required
                />
                <Input
                  label="Confirm password"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, confirmPassword: event.target.value }))
                  }
                  hint="Repeat the same password to finish your setup."
                  required
                />
              </div>
            </section>
          ) : null}

          <div className="onboarding-actions onboarding-actions--wizard">
            <Button type="button" variant="ghost" onClick={resetWizard}>
              Clear form
            </Button>

            <div className="onboarding-actions__primary">
              {currentStep > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCurrentStep((step) => Math.max(step - 1, 0))}
                >
                  Back
                </Button>
              ) : null}

              {currentStep < setupSteps.length - 1 ? (
                <Button type="button" loading={loading} onClick={() => void handleNext()}>
                  Next
                </Button>
              ) : (
                <Button type="submit" loading={loading}>
                  Create account
                </Button>
              )}
            </div>
          </div>

          <p className="auth-shell__footer onboarding-card__footer">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </form>
      </section>
    </div>
  );
}






