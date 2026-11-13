# Validación de revocación y devolución (13/11/2026)

Método: 29 mensajes enviados por el flujo real de Telegram (`processUpdate`) y 15 operaciones sobre los servicios reales, cada caso dentro de `rollbackTest` (no quedó ningún dato en la base). Primero con Ollama `llama3.2:3b`; los casos fallidos se repitieron con OpenAI `gpt-5.4-nano`. Costo de OpenAI: 6 llamadas, 6 969 tokens de entrada y 280 de salida, menos de US$ 0,004.

Resultado: 37 de 44 casos se comportan como se espera. Los 7 que fallan no los corrige GPT, porque la causa está en las reglas del sistema y no en el modelo.

## Mensajes del contacto: revocación

| # | Mensaje | Debería pasar | Pasa en realidad | Resultado |
|---|---|---|---|---|
| R01 | /revocar | Revoca solo Telegram; WhatsApp y correo siguen | Igual | ✔ |
| R02 | /revocar → /autorizar | Revoca y vuelve a autorizar Telegram | Igual | ✔ |
| R03 | No me escriban más por favor | Revoca todos los canales y suspende | Igual | ✔ |
| R04 | NO ME CONTACTEN | Revoca todo y suspende | Igual | ✔ |
| R05 | stop | Revoca todo y suspende | Igual | ✔ |
| R06 | Ya no quiero recibir mensajes | Revoca todo y suspende | Igual | ✔ |
| R07 | Dejen de llamarme y de escribirme | Revoca todo y suspende | Igual | ✔ |
| R08 | No me manden más publicidad | Revoca todo y suspende | Igual | ✔ |
| R09 | Retiro mi autorización para recibir mensajes | Revoca todo y suspende | No revoca; explica cómo revocar (Ollama y GPT) | ✘ |
| R10 | Quiero darme de baja, ya no me envíen nada | Revoca todo y suspende | No revoca; le pregunta su carrera (Ollama y GPT) | ✘ |
| R11 | Ya no me escriban por WhatsApp, solo por correo | Revoca solo WhatsApp | Revoca los 3 canales y suspende (regla fija) | ✘ |
| R12 | no quiero que dejen de escribirme | No revoca | No revoca | ✔ |
| R13 | Ya no me interesa, gracias | No revoca (es desinterés) | No revoca | ✔ |
| R14 | No le escriban a mi mamá, ella no decide | No revoca y no invita a la mamá | No revoca, pero pide los datos de la mamá para invitarla | ⚠ |
| R15 | No me interesa Meta UNT, prefiero Ruta UNT | No revoca | No revoca | ✔ |
| R16 | NO ME CONTACTEN → ¿Cuánto cuesta Meta UNT? | Sigue revocado y responde la consulta | Igual | ✔ |
| R17 | NO ME CONTACTEN → Quiero volver a recibir mensajes | Reautoriza o explica cómo hacerlo | No reautoriza ni explica; le pregunta su carrera (Ollama y GPT) | ✘ |

## Mensajes del contacto: devolución y disputa

| # | Mensaje | Debería pasar | Pasa en realidad | Resultado |
|---|---|---|---|---|
| D01 | Quiero que me devuelvan mi dinero | Deriva por reembolso | Igual | ✔ |
| D02 | Solicito el reembolso de mi pago | Deriva por reembolso | Igual | ✔ |
| D03 | ¿Me pueden devolver la plata? | Deriva por reembolso | «No encuentro esa información…»; no deriva (Ollama y GPT) | ✘ |
| D04 | Quiero cancelar y que me regresen lo que pagué | Deriva por reembolso | Deriva con motivo general (7), no reembolso (Ollama y GPT) | ⚠ |
| D05 | Me cobraron dos veces, quiero que me devuelvan uno | Deriva por reembolso | Igual | ✔ |
| D06 | No quiero el plan, devuélvanme | Deriva por reembolso | Igual | ✔ |
| D07 | ¿Cuál es la política de devolución? | Explica o deriva | Deriva por reembolso | ✔ |
| D08 | Si no me gusta, ¿me devuelven el dinero? | Explica o deriva | «No encuentro esa información…» (Ollama y GPT) | ✘ |
| D09 | Desconozco el cargo en mi tarjeta | Deriva por disputa | Igual | ✔ |
| D10 | Voy a abrir una disputa con mi banco | Deriva por disputa | Igual | ✔ |
| D11 | Quiero hacer un contracargo | Deriva por disputa | Igual | ✔ |
| D12 | Ya pagué y no me activan el plan | Deriva por pago no confirmado | Igual | ✔ |

## Operaciones del operador y del sistema

