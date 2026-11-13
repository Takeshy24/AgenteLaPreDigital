# Índice base de los manuales de LaPreDigital

Agente negociador inteligente para la gestión y análisis de leads en LaPreDigital

La numeración de módulos y opciones es común al manual de usuario y al manual de código fuente. Ambos Word contienen el índice con páginas y enlaces. Este archivo conserva la estructura y la relación con los archivos del sistema. Estructura vigente: 14 módulos y 44 opciones (actualizada el 13 de noviembre de 2026).

## Estructura común

1. Presentación del sistema
2. Acceso e Inicio
   - 2.1 Abrir la consola de negociación
   - 2.2 Usar el menú y reconocer los modos de operación
3. Captación pública
   - 3.1 Enviar el formulario de contacto
   - 3.2 Continuar desde el comprobante de registro
   - 3.3 Solicitar información de un plan
   - 3.4 Aceptar la invitación del responsable económico
   - 3.5 Activar Explora UNT desde el enlace personal
4. Pendientes del operador
   - 4.1 Consultar las gestiones pendientes
   - 4.2 Registrar la atención de una conversación derivada
   - 4.3 Validar una contratación con pago registrado
   - 4.4 Revisar la entrega de credenciales
5. LEADS y casos
   - 5.1 Revisar una solicitud de captación
   - 5.2 Registrar un contacto y su participación
   - 5.3 Buscar y abrir una negociación
6. Expediente de negociación
   - 6.1 Consultar y completar el perfil
   - 6.2 Consultar la conversación y registrar un mensaje recibido
   - 6.3 Revisar un mensaje con la inteligencia artificial
   - 6.4 Revisar interés y prioridad de seguimiento
   - 6.5 Registrar autorización o revocación de contacto
   - 6.6 Preparar la prueba gratuita desde el expediente
   - 6.7 Preparar una invitación al responsable económico
   - 6.8 Registrar una aceptación documentada del responsable
7. Propuestas y servicio
   - 7.1 Preparar una propuesta con tarifa vigente
   - 7.2 Consultar el avance y compartir la oferta personal
   - 7.3 Aceptar la propuesta y sus condiciones en el portal
   - 7.4 Abrir el pago de prueba desde la oferta
   - 7.5 Habilitar un servicio adquirido
   - 7.6 Consultar el servicio habilitado
8. Catálogo interno
   - 8.1 Consultar planes y tarifas mensuales
   - 8.2 Comparar la modalidad semestral
9. Seguimiento autorizado
   - 9.1 Consultar la agenda y revisar vencimientos
10. Indicadores de la fase LEADS
   - 10.1 Consultar el resumen de indicadores
   - 10.2 Aplicar filtros por periodo y dimensión
   - 10.3 Interpretar causas y desgloses
   - 10.4 Actualizar los datos y exportar el reporte
11. Agente e integraciones
   - 11.1 Consultar el estado de los servicios
   - 11.2 Vincular Telegram con un contacto existente
   - 11.3 Configurar las recomendaciones con datos
12. Conocimiento del agente
   - 12.1 Consultar y editar un documento
   - 12.2 Crear o subir un documento
   - 12.3 Probar una consulta
13. Reglas del agente
   - 13.1 Configurar las preguntas y las acciones automáticas
14. Referencia de operación
   - 14.1 Resolver situaciones frecuentes
   - 14.2 Interpretar los indicadores

## Correspondencia para el manual de código fuente

Dentro de cada opción técnica se explicarán el componente o punto de entrada, las validaciones y reglas, el servicio que ejecuta la operación, las tablas afectadas y el resultado. Las capturas del código deberán proceder de esos archivos reales y llevar el mismo número de módulo y opción que la pantalla correspondiente.

