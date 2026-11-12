#!/bin/bash
# ============================================================
# Script para crear issues en GitHub
# Enjoy Producciones — Sistema de Gestión Integral
#
# USO:
#   1. Crear el repo en GitHub si no existe
#   2. Generar un Personal Access Token en:
#      GitHub → Settings → Developer settings → Personal access tokens → Fine-grained
#      Permisos necesarios: Issues (Read & Write), Projects (Read & Write)
#   3. Ejecutar:
#      GITHUB_TOKEN=tu_token GITHUB_REPO=usuario/repo bash crear-issues-github.sh
# ============================================================

TOKEN="${GITHUB_TOKEN}"
REPO="${GITHUB_REPO}"   # ej: miusuario/admin-portal

if [ -z "$TOKEN" ] || [ -z "$REPO" ]; then
  echo "❌ Faltan variables de entorno."
  echo "   Uso: GITHUB_TOKEN=xxx GITHUB_REPO=usuario/repo bash $0"
  exit 1
fi

API="https://api.github.com/repos/${REPO}"
HEADERS=(
  -H "Authorization: Bearer ${TOKEN}"
  -H "Accept: application/vnd.github+json"
  -H "Content-Type: application/json"
)

echo "🚀 Creando labels..."

create_label() {
  local name="$1" color="$2" desc="$3"
  curl -s -o /dev/null "${HEADERS[@]}" \
    -X POST "${API}/labels" \
    -d "{\"name\":\"${name}\",\"color\":\"${color}\",\"description\":\"${desc}\"}"
}

# Labels de fase
create_label "fase-1"      "1E3A5F" "MVP — Excel al sistema"
create_label "fase-2"      "065F46" "Gestión Comercial"
create_label "fase-3"      "7C2D12" "Control y Análisis"
create_label "fase-4"      "4C1D95" "Multimedia"

# Labels de tipo
create_label "backend"     "0EA5E9" "Tarea de backend"
create_label "frontend"    "A855F7" "Tarea de frontend"
create_label "full-stack"  "F59E0B" "Backend + Frontend"
create_label "devops"      "6B7280" "Infraestructura / DevOps"

# Labels de prioridad
create_label "prio-alta"   "EF4444" "Alta prioridad"
create_label "prio-media"  "F59E0B" "Media prioridad"
create_label "prio-baja"   "22C55E" "Baja prioridad"

# Labels de estado (para workflow)
create_label "bug"         "DC2626" "Error en producción"
create_label "feature"     "2563EB" "Nueva funcionalidad"
create_label "mejora"      "7C3AED" "Mejora de funcionalidad existente"
create_label "bloqueado"   "9CA3AF" "Bloqueado por dependencia"

echo "✅ Labels creados"
echo ""
echo "🚀 Creando milestones..."

create_milestone() {
  local title="$1" desc="$2" date="$3"
  curl -s -o /dev/null "${HEADERS[@]}" \
    -X POST "${API}/milestones" \
    -d "{\"title\":\"${title}\",\"description\":\"${desc}\",\"due_on\":\"${date}T00:00:00Z\"}"
}

create_milestone "Fase 1 — MVP"              "Reemplaza Excel de egresos, caja, RRHH y facturas" "2025-12-15"
create_milestone "Fase 2 — Gestión Comercial" "Proyectos, ficha técnica, presupuestador, cortesías" "2026-03-01"
create_milestone "Fase 3 — Control"           "Dashboard, reportes y repositorio documental"         "2026-05-01"
create_milestone "Fase 4 — Multimedia"        "Galería de fotos/videos con fotógrafos externos"      "2026-07-01"

echo "✅ Milestones creados"
echo ""
echo "🚀 Creando issues..."

TOTAL=0

create_issue() {
  local id="$1" title="$2" body="$3" labels="$4" milestone="$5"
  local result
  result=$(curl -s "${HEADERS[@]}" \
    -X POST "${API}/issues" \
    -d "{
      \"title\": \"[${id}] ${title}\",
      \"body\": ${body},
      \"labels\": ${labels},
      \"milestone\": ${milestone}
    }")
  local num
  num=$(echo "$result" | grep -o '"number":[0-9]*' | head -1 | grep -o '[0-9]*')
  if [ -n "$num" ]; then
    echo "  ✓ #${num} — [${id}] ${title}"
    TOTAL=$((TOTAL + 1))
  else
    echo "  ✗ Error en [${id}] ${title}"
    echo "$result" | head -3
  fi
  sleep 0.5  # Rate limiting
}

# ── OBTENER IDs DE MILESTONES ──────────────────────────────────────────────
MS=$(curl -s "${HEADERS[@]}" "${API}/milestones?per_page=10")
MS1=$(echo "$MS" | grep -B2 '"Fase 1' | grep '"number"' | head -1 | grep -o '[0-9]*')
MS2=$(echo "$MS" | grep -B2 '"Fase 2' | grep '"number"' | head -1 | grep -o '[0-9]*')
MS3=$(echo "$MS" | grep -B2 '"Fase 3' | grep '"number"' | head -1 | grep -o '[0-9]*')
MS4=$(echo "$MS" | grep -B2 '"Fase 4' | grep '"number"' | head -1 | grep -o '[0-9]*')

echo "Milestones: F1=$MS1 F2=$MS2 F3=$MS3 F4=$MS4"
echo ""

# ── FASE 1 ─────────────────────────────────────────────────────────────────
echo "📦 FASE 1 — MVP"

create_issue "F1-01" "Diseñar nuevo schema Prisma completo" \
  '"## Descripción\nNuevas entidades: Rubro, Empleado, Jornada, Liquidacion, Anticipo, TransferenciaEvento.\nModificar: Evento, Egreso, Caja.\n\n## Criterios de aceptación\n- [ ] Schema.prisma actualizado con todas las entidades nuevas\n- [ ] Relaciones correctas entre entidades\n- [ ] Enums actualizados (EstadoEgreso, RolUsuario, etc.)\n- [ ] Migración generada sin errores"' \
  '["fase-1","backend","prio-alta"]' "$MS1"

create_issue "F1-02" "Migración de datos existentes al nuevo schema" \
  '"## Descripción\nScript de migración desde el schema demo al nuevo schema sin perder datos de prueba.\n\n## Criterios de aceptación\n- [ ] Script de migración ejecutable\n- [ ] Datos del demo migrados correctamente\n- [ ] Sin pérdida de información existente\n- [ ] Rollback posible si algo falla"' \
  '["fase-1","backend","prio-alta"]' "$MS1"

