import { useState } from 'react';
import { Badge, Button, Empty } from '../../components/ui';
import { useWorkspace } from '../../state/Workspace';
import { LeadForm } from './LeadForm';
import type { PublicInquiry } from '../../api';
export function LeadTable() {
  const { data, open, inquiries, inquiryError, refreshInquiries } = useWorkspace();
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [caseState, setCaseState] = useState('');
  const [intake, setIntake] = useState<PublicInquiry | null>(null);
  const pendingInquiries = inquiries?.filter(
    (item) => !item.participationId && item.status !== 'Vinculada' && item.status !== 'Descartada',
  );
  const rows =
    data?.leads.filter(
      (lead) =>
        `${lead.name} ${lead.email || ''} ${lead.beneficiary} ${lead.idCaso}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (!priority || lead.priority === priority) &&
        (!caseState || lead.idEstadoCaso === Number(caseState)),
    ) || [];
  return (
    <>
      {intake && (
        <LeadForm
          inquiry={intake}
          onClose={() => {
            setIntake(null);
            void refreshInquiries();
          }}
        />
      )}
      <section className="data-section" id="solicitudes">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FORMULARIO PÚBLICO</span>
            <h2>Solicitudes por revisar {pendingInquiries && `(${pendingInquiries.length})`}</h2>
          </div>
          <Button variant="secondary" onClick={() => void refreshInquiries()}>
            Actualizar
          </Button>
        </div>
        <p className="inquiry-note">
          Aquí aparecen las solicitudes que necesitan datos o confirmación de identidad. Las ya
          vinculadas se gestionan en «Negociaciones registradas».
        </p>
        {inquiryError && (
          <div className="live-alert" role="alert">
            No se pudieron consultar las solicitudes: {inquiryError}
          </div>
        )}
        {pendingInquiries?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>CONTACTO</th>
                  <th>BENEFICIARIO</th>
                  <th>PLAN</th>
                  <th>SEGUIMIENTO</th>
                  <th>ESTADO / ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {pendingInquiries.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.name}
                      <small className="live-sub">{item.email}</small>
                    </td>
                    <td>{item.beneficiary}</td>
                    <td>{item.plan}</td>
                    <td>{item.consent ? 'Autorizó correo' : 'Sin autorización'}</td>
                    <td>
                      <small className="live-sub">{item.status}</small>
                      <Button variant="secondary" onClick={() => setIntake(item)}>
                        Completar captación
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !inquiryError ? (
          <Empty>
            {pendingInquiries
              ? 'No hay solicitudes pendientes de revisión.'
              : 'Consultando solicitudes…'}
          </Empty>
        ) : null}
      </section>
      <section className="data-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">PARTICIPACIONES LEAD–CASO</span>
            <h2>Negociaciones registradas</h2>
          </div>
          <span>
            {rows.length} de {data?.leads.length || 0} participaciones
          </span>
        </div>
        <div className="list-toolbar">
          <input
            className="live-input"
            aria-label="Buscar contactos"
            placeholder="Buscar contacto o beneficiario"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <label className="filter-label">
            Prioridad
            <select value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="">Todas</option>
              {['Pendiente', 'Alta', 'Media', 'Baja', 'Nula'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="filter-label">
            Caso
            <select value={caseState} onChange={(event) => setCaseState(event.target.value)}>
              <option value="">Todos</option>
              <option value="1">Abierto</option>
              <option value="2">Cerrado</option>
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>CONTACTO</th>
                <th>BENEFICIARIO / CASO</th>
                <th>PRIORIDAD</th>
                <th>PARTICIPACIÓN</th>
                <th>INTERÉS</th>
                <th>ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <b>{lead.name}</b>
                    <small className="live-sub">
                      {lead.role} · {lead.email || lead.phone}
                    </small>
                  </td>
                  <td>
                    {lead.beneficiary}
                    <small className="live-sub">
                      Caso #{lead.idCaso} · {lead.idEstadoCaso === 1 ? 'Abierto' : 'Cerrado'} ·
                      Participación #{lead.id}
                    </small>
                  </td>
                  <td>
                    <Badge value={lead.priority} />
                  </td>
                  <td>
                    <Badge value={lead.status} />
                  </td>
                  <td>{lead.interest}</td>
                  <td>
                    <Button variant="secondary" onClick={() => open(lead.id)}>
                      Abrir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <Empty>
              {search || priority || caseState
                ? 'No hay participaciones que coincidan con los filtros.'
                : 'Registra el primer contacto para iniciar una negociación.'}
            </Empty>
          )}
        </div>
      </section>
    </>
  );
}
