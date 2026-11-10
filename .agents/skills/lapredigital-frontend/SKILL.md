---
name: lapredigital-frontend
description: Diseñar pantallas React de LaPreDigital con la identidad premium oscura y lima aprobada del catálogo, Plus Jakarta Sans, profundidad y microinteracciones accesibles. Aplicar a vistas, componentes, estilos, UX, formularios, tablas y navegación conservando datos y contratos; no a lógica del backend ni documentos académicos.
---

# Frontend de LaPreDigital

Crear una experiencia comercial moderna, profesional y minimalista con una dirección visual deliberada. Compartir identidad y comportamiento entre módulos sin perpetuar estilos deficientes ni convertir todas las pantallas en la misma cuadrícula de tarjetas.

## Referencia visual aprobada

El usuario aprobó expresamente el catálogo oscuro con acento lima y pidió extenderlo a todas las vistas. `src/pages/Catalog.tsx` y `src/pages/Catalog.css` son la referencia de acabado; `src/styles.css` contiene los tokens `--ui-*` y `src/live.css` aplica la identidad común al espacio conectado. No volver a la paleta clara azul/naranja del prototipo ni proponer una identidad distinta sin un nuevo encargo.

Mantener Plus Jakarta Sans, base carbón, superficies tinta, texto marfil y CTA lima. Compartir luces interiores, bordes sutiles, degradados de superficie, foco visible y respuesta de hover. La densidad y la composición se adaptan a cada trabajo: el catálogo puede destacar una tarjeta; una tabla, un editor o un formulario deben permanecer estables durante la interacción.

## Antes de editar

Leer [el sistema de diseño](references/design-system.md). Inspeccionar las vistas y estilos actuales del proyecto activo, `.editorconfig` y `.prettierrc.json`. Ubicar el componente más parecido antes de crear otro. Los archivos actuales prevalecen sobre rutas o detalles históricos de esta skill si el proyecto evolucionó.

Esta skill pertenece al repositorio que contiene `.agents/skills/lapredigital-frontend/`. Resolver las rutas de código desde la raíz de ese repositorio, sin depender del nombre del equipo o de una ruta absoluta.

## Aplicar una sola identidad

- Compartir shell, títulos, botones, campos, tablas, badges, tarjetas, modales y mensajes de estado. Extraer un componente común cuando exista duplicación real; una tarjeta específica de una página puede permanecer local.
- Reutilizar tokens CSS y variantes existentes. Si falta un token, incorporarlo en la fuente común antes de replicar valores por pantalla. Un cambio global de identidad debe aplicarse a los componentes afectados de manera consistente y dentro del alcance solicitado.
- Reutilizar `Card`, `Button` y `useSurfaceLight` para profundidad, brillo de cursor y microinteracciones. Mantener los efectos compartidos en su fuente común, sin copiar controladores de puntero por pantalla. La inclinación 3D se reserva para tarjetas comerciales; los formularios y las tablas no se inclinan.
- Tratar los colores existentes como identidad de origen, no como una combinación obligatoria. Elegir una base neutra y un acento dominante por composición; reservar otros colores para estados o detalles justificados. Una petición explícita de rediseño permite evolucionar los tokens afectados de forma coherente dentro de su alcance. No añadir funciones ni ventajas comerciales que no existen.
- Priorizar legibilidad: no reproducir textos diminutos, contraste débil o controles sin nombre aunque existan en una vista antigua.
- Evitar estilos inline salvo valores dinámicos, selectores por posición y nuevas hojas que sobrescriban repetidamente los mismos componentes.

## Dirección de estilos

Antes de implementar un rediseño, definir brevemente la composición, el foco visual, la paleta y el comportamiento del movimiento. Si hay referencia, identificar qué la hace funcionar: proporción, alineación, densidad, contraste y ritmo; cambiar colores o redondear tarjetas no basta.

Aplicar [los criterios de composición, color y movimiento](references/design-system.md#dirección-visual-y-composición). En vistas comerciales, combinar jerarquía tipográfica expresiva, espacio bien distribuido, profundidad sutil y microinteracciones de hover y foco. Mantener las vistas operativas compactas y legibles. El minimalismo debe simplificar la lectura y las decisiones, sin producir una pantalla vacía ni rellenarla con etiquetas y frases genéricas.

Usar degradados y animaciones como parte del acabado cuando aporten profundidad o respuesta. No resolver una mala composición añadiendo efectos. El resultado debe seguir teniendo jerarquía y calidad con las animaciones desactivadas.

## Escribir componentes mantenibles

- Un componente representa una responsabilidad visual o interacción reconocible: `LeadTable`, `LeadProfile`, `MessageList`, `ProposalForm`.
- Las pantallas componen componentes. Evitar ampliar un componente raíz que contenga navegación, todos los formularios, consultas y reglas comerciales.
- Mantener datos HTTP en servicios tipados; estados de carga y error en la vista o en un hook concreto como `useLeads`. No añadir un gestor de estado o librería de UI solo por aplicar esta skill.
- Preferir propiedades explícitas y nombres completos. No usar `any` para eludir contratos, ni cadenas de ternarios que oculten estados relevantes.
- El servidor decide precios, permisos, prioridades y transiciones. La interfaz muestra su respuesta; no duplica esas decisiones como autoridad comercial.
- Si se mueve código existente, conservar su comportamiento y limitar la extracción al flujo trabajado. La skill no exige reescribir toda la aplicación.

## Comportamiento compartido

- Cada control visible ejecuta una acción coherente o aparece deshabilitado con una explicación accesible. Evitar botones decorativos y paginadores ficticios.
- Un formulario usa etiquetas reales, validación junto al campo, errores comprensibles, estado de guardado y confirmación. Evitar envíos repetidos; no mostrar éxito antes de confirmar la API.
- Mantener estados de carga, vacío, sin resultados, error y permisos con los mismos patrones en todas las vistas. Nunca sustituir silenciosamente una API fallida por mocks.
- Distinguir datos persistentes, borradores y simulaciones. Preparación, entrega, aceptación y pago son estados distintos.
- Presentar fechas almacenadas por el OLTP en la zona de Lima según su contrato; no reinterpretar una fecha local como UTC.

## Revisar la entrega

Ejecutar el comando de formato y la comprobación de tipos/compilación pertinentes. Si hay navegador disponible, revisar el flujo modificado en escritorio y pantalla estrecha, con teclado y foco visible; no afirmar revisión visual si no se realizó. Comprobar errores, textos extensos, scroll, estados pendientes y movimiento reducido.

Informar qué cambió y qué se verificó. Cambios solo de formato no justifican crear pruebas de negocio ni modificar datos de SQL Server.

En rediseños, comprobar además el equilibrio de color, la alineación entre tarjetas, la jerarquía a primera vista y los estados hover/foco. Una compilación correcta no valida la estética: revisar capturas reales cuando haya navegador disponible y corregir lo observado antes de entregar. Si no se pudo revisar visualmente, declararlo sin presentar el acabado como verificado.