create_issue "F1-03" "Actualizar seed.ts y seed-demo.ts para nuevo schema" \
  '"## Descripción\nActualizar seeds para el nuevo modelo de datos con datos de prueba realistas.\n\n## Criterios de aceptación\n- [ ] npm run seed ejecuta sin errores\n- [ ] npm run seed:demo carga datos representativos\n- [ ] Datos de RRHH de ejemplo incluidos"' \
  '["fase-1","backend","prio-alta"]' "$MS1"

create_issue "F1-04" "Implementar 5 roles: Admin, Producción, Administración, Tesorería, Consulta" \
  '"## Descripción\nReemplazar los 3 roles actuales por 5 roles con permisos granulares.\n\n## Criterios de aceptación\n- [ ] Enum Rol actualizado en schema\n- [ ] Middleware requireRole actualizado en todas las rutas\n- [ ] Matriz de permisos documentada\n- [ ] Tests de autorización por endpoint"' \
  '["fase-1","backend","prio-alta"]' "$MS1"

create_issue "F1-05" "UI de gestión de roles en Configuración" \
  '"## Descripción\nActualizar pantalla de usuarios con los 5 roles nuevos y descripción de permisos.\n\n## Criterios de aceptación\n- [ ] Select de rol muestra los 5 roles con descripción\n- [ ] Tabla de usuarios muestra rol correcto\n- [ ] Admin no puede cambiar su propio rol"' \
  '["fase-1","frontend","prio-alta"]' "$MS1"

create_issue "F1-06" "Extender modelo Evento con nuevos campos" \
  '"## Descripción\nAgregar: tipo (Cliente/Interno), provincia, ciudad, logo, color, proyecto_id. Ampliar a 7 estados.\n\n## Criterios de aceptación\n- [ ] Campos nuevos en schema y migración\n- [ ] API actualizada con validaciones Zod\n- [ ] 7 estados: Borrador, En cotización, Confirmado, En producción, Finalizado, Cerrado, Archivado"' \
  '["fase-1","backend","prio-alta"]' "$MS1"

create_issue "F1-07" "Actualizar formulario de evento con nuevos campos" \
  '"## Descripción\nNuevos campos: tipo (Cliente/Interno), provincia, ciudad, color picker, upload de logo.\n\n## Criterios de aceptación\n- [ ] Color picker funcional\n- [ ] Upload de logo con preview\n- [ ] Select de tipo Cliente/Interno\n- [ ] Campos de ubicación (provincia, ciudad)"' \
  '["fase-1","frontend","prio-media"]' "$MS1"

create_issue "F1-08" "Vista macro cross-evento de movimientos" \
  '"## Descripción\nPantalla global con todos los movimientos de todos los eventos, filtrable.\n\n## Criterios de aceptación\n- [ ] Tabla con movimientos de todos los eventos\n- [ ] Filtros: evento, fecha desde/hasta, tipo, rubro, responsable\n- [ ] Paginación con 50 items por página\n- [ ] Exportación a Excel desde la vista macro\n- [ ] Al cargar un movimiento desde la macro, se asigna a un evento"' \
  '["fase-1","frontend","prio-alta"]' "$MS1"

create_issue "F1-09" "ABM de Rubros configurables" \
  '"## Descripción\nModelo Rubro: nombre, categoría, unidad, costo_estimado, proveedor_sugerido, activo.\n\n## Criterios de aceptación\n- [ ] CRUD completo de rubros\n- [ ] Categorías predefinidas: Sonido, Luces, Escenario, Producción, etc.\n- [ ] Rubros activos disponibles al crear egresos\n- [ ] UI en sección Configuración"' \
  '["fase-1","backend","prio-alta"]' "$MS1"

create_issue "F1-10" "Refactorizar Egreso: de tabs fijas a rubros dinámicos" \
  '"## Descripción\nEliminar tab_numero fijo. Agregar rubro_id, presupuesto, costo_real, IVA, estado_egreso, fecha_pago, responsable.\n\n## Criterios de aceptación\n- [ ] Migración de datos existentes a nuevo modelo\n- [ ] API actualizada con nuevos campos\n- [ ] Comparación presupuesto vs real calculada automáticamente\n- [ ] Campo responsable con FK a Usuario"' \
  '["fase-1","backend","prio-alta"]' "$MS1"

create_issue "F1-11" "Estados por egreso (Pendiente/Cotizando/Confirmado/Pagado/Cancelado)" \
  '"## Descripción\nEnum EstadoEgreso con transiciones válidas y lógica de negocio.\n\n## Criterios de aceptación\n- [ ] 5 estados implementados\n- [ ] Transiciones válidas: Pendiente→Cotizando→Confirmado→Pagado\n- [ ] No se puede volver de Pagado a estados anteriores\n- [ ] Filtro por estado en la lista de egresos"' \
  '["fase-1","backend","prio-alta"]' "$MS1"

create_issue "F1-12" "UI de egresos por rubro con presupuesto vs real" \
  '"## Descripción\nNueva tabla de egresos agrupada por rubro con columnas de presupuesto y real.\n\n## Criterios de aceptación\n- [ ] Agrupación por rubro (categoría colapsable)\n- [ ] Columnas: presupuesto, real, diferencia $, diferencia %, estado\n- [ ] Color rojo si real > presupuesto\n- [ ] Totales por rubro y total general\n- [ ] Filtros por estado y responsable"' \
  '["fase-1","frontend","prio-alta"]' "$MS1"

create_issue "F1-13" "Adjuntos por línea de egreso" \
  '"## Descripción\nCada fila de egreso puede tener archivos adjuntos (PDF, imagen).\n\n## Criterios de aceptación\n- [ ] Botón de adjuntar por fila\n- [ ] Upload de múltiples archivos\n- [ ] Preview de PDF e imágenes\n- [ ] Vinculado al repositorio documental (Fase 3)"' \
  '["fase-1","full-stack","prio-media"]' "$MS1"

create_issue "F1-14" "Importador Excel actualizado para nuevo modelo de egresos" \
  '"## Descripción\nActualizar excelParser.ts para mapear columnas del Excel al nuevo schema de Rubro.\n\n## Criterios de aceptación\n- [ ] Columnas ITEM, DESCRIPCIÓN, RESPONSABLE, CONSUMIDO mapeadas correctamente\n- [ ] Agrupadores de rubro detectados automáticamente\n- [ ] Preview del import con errores inline\n- [ ] Test con Excel real del cliente"' \
  '["fase-1","backend","prio-media"]' "$MS1"

