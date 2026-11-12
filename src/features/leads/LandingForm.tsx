import { ChangeEvent, FormEvent, ReactNode, useId, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  LoaderCircle,
  Mail,
  MessageCircle,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { request } from '../../api';
import { Button } from '../../components/ui';

type Fields = {
  name: string;
  email: string;
  phone: string;
  role: string;
  beneficiaryName: string;
  channels: number[];
  telegram: boolean;
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
  telegram: false,
  website: '',
};

// El servidor decide el enlace; la página solo lo usa si apunta a Telegram.
function safeTelegramUrl(url?: string) {
  return url && /^https:\/\/t\.me\/[A-Za-z0-9_]+(\?start=[A-Za-z0-9_-]+)?$/.test(url) ? url : '';
}

function safeWhatsAppUrl(url?: string) {
  return url && /^https:\/\/wa\.me\/[0-9]{8,15}(\?text=[A-Za-z0-9%._~-]*)?$/.test(url) ? url : '';
}

// Sin celular propio, el estudiante no recibiría los mensajes: es mejor que lo registre un familiar.
const NO_PHONE_ADVICE =
  'Si no tienes celular propio, te recomendamos registrarte con los datos de tu mamá, papá o apoderado: en «Soy» elige su parentesco y escribe tu nombre como estudiante.';

function validate(fields: Fields): Errors {
  const errors: Errors = {};
  if (fields.name.trim().length < 2) errors.name = 'Escribe tu nombre completo.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()))
    errors.email = 'Escribe un correo válido.';
  const phone = fields.phone.replace(/[\s\-().]/g, '');
  if (!phone && fields.role === '1') errors.phone = NO_PHONE_ADVICE;
  else if (!/^(9\d{8}|\+\d{8,15})$/.test(phone))
    errors.phone = 'Escribe un teléfono válido, por ejemplo 987654321.';
  if (!fields.role) errors.role = 'Elige tu rol.';
  if (fields.role && fields.role !== '1' && fields.beneficiaryName.trim().length < 2)
    errors.beneficiaryName = 'Escribe el nombre completo del estudiante.';
  if (!fields.channels.length && !fields.telegram)
    errors.channels = 'Elige al menos un canal de contacto.';
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
  const [telegramUrl, setTelegramUrl] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [emailed, setEmailed] = useState(false);

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
  function toggleTelegram() {
    setFields((current) => ({ ...current, telegram: !current.telegram }));
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
      const result = await request<{
        registered: boolean;
        telegramUrl?: string;
        whatsappUrl?: string;
        emailed?: boolean;
      }>('/public/landing', 'POST', {
        name: fields.name.trim(),
        email: fields.email.trim(),
        phone: fields.phone.trim(),
        role: Number(fields.role),
        beneficiaryName: fields.role === '1' ? undefined : fields.beneficiaryName.trim(),
        channels: fields.channels,
        telegram: fields.telegram,
        website: fields.website,
      });
      setTelegramUrl(safeTelegramUrl(result.telegramUrl));
      setWhatsappUrl(safeWhatsAppUrl(result.whatsappUrl));
      setEmailed(result.emailed === true);
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
        <span className="landing-success-icon" aria-hidden="true">
          <Check size={30} strokeWidth={1.8} />
        </span>
        <h2>¡Gracias! Recibimos tus datos</h2>
        <p>
          {fields.channels.length
            ? 'Te contactaremos por los canales que autorizaste.'
            : 'Continúa en Telegram o WhatsApp para conversar con nuestro agente.'}
        </p>
        {whatsappUrl && (
          <>
            <a
              className="landing-telegram landing-whatsapp"
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Continuar en WhatsApp
            </a>
            <p className="landing-hint">Se abrirá WhatsApp con un mensaje listo para enviar.</p>
          </>
        )}
        {telegramUrl && (
          <>
            <a
              className="landing-telegram"
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Continuar en Telegram
            </a>
            <p className="landing-hint">
              Pulsa Iniciar en el bot. El enlace vence en 10 minutos.
              {emailed ? ' También lo enviamos a tu correo.' : ''}
            </p>
          </>
        )}
        {!telegramUrl && fields.telegram && (
          <p className="landing-hint">
            Si el correo es tuyo, te enviamos un enlace para continuar en Telegram. Revisa también
            la carpeta de spam; vence en 10 minutos.
          </p>
        )}
      </div>
    );

  return (
    <form className="landing-form" onSubmit={submit} noValidate>
      <header className="landing-form-header">
        <div className="landing-form-overline">
          EMPECEMOS POR TI <ArrowUpRight size={20} aria-hidden="true" />
        </div>
        <h2>Déjanos tus datos</h2>
        <p>Cuéntanos quién eres y elige cómo prefieres que conversemos.</p>
      </header>
      <Field id={`${formId}-name`} label="Nombre completo" error={errors.name}>
        <input
          {...inputProps('name')}
          type="text"
          autoComplete="name"
          placeholder="Tu nombre y apellidos"
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
          placeholder="tu@correo.com"
          maxLength={254}
          value={fields.email}
          onChange={setField('email')}
        />
      </Field>
      <div className="landing-form-row">
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
          {fields.role === '1' && !fields.phone.trim() && !errors.phone && (
            <p className="landing-hint">
              ¿No tienes celular propio? Es mejor que te registre tu mamá, papá o apoderado con sus
              datos, para que podamos escribirle.
            </p>
          )}
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
      </div>
      {fields.role && fields.role !== '1' && (
        <Field
          id={`${formId}-beneficiaryName`}
          label="Nombre completo del estudiante"
          error={errors.beneficiaryName}
        >
          <input
            {...inputProps('beneficiaryName')}
            type="text"
            placeholder="Nombre y apellidos del estudiante"
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
            {channel.id === 1 ? (
              <MessageCircle size={15} aria-hidden="true" />
            ) : (
              <Mail size={15} aria-hidden="true" />
            )}
            {channel.label}
          </label>
        ))}
        {errors.channels && (
          <span className="landing-field-error" id={`${formId}-channels-error`}>
            {errors.channels}
          </span>
        )}
      </fieldset>
      <div className="landing-telegram-option">
        <label className="landing-check">
          <input type="checkbox" checked={fields.telegram} onChange={toggleTelegram} />
          <Send size={15} aria-hidden="true" />
          Prefiero conversar por Telegram
        </label>
        <p className="landing-hint">
          Te daremos un enlace para abrir nuestro bot. Allí podrás autorizar el seguimiento.
        </p>
      </div>
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
      <Button className="landing-submit" type="submit" disabled={status === 'sending'}>
        <span>{status === 'sending' ? 'Enviando…' : 'Quiero que me contacten'}</span>
        {status === 'sending' ? (
          <LoaderCircle size={19} className="landing-submit-spinner" aria-hidden="true" />
        ) : (
          <ArrowUpRight size={19} aria-hidden="true" />
        )}
      </Button>
      <p className="landing-privacy">
        <ShieldCheck size={14} aria-hidden="true" />
        Puedes revocar tu autorización de contacto cuando quieras.
      </p>
    </form>
  );
}
