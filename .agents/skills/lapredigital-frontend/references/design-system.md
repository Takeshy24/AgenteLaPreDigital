# Sistema visual compartido

## Fuentes del proyecto

- `src/styles.css`: tokens y componentes compartidos; shell del prototipo de origen.
- `src/live.css`: estilos de la interfaz conectada.
- `src/LiveApp.tsx`: composición de la interfaz conectada; `src/api.ts`: contratos HTTP.
- `src/components/`: controles y layout compartidos; `src/pages/`: composición de vistas; `src/features/`: formularios y paneles por dominio; `src/state/`: estado compartido; `src/shared/`: utilidades.
- `src/demo/`, `src/data.ts`: prototipo histórico con mocks. No tomar sus métricas o reglas antiguas como requisitos de la operación actual.

Inspeccionar el estado real antes de editar. Estas rutas describen el punto de partida, no obligan a conservar archivos monolíticos.

## Identidad y tokens

La referencia aprobada es el catálogo premium oscuro. La misma identidad se aplica a todas las vistas conectadas, incluidas navegación, formularios, tablas, modales, estados vacíos y expediente. El prototipo claro en `src/demo` es histórico, no una guía de estilos.

| Uso                  | Token compartido    | Valor                            |
| -------------------- | ------------------- | -------------------------------- |
| Fondo carbón         | `--ui-bg`           | `#0D1416`                        |
| Superficie tinta     | `--ui-panel`        | `#172124`                        |
| Superficie elevada   | `--ui-panel-raised` | `#1D2A2D`                        |
| Texto marfil         | `--ui-ink`          | `#F4F6F1`                        |
| Texto secundario     | `--ui-muted`        | `#AAB6B5`                        |
| Acento lima          | `--ui-accent`       | `#D4F477`                        |
| Segundo tono del CTA | `--ui-accent-deep`  | `#AACE50`                        |
| Borde translúcido    | `--ui-line`         | `#FFFFFF1C`                      |
| Superficie de vidrio | `--ui-glass`        | `#FFFFFF06`                      |
| Easing de salida     | `--ui-ease`         | `cubic-bezier(0.22, 1, 0.36, 1)` |

Los tokens `--ui-*` se definen en `src/styles.css`. `src/live.css` los adapta a los aliases existentes y al shell conectado; `src/pages/Catalog.css` conserva solo la composición comercial específica. Evitar temas por ruta que hagan cambiar de identidad al navegar. No crear otra copia de la paleta para una pantalla nueva.

- Plus Jakarta Sans para títulos, cifras y UI conectada; DM Sans y sistema como fallback. La carga de la fuente no debe bloquear la lectura.
- En pantallas operativas: títulos de 24–28 px, secciones de 16–18 px y contenido de 13–14 px. En catálogos y vistas comerciales, permitir títulos y precios de mayor escala con `clamp()`, sin competir entre sí. Texto secundario preferentemente de 12 px o más. Ajustar densidad sin volver ilegibles las etiquetas.
- Espaciado base de 4 px: usar principalmente 8, 12, 16, 24 y 32 px.
- Radios coherentes por familia: controles de 6–10 px y superficies de 12–20 px como punto de partida. Usar superficies continuas y separadores cuando sean más claros que otra tarjeta. Definir radios, bordes y sombras como tokens compartidos, sin asignar un acabado diferente a cada bloque.
- Iconos Lucide de 16–20 px, mismo grosor visual y nombre accesible en botones que solo tengan icono.
- Los degradados sutiles y las microinteracciones forman parte del vocabulario visual; aplicarlos con los criterios siguientes.

## Dirección visual y composición

- Elegir un foco por sección: precio, decisión o contenido principal. El tamaño, el peso y el espacio deben hacer visible esa prioridad antes de añadir decoración.
- Componer con márgenes amplios, alineaciones precisas y ritmo entre bloques. Usar contraste de escala y densidad; evitar repetir título, subtítulo, badge, icono y caja en cada sección por rutina.
- En catálogos, alinear precios y acciones entre opciones, mostrar diferencias reales y agrupar modalidades con claridad. Destacar una opción con tratamiento visual deliberado; no atribuirle popularidad, recomendación, ahorro o beneficios sin respaldo. No convertir nombre, modalidad y vigencia en una lista ficticia de ventajas.
- Preservar información útil al reducir el ruido visual. Evitar titulares intercambiables, contadores decorativos y pasos numerados añadidos solo para llenar espacio.
- La calidad debe venir de proporciones, tipografía y detalle. No depender de grandes áreas vacías, bordes redondeados uniformes, sombras excesivas o un panel oscuro arbitrario para aparentar diseño.

### Paleta y degradados

