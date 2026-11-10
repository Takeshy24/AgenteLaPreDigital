---
name: lapredigital-backend
description: Crear, modificar o revisar la API y lógica comercial de LaPreDigital con funciones de nombres sencillos, responsabilidades separadas y operaciones SQL Server legibles. Usar para servicios, repositorios, validación y reglas del backend; no para rediseñar pantallas o ejecutar el script de base de datos sin un encargo que lo requiera.
---

# Backend claro de LaPreDigital

Escribir código que permita seguir una operación de principio a fin sin saltar entre abstracciones innecesarias. Los nombres deben explicar la acción; cada función debe tener una responsabilidad concreta.

## Entender antes de cambiar

Leer [el mapa del backend y sus reglas](references/backend-map.md) cuando la tarea toque datos comerciales. Revisar el esquema SQL y el contrato HTTP vigente. Consultar el informe más reciente disponible para cambios de negocio; el prototipo frontend antiguo no es fuente de reglas actuales.

Esta skill pertenece al repositorio que contiene `.agents/skills/lapredigital-backend/`. Resolver las rutas desde su raíz y trabajar sobre el checkout correspondiente al encargo. Esta skill orienta la implementación, no autoriza desplegar, enviar mensajes ni cambiar bases ajenas a la tarea.

## Organizar por responsabilidad

Mantener una dirección clara: ruta HTTP → función de negocio → acceso a datos → conexión.

- **Ruta:** valida entrada, obtiene contexto de autorización y transforma la respuesta. No contiene consultas SQL ni decide reglas comerciales.
- **Servicio:** expresa un caso de uso, coordina pasos y delimita la transacción. No depende de `req`, `res` o controles visuales.
- **Repositorio:** consultas e inserciones concretas; recibe conexión/transacción y parámetros explícitos. No genera respuestas HTTP.
- **Regla pura:** calcula una decisión a partir de datos recibidos, sin base de datos, reloj oculto ni efectos externos. Ejemplo: `getPriority(level, count, limits)`.
- **Adaptador:** abre conexiones, parametriza valores, confirma/revierte transacciones y gestiona recursos. No decide prioridades ni ofrece planes.

Aplicar estas fronteras a lo que se modifica. Un flujo pequeño puede usar pocos archivos. Separar un módulo cuando mezcle dominios distintos o dificulte probar una regla; no crear una jerarquía de clases, interfaces vacías o carpetas sin necesidad. Evitar seguir acumulando todas las operaciones en `repository.mjs`.

## Nombres y lectura

- Mantener el idioma predominante del código. En el backend actual usar verbos simples en inglés y términos del dominio: `createLead`, `getCase`, `listMessages`, `saveProfile`, `prepareProposal`, `evaluatePriority`, `revokeConsent`.
- Preferir `contact`, `participation`, `caseId`, `message`, `result` sobre `c`, `lc`, `m`, `r` fuera del SQL. En SQL los alias cortos son aceptables si los JOIN siguen siendo claros.
- Evitar nombres como `handleData`, `processEverything`, `executeBusinessWorkflowManager` y abreviaturas que obliguen a consultar su significado.
- Separar validación, decisión y escritura en pasos visibles. Usar retornos tempranos para errores y estados no permitidos.
- Extraer un bloque si introduce otra responsabilidad o un nivel de detalle que impide entender el flujo. No trocear cada línea para cumplir un límite arbitrario de tamaño.
- No ocultar errores con `catch {}` ni convertir fallos en resultados exitosos. Al limpiar recursos o revertir, conservar el error original y registrar fallos adicionales si importan.
- Usar objetos de parámetros con campos explícitos cuando varios argumentos del mismo tipo puedan confundirse. Documentar motivos de negocio, no repetir en comentarios lo que la línea ya dice.

## Datos y efectos

- Validar tipos, longitudes, identificadores y campos permitidos en la frontera HTTP. Evitar asignación masiva y `any` en contratos TypeScript.
- Parametrizar valores SQL. Elegir identificadores dinámicos únicamente de una lista fija. Escribir SQL multilínea con SELECT, FROM, JOIN y WHERE alineados; Prettier no formatea el interior de strings SQL.
- El servicio conserva una misma transacción para escrituras relacionadas; el repositorio no abre otra transacción por cada paso. Respetar los triggers y restricciones existentes.
- Conservar diferencias entre dato desconocido y dato confirmado; no inventar valores para completar columnas.
- Incluir evidencia, operador y fechas cuando lo exige el dominio. La base determina tarifas y parámetros, no el cliente HTTP.
- Separar el registro de una intención de un efecto externo. Preparar no es enviar; aceptar no es pagar. Una confirmación de pago o entrega requiere evidencia del sistema correspondiente.
- Para concurrencia o reintentos relevantes, definir qué identidad se reutiliza y qué restricción/transacción evita duplicados. No añadir reintentos automáticos a escrituras sin evaluar su idempotencia.

## Verificar

Aplicar `.editorconfig`, Prettier y el formato SQL del repositorio. Probar la regla o flujo que cambió con casos de frontera reales. Para escrituras en SQL Server, preferir una transacción de prueba que se revierta o una base de prueba identificada. No dejar fixtures en datos operativos ni ejecutar el script completo al arrancar.

Informar operaciones implementadas, verificaciones ejecutadas y dependencias externas pendientes. Si solo se reorganiza código, conservar contratos y comportamiento; no migrar el esquema ni cambiar reglas por una preferencia de estilo.
