export interface Participation {
  id: number;
  idCaso: number;
  idLead: number;
  idContacto: number;
  idBeneficiario: number;
  name: string;
  email: string | null;
  phone: string | null;
  beneficiary: string;
  role: string;
  channel: string;
  priority: string;
  status: string;
  interest: string;
  university: string | null;
  career: string | null;
  availability: string | null;
  budget: number | null;
  score: number | null;
  courses: string | null;
  applications: string | null;
  authorized: number;
  idEstadoCaso: number;
  idEstadoParticipacion: number;
}
export interface Tariff {
  idPlanTarifa: number;
  plan: string;
  modalidad: string;
  precio: number;
  versionCatalogo: string;
}
export interface Bootstrap {
  leads: Participation[];
  tariffs: Tariff[];
  parameters: { codigo: string; valor: number }[];
  agenda: { numeroIntento: number; diaDesdeInicio: number }[];
  channels: { id: number; nombre: string }[];
  roles: { id: number; nombre: string }[];
}
export interface PublicInquiry {
  id: number;
  name: string;
  email: string;
  beneficiary: string;
  plan: string;
  consent: boolean;
  communicationChannel?: 1 | 2 | 3;
  createdAt: string;
  phone: string | null;
  role: number | null;
  status: string;
  participationId: number | null;
}
export interface Message {
  idMensaje: number;
  idDireccion: number;
  textoMensaje: string;
  fechaHora: string;
  canal: string;
  idEstadoEntrega: number | null;
}
export interface Details {
  events: { idEvento: number; fechaEvento: string; type: string }[];
  handoffs: {
    idDerivacion: number;
    fechaAtencion: string | null;
    fechaRetomaAgente: string | null;
  }[];
  invitations: {
    idInvitacion: number;
    codigoEnlace: string;
    nombreInvitado: string;
    fechaVinculacion: string | null;
  }[];
  contracts: {
    idContratacion: number;
    idEventoPago: number | null;
    idEventoValidacion: number | null;
    referenciaPago: string | null;
    fechaHabilitacion: string | null;
    invalidated: boolean;
  }[];
  trials: { idPrueba: number; fechaFin: string; idEstadoPrueba: number }[];
  access: {
    username: string;
    contact: string;
    channel: string;
    messageId: number;
    deliveredAt: string | null;
    delivery: string;
    error: string | null;
    retryAllowed: boolean;
  }[];
  messages: Message[];
  changes: {
    idCambio: number;
    idCanal?: number | null;
    campo: string;
    datoPrevio: string | null;
    datoNuevo: string;
    fechaRespuesta: string;
  }[];
  evaluations: {
    idEvaluacion: number;
    idReglaAplicada: number;
    prioridad: string;
    fechaEvaluacion: string;
    intentosSinRespuesta: number;
  }[];
  attempts: {
    idIntento: number;
    numeroIntento: number;
    fechaProgramada: string;
    omitido: boolean;
    idMensajeEnvio: number | null;
    canalEnvio: string | null;
    fechaEnvio: string | null;
  }[];
  proposals: {
    idPropuesta: number;
    idMensajeEntrega: number;
    plan: string;
    precioAutorizado: number;
    precioCatalogo: number;
    idOperadorAprueba: number | null;
    idResultado: number | null;
    idEstadoEntrega: number;
  }[];
}
export type KpiDimension = 'time' | 'contact' | 'channel' | 'role' | 'plan' | 'priority';
export interface KpiBreakdownItem {
  key: string;
  label: string;
  numerator: number;
  denominator: number;
  percent: number | null;
}
export interface Kpi {
  id: string;
  activity: string;
  name: string;
  formula: string;
  unit: string;
  meaning: string;
  interpretation: string;
  thresholds: [number, number];
  dimensions: KpiDimension[];
  numerator: number;
  denominator: number;
  measures: { code: string; label: string; value: number }[];
  percent: number | null;
  state: { code: 'ok' | 'alert' | 'critical' | 'na'; label: string };
  provisional: number;
  causes: { label: string; count: number; provisional: boolean }[];
  breakdown: Partial<Record<KpiDimension, KpiBreakdownItem[]>>;
  note: string | null;
  units: { label: string; at: string; done: boolean; reason: string | null }[];
}
export interface KpiFilters {
  from: string;
  to: string;
  grain: 'year' | 'quarter' | 'month' | 'day';
  contact: string;
  channel: string;
  role: string;
  plan: string;
}
export interface KpiResponse {
  source: string;
  generatedAt: string;
  kpis: Kpi[];
  options: {
    contacts: { id: number; name: string }[];
    plans: { id: number; name: string }[];
    channels: { id: number; name: string }[];
    roles: { id: number; name: string }[];
  };
}
// Vacío: la API es la del mismo origen (npm start, o Vite con su proxy). Con valor, es una API
// pública (por ejemplo el túnel ngrok) y la página puede alojarse en otro origen.
const apiBase = (import.meta.env.VITE_API_URL ?? '')
  .replace(/^\uFEFF/, '')
  .trim()
  .replace(/\/$/, '');
export const apiUrl = (path: string) => apiBase + '/api' + path;
export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (apiBase) headers['ngrok-skip-browser-warning'] = '1';
  const res = await fetch(apiBase + '/api' + path, {
    method,
    credentials: 'same-origin',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    throw new Error(
      'El servidor no devolvió una respuesta válida. La operación no está confirmada. Revisa la API y vuelve a intentarlo.',
    );
  }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/public/') && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('lapredigital:auth-required'));
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : 'Error en la API';
    throw new Error(message);
  }
  return payload as T;
}
