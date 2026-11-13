import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Database, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { Button } from '../components/ui';
import { useAuth } from '../state/Auth';
import './Login.css';

export function Login() {
  const { checking, error: sessionError, signIn, checkSession } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await signIn(username, password);
      setPassword('');
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <span>
            <Database size={23} />
          </span>
          <b>
            LaPreDigital<small>GESTIÓN DE LEADS</small>
          </b>
        </div>
        <div className="login-heading">
          <span className="eyebrow">ACCESO A LA CONSOLA</span>
          <h1 id="login-title">Iniciar sesión</h1>
          <p>Ingresa tus credenciales para continuar.</p>
        </div>
        {checking ? (
          <p className="login-status" role="status">
            Comprobando sesión…
          </p>
        ) : (
          <>
            {(error || sessionError) && (
              <div className="login-error" role="alert">
                {error || sessionError}
              </div>
            )}
            <form onSubmit={(event) => void submit(event)}>
              <label htmlFor="login-username">Usuario</label>
              <input
                id="login-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={50}
                placeholder="Tu usuario"
                required
                disabled={busy}
                autoFocus
              />
              <label htmlFor="login-password">Contraseña</label>
              <div className="login-password">
                <input
                  id="login-password"
                  type={visible ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  maxLength={256}
                  placeholder="Tu contraseña"
                  required
                  disabled={busy}
                />
                <button
                  type="button"
                  aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                  disabled={busy}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <Button disabled={busy || !username.trim() || !password}>
                {busy ? 'Ingresando…' : 'Ingresar'}
                <ArrowRight size={17} />
              </Button>
            </form>
            {sessionError && (
              <button
                type="button"
                className="login-retry"
                onClick={() => void checkSession()}
                disabled={busy}
              >
                Volver a comprobar conexión
              </button>
            )}
          </>
        )}
        <p className="login-footnote">
          <LockKeyhole size={14} />
          Consola de administración
        </p>
      </section>
    </main>
  );
}
