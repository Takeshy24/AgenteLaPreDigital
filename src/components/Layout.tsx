import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Database,
  Files,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  Users,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useAuth } from '../state/Auth';
import { useWorkspace, type Page } from '../state/Workspace';
import { Button } from './ui';
const navigation = [
  { id: 'overview', name: 'Inicio', icon: LayoutDashboard },
  { id: 'leads', name: 'LEADS y casos', icon: Users },
  { id: 'pending', name: 'Pendientes', icon: ClipboardList },
  { id: 'catalog', name: 'Catálogo', icon: BookOpen },
  { id: 'followup', name: 'Seguimiento', icon: CalendarDays },
  { id: 'kpis', name: 'Indicadores', icon: BarChart3 },
  { id: 'integrations', name: 'Agente e integraciones', icon: Settings },
  { id: 'knowledge', name: 'Conocimiento', icon: Files },
  { id: 'agent-rules', name: 'Reglas del agente', icon: GitBranch },
] satisfies { id: Page; name: string; icon: typeof Users }[];
export function Layout({ children, onCreate }: { children: ReactNode; onCreate: () => void }) {
  const {
    data,
    page,
    selected,
    error,
    notice,
    reload,
    setError,
    setNotice,
    navigate,
    unsavedChanges,
  } = useWorkspace();
  const { signOut } = useAuth();
  const [leaving, setLeaving] = useState(false);
  async function logout() {
    if (
      leaving ||
      (unsavedChanges &&
        !window.confirm('Tienes cambios sin guardar. ¿Cerrar sesión y descartarlos?'))
    )
      return;
    setLeaving(true);
    try {
      await signOut();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setLeaving(false);
    }
  }
  return (
    <div className={`app-shell live-app page-${page}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Database size={19} />
          </div>
          <div>
            <b>LaPreDigital</b>
            <span>NEGOCIACIONES</span>
          </div>
        </div>
        <div className="workspace">
          <Database size={18} />
          <div>
            <b>Operación UNT</b>
            <span>Administración local</span>
          </div>
        </div>
        {navigation.map((item) => (
          <button
            key={item.id}
            aria-current={page === item.id ? 'page' : undefined}
            className={'nav-item ' + (page === item.id ? 'active' : '')}
            title={item.name}
            aria-label={item.name}
            onClick={() => navigate(item.id)}
          >
            <item.icon size={17} />
            <span>{item.name}</span>
          </button>
        ))}
        <div className="side-bottom">
          <div className="demo-card">
            <b>Consola de negociación</b>
            <p>Perfil, propuestas y seguimiento de la fase LEADS.</p>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="crumb">LaPreDigital · Gestión comercial</div>
          <div className="session-actions">
            <span className="pill green">{data ? 'OLTP conectado' : 'Conectando…'}</span>
            <Button variant="secondary" onClick={() => void logout()} disabled={leaving}>
              <LogOut size={15} />
              {leaving ? 'Saliendo…' : 'Cerrar sesión'}
            </Button>
          </div>
        </header>
        <div className="content">
          {(selected || page !== 'catalog') && (
            <div className="page-heading">
              <div>
                <div className="eyebrow">LAPREDIGITAL / GESTIÓN COMERCIAL</div>
                <h1>
                  {selected
                    ? 'Expediente de negociación'
                    : navigation.find((item) => item.id === page)?.name}
                </h1>
                <p>
                  {selected
                    ? 'Contacto, beneficiario y participación: cada dato conserva su contexto.'
                    : {
                        overview: 'Vista operativa de las negociaciones registradas.',
                        pending:
                          'Derivaciones, pagos y revisiones que esperan una decisión del personal comercial.',
                        leads: 'Consulta cada participación por contacto, beneficiario y caso.',
                        catalog: 'Planes y modalidades del catálogo autorizado.',
                        followup: 'Agenda de intentos y condiciones del seguimiento autorizado.',
                        kpis: 'Los seis indicadores de la fase LEADS, con sus causas y desgloses por dimensión.',
                        integrations:
                          'Recomendaciones del agente, canales y disponibilidad de los servicios.',
                        knowledge:
                          'Documentos que el agente consulta para responder. Organiza, revisa y actualiza su contenido.',
                        'agent-rules': 'Configura las preguntas y acciones automáticas del agente.',
                      }[page]}
                </p>
              </div>
              {!['knowledge', 'agent-rules'].includes(page) && (
                <Button onClick={onCreate}>
                  <Plus size={15} />
                  Nuevo LEAD
                </Button>
              )}
            </div>
          )}
          {error && (
            <div role="alert" className="live-alert">
              {error}
              <Button
                variant="secondary"
                onClick={() => {
                  setError('');
                  reload(selected?.id).catch((failure) => setError(failure.message));
                }}
              >
                Reintentar
              </Button>
            </div>
          )}
          {notice && (
            <div className="hint-box" role="status">
              {notice}
              <button className="text-link" onClick={() => setNotice('')}>
                Cerrar
              </button>
            </div>
          )}
          {children}
          <footer className="footer">
            <span>
              LaPreDigital · {page === 'kpis' ? 'Indicadores del DataMart' : 'Información del OLTP'}
            </span>
            <span>Fechas en hora de Lima</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
