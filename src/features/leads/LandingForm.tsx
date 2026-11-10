import { ChangeEvent, FormEvent, ReactNode, useId, useState } from 'react';
import { request } from '../../api';

type Fields = {
  name: string;
  email: string;
  phone: string;
  role: string;
  beneficiaryName: string;
  channels: number[];
  website: string;
};
type FieldName = 'name' | 'email' | 'phone' | 'role' | 'beneficiaryName' | 'channels';
type Errors = Partial<Record<FieldName, string>>;
type Status = 'editing' | 'sending' | 'done';

const roles = [
  { id: '1', label: 'Estudiante' },
  { id: '2', label: 'Padre' },
  { id: '3', label: 'Madre' },
  { id: '4', label: 'Apoderado' },
];
const channels = [
  { id: 1, label: 'WhatsApp' },
  { id: 2, label: 'Correo electrónico' },
];
const emptyFields: Fields = {
  name: '',
  email: '',
  phone: '',
  role: '',
  beneficiaryName: '',
  channels: [],
  website: '',
};

function validate(fields: Fields): Errors {
  const errors: Errors = {};
  if (fields.name.trim().length < 2) errors.name = 'Escribe tu nombre completo.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()))
    errors.email = 'Escribe un correo válido.';
  const phone = fields.phone.replace(/[\s\-().]/g, '');
  if (!/^(9\d{8}|\+\d{8,15})$/.test(phone))
    errors.phone = 'Escribe un teléfono válido, por ejemplo 987654321.';
  if (!fields.role) errors.role = 'Elige tu rol.';
  if (fields.role && fields.role !== '1' && fields.beneficiaryName.trim().length < 2)
    errors.beneficiaryName = 'Escribe el nombre completo del estudiante.';
  if (!fields.channels.length) errors.channels = 'Elige al menos un canal de contacto.';
  return errors;
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="landing-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <span className="landing-field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}

export function LandingForm() {
  const formId = useId();
  const [fields, setFields] = useState<Fields>(emptyFields);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>('editing');
  const [failure, setFailure] = useState('');

  function setField(name: keyof Fields) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFields((current) => ({ ...current, [name]: event.target.value }));
  }
  function toggleChannel(id: number) {
    setFields((current) => ({
      ...current,
      channels: current.channels.includes(id)
        ? current.channels.filter((item) => item !== id)
        : [...current.channels, id],
    }));
  }
  function inputProps(name: FieldName) {
    const id = `${formId}-${name}`;
    return {
      id,
      'aria-invalid': errors[name] ? true : undefined,
      'aria-describedby': errors[name] ? `${id}-error` : undefined,
    };
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending') return;
    const found = validate(fields);
    setErrors(found);
    setFailure('');
    if (Object.keys(found).length) return;
    setStatus('sending');
    try {
      await request('/public/landing', 'POST', {
        name: fields.name.trim(),
        email: fields.email.trim(),
        phone: fields.phone.trim(),
        role: Number(fields.role),
        beneficiaryName: fields.role === '1' ? undefined : fields.beneficiaryName.trim(),
        channels: fields.channels,
        website: fields.website,
      });
      setStatus('done');
    } catch (error) {
      setFailure(
        error instanceof TypeError
          ? 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.'
          : (error as Error).message,
      );
      setStatus('editing');
    }
  }

  if (status === 'done')
    return (
      <div className="landing-success" role="status">
        <h2>¡Gracias! Recibimos tus datos</h2>
        <p>Te contactaremos por los canales que autorizaste.</p>
      </div>
    );

  return (
    <form className="landing-form" onSubmit={submit} noValidate>
      <h2>Déjanos tus datos</h2>
      <Field id={`${formId}-name`} label="Nombre completo" error={errors.name}>
        <input
          {...inputProps('name')}
          type="text"
          autoComplete="name"
          maxLength={150}
          value={fields.name}
          onChange={setField('name')}
        />
      </Field>
      <Field id={`${formId}-email`} label="Correo electrónico" error={errors.email}>
        <input
          {...inputProps('email')}
          type="email"
          autoComplete="email"
          maxLength={254}
          value={fields.email}
          onChange={setField('email')}
        />
      </Field>
      <Field id={`${formId}-phone`} label="Teléfono" error={errors.phone}>
        <input
          {...inputProps('phone')}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="987654321"
          maxLength={20}
          value={fields.phone}
          onChange={setField('phone')}
        />
      </Field>
      <Field id={`${formId}-role`} label="Soy" error={errors.role}>
        <select {...inputProps('role')} value={fields.role} onChange={setField('role')}>
          <option value="" disabled>
            Elige una opción
          </option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.label}
            </option>
          ))}
        </select>
      </Field>
      {fields.role && fields.role !== '1' && (
        <Field
          id={`${formId}-beneficiaryName`}
          label="Nombre completo del estudiante"
          error={errors.beneficiaryName}
        >
          <input
            {...inputProps('beneficiaryName')}
            type="text"
            maxLength={150}
            value={fields.beneficiaryName}
            onChange={setField('beneficiaryName')}
          />
        </Field>
      )}
      <fieldset aria-describedby={errors.channels ? `${formId}-channels-error` : undefined}>
        <legend>Autorizo a LaPreDigital a contactarme por:</legend>
        {channels.map((channel) => (
          <label className="landing-check" key={channel.id}>
            <input
              type="checkbox"
              checked={fields.channels.includes(channel.id)}
              onChange={() => toggleChannel(channel.id)}
            />
            {channel.label}
          </label>
        ))}
        {errors.channels && (
          <span className="landing-field-error" id={`${formId}-channels-error`}>
            {errors.channels}
          </span>
        )}
      </fieldset>
      <input
        className="landing-trap"
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={fields.website}
        onChange={setField('website')}
      />
      {failure && (
        <p className="landing-failure" role="alert">
          {failure}
        </p>
      )}
      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Enviando…' : 'Quiero que me contacten'}
      </button>
    </form>
  );
}