| Módulo | Archivos de referencia existentes |
| --- | --- |
| 1 Presentación del sistema | `README.md`, `server/README.md` |
| 2 Acceso e Inicio | `src/pages/Login.tsx`, `src/features/auth/api.ts`, `server/auth/service.mjs`, `server/auth/routes.mjs`, `src/App.tsx`, `src/LiveApp.tsx`, `src/components/Layout.tsx`, `src/state/Workspace.tsx`, `server/app.mjs`, `server/workspace/repository.mjs` |
| 3 Captación pública | `src/pages/Landing.tsx`, `src/features/leads/LandingForm.tsx`, `src/pages/PublicPlans.tsx`, `src/pages/PublicGuardian.tsx`, `src/pages/PublicTrial.tsx`, `server/public/landing.mjs`, `server/public/intake.mjs`, `server/public/invitations.mjs` |
| 4 Pendientes del operador | `src/pages/Pending.tsx`, `server/pending/service.mjs`, `server/handoffs/service.mjs`, `server/contracts/service.mjs`, `server/access/service.mjs` |
| 5 LEADS y casos | `src/features/leads/LeadTable.tsx`, `src/features/leads/LeadForm.tsx`, `server/leads/service.mjs`, `server/public/intake.mjs`, `server/cases/service.mjs` |
| 6 Expediente de negociación | `src/pages/Profile.tsx`, `src/features/profiles/ProfileCard.tsx`, `src/features/messages/Conversation.tsx`, `src/features/agent/AgentCard.tsx`, `src/features/priorities/PriorityCard.tsx`, `src/features/consents/ConsentCard.tsx`, `src/features/trials/TrialCard.tsx`, `src/features/links/GuardianCard.tsx`, `server/profiles/service.mjs`, `server/messages/service.mjs`, `server/priorities/service.mjs`, `server/consents/service.mjs`, `server/trials/service.mjs`, `server/links/service.mjs` |
| 7 Propuestas y servicio | `src/features/proposals/ProposalCard.tsx`, `src/pages/PublicOffer.tsx`, `src/features/contracts/ContractCard.tsx`, `server/proposals/service.mjs`, `server/contracts/service.mjs`, `server/contracts/stripe.mjs`, `server/contracts/webhook.mjs`, `server/access/service.mjs` |
| 8 Catálogo interno | `src/pages/Catalog.tsx`, `src/features/catalog/PlanBenefits.tsx`, `src/shared/offer.json`, `server/workspace/repository.mjs`, `server/public/repository.mjs` |
| 9 Seguimiento autorizado | `src/pages/Followup.tsx`, `server/followup/service.mjs`, `server/followup/repository.mjs`, `server/workers.mjs`, `server/policy.mjs` |
| 10 Indicadores de la fase LEADS | `src/pages/Kpis.tsx`, `src/features/kpis/KpiFilters.tsx`, `src/features/kpis/KpiCard.tsx`, `server/kpis/service.mjs`, `server/kpis/rules.mjs`, `server/kpis/report.mjs`, `server/datamart/service.mjs`, `sql/dimensiones.sql`, `sql/hechos.sql`, `sql/etl_dimensiones.sql`, `sql/etl_hechos.sql` |
| 11 Agente e integraciones | `src/pages/Integrations.tsx`, `src/features/integrations/TelegramCard.tsx`, `src/features/integrations/RecommendationSettings.tsx`, `server/agent/recommendations.mjs`, `server/agent/recommendation-rules.mjs`, `server/operations/routes.mjs`, `server/integrations/config.mjs`, `server/integrations/service.mjs`, `server/integrations/telegram.mjs`, `server/integrations/whatsapp.mjs`, `server/integrations/dispatch.mjs`, `server/agent/ollama.mjs`, `server/agent/service.mjs` |
| 12 Conocimiento del agente | `src/pages/Knowledge.tsx`, `src/features/knowledge/api.ts`, `server/knowledge/routes.mjs`, `server/knowledge/service.mjs`, `server/knowledge/extract.mjs`, `server/knowledge/search.mjs`, `server/knowledge/repository.mjs` |
| 13 Reglas del agente | `src/pages/AgentRules.tsx`, `server/agent/policy.mjs`, `server/agent/policy-repository.mjs`, `server/knowledge/routes.mjs` |
| 14 Referencia de operación | `server/http/validation.mjs`, `server/shared/errors.mjs`, `server/tests/landing.test.mjs`, `server/tests/business.test.mjs`, `server/tests/datamart.test.mjs` |

## Alcance técnico complementario

Antes del recorrido por opciones, el manual de código documenta la arquitectura general, los requisitos y la configuración, la estructura de carpetas, el flujo React → API → servicios → SQL Server y la separación entre OLTP y Data Mart. Estos temas amplían el capítulo 1 sin cambiar la numeración funcional.

En el capítulo 10 se explican las dimensiones (las seis originales más DimCaso), los cinco hechos, la carga ETL y las fórmulas de los seis indicadores. Deben mantenerse las claves dimensionales y la procedencia de cada medida, sin presentar los recuentos operativos de Inicio como tasas del Data Mart.

Al cierre del capítulo 14 se incorporan las verificaciones de funcionamiento y los puntos de configuración necesarios para reproducir los recorridos. La documentación del código debe describir la interfaz vigente, incluida la pestaña Servicio y las acciones de Pendientes. No debe recuperar controles retirados de la interfaz.
