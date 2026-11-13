import { request } from '../../api';
export type ProfileQuestion = 'career' | 'availability' | 'budget';
export interface AgentPolicy {
  profileQuestions: boolean;
  optionalQuestions: boolean;
  recommendAfterProfile: boolean;
  proposalLinks: boolean;
  trialLinks: boolean;
  guardianInvitations: boolean;
  useLeadData: boolean;
  questionOrder: ProfileQuestion[];
  version: number;
}
export interface KnowledgeDocument {
  id: number;
  title: string;
  content?: string;
  keywords: string;
  source: string;
  active: boolean;
  version: number;
  fileName: string | null;
  format: string;
  createdAt: string;
  updatedAt: string;
  characters: number;
  fragments: number;
}
export interface KnowledgeMatch {
  id: string;
  title: string;
  source: string;
  content: string;
  score: number;
}
export interface KnowledgeDraft {
  title: string;
  content: string;
  source: string;
  keywords: string;
  active: boolean;
}
export const emptyDraft = (): KnowledgeDraft => ({
  title: '',
  content: '',
  source: '',
  keywords: '',
  active: false,
});
export function toDraft(doc: KnowledgeDocument): KnowledgeDraft {
  return {
    title: doc.title,
    content: doc.content ?? '',
    source: doc.source,
    keywords: doc.keywords,
    active: doc.active,
  };
}
export async function uploadDocument(file: File) {
  if (!/\.(txt|md|docx|pdf)$/i.test(file.name))
    throw new Error('Elige un archivo TXT, MD, DOCX o PDF.');
  if (!file.size || file.size > 2 * 1024 * 1024)
    throw new Error('El archivo debe pesar entre 1 byte y 2 MB.');
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return request<KnowledgeDocument>('/knowledge/import', 'POST', { name: file.name, base64 });
}