create_issue "F1-15" "Tipos de ingreso configurables con estados por fila" \
  '"## Descripción\nReemplazar tabs fijas de ingresos por tipos configurables con estado por fila.\n\n## Criterios de aceptación\n- [ ] Tipos configurables desde admin\n- [ ] Estado por fila: Pendiente, Facturado, Cobrado parcialmente, Cobrado, Cancelado\n- [ ] Migración de datos existentes"' \
  '["fase-1","backend","prio-alta"]' "$MS1"

create_issue "F1-16" "UI de ingresos con estados y tipos configurables" \
  '"## Descripción\nActualizar IngresoTable con columna de estado, tipo dinámico y filtros.\n\n## Criterios de aceptación\n- [ ] Columna de estado con badge de color\n- [ ] Select de tipo desde configuración\n- [ ] Filtro por estado\n- [ ] Totales por estado"' \
  '["fase-1","frontend","prio-alta"]' "$MS1"

create_issue "F1-17" "Extender ficha de proveedor con datos fiscales" \
  '"## Descripción\nAgregar: nombre_fantasia, condicion_iva, banco, CBU, alias. Ficha completa.\n\n## Criterios de aceptación\n- [ ] Campos nuevos en schema y API\n- [ ] Validación de CBU (22 dígitos)\n- [ ] Condición IVA: RI, Monotributo, Exento, CF\n- [ ] Datos bancarios pre-poblados en formulario de pago"' \
  '["fase-1","backend","prio-alta"]' "$MS1"

create_issue "F1-18" "Importador de proveedores desde Excel (Google Form responses)" \
  '"## Descripción\nLeer Proveedores-datos.xlsx y crear/actualizar proveedores masivamente.\n\n## Criterios de aceptación\n- [ ] Mapeo de columnas del Google Form al modelo Proveedor\n- [ ] Detección de duplicados por CUIT\n- [ ] Preview antes de confirmar el import\n- [ ] Reporte de creados vs actualizados vs errores"' \
  '["fase-1","backend","prio-media"]' "$MS1"

create_issue "F1-19" "Historial completo en ficha de proveedor" \
  '"## Descripción\nVer todos los eventos, facturas, pagos y montos del proveedor en una pantalla.\n\n## Criterios de aceptación\n- [ ] Total facturado histórico (ARS y USD separados)\n- [ ] Lista de eventos donde participó\n- [ ] Facturas pendientes de pago resaltadas\n- [ ] Exportación del historial a Excel"' \
  '["fase-1","frontend","prio-media"]' "$MS1"

create_issue "F1-20" "Refactorizar Caja: de por-evento a empresa-wide" \
  '"## Descripción\nCuentaBancaria deja de requerir evento_id (ahora opcional). Caja a nivel empresa.\n\n## Criterios de aceptación\n- [ ] evento_id opcional en CuentaBancaria\n- [ ] Campo responsable_id (FK a Usuario) en CuentaBancaria\n- [ ] Migración sin pérdida de datos existentes\n- [ ] API actualizada"' \
  '["fase-1","backend","prio-alta"]' "$MS1"

create_issue "F1-21" "Multi-cajero: responsable por movimiento de caja" \
  '"## Descripción\nCada MovimientoCaja tiene responsable_id. Filtros por cajero.\n\n## Criterios de aceptación\n- [ ] responsable_id en MovimientoCaja\n- [ ] Cajeros actuales: Dani, Male, Gus, Flor, Vicky, Mili, Pipa\n- [ ] Filtro por cajero en la vista de caja\n- [ ] Saldo por cajero en resumen"' \
  '["fase-1","backend","prio-alta"]' "$MS1"

create_issue "F1-22" "Campo tipo_gasto en MovimientoCaja" \
  '"## Descripción\nEnum tipo_gasto: EVENTO, COWORKING, OFICINA, OTRO. Para reportes segmentados.\n\n## Criterios de aceptación\n- [ ] Campo tipo_gasto en schema\n- [ ] Select en formulario de nuevo movimiento\n- [ ] Filtro por tipo en la vista de caja"' \
  '["fase-1","backend","prio-alta"]' "$MS1"

create_issue "F1-23" "UI de caja empresa-wide con filtros por cajero y tipo" \
  '"## Descripción\nVista global de todas las cajas. Selector de cajero, tipo_gasto, rango de fechas.\n\n## Criterios de aceptación\n- [ ] Vista macro de todos los movimientos de caja\n- [ ] Filtros: cajero, tipo_gasto, fecha desde/hasta, evento\n- [ ] Saldo consolidado por cuenta\n- [ ] Tabla paginada con 50 items"' \
  '["fase-1","frontend","prio-alta"]' "$MS1"

create_issue "F1-24" "Reporte de coworking: filtrar y exportar por tercio" \
  '"## Descripción\nFiltrar por tipo_gasto=COWORKING, dividir en 3 partes iguales, exportar para cada empresa.\n\n## Criterios de aceptación\n- [ ] Filtro automático de movimientos COWORKING\n- [ ] División en 3 tercios exactos\n- [ ] Export Excel con hoja por empresa\n- [ ] Total del período configurable (mes, trimestre, etc.)"' \
  '["fase-1","full-stack","prio-alta"]' "$MS1"

create_issue "F1-25" "Modelo Empleado completo" \
  '"## Descripción\nnombre, apellido, DNI, CUIT, mail, teléfono, CBU, alias, categoría, valor_hora, valor_hora_extra, estado.\n\n## Criterios de aceptación\n- [ ] Schema Prisma con todas las relaciones\n- [ ] API CRUD completa\n- [ ] Validaciones: DNI único, CUIT formato válido, CBU 22 dígitos\n- [ ] Estados: Activo, Inactivo, Suspendido"' \
  '["fase-1","backend","prio-alta"]' "$MS1"

create_issue "F1-26" "ABM de empleados con importador desde Excel" \
  '"## Descripción\nCRUD completo de empleados. Importar desde Horas-y-vales.xlsx.\n\n## Criterios de aceptación\n- [ ] Formulario de alta de empleado con todos los campos\n- [ ] Import desde Excel con detección de duplicados por DNI\n- [ ] Lista de empleados con filtros por categoría y estado\n- [ ] Ficha de empleado con historial de jornadas"' \
  '["fase-1","full-stack","prio-alta"]' "$MS1"

