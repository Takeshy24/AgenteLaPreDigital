import { useCallback, useState } from 'react';
import { Layout } from './components/Layout';
import { Empty } from './components/ui';
import { LeadForm } from './features/leads/LeadForm';
import { LeadTable } from './features/leads/LeadTable';
import './live.css';
import { Catalog } from './pages/Catalog';
import { Followup } from './pages/Followup';
import { Integrations } from './pages/Integrations';
import { Kpis } from './pages/Kpis';
import { Overview } from './pages/Overview';
import { Profile } from './pages/Profile';
import { WorkspaceProvider, useWorkspace } from './state/Workspace';
function WorkspaceView() {
  const { data, selected, page, error } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const closeForm = useCallback(() => setCreating(false), []);
  return (
    <Layout onCreate={() => setCreating(true)}>
      {!data && !error && <Empty>Cargando SQL Server…</Empty>}
      {data && selected && <Profile key={selected.id} />}
      {data && !selected && page === 'overview' && <Overview />}
      {data && !selected && page === 'leads' && <LeadTable />}
      {data && !selected && page === 'catalog' && <Catalog />}
      {data && !selected && page === 'followup' && <Followup />}
      {data && !selected && page === 'kpis' && <Kpis />}
      {data && !selected && page === 'integrations' && <Integrations />}
      {creating && <LeadForm onClose={closeForm} />}
    </Layout>
  );
}
export default function LiveApp() {
  return (
    <WorkspaceProvider>
      <WorkspaceView />
    </WorkspaceProvider>
  );
}
