import { ArrowUpRight, BookOpen, CalendarDays, Users } from 'lucide-react';
import { Button } from '../components/ui';
import { useSurfaceLight } from '../shared/useSurfaceLight';
import { LeadTable } from '../features/leads/LeadTable';
import { useWorkspace } from '../state/Workspace';
export function Overview() {
  const { data, navigate, inquiries, inquiryError, refreshInquiries } = useWorkspace();
  const light = useSurfaceLight();
  const active = data?.leads.filter((lead) => lead.idEstadoCaso === 1) || [];
  return (
    <div className="overview-page">
      <section {...light} className="workspace-intro">
        <div>
          <span className="eyebrow">GESTIÓN DE LEADS · UNT</span>
          <h2>
            Cada negociación,
            <br />
            <span>con su contexto.</span>
          </h2>
          <p>
            Consulta las participaciones, amplía el perfil y prepara propuestas con el catálogo
            autorizado.
          </p>
        </div>
        <Button onClick={() => navigate('leads')}>
          Gestionar contactos <ArrowUpRight size={18} aria-hidden="true" />
        </Button>
      </section>
      <section className="inquiry-summary" aria-label="Solicitudes del catálogo público">
        <div>
          <span className="eyebrow">FORMULARIO PÚBLICO</span>
          <h3>
            Solicitudes de planes: {inquiryError ? 'No disponible' : (inquiries?.length ?? '…')}
          </h3>
          <p>
            {inquiryError
              ? `No se pudieron consultar las solicitudes: ${inquiryError}`
              : inquiries?.length
                ? `${inquiries.filter((item) => !item.participationId).length} pendientes de completar o revisar. Las demás ya tienen una negociación vinculada.`
                : inquiries
                  ? 'No hay solicitudes recibidas.'
                  : 'Consultando solicitudes recibidas…'}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => (inquiryError ? void refreshInquiries() : navigate('leads'))}
        >
          {inquiryError ? 'Reintentar' : 'Ver solicitudes'}
        </Button>
      </section>
      <div className="metric-strip" aria-label="Resumen operativo">
        {[
          ['Participaciones registradas', data?.leads.length || 0],
          ['Casos abiertos', new Set(active.map((lead) => lead.idCaso)).size],
          [
            'Participaciones en Alta · caso abierto',
            active.filter((lead) => lead.priority === 'Alta').length,
          ],
          [
            'Sin evaluar · caso abierto',
            active.filter((lead) => lead.priority === 'Pendiente').length,
          ],
        ].map(([label, value]) => (
          <div className="metric" key={String(label)}>
            <span>{label}</span>
            <div className="metric-value">{value}</div>
          </div>
        ))}
      </div>
      <p className="source-note">
        Recuentos actuales de la base transaccional. No representan los seis KPI mensuales del
        informe; su cálculo en el DataMart está pendiente.
      </p>
      <div className="workspace-shortcuts">
        <button onClick={() => navigate('leads')}>
          <Users size={21} aria-hidden="true" />
          <span>
            <b>Contactos y casos</b>
            <small>Participaciones e historial de negociación</small>
          </span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </button>
        <button onClick={() => navigate('catalog')}>
          <BookOpen size={21} aria-hidden="true" />
          <span>
            <b>Catálogo de planes</b>
            <small>Oferta y modalidades autorizadas</small>
          </span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </button>
        <button onClick={() => navigate('followup')}>
          <CalendarDays size={21} aria-hidden="true" />
          <span>
            <b>Seguimiento</b>
            <small>Agenda y parámetros vigentes</small>
          </span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </button>
      </div>
      <LeadTable />
    </div>
  );
}