create_issue "F1-27" "API de carga de jornadas por empleado" \
  '"## Descripción\nCampos: empleado_id, evento_id, fecha, convocatoria, hora_ingreso, hora_salida, horas_normales, horas_extras, descripcion.\n\n## Criterios de aceptación\n- [ ] POST crear jornada\n- [ ] Cálculo automático de horas_normales y horas_extras\n- [ ] Validación: no duplicar jornada del mismo empleado en la misma fecha\n- [ ] Estado inicial: PENDIENTE"' \
  '["fase-1","backend","prio-alta"]' "$MS1"

create_issue "F1-28" "UI de carga de jornada (vista empleado)" \
  '"## Descripción\nPantalla simple para que el empleado cargue su jornada diaria.\n\n## Criterios de aceptación\n- [ ] Select de evento (solo eventos activos)\n- [ ] Campos: hora ingreso, hora salida (time picker)\n- [ ] Cálculo automático de horas trabajadas\n- [ ] Descripción de actividades\n- [ ] Confirmación visual de carga exitosa"' \
  '["fase-1","frontend","prio-alta"]' "$MS1"

create_issue "F1-29" "Flujo de aprobación de jornadas" \
  '"## Descripción\nEl supervisor aprueba o rechaza cada jornada. Estados: Pendiente → Aprobada/Rechazada.\n\n## Criterios de aceptación\n- [ ] Vista de jornadas pendientes para el supervisor\n- [ ] Aprobar/rechazar individual o por lote\n- [ ] Campo de observaciones al rechazar\n- [ ] Notificación al empleado (futura: email)\n- [ ] Jornadas rechazadas pueden reenviarse"' \
  '["fase-1","full-stack","prio-alta"]' "$MS1"

create_issue "F1-30" "Módulo de anticipos y vales por empleado" \
  '"## Descripción\nAnticipo: monto, fecha, motivo. Se descuenta automáticamente en la liquidación.\n\n## Criterios de aceptación\n- [ ] CRUD de anticipos por empleado\n- [ ] Anticipo pendiente de descuento vs descontado\n- [ ] Se resta del total en la liquidación\n- [ ] Historial de anticipos en ficha del empleado"' \
  '["fase-1","backend","prio-alta"]' "$MS1"

create_issue "F1-31" "Liquidación automática por empleado y evento" \
  '"## Descripción\nCalcular: horas normales × valor_hora + extras × valor_hora_extra - anticipos - descuentos = total.\n\n## Criterios de aceptación\n- [ ] Cálculo automático al generar liquidación\n- [ ] Detalle de horas por jornada\n- [ ] Descuento de anticipos pendientes\n- [ ] Total a cobrar correcto\n- [ ] Estado: Borrador → Aprobada → Pagada"' \
  '["fase-1","backend","prio-alta"]' "$MS1"

create_issue "F1-32" "UI de liquidaciones con aprobación y exportación" \
  '"## Descripción\nTabla de liquidaciones por evento. Al aprobar → genera Egreso automático.\n\n## Criterios de aceptación\n- [ ] Vista por evento con todos los empleados\n- [ ] Detalle de horas, extras, anticipos y total\n- [ ] Botón aprobar liquidación → crea Egreso en el evento\n- [ ] Exportación Excel con firma de recibido\n- [ ] Export PDF individual por empleado"' \
  '["fase-1","frontend","prio-alta"]' "$MS1"

create_issue "F1-33" "Importador de jornadas desde Excel (historial)" \
  '"## Descripción\nLeer Horas-y-vales.xlsx y crear jornadas masivamente para migrar el historial.\n\n## Criterios de aceptación\n- [ ] Parseo de hojas por empleado\n- [ ] Mapeo de columnas: día, fecha, inicio, fin, extras\n- [ ] Preview antes de confirmar\n- [ ] Reporte de jornadas creadas/omitidas"' \
  '["fase-1","backend","prio-media"]' "$MS1"

create_issue "F1-34" "Modelo TransferenciaEvento" \
  '"## Descripción\nevento_origen_id, evento_destino_id, monto, fecha, estado, observaciones.\n\n## Criterios de aceptación\n- [ ] Schema y migración\n- [ ] Estados: Pendiente, Devuelta parcialmente, Devuelta, Cancelada\n- [ ] No impacta en Ingresos ni Egresos del evento"' \
  '["fase-1","backend","prio-media"]' "$MS1"

create_issue "F1-35" "API de transferencias entre eventos" \
  '"## Descripción\nPOST crear, PATCH devolver parcialmente, PATCH devolver total, PATCH cancelar.\n\n## Criterios de aceptación\n- [ ] Validación: ambos eventos deben ser del mismo dueño\n- [ ] El monto no puede exceder el saldo del evento origen\n- [ ] Devolución parcial reduce el monto pendiente\n- [ ] Log de auditoría"' \
  '["fase-1","backend","prio-media"]' "$MS1"

create_issue "F1-36" "UI de transferencias entre eventos" \
  '"## Descripción\nPantalla por evento mostrando transferencias recibidas y enviadas.\n\n## Criterios de aceptación\n- [ ] Lista de transferencias enviadas y recibidas\n- [ ] Formulario: evento destino, monto, fecha, observaciones\n- [ ] Estado visual claro (pendiente/devuelta)\n- [ ] Botón devolver con monto parcial o total"' \
  '["fase-1","frontend","prio-media"]' "$MS1"

create_issue "F1-37" "Vista de pagos pendientes para Tesorería (Matías)" \
  '"## Descripción\nDashboard simplificado para Matías: facturas aprobadas listas para pagar.\n\n## Criterios de aceptación\n- [ ] Lista de facturas en estado APROBADA\n- [ ] Datos bancarios del proveedor visibles (CUIT, CBU, alias)\n- [ ] Monto total a pagar consolidado\n- [ ] Filtros: por evento, por vencimiento\n- [ ] Sin acceso al resto del sistema"' \
  '["fase-1","frontend","prio-alta"]' "$MS1"

create_issue "F1-38" "Flujo de aprobación de pagos por Tesorería" \
  '"## Descripción\nFlujo: Factura APROBADA → Tesorería la marca como PAGADA con referencia bancaria.\n\n## Criterios de aceptación\n- [ ] Botón PAGAR en la vista de Tesorería\n- [ ] Campos: fecha de pago, referencia bancaria (número de transferencia)\n- [ ] Factura pasa a estado PAGADA\n- [ ] Se crea el Egreso automáticamente si tiene tab configurada"' \
  '["fase-1","full-stack","prio-alta"]' "$MS1"

