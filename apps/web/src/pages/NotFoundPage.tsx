import { Link } from 'react-router-dom';

import { Button, Card } from '../components/ui';

export function NotFoundPage() {
  return (
    <div className="page-section">
      <Card title="Page not found" description="The route you opened does not exist in this workspace.">
        <div className="stack">
          <p>Use the main navigation to get back to your dashboard, inventory, imports, reports, or settings.</p>
          <div>
            <Link to="/dashboard">
              <Button>Go to dashboard</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
