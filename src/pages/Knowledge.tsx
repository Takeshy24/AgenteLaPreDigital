import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  FileText,
  Plus,
  Upload,
  Search,
  Trash2,
  Save,
  Download,
  BookOpen,
  X,
  Check,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { apiUrl, request } from '../api';
import { Button, Empty, Modal } from '../components/ui';
import {
  emptyDraft,
  toDraft,
  uploadDocument,
  type KnowledgeDocument,
  type KnowledgeDraft,
  type KnowledgeMatch,
} from '../features/knowledge/api';
import { formatDate } from '../shared/dates';
import { useWorkspace } from '../state/Workspace';
import './Knowledge.css';

export function Knowledge() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [selected, setSelected] = useState<KnowledgeDocument | null>(null);
  const [draft, setDraft] = useState<KnowledgeDraft | null>(null);
  const [saved, setSaved] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reading, setReading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [question, setQuestion] = useState('');
  const [matches, setMatches] = useState<KnowledgeMatch[] | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const title = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const { setUnsavedChanges } = useWorkspace();
  const dirty = !!draft && JSON.stringify(draft) !== saved;

  async function reload() {
    const result = await request<KnowledgeDocument[]>('/knowledge/documents');
    setDocuments(result);
  }
  useEffect(() => {
    let active = true;
    request<KnowledgeDocument[]>('/knowledge/documents')
      .then((result) => active && setDocuments(result))
      .catch((failure: Error) => active && setError(failure.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    setUnsavedChanges(dirty);
    const leave = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', leave);
    return () => {
      setUnsavedChanges(false);
      window.removeEventListener('beforeunload', leave);
    };
  }, [dirty, setUnsavedChanges]);

  function canLeave() {
    return !dirty || window.confirm('Tienes cambios sin guardar. ¿Descartarlos?');
  }
  function show(doc: KnowledgeDocument | null) {
    const next = doc ? toDraft(doc) : emptyDraft();
    setSelected(doc);
    setDraft(next);
    setSaved(JSON.stringify(next));
    setReading(false);
    setError('');
    setNotice('');
  }
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
  async function open(id: number) {
    if (!canLeave()) return;
    await perform(async () => show(await request<KnowledgeDocument>(`/knowledge/documents/${id}`)));
  }
  function create() {
    if (!canLeave()) return;
    show(null);
    window.setTimeout(() => title.current?.focus(), 0);
  }
  async function importFile(file: File) {
    if (!canLeave()) return;
    await perform(async () => {
      const doc = await uploadDocument(file);
      show(doc);
      await reload();
      setNotice('Documento subido como borrador. Revisa el texto y actívalo cuando esté listo.');
    });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    await perform(async () => {
      const doc = await request<KnowledgeDocument>(
        selected ? `/knowledge/documents/${selected.id}` : '/knowledge/documents',
        selected ? 'PATCH' : 'POST',
        selected ? { ...draft, version: selected.version } : draft,
      );
      show(doc);
      setDocuments((items) => [doc, ...items.filter((item) => item.id !== doc.id)]);
      setMatches(null);
      setNotice(
        doc.active
          ? 'Guardado. El agente consultará esta versión en los próximos mensajes.'
          : 'Borrador guardado. El agente todavía no lo utiliza.',
      );
    });
  }
  async function remove() {
    if (!selected) return;
    await perform(async () => {
      await request(`/knowledge/documents/${selected.id}`, 'DELETE', { version: selected.version });
      setDocuments((items) => items.filter((item) => item.id !== selected.id));
      setConfirmDelete(false);
      setSelected(null);
      setDraft(null);
      setMatches(null);
      setNotice('Documento eliminado. Sus fragmentos ya no están disponibles para el agente.');
    });
  }
  function change(key: keyof KnowledgeDraft, value: string | boolean) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }
  function downloadText() {
    if (!draft) return;
    const url = URL.createObjectURL(
      new Blob([draft.content], { type: 'text/markdown;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${draft.title.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 100) || 'documento'}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }
  const rows = documents.filter(
    (doc) =>
      (!query ||
        `${doc.title} ${doc.fileName ?? ''} ${doc.keywords}`
          .toLocaleLowerCase('es')
          .includes(query.toLocaleLowerCase('es'))) &&
      (filter === 'all' || doc.active === (filter === 'active')),
  );
  return (
    <div className="knowledge-page">
      <div className="knowledge-toolbar">
        <div className="knowledge-summary">
          <BookOpen size={20} />
          <span>
            <b>{documents.length} documentos</b>
            <small>{documents.filter((doc) => doc.active).length} disponibles para el agente</small>
          </span>
        </div>
        <div className="knowledge-actions">
          <Button variant="secondary" onClick={() => setTesting(true)} disabled={busy}>
            <Search size={16} /> Probar consulta
          </Button>
          <Button variant="secondary" onClick={() => input.current?.click()} disabled={busy}>
            <Upload size={16} /> Subir documento
          </Button>
          <Button onClick={create} disabled={busy}>
            <Plus size={16} /> Nuevo documento
          </Button>
          <input
            ref={input}
            type="file"
            className="knowledge-file"
            aria-label="Archivo de conocimiento"
            accept=".txt,.md,.docx,.pdf"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) void importFile(file);
            }}
          />
        </div>
      </div>
      {error && (
        <div className="live-alert" role="alert">
          {error}
          <Button variant="secondary" disabled={busy} onClick={() => void perform(reload)}>
            <RefreshCw size={14} /> Recargar lista
          </Button>
        </div>
      )}
      {notice && (
        <div className="hint-box" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      <div className="knowledge-workspace" aria-busy={busy}>
        <aside className="knowledge-library" aria-label="Biblioteca de documentos">
          <div className="knowledge-library-head">
            <label className="knowledge-search">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar documento…"
                aria-label="Buscar documento"
              />
            </label>
            <label className="knowledge-filter">
              Mostrar
              <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="all">Todos los documentos</option>
                <option value="active">Disponibles para el agente</option>
                <option value="draft">Borradores</option>
              </select>
            </label>
          </div>
          <div className="knowledge-document-list">
            {loading ? (
              <Empty>Cargando documentos…</Empty>
            ) : rows.length ? (
              rows.map((doc) => (
                <button
                  type="button"
                  key={doc.id}
                  className={`knowledge-document ${selected?.id === doc.id ? 'is-selected' : ''}`}
                  aria-current={selected?.id === doc.id ? 'true' : undefined}
                  disabled={busy}
                  onClick={() => void open(doc.id)}
                >
                  <span className="knowledge-document-icon">
                    <FileText size={20} />
                  </span>
                  <span className="knowledge-document-info">
                    <b>{doc.title}</b>
                    <span>
                      <em className={doc.active ? 'knowledge-active' : ''}>
                        {doc.active ? 'Disponible' : 'Borrador'}
                      </em>
                      <small>{doc.format.toUpperCase()}</small>
                    </span>
                    <small>Actualizado {formatDate(doc.updatedAt)}</small>
                  </span>
                </button>
              ))
            ) : (
              <Empty>
                {documents.length
                  ? 'No hay documentos con esos filtros.'
                  : 'Tu biblioteca está vacía. Sube un archivo o crea un documento.'}
              </Empty>
            )}
          </div>
          <p className="knowledge-formats">
            TXT, MD, DOCX y PDF · hasta 2 MB.
            <br />
            Los PDF necesitan texto seleccionable.
          </p>
        </aside>
        <section className="knowledge-editor" aria-label="Editor del documento">
          {!draft ? (
            <div className="knowledge-welcome">
              <span>
                <FileText size={34} />
              </span>
              <h2>El conocimiento, en un solo lugar.</h2>
              <p>
                Selecciona un documento para leerlo o editarlo. El agente utiliza únicamente los que
                marques como disponibles.
              </p>
              <Button onClick={create} disabled={busy}>
                <Plus size={16} />{' '}
                {documents.length ? 'Nuevo documento' : 'Crear mi primer documento'}
              </Button>
              <small>Los precios vigentes siguen viniendo del catálogo.</small>
            </div>
          ) : (
            <form onSubmit={(event) => void save(event)}>
              <div className="knowledge-editor-bar">
                <span>
                  {selected
                    ? `Documento ${selected.id} · versión ${selected.version}`
                    : 'Documento nuevo'}
                  {dirty && <em>Sin guardar</em>}
                </span>
                <div className="knowledge-actions">
                  <Button type="button" variant="secondary" onClick={() => setReading(!reading)}>
                    {reading ? 'Editar' : 'Vista de lectura'}
                  </Button>
                  <Button
                    type="submit"
                    disabled={busy || !dirty || !draft.title.trim() || !draft.content.trim()}
                  >
                    <Save size={15} />
                    {busy ? 'Guardando…' : 'Guardar cambios'}
                  </Button>
                </div>
              </div>
              <div className="knowledge-paper">
                <label className="knowledge-title-label" htmlFor="knowledge-title">
                  Título del documento
                </label>
                <input
                  id="knowledge-title"
                  ref={title}
                  className="knowledge-title"
                  value={draft.title}
                  onChange={(event) => change('title', event.target.value)}
                  placeholder="Escribe un título"
                  minLength={2}
                  maxLength={150}
                  required
                  disabled={busy}
                  readOnly={reading}
                />
                <div className="knowledge-metadata">
                  <label>
                    Fuente o referencia
                    <input
                      value={draft.source}
                      onChange={(event) => change('source', event.target.value)}
                      maxLength={300}
                      placeholder="Ej. Condiciones del servicio · noviembre 2026"
                      disabled={busy}
                      readOnly={reading}
                    />
                  </label>
                  <label>
                    Palabras clave (opcional)
                    <input
                      value={draft.keywords}
                      onChange={(event) => change('keywords', event.target.value)}
                      maxLength={1000}
                      placeholder="Ej. acceso, horarios, soporte"
                      disabled={busy}
                      readOnly={reading}
                    />
                    <small>
                      Ayudan a encontrar sinónimos y términos habituales. También se busca en el
                      título y en todo el texto.
                    </small>
                  </label>
                </div>
                <label className="knowledge-availability">
                  <input
                    type="checkbox"
                    checked={draft.active}
                    onChange={(event) => change('active', event.target.checked)}
                    disabled={busy || reading}
                  />
                  <span>
                    <b>Disponible para el agente</b>
                    <small>Al guardar, el agente podrá consultar este contenido.</small>
                  </span>
                </label>
                <div className="knowledge-content-head">
                  <label htmlFor="knowledge-content">Contenido</label>
                  <small>{draft.content.length.toLocaleString('es-PE')} / 200 000 caracteres</small>
                </div>
                {reading ? (
                  <div className="knowledge-reading">{draft.content}</div>
                ) : (
                  <textarea
                    id="knowledge-content"
                    value={draft.content}
                    onChange={(event) => change('content', event.target.value)}
                    maxLength={200000}
                    placeholder="Escribe o pega aquí la información que debe conocer el agente…"
                    required
                    disabled={busy}
                    spellCheck
                  />
                )}
                <p className="knowledge-note">
                  Los documentos disponibles son la fuente de las respuestas informativas. Al
                  cambiar precios aquí, revisa también las tarifas del catálogo: las propuestas se
                  calculan con la tarifa transaccional vigente.
                </p>
              </div>
              <div className="knowledge-editor-footer">
                <div className="knowledge-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={downloadText}
                    disabled={busy || !draft.content}
                  >
                    <Download size={15} /> Descargar texto
                  </Button>
                  {selected?.fileName && (
                    <a
                      className="text-link"
                      href={apiUrl(`/knowledge/documents/${selected.id}/original`)}
                      download
                    >
                      Archivo original subido
                    </a>
                  )}
                </div>
                {selected && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="knowledge-delete"
                    disabled={busy}
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 size={15} /> Eliminar
                  </Button>
                )}
              </div>
            </form>
          )}
        </section>
      </div>
      {confirmDelete && selected && (
        <Modal title="Eliminar documento" onClose={() => !busy && setConfirmDelete(false)}>
          <p>
            Se eliminará «{selected.title}» y dejará de estar disponible para el agente. Esta acción
            no se puede deshacer.
          </p>
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          <div className="knowledge-actions">
            <Button variant="secondary" disabled={busy} onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button disabled={busy} onClick={() => void remove()}>
              <Trash2 size={15} /> Eliminar documento
            </Button>
          </div>
        </Modal>
      )}
      {testing && (
        <Modal
          title="Probar una consulta"
          onClose={() => !busy && setTesting(false)}
          className="knowledge-test"
        >
          <p>
            Consulta el contenido guardado y disponible para el agente. Los cambios sin guardar no
            se incluyen. La búsqueda recorre los fragmentos de todos los documentos disponibles y
            selecciona los más relacionados; no envía todos los documentos completos al modelo.
          </p>
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void perform(async () =>
                setMatches(
                  await request<KnowledgeMatch[]>('/knowledge/search', 'POST', { text: question }),
                ),
              );
            }}
          >
            <label className="field">
              Pregunta
              <input
                value={question}
                onChange={(event) => {
                  setQuestion(event.target.value);
                  setMatches(null);
                }}
                minLength={3}
                maxLength={500}
                placeholder="Ej. ¿Cómo funciona el soporte?"
                required
                disabled={busy}
              />
            </label>
            <Button disabled={busy || question.trim().length < 3}>
              <ArrowRight size={16} />
              Buscar en los documentos
            </Button>
          </form>
          {matches?.length === 0 && (
            <Empty>
              No se encontraron fragmentos para esa consulta. Prueba otras palabras o revisa las
              palabras clave del documento.
            </Empty>
          )}
          {matches?.map((match) => (
            <article key={match.id} className="knowledge-match">
              <h3>{match.title}</h3>
              <p>{match.content}</p>
              <small>{match.source}</small>
            </article>
          ))}
          <Button variant="secondary" onClick={() => setTesting(false)} disabled={busy}>
            <X size={15} />
            Cerrar
          </Button>
        </Modal>
      )}
    </div>
  );
}
