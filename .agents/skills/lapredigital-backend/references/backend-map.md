# Mapa y reglas del backend

## Punto de partida

- `server/index.mjs`: arranque HTTP y procesos periódicos; `server/app.mjs`: montaje de rutas y errores.
- `server/<dominio>/routes.mjs`: contratos HTTP y validación Zod.
- `server/<dominio>/service.mjs`: casos de uso y transacciones; `repository.mjs`: consultas SQL del dominio.
- Dominios: leads, profiles, messages, proposals, priorities, consents, cases, contracts, links, trials, handoffs y followup.
- `server/integrations/`: Telegram, vinculación, recepción durable y despacho; `server/agent/`: Ollama y aplicación de propuestas estructuradas.
- `server/policy.mjs`: decisión de prioridad sin efectos externos.
- `server/db.mjs`, `server/sql-worker.ps1`: transporte local Node → .NET SqlClient con autenticación Windows. Es específico del entorno Windows; no cambiar de controlador como efecto secundario de una tarea de estilo.
- `script/LaPreDigital_OLTP.sql`: esquema suministrado, catálogos, parámetros, restricciones y triggers.
- `src/api.ts`: contratos usados por la interfaz conectada.
- `script/migrations/`: extensiones versionadas; aplicar únicamente con el comando de migración explícito.
- `server/README.md`: alcance HTTP y componentes pendientes. Verificar que siga actualizado.

## Organización incremental sugerida

Cuando un flujo requiera separarse, agruparlo por dominio: `leads`, `profiles`, `messages`, `proposals`, `consents`, `priorities`. Elegir archivos sencillos como `profiles/service.mjs` y `profiles/repository.mjs` si existe suficiente lógica para ambos. Mantener errores y utilidades realmente compartidas en un lugar común. No imponer esta estructura completa a una corrección pequeña.

Un servicio puede leerse así; adaptar los nombres y las consultas al repositorio real, no copiar llamadas a funciones inexistentes:

```js
async function saveProfile(participationId, changes, actor) {
  return transaction(async (db) => {
    const participation = await getParticipation(db, participationId);
    checkProfileAccess(participation, actor);
    const previousProfile = await getProfile(db, participation);
    const updates = getProfileChanges(previousProfile, changes);
    await updateProfile(db, participation, updates);
    await recordProfileChanges(db, participation, updates, actor);
    return { saved: true };
  });
}
```

La finalidad es mostrar el caso de uso con nombres concretos. No crear un helper por cada línea si el flujo ya es claro.

## Identidades que no deben mezclarse

- **Contacto:** persona que conversa y autoriza canales.
- **Beneficiario:** estudiante que recibe el servicio y conserva su etapa.
- **Lead:** relación contacto–beneficiario reutilizable.
- **Caso:** oportunidad de negociación del beneficiario; respetar la restricción de un caso abierto.
- **LeadCaso:** participación individual, con prioridad, elegibilidad, nivel de interés y estado propios.

No usar un único `lead.status` para representar etapa del estudiante, estado del caso, resultado de propuesta y estado de participación.

## Reglas verificadas en la referencia actualizada

Corroborar contra el informe/esquema actual al modificar el proceso; esta lista orienta y no sustituye una versión posterior.

- Las participaciones nuevas empiezan Pendiente. Compra indica intención de adquirir; preguntar precio o características es Consulta.
- Los umbrales de intentos prevalecen sobre el nivel de interés: Nula en su umbral; Baja desde su umbral; debajo de ellos Compra → Alta, Consulta → Media, Ninguno → Baja. Leer `Param_Proceso`.
- Una revocación afecta contacto y canal. Sin canales vigentes se suspende la participación, conservando prioridad; no asignar Nula automáticamente por revocar.
- La agenda es única por participación y nace con la elegibilidad autorizada. Una respuesta o reactivación no crea siete intentos nuevos.
- Un mensaje humano entrante reinicia el contador y provoca reevaluación. Rebotes o respuestas automáticas no son respuestas comerciales. Los intentos cuentan al entregarse y vencer su plazo; no al programarlos o prepararlos.
- No ofrecer una tarifa vencida, alterar precios de versiones antiguas ni confiar en un importe enviado desde el frontend. Explora se registra como prueba gratuita, no como tarifa positiva o pago ficticio.
- La aceptación de propuesta requiere evidencia del caso. El pago y la validación contractual son eventos diferentes y no se deducen de aceptación o texto del contacto.
- Preservar historial de cambios, evaluaciones y eventos; no reescribir registros inmutables para corregir el pasado.
- Guardar propuesta con mensaje Pendiente no acredita entrega. El conector externo debe confirmar el resultado antes de medirlo como entregado.
- L-5.1 actualizado mide conversión pagada de casos con prioridad Alta. No reutilizar el KPI antiguo de cobertura de evaluación como si siguiera vigente.

Los horarios originales del OLTP están almacenados como hora local UTC−5. Evitar conversiones dobles; explicitar el contrato de fechas y usar reloj controlable al probar vencimientos.
