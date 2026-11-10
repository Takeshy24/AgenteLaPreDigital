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
  authorized: number;
  idEstadoCaso: number;
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
  }[];
  trials: { idPrueba: number; fechaFin: string; idEstadoPrueba: number }[];
  messages: Message[];
  changes: {
    idCambio: number;
    campo: string;
    datoPrevio: string | null;
    datoNuevo: string;
    fechaRespuesta: string;
  }[];
  evaluations: {
    idEvaluacion: number;
    prioridad: string;
    fechaEvaluacion: string;
    intentosSinRespuesta: number;
  }[];
  attempts: {
    idIntento: number;
    numeroIntento: number;
    fechaProgramada: string;
    omitido: boolean;
  }[];
  proposals: {
    idPropuesta: number;
    idMensajeEntrega: number;
    plan: string;
    precioAutorizado: number;
    idResultado: number | null;
    idEstadoEntrega: number;
  }[];
}
// Vacío: la API es la del mismo origen (npm start, o Vite con su proxy). Con valor, es una API
// pública (por ejemplo el túnel ngrok) y la página puede alojarse en otro origen.
const apiBase = (import.meta.env.VITE_API_URL ?? '')
  .replace(/^\uFEFF/, '')
  .trim()
  .replace(/\/$/, '');
export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (apiBase) headers['ngrok-skip-browser-warning'] = '1';
  const res = await fetch(apiBase + '/api' + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res
    .json()
    .catch(() => ({ error: 'La API no está disponible. Inicia npm run server.' }));
  if (!res.ok) throw new Error(payload.error || 'Error en la API');
  return payload as T;
}
