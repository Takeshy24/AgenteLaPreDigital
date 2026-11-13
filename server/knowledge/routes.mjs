import { z } from 'zod';
import {
  createDocument,
  deleteDocument,
  downloadOriginal,
  getDocument,
  listDocuments,
  previewSearch,
  updateDocument,
} from './service.mjs';
import { extractDocument, MAX_CONTENT_LENGTH } from './extract.mjs';
import { getPolicy, savePolicy, policySchema } from '../agent/policy.mjs';
const idSchema = z.coerce.number().int().positive().max(2147483647);
const fields = z
  .object({
    title: z.string().trim().min(2).max(150),
    content: z.string().trim().min(1).max(MAX_CONTENT_LENGTH),
    keywords: z.string().trim().max(1000).default(''),
    source: z.string().trim().max(300).default(''),
    active: z.boolean(),
  })
  .strict();
export function registerRoutes(app) {
  app.get('/api/knowledge/policy', async (req, res) => res.json(await getPolicy()));
  app.put('/api/knowledge/policy', async (req, res) => {
    const data = policySchema.extend({ version: z.number().int().positive() }).parse(req.body);
    res.json(await savePolicy(data));
  });
  app.get('/api/knowledge/documents', async (req, res) => res.json(await listDocuments()));
  app.get('/api/knowledge/documents/:id', async (req, res) =>
    res.json(await getDocument(idSchema.parse(req.params.id))),
  );
  app.post('/api/knowledge/documents', async (req, res) =>
    res.status(201).json(await createDocument(fields.parse(req.body))),
  );
  app.patch('/api/knowledge/documents/:id', async (req, res) => {
    const data = fields.extend({ version: z.number().int().positive() }).parse(req.body);
    res.json(await updateDocument(idSchema.parse(req.params.id), data));
  });
  app.delete('/api/knowledge/documents/:id', async (req, res) => {
    const { version } = z.object({ version: z.number().int().positive() }).strict().parse(req.body);
    res.json(await deleteDocument(idSchema.parse(req.params.id), version));
  });
  app.post('/api/knowledge/import', async (req, res) => {
    const data = z
      .object({ name: z.string().min(1).max(255), base64: z.string().min(1).max(2800000) })
      .strict()
      .parse(req.body);
    const file = await extractDocument(data.name, data.base64);
    const title = file.name
      .replace(/\.[^.]+$/, '')
      .trim()
      .slice(0, 150);
    res.status(201).json(
      await createDocument(
        {
          title: title.length >= 2 ? title : 'Documento sin título',
          content: file.content,
          source: file.name,
          keywords: '',
          active: false,
        },
        file,
      ),
    );
  });
  app.get('/api/knowledge/documents/:id/original', async (req, res) => {
    const file = await downloadOriginal(idSchema.parse(req.params.id));
    res.attachment(file.name).type('application/octet-stream').send(file.bytes);
  });
  app.post('/api/knowledge/search', async (req, res) => {
    const { text } = z
      .object({ text: z.string().trim().min(3).max(500) })
      .strict()
      .parse(req.body);
    res.json(await previewSearch(text));
  });
}
