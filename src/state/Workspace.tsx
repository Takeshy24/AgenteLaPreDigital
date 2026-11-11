import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { request, type Bootstrap, type Details, type PublicInquiry } from '../api';
export type Page =
  'overview' | 'pending' | 'leads' | 'catalog' | 'followup' | 'kpis' | 'integrations';
function useWorkspaceState() {
  const [data, setData] = useState<Bootstrap | null>(null),
    [selectedId, setSelectedId] = useState<number | null>(null),
    [detail, setDetail] = useState<Details | null>(null),
    [page, setPage] = useState<Page>('overview'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [inquiries, setInquiries] = useState<PublicInquiry[] | null>(null),
    [inquiryError, setInquiryError] = useState('');
  const lock = useRef(false),
    selection = useRef(0);
  const latestData = useRef(data);
  latestData.current = data;
  const reload = useCallback(async (id?: number | null) => {
    const fresh = await request<Bootstrap>('/bootstrap');
    setData(fresh);
    if (id && selection.current === id) {
      const freshDetail = await request<Details>('/participations/' + id);
      if (selection.current === id) setDetail(freshDetail);
    }
  }, []);
  const refreshInquiries = useCallback(async () => {
    try {
      const result = await request<PublicInquiry[]>('/public-inquiries');
      setInquiries(result);
      setInquiryError('');
      if (
        result.some(
          (item) =>
            item.participationId &&
            !latestData.current?.leads.some((lead) => lead.id === item.participationId),
        )
      )
        setData(await request<Bootstrap>('/bootstrap'));
    } catch (failure) {
      setInquiryError((failure as Error).message);
    }
  }, []);
  useEffect(() => {
    void refreshInquiries();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refreshInquiries();
    }, 10000);
    const onFocus = () => void refreshInquiries();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshInquiries]);
  useEffect(() => {
    const refresh = async () => {
      const id = selection.current;
      if (!id || lock.current || document.hidden) return;
      try {
        await reload(id);
      } catch {
        return;
      }
    };
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [reload]);
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
      if (result?.participationId && selection.current === (selectedId ?? 0)) {
        target = result.participationId;
        selection.current = target;
        setSelectedId(target);
        setDetail(null);
      }
      try {
        await reload(target);
        await refreshInquiries();
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
    inquiries,
    inquiryError,
    refreshInquiries,
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
