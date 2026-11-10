import { ArrowRight, FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { Lead } from '../data';
export function NewLead({ onSave, onCancel }: { onSave: (l: Lead) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('Estudiante');
  return (
    <div className="form">
      <div className="hint-box">
        <FlaskConical size={16} />
        <span>Este contacto se agregará solo al estado local de la demostración.</span>
      </div>
      <label>
        Nombre completo
        <input
          autoFocus
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre y apellidos"
        />
      </label>
      <label>
        Correo electrónico
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nombre@correo.pe"
        />
      </label>
      <label>
        Teléfono
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+51 9XX XXX XXX"
        />
      </label>
      <label>
        Rol
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option>Estudiante</option>
          <option>Madre · responsable económico</option>
          <option>Padre · responsable económico</option>
          <option>Apoderado</option>
        </select>
      </label>
      <div className="modal-actions">
        <button className="button secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button
          className="button primary"
          disabled={!name.trim()}
          onClick={() =>
            onSave({
              id: `LP-${2049 + Math.floor(Math.random() * 900)}`,
              name,
              email: email || 'Pendiente',
              phone: phone || 'Pendiente',
              role,
              channel: 'Landing page',
              plan: 'Explora UNT',
              priority: 'Pendiente',
              status: 'Evaluación pendiente',
              last: 'Ahora',
              joined: '05 nov 2026',
              university: 'Pendiente',
              career: 'Pendiente',
              history: 'Contacto captado en demostración.',
              availability: 'Pendiente',
              budget: 'Pendiente',
              modality: 'Virtual',
              objections: [],
              motivation: 'Pendiente',
              guardian: 'Pendiente',
              authorized: true,
              noReply: 0,
              activity: 'Nuevo contacto agregado en la demo.',
              messages: [],
            })
          }
        >
          Agregar LEAD <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