- Usar la base carbón/tinta y el acento lima aprobados; mantener neutros relacionados entre sí y un solo acento dominante. No combinar automáticamente azul eléctrico, marino y naranja saturado en grandes superficies. Los colores de estado conservan su significado; el naranja del prototipo no se reintroduce como segundo acento decorativo.
- Reservar el color más intenso para acciones o énfasis. Mantener texto secundario, divisores y fondos en una misma familia de temperatura. Separar colores de marca de colores de error, éxito y advertencia.
- Para profundidad, usar degradados de dos o tres tonos cercanos, por ejemplo carbón a tinta ligeramente más clara, o un tinte de acento que se desvanece sobre un neutro. Evitar arcoíris, violetas por defecto, halos extensos y degradados saturados detrás de texto pequeño.
- Localizar el degradado en una superficie protagonista, un borde o una luz tenue; dejar áreas de descanso. Comprobar contraste en ambos extremos y detrás del texto, también en hover y estados deshabilitados.
- Definir tokens semánticos de superficie, acento, borde, sombra y movimiento en la fuente común cuando se necesiten. No sumar colores aislados y overrides sucesivos para reparar una combinación fallida.

### Movimiento e interacción

- Reutilizar `src/shared/useSurfaceLight.ts`: `Card` y la cabecera de Inicio usan luz de cursor sin desplazamiento; las tarjetas de planes optan por inclinación con `useSurfaceLight(true)`. Limitar la escritura de variables CSS dinámicas a `requestAnimationFrame` y cancelarlo al desmontar o salir.
- Botones compartidos: degradado lima con texto carbón, sombra de color leve, shimmer al hover y presión breve al activar; secundarios de vidrio con borde neutro. Entradas y selects: fondo carbón, borde discreto, foco lima y `color-scheme: dark` para los controles nativos.
- Paneles: degradado tinta, luz interior de 1 px y sombra en capas. Tablas: superficie continua con hover de fila, sin tilt ni glow móvil. No mover formularios o contenido editable durante la escritura.
- La entrada de vistas puede durar 400 ms; el catálogo mantiene su entrada por scroll de 500 ms y precios de 420 ms. Reservar el borde giratorio continuo para el plan destacado, no aplicarlo a todos los paneles. No animar filas una por una en listas largas.

- Incorporar respuesta de hover a botones, enlaces y elementos interactivos. Para tarjetas de plan, un cambio sutil de borde o profundidad puede reforzar la comparación; si solo su botón es accionable, no hacer parecer clicable toda la tarjeta.
- Como referencia, usar transiciones de 140–220 ms en controles y de 200–320 ms en superficies, con easing suave. Limitar elevaciones a unos 2–4 px y desplazamientos de iconos a unos 2–3 px. Ajustar al contexto, sin rebotes, zoom agresivo ni movimiento permanente.
- Preferir `transform` y `opacity` para desplazamientos y entradas. Declarar las propiedades que cambian; evitar `transition: all`, animar dimensiones o introducir saltos en la disposición. Los cambios de sombra deben ser leves y limitados a pocas superficies.
- Una entrada breve con opacidad y desplazamiento pequeño puede ordenar la aparición del contenido. No retrasar acciones, ocultar información hasta terminar la animación ni repetirla al cambiar cada campo. Evitar secuencias largas y animaciones de entrada en tablas densas.
- Dar a `:focus-visible` una indicación equivalente de énfasis, con contorno visible; no depender del hover para mostrar información o acciones. Limitar desplazamientos de hover a `@media (hover: hover) and (pointer: fine)` y mantener controles utilizables al tacto.
- Bajo `prefers-reduced-motion: reduce`, quitar entradas, desplazamientos y movimiento decorativo, manteniendo cambios instantáneos de color, borde y foco. No añadir una librería de animación para transiciones CSS sencillas.

### Revisión del acabado

Revisar la vista completa y sus estados en escritorio y móvil, no solo componentes aislados. Comprobar que el precio y el CTA se encuentran rápido, que no compiten varios acentos, que los textos largos no rompen alineaciones y que hover, foco y movimiento reducido mantienen la composición. Si el resultado sigue pareciendo una plantilla, corregir proporciones, información y jerarquía antes de añadir más efectos.

## Jerarquía de páginas

Sidebar y header comunes → título y explicación breve → acción principal → contenido de trabajo. Reservar las tarjetas para grupos útiles. Una tabla extensa puede ocupar una superficie continua.

En el expediente: identidad y estado → contexto conocido y pendientes → conversación/hallazgos declarados → propuesta/siguiente paso → historial. En escritorio puede usarse una columna principal y otra contextual. En móvil, pasar a una columna con las acciones cerca del dato correspondiente.

## Estados semánticos

Usar un componente `Badge` o equivalente con variantes comunes. Prioridades: Alta con rojo suave, Media azul, Baja ámbar, Nula gris y Pendiente neutro. Mostrar texto además del color. Una autorización revocada no significa por sí misma prioridad Nula.

Usar éxito solo tras confirmación; advertencia para pendientes o datos incompletos; error con acción de recuperación. Evitar mensajes que presenten conectores o IA como disponibles si siguen sin integrar.

## Responsive y accesibilidad

Validar escritorio alrededor de 1440 px, tablet y móvil alrededor de 390 px cuando sea posible. Las tablas pueden tener scroll horizontal delimitado; el resto del layout debe caber sin desbordamiento global. Reorganizar columnas, no encoger toda la página.

Conservar foco visible, etiquetas, orden de tabulación y tamaño usable de controles. Los modales requieren cierre con teclado, foco inicial, contención/restauración de foco y nombre accesible; reutilizar un componente accesible si está disponible. Respetar `prefers-reduced-motion`.
