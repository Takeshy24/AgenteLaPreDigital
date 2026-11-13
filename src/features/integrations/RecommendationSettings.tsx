import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, ChartNoAxesCombined, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui';
import {
  getSettings,
  saveSettings,
  preview,
  type RecommendationSettings as Settings,
  type RecommendationPreview,
} from './recommendations';
import './RecommendationSettings.css';

export function RecommendationSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [career, setCareer] = useState('Ingeniería de Sistemas');
  const [availability, setAvailability] = useState('2 horas al día');
  const [budget, setBudget] = useState('80');
  const [mode, setMode] = useState('simulation');
  const [result, setResult] = useState<RecommendationPreview | null>(null);
  const lock = useRef(false);
  async function refresh() {
    setLoading(true);
    setError('');
    try {
      setSettings(await getSettings());
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function perform(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function toggle() {
    if (!settings) return;
    void perform(async () => {
      const next = await saveSettings(!settings.configured, settings.version);
      setSettings(next);
      setResult(null);
      setNotice(
        next.enabled
          ? 'Recomendaciones con datos activadas para los próximos mensajes.'
          : 'Recomendaciones por perfil y presupuesto. El historial está desactivado.',
      );
      if (!next.enabled) setMode('simulation');
    });
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void perform(async () =>
      setResult(
        await preview({
          career,
          availability,
          budget: Number(budget),
          simulation: mode === 'simulation',
        }),
      ),
    );
  }
  return (
    <section className="recommendation-settings" aria-labelledby="recommendation-title">
      <div className="recommendation-head">
        <div>
          <span className="eyebrow">PERSONALIZACIÓN DEL AGENTE</span>
          <h2 id="recommendation-title">
            <ChartNoAxesCombined size={22} />
            Recomendaciones con datos
          </h2>
          <p>
            Compara alternativas según la carrera, la disponibilidad y el presupuesto. El historial
            puede ayudar a ordenar los planes que sí caben en ese presupuesto.
          </p>
        </div>
        <Button variant="secondary" disabled={loading || busy} onClick={() => void refresh()}>
          <RefreshCw size={15} />
          Actualizar recuento
        </Button>
      </div>
      {error && (
        <div className="live-alert" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <p className="hint-box" role="status">
          {notice}
        </p>
      )}
      {loading && !settings && <p role="status">Consultando los LEADs registrados…</p>}
      {settings && (
        <>
          <div className="recommendation-control">
            <div>
              <b id="recommendation-toggle-label">Usar el historial de LEADs para recomendar</b>
              <small id="recommendation-toggle-help">
                {settings.eligible
                  ? 'Disponible. Las preferencias se calculan con contrataciones pagadas y validadas.'
                  : `Se necesitan ${settings.minimum} LEADs registrados para activar esta opción. Actualmente hay ${settings.leads}.`}
              </small>
            </div>
            <button
              type="button"
              className="recommendation-switch"
              role="switch"
              aria-checked={settings.configured}
              aria-labelledby="recommendation-toggle-label"
              aria-describedby="recommendation-toggle-help"
              disabled={loading || busy || (!settings.eligible && !settings.configured)}
              onClick={toggle}
            >
              <span />
            </button>
          </div>
          <div className="recommendation-count">
            <span>
              <b>{settings.leads}</b> / {settings.minimum} LEADs mínimos
            </span>
            <span>
              {settings.enabled
                ? 'Activo · perfil, presupuesto e historial'
                : settings.configured
                  ? 'En pausa · faltan LEADs'
                  : 'Modo actual · perfil y presupuesto'}
            </span>
          </div>
          <progress
            max={settings.minimum}
            value={Math.min(settings.leads, settings.minimum)}
            aria-label="LEADs disponibles para habilitar recomendaciones"
          />
          <p className="recommendation-note">
            El límite se comprueba también en el servidor. Para mencionar preferencias de una
            carrera se requieren al menos {settings.minimumCohort} estudiantes comparables con
            compras pagadas y validadas. Las compras registradas no acreditan resultados académicos.
          </p>
          <details className="recommendation-preview">
            <summary>Probar cómo respondería el agente</summary>
            <p>
              La vista previa no envía mensajes ni crea LEADs. Puedes revisar un ejemplo con cifras
              simuladas mientras reúnes datos.
            </p>
            <form onSubmit={submit}>
              <label>
                Carrera
                <input
                  value={career}
                  onChange={(event) => {
                    setCareer(event.target.value);
                    setResult(null);
                  }}
                  minLength={2}
                  maxLength={100}
                  required
                  disabled={busy}
                />
              </label>
              <label>
                Disponibilidad
                <input
                  value={availability}
                  onChange={(event) => {
                    setAvailability(event.target.value);
                    setResult(null);
                  }}
                  maxLength={200}
                  disabled={busy}
                />
              </label>
              <label>
                Presupuesto mensual (S/)
                <input
                  type="number"
                  min="0"
                  max="9999999.99"
                  step="0.01"
                  value={budget}
                  onChange={(event) => {
                    setBudget(event.target.value);
                    setResult(null);
                  }}
                  required
                  disabled={busy}
                />
              </label>
              <label>
                Origen del ejemplo
                <select
                  value={mode}
                  onChange={(event) => {
                    setMode(event.target.value);
                    setResult(null);
                  }}
                  disabled={busy}
                >
                  <option value="simulation">Ejemplo simulado · cifras ficticias</option>
                  <option value="real" disabled={!settings.enabled}>
                    Historial registrado · requiere activación
                  </option>
                </select>
              </label>
              <Button disabled={busy || loading || (mode === 'real' && !settings.enabled)}>
                <ArrowRight size={16} />
                {busy
                  ? 'Preparando…'
                  : mode === 'simulation'
                    ? 'Ver ejemplo simulado'
                    : 'Probar con historial registrado'}
              </Button>
            </form>
            {result && (
              <article className="recommendation-result" role="status">
                <span className="eyebrow">
                  {result.simulation
                    ? 'SIMULACIÓN · NO SE ENVÍA A CONTACTOS'
                    : 'VISTA PREVIA CON HISTORIAL REGISTRADO'}
                </span>
                <p>{result.text}</p>
              </article>
            )}
          </details>
        </>
      )}
    </section>
  );
}
