import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { request, type Bootstrap, type Details } from '../api';
export type Page = 'overview' | 'leads' | 'catalog' | 'followup' | 'integrations';
function useWorkspaceState() {
  const [data, setData] = useState<Bootstrap | null>(null),
    [selectedId, setSelectedId] = useState<number | null>(null),
    [detail, setDetail] = useState<Details | null>(null),
    [page, setPage] = useState<Page>('overview'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const lock = useRef(false),
    selection = useRef(0);
  const reload = useCallback(async (id?: number | null) => {
    const fresh = await request<Bootstrap>('/bootstrap');
    setData(fresh);
    if (id && selection.current === id) {
      const freshDetail = await request<Details>('/participations/' + id);
      if (selection.current === id) setDetail(freshDetail);
    }
  }, []);
  useEffect(() => {
    let active = true;
    request<Bootstrap>('/bootstrap')
      .then(async (result) => {
        if (!active) return;
        setData(result);
        const query = new URLSearchParams(window.location.search);
        const caseId = Number(query.get('stripe_case'));
        const sessionId = query.get('stripe_session_id');
        if (!Number.isSafeInteger(caseId) || caseId < 1 || !sessionId) return;
        const participant = result.leads.find((item) => item.idCaso === caseId);
        if (!participant) throw new Error('No se encontró la oportunidad pagada.');
        await request(`/cases/${caseId}/stripe-confirm`, 'POST', { sessionId });
        if (!active) return;
        window.history.replaceState(null, '', window.location.pathname);
        selection.current = participant.id;
        setSelectedId(participant.id);
        setPage('leads');
        setDetail(await request<Details>('/participations/' + participant.id));
        setNotice('Pago de prueba verificado en Stripe. Ya puedes validar la contratación.');
      })
      .catch((failure) => {
        if (active) setError(failure.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function open(id: number) {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    selection.current = id;
    setSelectedId(id);
    setDetail(null);
    setError('');
    try {
      const result = await request<Details>('/participations/' + id);
      if (selection.current === id) setDetail(result);
    } catch (failure) {
      if (selection.current === id) setError((failure as Error).message);
    }
  }
  function navigate(next: Page) {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    selection.current = 0;
    setSelectedId(null);
    setDetail(null);
    setPage(next);
    setError('');
  }
  async function run(path: string, body: unknown, success: string, method = 'POST') {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await request<{ participationId?: number }>(path, method, body);
      setNotice(success);
      let target = selectedId;
      if (result?.participationId && selection.current === selectedId) {
        target = result.participationId;
        selection.current = target;
        setSelectedId(target);
        setDetail(null);
      }
      try {
        await reload(target);
      } catch {
        setError(
          'La operación se guardó, pero no se pudo actualizar la vista. Reintenta la lectura.',
        );
      }
      return true;
    } catch (failure) {
      setError((failure as Error).message);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const selected = data?.leads.find((item) => item.id === selectedId) || null;
  return {
    data,
    detail,
    selected,
    page,
    error,
    notice,
    busy,
    open,
    navigate,
    run,
    reload,
    setError,
    setNotice,
  };
}
type Workspace = ReturnType<typeof useWorkspaceState>;
const Context = createContext<Workspace | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const workspace = useWorkspaceState();
  return <Context.Provider value={workspace}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error('WorkspaceProvider requerido');
  return context;
}