| # | Situación | Debería pasar | Pasa en realidad | Resultado |
|---|---|---|---|---|
| O01 | Revoca el correo con Telegram vigente | Solo revoca el correo; sigue activa | Igual | ✔ |
| O02 | Revoca el único canal vigente | Participación suspendida | Suspendida (motivo 2) | ✔ |
| O03 | Intento vencido tras revocar todo | No envía | No preparó envío | ✔ |
| O04 | Vuelve a autorizar tras revocar | Reactiva sin reiniciar la agenda | Activa, 7 intentos | ✔ |
| O05 | Autoriza Telegram sin bot iniciado | Rechaza | «El canal aún no puede utilizarse» | ✔ |
| O06 | Reembolso sin pago | Rechaza | «El caso no tiene un pago confirmado» | ✔ |
| O07 | Reembolso con pago sin validar | Rechaza | «Debe estar validada y cerrada» | ✔ |
| O08 | Reembolso total antes de habilitar | Invalida, vuelve a LEADS, bloquea, no se puede habilitar | Igual | ✔ |
| O09 | Mismo reembolso dos veces | Rechaza | «La invalidación ya fue registrada» | ✔ |
| O10 | Reembolso total tras habilitar | Rechaza el total; permite el parcial | Igual; el servicio sigue habilitado | ✔ (ver nota) |
| O11 | Disputa registrada | Evento de disputa y bloqueo | Igual | ✔ |
| O12 | Resolución de la disputa | Registra; no levanta el bloqueo solo | Igual | ✔ |
| O13 | Tras reembolso, el contacto escribe | Levanta el bloqueo y abre nueva participación | Igual | ✔ |
| O14 | Disputa abierta y el contacto escribe «Gracias» | El bloqueo por disputa sigue | Se levanta con cualquier mensaje | ✘ |
| O15 | Stripe envía `charge.refunded` | Lo ignora (el reembolso lo registra el operador) | Ignorado | ✔ |

## Causas

1. R09, R10: `isNoContactRequest` (`server/agent/consent-prompt.mjs:20`) no reconoce «retiro mi autorización», «darme de baja» ni «no me envíen nada». El modelo no tiene una acción de revocar, así que ni Ollama ni GPT pueden suplirlo.
2. R11: la misma regla revoca siempre los tres canales y no interpreta «por WhatsApp, solo por correo».
3. R17: no hay forma de volver a autorizar por mensaje. En Telegram solo existe /autorizar y el bot no lo menciona; en WhatsApp la respuesta dice «Si cambias de opinión, solo avísame», pero avisar no reautoriza.
4. D03, D08: `handoffReason` (`server/agent/service.mjs:66`) no reconoce «devolver la plata» ni «devuelven», y la base de conocimiento no encuentra el documento de reembolsos para esas frases.
5. D04: «regresen lo que pagué» no está en la regla; el modelo deriva, pero con el motivo general 7.
6. R14: el modelo interpreta «mi mamá» como pedido de invitar al responsable económico.
7. O14: `clearContactBlocks` (`server/messages/repository.mjs:19`) cierra todos los bloqueos, incluido el de disputa, ante cualquier mensaje entrante.

Nota O10: después de habilitar, un reembolso total solo puede registrarse como parcial; el servicio y las credenciales siguen activos.

## Corrección y revalidación (13/11/2026)

Resultado tras la corrección: 44 de 44 casos se comportan como se espera, con Ollama. No se volvió a usar OpenAI. El costo total de la validación fue de US$ 0,0037.

| Caso | Corrección | Respuesta actual |
|---|---|---|
| R09, R10 | `isNoContactRequest` reconoce «retiro/revoco mi autorización», «darme de baja», «desuscribirme», «no me envíen nada» y «no quiero volver a recibir mensajes». | Revoca todos los canales. |
| R11 | `noContactChannels` revoca solo los canales nombrados y conserva los que siguen a «solo», «pero» o «mejor». Lo usan Telegram, WhatsApp y el registro por chat. | «Listo, ya no te escribiremos por WhatsApp…»; el correo y Telegram siguen vigentes. |
| R17 | `isResumeContactRequest` permite volver a autorizar el canal en que escribe la persona («quiero volver a recibir mensajes», «ya pueden escribirme»). Las respuestas de revocación explican cómo volver a autorizar. | «Autorización registrada para seguimiento por Telegram.» |
| D03, D04, D08 | `handoffReason` reconoce devolver, devuelven, regresen o reintegren seguidos de dinero, plata, pago o «lo que pagué». | Deriva por reembolso (motivo 3). |
| R14 | `CONTACT_DENIAL` admite «no le/les/la/lo escriban/llamen/molesten». | «De acuerdo, no enviaré una invitación a esa persona.» |
| O14 | Un mensaje del contacto levanta el bloqueo por reembolso. El bloqueo por disputa solo se levanta si ya se registró su resolución (`clearContactBlocks` y `resumeOnReply`). | El bloqueo por disputa sigue activo hasta la resolución. |

Pruebas nuevas: `server/tests/no-contact.test.mjs` (revocación por canal, reautorización, reembolso, familiar negado) y `server/tests/business.test.mjs` (bloqueo por disputa).

## Ajustes solicitados (13/11/2026)

| Caso | Comportamiento |
|---|---|
| R14 | «No le escriban a mi mamá, ella no decide», sin la mamá registrada: «De acuerdo, no enviaré una invitación a esa persona.» |
| R18 | «No le escriban a mi mamá», con la mamá registrada para el mismo beneficiario: se revocan todos sus canales. Respuesta: «De acuerdo, ya no le escribiremos a tu mamá.» Las autorizaciones del estudiante no cambian. |
| R19 | «No le escriban a mi mamá por WhatsApp»: se revoca solo el WhatsApp de la mamá. |
| R20 | «¿Cómo me doy de baja?» es una consulta: no revoca nada y explica cómo pedirlo y cómo volver a autorizar. |

El familiar se busca por rol en los Lead del mismo beneficiario: mamá (3), papá (2), «mis padres» (2 y 3) y otros familiares o apoderado (4); «familiar» o «responsable» sin precisar abarca los tres roles. Implementación: `stopRelativeContact` en `server/agent/service.mjs`, `listRelatives` en `server/agent/repository.mjs`, `isUnsubscribeQuestion` en `server/agent/consent-prompt.mjs`.