create_issue "F1-39" "Exportación de listado de pagos pendientes" \
  '"## Descripción\nExcel con: proveedor, CUIT, CBU/alias, monto, concepto. Para enviar al banco.\n\n## Criterios de aceptación\n- [ ] Un click genera el Excel de pagos pendientes\n- [ ] Datos bancarios del proveedor incluidos\n- [ ] Agrupado por fecha de vencimiento\n- [ ] Formato compatible con sistemas bancarios"' \
  '["fase-1","backend","prio-alta"]' "$MS1"

echo ""
echo "📦 FASE 2 — Gestión Comercial"

create_issue "F2-01" "Modelo Proyecto/Cotización" \
  '"## Descripción\nnombre, cliente, responsable, fecha_evento, lugar, asistentes_estimados, estado, observaciones.\n\n## Criterios de aceptación\n- [ ] Schema con todos los campos\n- [ ] Estados: Borrador, Enviado, Aprobado, Rechazado, Convertido\n- [ ] Vinculación a Evento (evento_id) al convertir\n- [ ] Soft delete"' \
  '["fase-2","backend","prio-alta"]' "$MS2"

create_issue "F2-02" "CRUD de proyectos con estados y transiciones" \
  '"## Descripción\nAPI completa con validaciones de transición de estado.\n\n## Criterios de aceptación\n- [ ] POST, GET, PUT, DELETE con soft delete\n- [ ] Validaciones de transición (no volver de Aprobado a Borrador)\n- [ ] Filtros: por estado, responsable, fecha\n- [ ] Historial de cambios de estado"' \
  '["fase-2","backend","prio-alta"]' "$MS2"

create_issue "F2-03" "Conversión Proyecto → Evento sin recargar datos" \
  '"## Descripción\nUn click convierte el proyecto en evento, precargando datos de la ficha técnica.\n\n## Criterios de aceptación\n- [ ] Botón CONVERTIR EN EVENTO en el detalle del proyecto\n- [ ] Pre-carga: nombre, fecha, lugar, socios\n- [ ] Rubros de la ficha técnica → Egresos en estado Pendiente\n- [ ] Proyecto queda en estado CONVERTIDO"' \
  '["fase-2","full-stack","prio-alta"]' "$MS2"

create_issue "F2-04" "UI de lista y detalle de proyectos" \
  '"## Descripción\nLista con Kanban de estados y vista detalle con historial.\n\n## Criterios de aceptación\n- [ ] Lista con filtros por estado y responsable\n- [ ] Vista Kanban (columnas por estado) — opcional\n- [ ] Detalle con datos del proyecto y ficha técnica\n- [ ] Historial de cambios de estado con usuario y fecha"' \
  '["fase-2","frontend","prio-alta"]' "$MS2"

create_issue "F2-05" "PDF de cotización para cliente (Vicky)" \
  '"## Descripción\nPDF profesional con logo, rubros, precios estimados y condiciones.\n\n## Criterios de aceptación\n- [ ] Template con logo configurable\n- [ ] Rubros agrupados por categoría\n- [ ] Precios estimados por rubro y total\n- [ ] Condiciones de pago y validez\n- [ ] Número de versión del presupuesto"' \
  '["fase-2","backend","prio-media"]' "$MS2"

create_issue "F2-06" "Library de rubros configurables (~30 categorías)" \
  '"## Descripción\nABM de rubros con categorías predefinidas. Configurable desde admin.\n\n## Criterios de aceptación\n- [ ] ~30 rubros predefinidos: Producción, Sonido, Luces, Streaming, Escenario, Seguridad, etc.\n- [ ] Campos: nombre, categoría, unidad, costo_estimado, proveedor_sugerido\n- [ ] Activar/desactivar rubros sin eliminarlos\n- [ ] UI en sección Configuración"' \
  '["fase-2","backend","prio-alta"]' "$MS2"

create_issue "F2-07" "Ficha Técnica por proyecto/evento" \
  '"## Descripción\nChecklist de rubros activos con descripción, cantidad, unidad, costo estimado y proveedor sugerido.\n\n## Criterios de aceptación\n- [ ] Modelo FichaTecnica vinculado a proyecto_id o evento_id\n- [ ] API para activar/desactivar rubros y completar campos\n- [ ] Los rubros activos generan líneas de presupuesto"' \
  '["fase-2","backend","prio-alta"]' "$MS2"

create_issue "F2-08" "UI de ficha técnica (Dani marca rubros)" \
  '"## Descripción\nVista checklist donde Dani activa los rubros necesarios para el evento.\n\n## Criterios de aceptación\n- [ ] Checklist agrupado por categoría\n- [ ] Al activar un rubro: campos cantidad, descripción, proveedor sugerido\n- [ ] Progreso visual: X de Y rubros completados\n- [ ] Botón CONFIRMAR FICHA genera egresos pendientes"' \
  '["fase-2","frontend","prio-alta"]' "$MS2"

create_issue "F2-09" "Generación automática de egresos desde ficha técnica" \
  '"## Descripción\nAl confirmar ficha técnica, crear Egresos en estado Pendiente para cada rubro activo.\n\n## Criterios de aceptación\n- [ ] Un Egreso por rubro activo en la ficha\n- [ ] Estado inicial: PENDIENTE\n- [ ] Proveedor sugerido pre-cargado (editable)\n- [ ] Presupuesto = costo_estimado del rubro"' \
  '["fase-2","backend","prio-alta"]' "$MS2"

create_issue "F2-10" "Presupuestador: generación automática desde rubros" \
  '"## Descripción\nA partir de la ficha técnica, generar presupuesto con costos estimados.\n\n## Criterios de aceptación\n- [ ] Presupuesto generado desde ficha técnica\n- [ ] Costo por rubro editable\n- [ ] IVA configurable por rubro\n- [ ] Total automático con y sin IVA"' \
  '["fase-2","backend","prio-alta"]' "$MS2"

create_issue "F2-11" "Versiones de presupuesto" \
  '"## Descripción\nGuardar múltiples versiones (v1, v2, final) con comparativa.\n\n## Criterios de aceptación\n- [ ] Crear nueva versión desde la actual\n- [ ] Comparativa lado a lado entre versiones\n- [ ] Marcar una versión como FINAL\n- [ ] Historial de versiones con fecha y usuario"' \
  '["fase-2","full-stack","prio-media"]' "$MS2"

