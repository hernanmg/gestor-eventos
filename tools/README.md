# tools/

Scripts de trabajo que no forman parte del sistema: los que arman documentos, los que recorren la app y los que revisan datos o planillas. Se corren desde la **raíz del repo**.

| Carpeta | Qué va | ¿Va al repo? |
|---|---|---|
| `informes/` | Generadores de los informes para el cliente (Word), uno por mes: `informe_AAAA-MM.js` | Sí |
| `documentos/` | Generadores de otros documentos Word: plan de desarrollo (→ raíz), preparación de la prueba en producción (→ `docs/`), relevamiento DOS57 de Florencia y Lorena (→ `docs/dos57/`). Al correrlos, pisan el `.docx` de salida | Sí |
| `tmp/` | Scripts de un solo uso y sus salidas: recorridos con Playwright, conteos en la base, listados de hojas de Excel, capturas, PDF de control | No (`.gitignore`) |

Cuando un script de `tmp/` se vuelve útil más de una vez, se pasa a una carpeta versionada con un nombre claro y un comentario de uso arriba.

## Informe mensual

```bash
node tools/informes/informe_2026-11.js     # → docs/avance/2026-11.docx
```

- Usa la librería `docx` del `package.json` de la raíz (`npm install` en la raíz si falta).
- El contenido tiene que coincidir con `docs/avance/AAAA-MM.md`.
- Para un mes nuevo, copiar el script del mes anterior y actualizar los datos: porcentajes, lo desarrollado, lo que falta, las preguntas y los próximos pasos.
- Para revisar cómo queda en esta máquina: no hay LibreOffice ni pdftoppm, pero Word se puede usar por COM desde PowerShell (`Documents.Open` + `ExportAsFixedFormat(ruta, 17)`) para pasarlo a PDF.

## Cuidados

- `tmp/` no se commitea, pero igual **no** se copian ahí datos personales ni claves de las planillas de `docs/`.
- Los scripts que escriben en la base van en una empresa temporal (ver `CLAUDE.md`). Para los recorridos con los usuarios del cliente, los datos los carga la persona, no un script.
