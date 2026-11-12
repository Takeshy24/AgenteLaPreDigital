# Manual de código fuente de LaPreDigital

Entrega: `../Manual_de_codigo_LaPreDigital.docx` y `../Manual_de_codigo_LaPreDigital.pdf`.

Se conserva exactamente el índice de `../Indice_base_manuales_LaPreDigital.md` y las pantallas visibles de `../Manual_de_usuario_LaPreDigital.docx`. Las capturas de código se obtienen desde Visual Studio Code con los archivos reales abiertos; no se recrea un editor ni se convierten bloques de texto en imágenes.

Estado final: manual completo y verificado en Word editable y PDF, con 77 páginas, 12 módulos, 39 opciones y 86 figuras: 37 de pantalla y 49 capturas reales de código. El índice automático contiene 51 entradas con enlaces y páginas comprobadas. `qa_final.json` conserva las comprobaciones estructurales y los hashes de entrega. `render-final` contiene las 77 páginas renderizadas y revisadas visualmente.

Los scripts, la selección de fragmentos y las imágenes se guardan en esta carpeta. El usuario revocó los respaldos periódicos; el proceso terminó y no debe reiniciarse. Las capturas se completaron en el editor web real mediante navegador integrado oculto; no se debe retomar el control de ventanas del escritorio. La sesión auxiliar del editor web se detuvo al finalizar.

Durante la documentación, el usuario autorizó expresamente `npm run db:clean -- --local --yes`. Se ejecutó con éxito en LaPreDigital_OLTP de localhost: 419 filas de uso antes de la limpieza y TOTAL 0 después. Los catálogos, parámetros, planes, tarifas y operadores se conservaron. Las capturas ya estaban guardadas y no dependían de los datos eliminados. No volver a ejecutar esta limpieza sin una nueva petición.

Fuentes normativas: MANUAL DE CODIGO FUENTE.docx y MANUAL DE APLICACION CODIGO FUENTE.pdf en Downloads. Contexto: Informe_LEADS_LaPreDigital_David_Takeshy_Business_Intelligence_v32.docx. Prioridad de evidencia: implementación actual frente a expectativas del informe; registrar diferencias concretas sin atribuir funciones inexistentes.