create_issue "F2-12" "UI del presupuestador con edición inline" \
  '"## Descripción\nTabla editable de rubros con precio unitario, cantidad y subtotal automático.\n\n## Criterios de aceptación\n- [ ] Tabla editable estilo MovimientoTable\n- [ ] Precio unitario y cantidad editables inline\n- [ ] Subtotal calculado automáticamente\n- [ ] Total general con IVA y sin IVA\n- [ ] Agregar rubros no contemplados en la ficha"' \
  '["fase-2","frontend","prio-alta"]' "$MS2"

create_issue "F2-13" "Export PDF de presupuesto para cliente" \
  '"## Descripción\nPDF profesional con rubros, precios y totales. Logo configurable.\n\n## Criterios de aceptación\n- [ ] Logo de la empresa en el header\n- [ ] Rubros agrupados con subtotales\n- [ ] IVA y total final destacado\n- [ ] Número de versión y fecha de validez\n- [ ] Firma digital o espacio para firma"' \
  '["fase-2","backend","prio-alta"]' "$MS2"

create_issue "F2-14" "Modelo Cortesía y Beneficio" \
  '"## Descripción\nCortesia: evento_id, empresa, persona, autorizo, estado. Beneficio: tipo, cantidad, entregados.\n\n## Criterios de aceptación\n- [ ] Schema con relaciones correctas\n- [ ] Tipos de beneficio: Kit Estándar, Kit Full, Tourmalet, Parking, VIP\n- [ ] Una cortesía puede tener múltiples tipos de beneficio\n- [ ] Estados: Pendiente, Visado, Entregado"' \
  '["fase-2","backend","prio-alta"]' "$MS2"

create_issue "F2-15" "CRUD de cortesías con múltiples beneficios" \
  '"## Descripción\nAPI completa. Una cortesía puede tener múltiples beneficios simultáneos.\n\n## Criterios de aceptación\n- [ ] POST crear cortesía con N beneficios\n- [ ] PUT actualizar estado de entrega por beneficio\n- [ ] GET con filtros: empresa, tipo_beneficio, estado\n- [ ] DELETE con soft delete"' \
  '["fase-2","backend","prio-alta"]' "$MS2"

create_issue "F2-16" "UI de gestión de cortesías por evento" \
  '"## Descripción\nTabla con empresa, persona, tipos de beneficio, cantidades, visado y entregado.\n\n## Criterios de aceptación\n- [ ] Tabla con todas las cortesías del evento\n- [ ] Columnas por tipo de beneficio con cantidad y estado\n- [ ] Búsqueda por nombre o empresa\n- [ ] Contadores: total cortesías, pendientes, entregadas"' \
  '["fase-2","frontend","prio-alta"]' "$MS2"

create_issue "F2-17" "Control de entrega de cortesías (check-in)" \
  '"## Descripción\nMarcar cada cortesía como visada y entregada. Contadores en tiempo real.\n\n## Criterios de aceptación\n- [ ] Toggle visado/entregado por fila\n- [ ] Actualización en tiempo real sin recargar\n- [ ] Contador de pendientes en el header\n- [ ] Modo check-in: pantalla optimizada para acreditación"' \
  '["fase-2","frontend","prio-alta"]' "$MS2"

create_issue "F2-18" "Importador de cortesías desde Excel (Cortesias.xlsx)" \
  '"## Descripción\nLeer el Excel de cortesías de Male y crear cortesías masivamente por evento.\n\n## Criterios de aceptación\n- [ ] Parseo de las columnas del Excel de Male\n- [ ] Mapeo de tipos de kit a los tipos del sistema\n- [ ] Preview con errores antes de confirmar\n- [ ] Cortesías existentes no se duplican (upsert por empresa+persona)"' \
  '["fase-2","backend","prio-media"]' "$MS2"

create_issue "F2-19" "Importar padrón de inscriptos" \
  '"## Descripción\nImportar la hoja de padrón (44 columnas) para cruzar con cortesías.\n\n## Criterios de aceptación\n- [ ] Parser de las 44 columnas del padrón\n- [ ] Entidad Inscripto separada\n- [ ] Búsqueda de inscripto al crear cortesía\n- [ ] Export de padrón filtrado"' \
  '["fase-2","backend","prio-baja"]' "$MS2"

echo ""
echo "📦 FASE 3 — Control y Análisis"

create_issue "F3-01" "Dashboard KPIs empresa (vista macro)" \
  '"## Descripción\nKPIs globales: eventos activos, ingresos totales, egresos, saldo neto, caja, RRHH.\n\n## Criterios de aceptación\n- [ ] Cards con métricas en tiempo real\n- [ ] Ingresos y egresos de TODOS los eventos activos\n- [ ] Saldo de caja consolidado empresa-wide\n- [ ] RRHH: jornadas pendientes de aprobación, liquidaciones pendientes"' \
  '["fase-3","full-stack","prio-alta"]' "$MS3"

create_issue "F3-02" "Alertas globales en dashboard" \
  '"## Descripción\nAlertas: facturas vencidas, eventos sin cerrar, pagos pendientes, RRHH sin liquidar, caja negativa.\n\n## Criterios de aceptación\n- [ ] 6 tipos de alerta implementados\n- [ ] Severidad: Error (rojo), Warning (amarillo), Info (azul)\n- [ ] Click en alerta navega al item afectado\n- [ ] Contador de alertas en el sidebar"' \
  '["fase-3","full-stack","prio-alta"]' "$MS3"

create_issue "F3-03" "Gráficos: por evento, por rubro, evolución mensual" \
  '"## Descripción\nBarChart ingresos vs egresos. LineChart evolución mensual. PieChart por rubro.\n\n## Criterios de aceptación\n- [ ] BarChart por evento con ingresos y egresos\n- [ ] LineChart evolución mensual del año actual\n- [ ] PieChart distribución por rubro de egresos\n- [ ] Tooltips con montos formateados\n- [ ] Responsive en mobile"' \
  '["fase-3","frontend","prio-media"]' "$MS3"

create_issue "F3-04" "Vista macro cross-evento con filtros avanzados" \
  '"## Descripción\nTabla global filtrable con exportación directa desde la vista.\n\n## Criterios de aceptación\n- [ ] Todos los movimientos de todos los eventos\n- [ ] Filtros: evento, fecha, tipo, rubro, responsable, estado\n- [ ] Export Excel/CSV directo con los filtros aplicados\n- [ ] Paginación 50 items por página"' \
  '["fase-3","frontend","prio-alta"]' "$MS3"

