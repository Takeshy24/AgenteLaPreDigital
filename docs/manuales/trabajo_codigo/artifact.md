# Contrato del manual de código

Requerimiento normativo: `C:/Users/USERJSSV/Downloads/MANUAL DE CODIGO FUENTE.docx`. Exige los mismos módulos y opciones del manual de usuario, paginación y la misma pantalla acompañada del código principal. Se extrajo en `referencias.json`.

Referencia académica: `C:/Users/USERJSSV/Downloads/MANUAL DE APLICACION CODIGO FUENTE.pdf`, 26 páginas. Portada centrada, cabecera UNT, figuras de pantalla y código y explicación técnica breve. Se inspeccionaron portada y patrón de contenido. Sus ejemplos médicos no se trasladan a este sistema. La disposición horizontal del ejemplo se adapta al orden vertical solicitado para que el código de la consola web sea legible.

Plantilla retenida: `../Manual_de_usuario_LaPreDigital.docx`, 43 páginas, ya renderizado y revisado en el trabajo anterior. Se conservarán sus doce módulos, 39 opciones, 51 títulos, estilos, numeración nativa, cabecera, pie y capturas. A4 vertical; márgenes 3 cm a la izquierda y 2.5 en los otros lados; Arial Narrow 12 y títulos negros. El documento fuente permanece inmutable. Sus capturas se copian con las mismas relaciones, proporciones y recortes nativos de Word.

Las 49 imágenes nuevas son capturas reales de Visual Studio Code Server, abierto en el navegador integrado en segundo plano. No son imágenes generadas ni un editor dibujado. Los archivos pertenecen al proyecto actual. `capturas_codigo/manifest.json` conserva título del editor, archivo y líneas visibles. Los recortes de marco en Word solo excluyen la barra general y el espacio vacío, manteniendo el nombre del archivo y la numeración.

Se documentan las seis dimensiones originales y la ampliación DimCaso encontrada en el código vigente. El manual explica la diferencia. No se ejecutaron pruebas comerciales ni ETL para redactar el documento. A petición del usuario se ejecutó aparte `npm run db:clean -- --local --yes`, con salida cero y TOTAL 0 en LaPreDigital_OLTP; esto no modifica el código ni las capturas guardadas.

La petición de respaldos periódicos quedó revocada por el usuario y se creó `detener-backup`. No se programan más respaldos. La inspección de ventanas del escritorio cesó; las capturas se completaron con el navegador integrado.

Entrega: `../Manual_de_codigo_LaPreDigital.docx` y `../Manual_de_codigo_LaPreDigital.pdf`. Word actualizará TOC y SEQ en segundo plano, sin controlar ventanas. El renderizador empaquetado utilizará ese PDF y Poppler para producir PNG de cada página y efectuar la revisión visual.

Verificación final: 77 páginas, 86 figuras, 49 capturas de código y 37 figuras de pantalla (39 marcos originales). Se inspeccionaron todas las páginas renderizadas. Las 62 páginas idénticas a la revisión previa se comprobaron por hash y las 15 páginas nuevas o desplazadas se revisaron nuevamente. El índice tiene 51 entradas enlazadas y todas remiten a la página correcta en el PDF. Los bytes de las capturas, recortes y dimensiones de los 39 marcos de pantalla coinciden con el manual de usuario. Las 49 imágenes de código incrustadas coinciden con los PNG originales. La tabla adicional de origen de M1 a M11 se contrastó directamente con sql/etl_hechos.sql y server/kpis/datamart-rows.mjs. Todas las comprobaciones de verificar_codigo.py pasaron; el resultado está en qa_final.json.
