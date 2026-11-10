import 'dotenv/config';
import { analyzeMessage, ollamaStatus } from '../server/agent/ollama.mjs';
const status = await ollamaStatus();
if (!status.available) throw new Error('Ollama o el modelo configurado no están disponibles.');
const analysis = await analyzeMessage(
  'Quiero estudiar Medicina en la UNT. Mi presupuesto mensual es 80 soles. ¿Cuánto cuesta el plan?',
  [
    { idPlanTarifa: 1, plan: 'Ruta UNT', precio: 39.9, modalidad: 'Mensual' },
    { idPlanTarifa: 2, plan: 'Meta UNT', precio: 79.9, modalidad: 'Mensual' },
  ],
);
console.log(JSON.stringify({ model: status.model, analysis }, null, 2));
if (analysis.level !== 2 || analysis.action === 'handoff')
  throw new Error('El modelo no clasificó correctamente esta consulta de precio.');