create_issue "F3-05" "Reporte resultado por evento" \
  '"## Descripción\nIngresos, egresos, presupuesto vs real, saldo, distribución socios. Excel y PDF.\n\n## Criterios de aceptación\n- [ ] Resumen financiero completo del evento\n- [ ] Comparativa presupuesto vs real por rubro\n- [ ] Distribución automática entre socios\n- [ ] Export Excel y PDF con logo"' \
  '["fase-3","backend","prio-alta"]' "$MS3"

create_issue "F3-06" "Reporte anual de la empresa" \
  '"## Descripción\nResumen por mes: ingresos, egresos, resultado. Con comparativa año anterior.\n\n## Criterios de aceptación\n- [ ] Tabla 12 meses con ingresos/egresos/resultado\n- [ ] Comparativa con año anterior si hay datos\n- [ ] Gráfico de evolución mensual incluido en el PDF\n- [ ] Export Excel y PDF"' \
  '["fase-3","backend","prio-media"]' "$MS3"

create_issue "F3-07" "Reporte de gastos por proveedor y rubro" \
  '"## Descripción\nTop proveedores por monto, gastos por categoría, evolución histórica.\n\n## Criterios de aceptación\n- [ ] Ranking de proveedores por monto total\n- [ ] Distribución por categoría de rubro\n- [ ] Evolución por trimestre\n- [ ] Filtros por período y evento"' \
  '["fase-3","backend","prio-media"]' "$MS3"

create_issue "F3-08" "Reporte de RRHH: horas y liquidaciones" \
  '"## Descripción\nPor empleado y por evento: horas normales, extras, anticipos, total liquidado.\n\n## Criterios de aceptación\n- [ ] Total de horas por empleado en el período\n- [ ] Desglose de horas normales vs extras\n- [ ] Anticipos descontados\n- [ ] Total liquidado vs pendiente de pago"' \
  '["fase-3","backend","prio-alta"]' "$MS3"

create_issue "F3-09" "Reporte de facturas para cruce con AFIP" \
  '"## Descripción\nLista de facturas con CUIT, estado y evento asignado para el contador.\n\n## Criterios de aceptación\n- [ ] CUIT del proveedor incluido en cada fila\n- [ ] Número de factura y fecha de emisión\n- [ ] Estado (pagada/pendiente) y evento\n- [ ] Filtros por período (trimestral, anual)\n- [ ] Export CSV compatible con Excel del contador"' \
  '["fase-3","backend","prio-alta"]' "$MS3"

create_issue "F3-10" "UI de reportes con filtros y exportación" \
  '"## Descripción\nPantalla unificada. Selector de tipo de reporte, filtros, formato de exportación.\n\n## Criterios de aceptación\n- [ ] 6 tipos de reporte disponibles\n- [ ] Filtros: período, evento, proveedor, responsable\n- [ ] Preview en pantalla antes de exportar\n- [ ] Formatos: Excel, PDF, CSV\n- [ ] Historial de reportes generados"' \
  '["fase-3","frontend","prio-alta"]' "$MS3"

create_issue "F3-11" "Modelo Archivo multi-entidad" \
  '"## Descripción\nUn archivo puede relacionarse con múltiples entidades: Evento, Proveedor, Factura, Empleado, Proyecto.\n\n## Criterios de aceptación\n- [ ] Tabla Archivo con FK opcionales a cada entidad\n- [ ] Tipos soportados: PDF, Excel, Word, imagen, video, ZIP\n- [ ] Metadata: nombre, tipo, tamaño, fecha, usuario\n- [ ] Soft delete"' \
  '["fase-3","backend","prio-alta"]' "$MS3"

create_issue "F3-12" "API de repositorio documental" \
  '"## Descripción\nCRUD de archivos. Upload a DB. Búsqueda por entidad relacionada.\n\n## Criterios de aceptación\n- [ ] POST upload con metadata\n- [ ] GET con filtros por tipo y entidad\n- [ ] GET /download con Content-Disposition correcto\n- [ ] Límite de 20MB por archivo\n- [ ] Solo PDF, Excel, Word, imágenes y ZIP aceptados"' \
  '["fase-3","backend","prio-alta"]' "$MS3"

create_issue "F3-13" "Búsqueda global de archivos" \
  '"## Descripción\nBuscar por nombre, tipo, entidad relacionada. Buscar proveedor → ver sus facturas adjuntas.\n\n## Criterios de aceptación\n- [ ] Búsqueda por texto libre en nombre y descripción\n- [ ] Filtros por tipo de archivo y entidad\n- [ ] Resultados ordenados por relevancia y fecha\n- [ ] Preview de PDF e imágenes en los resultados"' \
  '["fase-3","backend","prio-media"]' "$MS3"

create_issue "F3-14" "UI de repositorio con organización por entidad" \
  '"## Descripción\nVista tipo explorador. Árbol por evento/proveedor/empleado. Preview integrado.\n\n## Criterios de aceptación\n- [ ] Árbol de navegación por entidad\n- [ ] Vista grid y lista de archivos\n- [ ] Preview de PDF en modal\n- [ ] Drag & drop para subir archivos\n- [ ] Búsqueda dentro del repositorio"' \
  '["fase-3","frontend","prio-media"]' "$MS3"

echo ""
echo "📦 FASE 4 — Multimedia"

create_issue "F4-01" "Configurar AWS S3 + CloudFront para multimedia" \
  '"## Descripción\nBucket S3 con políticas correctas. CloudFront CDN. Intelligent Tiering activado.\n\n## Criterios de aceptación\n- [ ] Bucket S3 creado con políticas de acceso correctas\n- [ ] CloudFront distribution configurada\n- [ ] Intelligent Tiering activado (ahorro automático de costos)\n- [ ] CORS configurado para upload desde el browser\n- [ ] Variables de entorno documentadas"' \
  '["fase-4","devops","prio-alta"]' "$MS4"

create_issue "F4-02" "Presigned URLs para upload directo a S3" \
  '"## Descripción\nEl backend genera URLs temporales. El cliente sube directo a S3 sin pasar por EC2.\n\n## Criterios de aceptación\n- [ ] Endpoint POST /api/archivos/presigned-url\n- [ ] URL con expiración de 15 minutos\n- [ ] Validación de tipo de archivo antes de generar la URL\n- [ ] Límite de tamaño configurable (default 500MB para videos)"' \
  '["fase-4","backend","prio-alta"]' "$MS4"

