import { Badge, Card } from '../../components/ui';
import { useWorkspace } from '../../state/Workspace';
function Value({ value }: { value: string | number | null | undefined }) {
  const empty = value == null || String(value).trim() === '';
  return <dd className={empty ? 'pending' : undefined}>{empty ? 'Pendiente' : value}</dd>;
}
export function LeadDataPanel() {
  const { selected } = useWorkspace();
  if (!selected) return null;
  return (
    <Card title="Datos del lead" label="EXPEDIENTE" mode="info">
      <div className="lead-data">
        <section>
          <h4>Contacto</h4>
          <dl>
            <dt>Nombre</dt>
            <Value value={selected.name} />
            <dt>Correo</dt>
            <Value value={selected.email} />
            <dt>Teléfono</dt>
            <Value value={selected.phone} />
            <dt>Captado por</dt>
            <Value value={selected.channel} />
          </dl>
        </section>
        <section>
          <h4>Beneficiario</h4>
          <dl>
            <dt>Estudiante</dt>
            <Value value={selected.beneficiary} />
            <dt>Rol de quien contacta</dt>
            <Value value={selected.role} />
            <dt>Caso #{selected.idCaso}</dt>
            <Value value={selected.idEstadoCaso === 1 ? 'Abierto' : 'Cerrado'} />
          </dl>
        </section>
        <section>
          <h4>Perfil comercial</h4>
          <dl>
            <dt>Universidad</dt>
            <Value value={selected.university} />
            <dt>Carrera</dt>
            <Value value={selected.career} />
            <dt>Disponibilidad</dt>
            <Value value={selected.availability} />
            <dt>Presupuesto mensual</dt>
            <Value value={selected.budget == null ? null : `S/ ${selected.budget}`} />
            <dt>Cursos difíciles</dt>
            <Value value={selected.courses} />
            <dt>Postulaciones anteriores</dt>
            <Value value={selected.applications} />
            <dt>Último puntaje</dt>
            <Value value={selected.score == null ? null : String(selected.score)} />
          </dl>
        </section>
        <section>
          <h4>Estado</h4>
          <dl>
            <dt>Prioridad</dt>
            <dd>
              <Badge value={selected.priority} />
            </dd>
            <dt>Interés comercial</dt>
            <Value value={selected.interest} />
            <dt>Participación</dt>
            <dd>
              <Badge value={selected.status} />
            </dd>
            <dt>Autorización de contacto</dt>
            <Value value={selected.authorized ? 'Algún canal vigente' : 'Sin canal vigente'} />
          </dl>
        </section>
      </div>
    </Card>
  );
}