create_issue "F4-03" "Lambda para thumbnails automáticos" \
  '"## Descripción\nAl subir foto/video a S3, Lambda genera thumbnail. Guardado en /thumbnails/ del mismo bucket.\n\n## Criterios de aceptación\n- [ ] Trigger: S3 PUT event\n- [ ] Fotos: thumbnail 300x300px\n- [ ] Videos: frame del segundo 5 como thumbnail\n- [ ] Thumbnail guardado en S3 bajo prefijo thumbnails/\n- [ ] URL del thumbnail guardada en DB"' \
  '["fase-4","devops","prio-alta"]' "$MS4"

create_issue "F4-04" "Modelo Archivo multimedia" \
  '"## Descripción\nnombre, tipo, S3_key, thumbnail_key, tamanio, evento_id, subido_por, estado, tags.\n\n## Criterios de aceptación\n- [ ] Schema con todos los campos\n- [ ] Estados: Pendiente, Aprobado, Rechazado\n- [ ] Tags como array de strings\n- [ ] Soft delete"' \
  '["fase-4","backend","prio-alta"]' "$MS4"

create_issue "F4-05" "API de galería multimedia por evento" \
  '"## Descripción\nGET lista con filtros, POST iniciar upload, PATCH aprobar/rechazar, DELETE.\n\n## Criterios de aceptación\n- [ ] GET con filtros: tipo, estado, fecha, tag, subido_por\n- [ ] POST: genera presigned URL + crea registro en DB con estado PENDIENTE\n- [ ] PATCH /aprobar y /rechazar con motivo opcional\n- [ ] DELETE: soft delete + eliminar de S3"' \
  '["fase-4","backend","prio-alta"]' "$MS4"

create_issue "F4-06" "UI de galería por evento (Mayra aprueba contenido)" \
  '"## Descripción\nGrid de thumbnails con aprobación por lote y vista en pantalla completa.\n\n## Criterios de aceptación\n- [ ] Grid de thumbnails responsivo\n- [ ] Filtros: tipo (foto/video), estado, fotógrafo\n- [ ] Click → vista en pantalla completa con navegación\n- [ ] Seleccionar múltiples → aprobar/rechazar por lote\n- [ ] Contador: pendientes / aprobados / rechazados"' \
  '["fase-4","frontend","prio-alta"]' "$MS4"

create_issue "F4-07" "Descarga masiva de contenido aprobado" \
  '"## Descripción\nSeleccionar múltiples archivos y descargar como ZIP.\n\n## Criterios de aceptación\n- [ ] Select múltiple con checkbox por archivo\n- [ ] Botón DESCARGAR SELECCIONADOS\n- [ ] ZIP generado en backend con los archivos de S3\n- [ ] Progreso de generación del ZIP\n- [ ] Descarga automática al completar"' \
  '["fase-4","backend","prio-media"]' "$MS4"

create_issue "F4-08" "Modelo UsuarioExterno (fotógrafo)" \
  '"## Descripción\nnombre, email, token_acceso JWT temporal, eventos_asignados, activo.\n\n## Criterios de aceptación\n- [ ] Schema separado de Usuario interno\n- [ ] Token JWT con expiración de 7 días\n- [ ] Puede asignarse a múltiples eventos\n- [ ] Revocación de acceso manual"' \
  '["fase-4","backend","prio-alta"]' "$MS4"

create_issue "F4-09" "Link temporal por evento para fotógrafo" \
  '"## Descripción\nMayra asigna fotógrafo a evento. Sistema genera link con JWT. Se envía por email (SES).\n\n## Criterios de aceptación\n- [ ] Endpoint POST /api/externos/generar-link\n- [ ] JWT con evento_id y expiración 7 días\n- [ ] Email automático con el link (AWS SES)\n- [ ] Historial de links generados por evento"' \
  '["fase-4","backend","prio-alta"]' "$MS4"

create_issue "F4-10" "UI de upload para fotógrafo (sin cuenta del sistema)" \
  '"## Descripción\nPantalla simple accesible con el link temporal. Drag & drop, progreso, confirmación.\n\n## Criterios de aceptación\n- [ ] Accesible solo con el token del link\n- [ ] Drag & drop de múltiples archivos\n- [ ] Barra de progreso por archivo\n- [ ] Vista previa antes de subir\n- [ ] Confirmación de upload exitoso\n- [ ] Sin acceso al resto del sistema"' \
  '["fase-4","frontend","prio-alta"]' "$MS4"

create_issue "F4-11" "Gestión de fotógrafos externos desde Configuración" \
  '"## Descripción\nLista de fotógrafos, asignación a eventos, historial de uploads, revocar acceso.\n\n## Criterios de aceptación\n- [ ] ABM de fotógrafos externos\n- [ ] Asignar fotógrafo a evento desde el detalle del evento\n- [ ] Historial de archivos subidos por fotógrafo\n- [ ] Revocar acceso con un click\n- [ ] Generar nuevo link si el anterior venció"' \
  '["fase-4","frontend","prio-media"]' "$MS4"

create_issue "F4-12" "Migrar archivos de DB a S3" \
  '"## Descripción\nMover pdf_data de tabla Factura y Archivo a S3. Actualizar referencias en DB.\n\n## Criterios de aceptación\n- [ ] Script de migración: leer pdf_data de DB → subir a S3 → actualizar S3_key\n- [ ] Limpiar pdf_data de DB después de confirmar migración exitosa\n- [ ] Rollback posible si algo falla\n- [ ] Cero downtime durante la migración"' \
  '["fase-4","backend","prio-alta"]' "$MS4"

create_issue "F4-13" "Búsqueda de multimedia por tags y fecha" \
  '"## Descripción\nBuscar fotos/videos por evento, tag, fecha, fotógrafo. Grid de thumbnails.\n\n## Criterios de aceptación\n- [ ] Búsqueda por texto en nombre y tags\n- [ ] Filtros: evento, fotógrafo, tipo, fecha desde/hasta\n- [ ] Resultados en grid de thumbnails\n- [ ] Ordenar por fecha o por relevancia"' \
  '["fase-4","full-stack","prio-media"]' "$MS4"

echo ""
echo "════════════════════════════════════════"
echo "✅ COMPLETADO"
echo "   Total issues creados: ${TOTAL}"
echo ""
echo "📋 PRÓXIMOS PASOS EN GITHUB:"
echo "   1. Ir a github.com/${REPO}/projects"
echo "   2. Crear nuevo Project (Board)"
echo "   3. Agregar columnas: Backlog | En progreso | En revisión | Completado"
echo "   4. Ir a Issues → filtrar por milestone → agregar al tablero"
echo "   5. Invitar a Mayra como collaborator (rol Triage) para visibilidad del cliente"
echo "════════════════════════════════════════"
