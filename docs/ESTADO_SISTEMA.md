# Estado del sistema — Enjoy · DOS57

> Fuente única del avance por pilar. Se actualiza al cerrar cada funcionalidad y se toma una foto mensual en `docs/avance/AAAA-MM.md`.
> Última actualización: 2026-11-04 · **Primera versión completa** (10 de 12 pilares relevados; Marketing y Comunicación quedan pendientes con Vicky)

## Cómo se lee

| Estado | Significado | Cuenta para el % |
|---|---|---|
| ✅ | Construido y funcionando | 1 |
| 🟡 | Parcial: existe pero le falta una parte | 0,5 |
| ⬜ | Pedido en el relevamiento, todavía no está | 0 |
| ❓ | Hay que definirlo con el cliente antes de hacerlo | 0 (y se lista aparte) |
| — | No aplica a esa empresa | no cuenta |

- **% construido** = puntos ÷ funcionalidades que aplican a esa empresa.
- **% en uso** = de lo construido, lo que ya se usa con datos reales. Arranca con la primera prueba en producción (ver `Preparacion_Prueba_Produccion.docx`).
- Cada funcionalidad cuenta en **un solo pilar**. Si toca a otros, se aclara en "Se conecta con", pero no se cuenta dos veces.
- El total del pilar sale de **lo que se pidió** (relevamientos, planillas, especificación), no solo de lo que ya está hecho.

## Pilares

| # | Pilar | Responsables | DOS57 | Enjoy |
|---|---|---|---|---|
| 01 | RRHH | Mayra (ambas) · Andrea, Lorena, Jazmín, Santi (DOS57) · Male, Daniel (Enjoy) | 87% | 83% |
| 02 | Finanzas | Mayra (ambas) · Andrea, Santi y Nico (DOS57) · Male, Chino (Enjoy) | 72% | 74% |
| 03 | Administración | Mayra, Matías · Andrea, Florencia (DOS57) · Chino, Male, Vicky (Enjoy) | 87% | 82% |
| 04 | Proveedores | Mayra (ambas) · Andrea, Santi y Nico (DOS57) · Male, Nico (Enjoy) | 73% | 71% |
| 05 | Depósito | Sergio (Pollo), Verónica, Jazmín (DOS57) · Daniel (Enjoy) | 78%* | 82% |
| 06 | Logística | Florencia, Lorena, Santi y Nico, Jazmín (DOS57) · Daniel, Chino (Enjoy) | 86% | 86% |
| 07 | Seguros | Lorena, Andrea, Mayra (DOS57) · Mayra (Enjoy) | 61% | 50% |
| 08 | Marketing | Vicky | pendiente de relevar | |
| 09 | Comunicación | Vicky | pendiente de relevar | |
| 10 | Novedades | Santi (flota), Florencia (eventos), todos | 17% | 17% |
| 11 | Varios y módulos auxiliares | Matías (administrador del sistema) | 90% | 90% |
| 12 | Calendario transversal *(nuevo)* | todos | 80% | 80% |

---

## 01 · RRHH

**DOS57: 87% construido (26 de 30) · Enjoy: 83% construido (15 de 18) · En uso: 0%, arranca con la prueba en producción**

Responsables: Mayra cierra sueldos de las dos empresas. En DOS57 la alimentan Lorena (presentismo, padrón, siniestros, uniformes), Andrea (jornaleros, adelantos, gastos del mes), Jazmín (parte diario) y Santi. En Enjoy: Male (jornaleros) y Daniel (personal técnico).

Se conecta con: Depósito (parte diario y pañol cargan horas a la gente que está ahí), Logística (choferes, bitácora, carnets, multas), Administración (la liquidación genera el egreso del evento), Seguros (ART/AP y siniestros del personal), Calendario (vencimientos y pendientes).

### Base de personal

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 1 | Padrón único de empleados: datos personales, contacto de emergencia, grupo sanguíneo, talles, licencia, equipamiento; con importador | ✅ | ✅ | Datos DOS57_Datos Personales (Lorena) · Especificación Enjoy §29 | RRHH → Empleados |
| 2 | Categorías y grupos de liquidación (capitán, armador, chofer, Fofis, Nestoras, extranjeros, sereno…) | ✅ | ✅ | Relevamiento Andrea | RRHH → Empleados |
| 3 | Empleado repartido entre las dos empresas (% por empresa) | ✅ | ✅ | Mayra | RRHH → Empleados |
| 4 | Alta de jornaleros desde el formulario de Google, sin duplicados (DNI/CUIT) | ✅ | ✅ | Proveedores - Datos (Respuestas) | Importar |
| 5 | Cargar el padrón sin ver los sueldos (permiso puntual) | ✅ | ✅ | Prueba en producción (Lorena) | Configuración → Usuarios |

### Horas y presencia

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 6 | Parte diario del personal (quién hace qué cada día), que genera las jornadas | ✅ | — | TAREAS_PERSONAL_DIARIO (Jazmín) | Parte Diario |
| 7 | Jornadas por evento con aprobación (pendiente / aprobada / rechazada) | ✅ | ✅ | Especificación Enjoy §31-32 · Backlog F1-27/29 | RRHH → Jornadas |
| 8 | Jornalero que carga sus propias horas desde su usuario | ✅ | ✅ | Backlog F1-28 | Rol Jornalero |
| 9 | Importador del histórico de horas y vales | — | ✅ | HORAS Y VALES MARZO 2026 | RRHH → Importar |
| 10 | Presentismo diario: citación por día, demora / llegada tarde, aprobación de tardanzas por Matías | ✅ | — | Registro de Faltas (Lorena) | Presentismo |
| 11 | Semáforo y resumen mensual por persona, con exportación a Excel | ✅ | — | Informe de Lorena a Matías | Presentismo → Mes |
| 12 | Francos por domingo trabajado, con saldo por persona | ✅ | — | Relevamiento Lorena | Presentismo → Francos |
| 13 | Importador de la planilla de presentismo (una hoja por persona) | ✅ | — | Registro de Faltas (Lorena) | Presentismo |
| 14 | Excedente de horas / banco de horas | ✅ | — | Relevamiento Andrea | Gastos del mes |

### Liquidación y pagos

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 15 | Liquidación de jornaleros: por hora (Enjoy) y por jornada con umbral de horas (DOS57) | ✅ | ✅ | SUELDOS JORNALEROS (Andrea) · Especificación §33 | RRHH → Liquidaciones |
| 16 | Al aprobar la liquidación se genera el egreso en el evento | ✅ | ✅ | Backlog F1-32 | RRHH → Liquidaciones |
| 17 | Adelantos, vales, descuentos y multas que se descuentan solos | ✅ | ✅ | Relevamiento Andrea y Lorena | RRHH → Anticipos |
| 18 | Planilla de adelantos (semana del 20) para imprimir y hacer firmar | 🟡 | — | Relevamiento Andrea | El adelanto se carga, falta la planilla de firma |
| 19 | Sueldos administrativos: acuerdos, escalafones, aumento manual o por IPC, premio presentismo, premio producción, vacaciones y aguinaldo, préstamos | ✅ | ✅ | SUELDO DOS57 Julio 2026 (Mayra) | RRHH → Sueldos Admin |
| 20 | Viático automático de los choferes según la bitácora de viajes | ✅ | — | Excel de viajes de Luis | RRHH → Sueldos Admin |
| 21 | Extranjeros: alta como empleado (categoría Extranjero), jornadas, liquidación y costo real del evento ("Staff Extranjeros") | 🟡 | — | EQUIPO EXTRANJEROS (Andrea) · Relevamiento Jazmín | RRHH → Empleados · Falta el viático por persona y por jornal: hoy solo se puede cargar como "gastos varios" en la caja del mes |
| 22 | Premio PAX / premio de equipo | ✅ | — | Relevamiento Andrea | RRHH → Sueldos Admin |
| 23 | Recibos y liquidaciones en PDF | 🟡 | 🟡 | Prueba en producción | Funciona local; en Render falta Chromium y el botón da error |
| 24 | Resumen mensual para el cierre de Mayra, exportable | ✅ | ✅ | Planilla madre de sueldos (Mayra) | Sueldos Admin → Resumen |
| 25 | Reporte de horas y liquidaciones por empleado y por evento | 🟡 | 🟡 | Backlog F3-08 | Existe el de administrativos; falta el de jornaleros por evento |

### Seguimiento del personal

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 26 | Uniformes: stock por talle con mínimo, entregas por persona, importadores | ✅ | ⬜ | 2026_STOCK Uniformes · Entregas 2024 (Lorena) | Uniformes · Enjoy espera la planilla de Daniel |
| 27 | Multas que se descuentan al empleado | ✅ | — | Relevamiento Lorena | Flota → Multas |
| 28 | Carnets de conducir con vencimiento | ✅ | — | Relevamiento Lorena | Flota → Carnets |
| 29 | Mandarle a cada persona su tarea del día (aviso en el sistema o por WhatsApp), en lugar de la captura que Jazmín manda al grupo | ⬜ | — | Relevamiento Jazmín | El parte diario existe, falta el envío |

### Lo que agregó la entrevista de Mayra

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 30 | Vacaciones, aguinaldo y extras como conceptos separados en la liquidación, más premios puntuales que Matías agrega por un tiempo | 🟡 | 🟡 | Entrevista Mayra · SUELDO DOS57 Julio 2026 | Hoy vacaciones y aguinaldo van en un solo concepto |
| 31 | Cierre de sueldos del mes: total a pagar y cuánto va por transferencia y cuánto en efectivo | 🟡 | 🟡 | Entrevista Mayra (conciliación final de la planilla de sueldos) | El resumen mensual da el total; falta separar transferencia y efectivo |

También confirma cosas que ya están: ítems fijos del acuerdo (básico, incentivo, viático, presentismo, antigüedad), premio de producción por evento del mes, viajes del chofer por tipo, adelanto del 30% del básico, sueldo repartido entre las dos empresas, y que lo que carga Lorena (horas y vales) no deja ver los acuerdos, que solo ven Mayra y Matías. El "recibo casero" para mandar por WhatsApp es el punto 23 (PDF).

### Para definir con el cliente

- **Antigüedad:** Mayra renueva la fecha de inicio del acuerdo con cada aumento. Hay que confirmar que la antigüedad se cuente desde el ingreso a la empresa y no desde el último acuerdo.
- **Horas extras negativas:** cuando dan negativo, Matías no las descuenta. ¿El sistema las deja en cero ese mes sin que se arrastre?
- **Premio de producción 1 o 2** (hasta 7 días o más): ¿lo elige Matías evento por evento, o sale solo de la duración del evento?
- **Premio presentismo:** hoy lo pierde quien tiene una falta o una llegada tarde rechazada. Confirmar con Lorena y Mayra.
- **Cortes de demora y llegada tarde:** 6 y 15 minutos, tomados de las marcas de Lorena.
- **Personas sin alta:** 15 de las 26 hojas de presentismo son de personas que todavía no están en RRHH.
- **Escalafón:** el número de nivel existe, falta confirmar qué significa.
- **Choferes:** el presentismo no se pierde por horas. Es una decisión nuestra, falta confirmarla.
- **Escalafones de julio 2026:** confirmar con Mayra si siguen vigentes o hubo aumento.
- **Viáticos de extranjeros** (punto 21): ¿van en la liquidación (monto fijo por jornal) o siguen saliendo de la caja de Andrea con un tipo propio?

---

## 02 · Finanzas

**DOS57: 72% construido (16,5 de 23) · Enjoy: 74% construido (15,5 de 21) · En uso: 0%**

Responsables: Mayra cierra las dos empresas y maneja los bancos (Galicia, Francés, Nación y Rebanking en Enjoy; Galicia, Nación y Rebanking en DOS57). Chino lleva Bancor de Enjoy. En DOS57, Andrea lleva las cajas del mes y Santi y Nico la tarjeta y el combustible. En Enjoy, Male. Matías aprueba los pagos.

Se conecta con: Administración (caja imputada y cobros de cada evento), Proveedores (pagos de facturas, cuentas corrientes de talleres y proveedores), RRHH (sueldos, adelantos, préstamos al personal), Logística (combustible pagado de caja), Calendario (vencimientos de echeqs, cuotas de AFIP, créditos, SGR, facturas a cobrar).

No se cuentan acá: órdenes de compra y comparativos de proveedores (Proveedores), espacios compartidos y coworking (Administración, punto 21), libro de compras de AFIP (Proveedores), resúmenes bancarios y documentación de la empresa (Varios, repositorio).

### Cajas y bancos

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 1 | Caja Global: cuentas de la empresa (efectivo, banco, FIMA), con o sin evento, y saldo consolidado | ✅ | ✅ | CAJAS JULIO-2026 (Andrea) · BANCOS (Mayra) | Caja Global |
| 2 | Cajas chicas por persona (Pollo, Jazmín, David, Daniel, Vicky, coworking…), con rendición y cierre; importador | ✅ | ✅ | CAJAS 2026 (Enjoy) · CAJAS JULIO-2026 (Andrea) · Caja Chica COWORKING (Mayra) | Caja Global |
| 3 | Caja del mes de Andrea con sus categorías (combustible, comida, servicios, vales, varios) | ✅ | — | CAJAS JULIO-2026 (Andrea) | Gastos del mes |
| 4 | Resumen semanal de pagos para que Matías apruebe (grupos de jornaleros, reposición de cajas chicas y de la caja de reserva, pagos a proveedores) | ⬜ | — | PAGOS+CAJAS 2026 (SOLICITUD MATIAS) (Andrea) | Los datos están en el sistema; falta armar el resumen y la aprobación |
| 5 | Saldos en varias monedas, con dólar e IPC actualizados | ✅ | ✅ | Entrevista Mayra | Caja Global · Indicadores |

### Cheques

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 6 | Echeqs del evento: pendientes, cobrados, vendidos (con descuento), rechazados, con vencimientos | ✅ | ✅ | Flujo de Caja Generico (EG-EXTRA) | Evento → Echeqs · Calendario |
| 7 | Cheques físicos (chequera del Francés, poco uso) | 🟡 | 🟡 | Cheques Pendientes - GALICIA · Entrevista Mayra | Se puede elegir "cheque" como medio de pago, pero no hay registro de la chequera |
| 8 | Cheques emitidos de la empresa por banco, también los que no son de un evento, separando los de financiamiento con SGR (cheque propio o avalado) | 🟡 | 🟡 | Entrevista Mayra ("las que llevo casi todos los días") | Los echeqs hoy viven dentro de un evento; falta el registro por banco de la empresa |
| 9 | Aviso de los jueves: cheques que caen el viernes y cuánto hay que cubrir en el banco | ⬜ | ⬜ | Entrevista Mayra | El calendario muestra los echeqs, pero no hay aviso semanal con el total a cubrir |
| 10 | Echeqs recibidos de clientes ligados a la factura que cobran, con aviso para depositarlos o ponerlos en custodia antes del vencimiento | 🟡 | 🟡 | Entrevista Mayra | Se registra el cobro de la factura, pero el echeq recibido no queda ligado con su vencimiento |

### Deudas y compromisos

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 11 | Planes de pago de AFIP: cuotas, fecha límite y fecha real de pago, cuotas pagadas y pendientes, comprobantes; a nombre de la empresa o de un socio | ✅ | ✅ | Planes de Pago AFIP 2024-2026 · Entrevista Mayra | AFIP / Créditos |
| 12 | Créditos bancarios con tabla de amortización y aviso el día anterior al vencimiento | ✅ | ✅ | Detalle de Préstamos Dos57 · Entrevista Mayra | AFIP / Créditos · Calendario |
| 13 | Leasings (por ejemplo, con Layher) | ❓ | ❓ | Entrevista Mayra | Definir si se llevan como crédito o como cuenta corriente |
| 14 | SGR: cupo y vinculación | ✅ | ✅ | Vinculación SGR Enjoy-Dos57 (Mayra) | AFIP / Créditos |
| 15 | Cuentas corrientes con terceros (Layher, talleres, vallas, Polo 52 / Jiménez, Agesta, Airasca, Zamora): facturas, pagos, notas de débito y saldo | ✅ | ✅ | CTAS CTES ESPECIALES y CTAS CTES VARIAS · Entrevista Mayra | Cuentas Corrientes |
| 16 | Cuentas personales de los socios (Matías, Pollo) y Blueteam en dólares | ✅ | ✅ | Blueteam · Entrevista Mayra | Cuentas Corrientes |
| 17 | Agenda de pagos fijos del mes (servicios, expensas, débitos automáticos) con vencimiento, medio de pago y estado | 🟡 | 🟡 | PLANILLA PAGOS MENSUALES TOTALES (Mayra) | Están los gastos fijos de los espacios compartidos y las cuotas de AFIP; falta la agenda general |
| 18 | Tarjeta corporativa: consumos por responsable, personal o empresa, "se descontó", importador | ✅ | ✅ | Tarjeta Corporativa DOS57 y ENJOY 2026 (Santi) · Entrevista Mayra | Tarjeta Corp. |

### Cobranzas y cierre

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 19 | Facturas a cobrar: cobros parciales, reparto entre razones sociales, comisionista, incobrables, vencidas, por evento y por cliente | ✅ | ✅ | FACTURAS DE VENTAS · Control de Pagos Eventos · Facturación Vallas Polaco (Mayra) | Facturas a Cobrar |
| 20 | Clientes fijos compartidos por las dos empresas (Talleres): partidos del semestre, parte de cada empresa, comisión del intermediario, pagos parciales y saldo conciliado en una sola vista | 🟡 | 🟡 | Planilla Talleres-ENP · Planilla Rendición Fútbol 2026 (Mayra) | Las facturas se reparten entre empresas y la comisión existe; falta la vista conciliada de las dos empresas |
| 21 | Importar "Mis Comprobantes Emitidos" de AFIP para no cargar las facturas de venta a mano | ⬜ | ⬜ | 2026 - Mis Comprobantes Emitidos (Mayra) | El de compras existe, el de ventas no |
| 22 | Cierre contable: foto financiera a una fecha de corte, con notas por sección y exportación | ✅ | ✅ | Entrevista Mayra | Cierre Contable |
| 23 | Para el balance del contador: deudores y acreedores a la fecha de cierre (31/5 DOS57, 31/7 Enjoy), incluidas las facturas anteriores al cierre que se pagaron después, con el cheque o la transferencia de cada pago | ✅ | ✅ | DATOS PARA CONFECCIÓN BALANCE y DDJJS · Entrevista Mayra | Cierre Contable · cada pago de factura queda ligado a su echeq |

### Para más adelante (no cuentan para el %)

La especificación de Enjoy (§44) las deja fuera de la primera etapa: conciliación automática con el banco, Mercado Pago y lectura automática de facturas (OCR). Mayra también pidió esto último: que las facturas que llegan por mail y el resumen de la tarjeta se carguen solos.

### Para definir con el cliente

- **Resumen semanal de pagos** (punto 4): ¿Matías lo aprueba línea por línea o en bloque? ¿Lo arma solo Andrea o también Mayra para Enjoy?
- **Cheques de la empresa** (punto 8): ¿se llevan todos en el sistema, también los de Bancor que hace Chino?
- **Aviso de los jueves** (punto 9): ¿a quién le llega, solo a Mayra o también a Matías?
- **Leasings** (punto 13): ¿cuántos hay y con quién?
- **Pagos fijos** (punto 17): ¿incluye los gastos personales de los socios (servicios de Matías y Pollo) o solo los de la empresa? Ojo: esa planilla tiene claves fiscales escritas; el sistema no debería guardarlas.
- **Talleres** (punto 20): ¿hay otros clientes fijos que funcionen igual?

---

## 03 · Administración

**DOS57: 87% construido (16,5 de 19) · Enjoy: 82% construido (15,5 de 19) · En uso: 0%**

Responsables: Mayra (ambas empresas), Matías. En DOS57, Andrea y Florencia (costo real). En Enjoy, Chino, Male y Vicky.

**Dónde termina Administración y empieza Finanzas:** Administración es **la plata y la gestión de cada evento**: alta, ficha, presupuesto, egresos e ingresos, conciliatoria, costo real, control de gestión. Finanzas es **la plata de la empresa**: cajas y bancos, echeqs, tarjeta, cuentas corrientes, AFIP, créditos, SGR, cobranzas y cierre contable. Las facturas a pagar y el libro de compras van en Proveedores.

Se conecta con: RRHH (la liquidación genera el egreso del evento), Depósito (stock propio en la ficha, pérdidas de pañol), Logística (combustible, viajes, comidas y remitos que alimentan el costo real), Finanzas (caja imputada, echeqs, cobros), Proveedores (rubros y pedidos de la ficha), Calendario (eventos, montaje y desmontaje).

No se cuentan acá: auditoría de cambios y repositorio de archivos (Varios), calendario de eventos (Calendario).

### Alta y planificación del evento

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 1 | Presupuesto comercial para el cliente, con estados (borrador, enviado, aprobado) y versiones; en Enjoy, que salga de la ficha técnica, se mande en PDF y se convierta en evento | ✅ | ⬜ | Especificación Enjoy §9-13 · BASE MATRICES RENTAL COST (Flor) | DOS57: Presupuestos · Enjoy: no existe el proyecto comercial previo al evento |
| 2 | Pre-Macro: asistente de alta del evento con socios, reparto y rubros sugeridos por empresa | ✅ | ✅ | Kick-off ("pre-macro por evento") | Pre-Macro |
| 3 | Ficha técnica: rubros con proveedor, presupuesto y estado; pedidos a proveedores; importadores de las planillas | ✅ | ✅ | Ficha de evento · Pedidos de material (Daniel) · Control de Rubros Enjoy | Evento → Ficha |
| 4 | Biblioteca de rubros configurable por empresa | ✅ | ✅ | Especificación §36 · rubros reales DOS57 (Jazmín) | Configuración |
| 5 | Estados del evento a lo largo de su vida (planificación, producción, en ejecución, finalizado, cerrado, archivado) | 🟡 | 🟡 | Especificación §16 | Hoy: confirmado / cancelado en el pre-macro, y activo / cerrado en el evento |
| 6 | Eventos informales y marca de "se factura", con aviso a Mayra cuando se carga un evento que falta facturar | ✅ | ✅ | Entrevista Mayra ("cuando nace un evento, sea cual sea, se tiene que cargar") | Evento |
| 7 | Forma de llevar cada evento: flujo de caja completo, centro de costos (Enjoy) u operativa con costo real (DOS57) | ✅ | ✅ | Relevamiento Male y Flor | Evento |

### La plata del evento

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 8 | Flujo de caja del evento: 5 pestañas de egresos y 5 de ingresos, con debe, haber y saldo, e impuestos fijos | ✅ | ✅ | Flujo de Caja Generico.xlsx | Evento → Egresos / Ingresos |
| 9 | Conciliatoria con reparto entre socios | ✅ | ✅ | Flujo de Caja Generico (RESUMEN) | Evento → Conciliatoria |
| 10 | Centro de costos: presupuesto contra real por rubro, IVA, señas, extras | — | ✅ | KM - Centro de Costos (Male) | Evento → Centro de costos |
| 11 | Costo real del evento: la matriz de Flor, "traer del sistema", tablero comparativo de eventos | ✅ | — | Matriz de costo real (Flor) | Evento → Costo real · Costo real |
| 12 | Valorización de material con la matriz de rental (% por ítem, nacional e importado, tipo de cambio) | ✅ | — | DOS57_BASE MATRICES_RENTAL COST_2026 (Flor) | Ítems de Rental · Presupuestos |
| 13 | Caja imputada: los movimientos de caja asignados al evento | ✅ | ✅ | Especificación §25 | Evento → Caja |
| 14 | Préstamos de plata entre eventos, con devolución (pendiente / devuelta) | 🟡 | 🟡 | Backlog F1-34/35 | Hay transferencias entre cuentas del evento; falta el préstamo de un evento a otro |
| 15 | Cortesías del evento | — | ✅ | Cortesías - Male.xlsx | Evento → Cortesías |
| 16 | Importador de eventos históricos desde el Excel original | ✅ | ✅ | Flujo de Caja Generico.xlsx | Importar eventos históricos |

### Control de gestión

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 17 | Macro: todos los eventos y KPIs globales con gráficos, vista por área para Mayra, "para hoy" y próximos días | ✅ | ✅ | Especificación §39 · Kick-off | Macro |
| 18 | Resumen del evento: ingresos, egresos, resultado y pendientes; faltan los gráficos (gasto por rubro, presupuesto contra gastado, evolución) | 🟡 | 🟡 | Especificación §18 | Evento → Resumen |
| 19 | Exportar el evento a Excel y PDF | 🟡 | 🟡 | Backlog F3 | Excel funciona; el PDF depende de Chromium en Render (ver RRHH, punto 23) |
| 20 | Reportes generales exportables: resultado anual, gastos por proveedor y por rubro, ingresos, sponsors | 🟡 | 🟡 | Especificación §40 · Backlog F3 | Hay reportes por módulo, falta el centro de reportes |
| 21 | Espacios compartidos (coworking de Alta Córdoba, depósito de Polo con Jiménez): gastos del mes cargados una sola vez y repartidos por porcentaje entre empresas | ✅ | ✅ | COWORKING · Planilla Nave 15 - Polo Sociedad Jimenez · Entrevista Mayra | Espacios Compartidos |

### Para definir con el cliente

- **Proyecto comercial en Enjoy** (punto 1): ¿Chino y Vicky presupuestan a clientes antes de crear el evento? ¿Con qué planilla?
- **Estados del evento** (punto 5): ¿qué estados usan de verdad? Los 7 de la especificación pueden ser demasiados.
- **Préstamos entre eventos** (punto 14): ¿se siguen usando? ¿Quién los aprueba?
- **Reportes** (punto 20): ¿cuáles mira Matías todos los meses? Conviene empezar por esos.
- **Ingresos que no son eventos** (por ejemplo, la publicidad de Enjoy en el aeropuerto: carteles por sector, facturación y de qué caja se paga): ¿se llevan como facturas a cobrar sin evento o tienen pantalla propia?
- **Mensaje del coworking:** Mayra arma a mano el mensaje con los gastos del mes para el grupo. ¿Alcanza con que el sistema lo genere listo para copiar?

---

## 04 · Proveedores

**DOS57: 73% construido (11 de 15) · Enjoy: 71% construido (10 de 14) · En uso: 0%**

Responsables: Mayra (ambas). En DOS57, Andrea (proveedores y jornaleros), Santi y Nico (libro de compras). En Enjoy, Male (formulario de proveedores) y Nico (facturas, con Male).

Se conecta con: Administración (rubros y pedidos de la ficha, egresos del evento), Finanzas (pagos, echeqs, cuentas corrientes), RRHH (los jornaleros entran por el mismo formulario), Logística (pedidos de comida, talleres), Calendario (vencimientos de facturas).

No se cuentan acá: alta desde el formulario de Google (RRHH, punto 4), pedidos a proveedores de la ficha (Administración, punto 3), cuentas corrientes con proveedores (Finanzas, punto 11), adjuntos del proveedor (Varios / repositorio).

### Base de proveedores

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 1 | Proveedor único por CUIT, que se carga una vez y se usa en todos los eventos | ✅ | ✅ | Especificación Enjoy §3.1 y §35 | Proveedores |
| 2 | Datos completos: nombre, CUIT, banco, CBU y alias, titular, si factura y qué tipo, servicio | 🟡 | 🟡 | Especificación §35 · Proveedores - Datos (Respuestas) | Proveedores · Faltan dirección, persona de contacto y condición de IVA como dato formal |
| 3 | Ficha del proveedor: eventos donde trabajó, movimientos, total facturado, echeqs | ✅ | ✅ | Especificación §36 | Proveedores → detalle |
| 4 | En la ficha del proveedor: sus facturas, saldo pendiente y pagos hechos | 🟡 | 🟡 | Especificación §35-36 | Están en Facturas a Pagar filtrando por proveedor, no en su ficha |
| 5 | Comisionistas con porcentaje de comisión | ✅ | — | Facturación Vallas Partidos - Polaco (Mayra) | Proveedores |
| 6 | Proveedor habitual y costo estimado por rubro, para que la ficha los sugiera | ⬜ | ⬜ | Especificación §36 (biblioteca de rubros) | — |
| 7 | Vincular proveedores a los movimientos del evento que llegaron sin proveedor | ✅ | ✅ | Importador de eventos históricos | Evento → Vincular proveedores |

### Facturas a pagar

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 8 | Factura con proveedor, evento, rubro, neto, IVA, total, vencimiento, PDF y estados (recibida, aprobada, pagada, anulada) | ✅ | ✅ | Especificación §37 · excel facturas y pagos | Facturas a Pagar |
| 9 | Pagos parciales en varias cuotas | ✅ | ✅ | Especificación §37 | Facturas a Pagar |
| 10 | Aprobación de la factura antes de pagarla | ✅ | ✅ | Especificación §42 | Facturas a Pagar |
| 11 | Importador del libro de compras de AFIP (Mis Comprobantes Recibidos) y control de faltantes | ✅ | ✅ | Comprobantes de Compras DOS57 (Santi) · FACTURAS AGOSTO ENJOY | Facturas a Pagar → Importar |
| 12 | Avisos de facturas vencidas, por vencer y sin PDF | ✅ | ✅ | — | Menú · Notificaciones · Calendario |
| 13 | Al pagar la factura se genera el egreso en el evento | ✅ | ✅ | Especificación §3.2 | Facturas a Pagar |

### Compras

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 14 | Órdenes de compra a proveedores: número, artículos, entrega, plazo y forma de pago (echeqs), en PDF; que Mayra pueda cotejar lo pedido con la factura antes de pagar | ⬜ | ⬜ | Ordenes de Compra y Pago · Entrevista Mayra (compras a Layher, lo que pide Jazmín) | — |
| 15 | Comparativo de presupuestos de proveedores para decidir una compra | ⬜ | ⬜ | Entrevista Mayra ("los que yo les presento en comparativa para las compras") | — |

### Para definir con el cliente

- **Órdenes de compra** (punto 14): ¿se usan para toda compra o solo para las grandes (acero, material)? ¿Quién las aprueba? ¿Al recibir la factura hay que cruzarla con la orden?
- **Proveedor habitual por rubro** (punto 6): ¿lo cargan ellos o alcanza con que el sistema sugiera el último proveedor usado en ese rubro?

---

## 05 · Depósito

**DOS57: 78% construido (14 de 18)\* · Enjoy: 82% construido (11,5 de 14) · En uso: 0%**

\* Sergio (Pollo) y Verónica, responsables del depósito de DOS57, todavía no fueron relevados. Lo de DOS57 sale de Jazmín y de las planillas de stock. Cuando se los releve, el total puede crecer.

Responsables: en DOS57, Sergio (Pollo) y Verónica, con Jazmín, que pasa los eventos y arma las planillas, y Pablo, el pañolero. En Enjoy, Daniel.

Se conecta con: RRHH (pañol con responsable, personal del depósito), Logística (camiones, remitos, cargas), Administración (stock propio en la ficha del evento, pérdidas en el costo real), Calendario (retornos de stock pendientes).

No se cuentan acá, para no contar dos veces: remitos y comidas (Logística), presupuestador rental y matrices de valorización (Administración), stock de uniformes (RRHH, punto 26).

### Catálogo y existencias

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 1 | Catálogo de stock: códigos propios y Layher, nombre técnico e interno, peso, valor, pieza crítica, foto | ✅ | ✅ | DOS57_STOCK_2026_GENERAL (Jazmín) · STOCK DE DEPOSITO ENJOY (Daniel) | Stock → Productos |
| 2 | Importadores del catálogo: Layher en DOS57, por espacio y período en Enjoy | ✅ | ✅ | Mismas planillas | Stock → Importar |
| 3 | Varios depósitos y ubicación de cada pieza (principal, depósito del Pollo, herrería, techos; en Enjoy por espacio) | 🟡 | ✅ | Relevamiento Jazmín | Enjoy tiene el espacio por producto; en DOS57 el catálogo no distingue depósitos |
| 4 | Ingreso de compras al stock general | 🟡 | 🟡 | Relevamiento Jazmín | Se puede corregir el total a mano, pero no queda registro de la compra |
| 5 | Material Layher que se cruza con otros (Agesta, Airasca, Zamora, Jofre): alquilado, prestado, vendido o comprado, que se suma o se resta del stock por un tiempo | ⬜ | — | Relevamiento Jazmín · Entrevista Mayra · Conciliación AIRASCA · Cuadro Cruce de Material BB | El estado "alquilado" está previsto, falta la carga |
| 6 | Conteo periódico: stock físico contra el sistema | 🟡 | 🟡 | Conteos por período de Enjoy · Relevamiento Jazmín | Los conteos entran por el importador; falta cargarlos en pantalla |
| 7 | Activos propios por sector (oficinas, depósito, taller), bien de uso o bien de capital, y a quién se entregó cada computadora o celular | 🟡 | 🟡 | Stock Polo 52 - Dos57 2023 · Planilla Stocks - Celulares + Notebook · Entrevista Mayra | Stock → Activos tiene ubicación y responsable; faltan bien de uso o capital y la entrega a cada persona |
| 8 | Alertas de stock mínimo y de faltantes | ✅ | ✅ | — | Stock → Alertas · menú |
| 9 | Stock de producción (oficina de Vicky, búnker), separado del depósito y del pañol | ❓ | ❓ | Relevamiento Jazmín | Definir con Vicky si se lleva en el sistema |

### Material para los eventos

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 10 | Asignar material a un evento, con disponibilidad según las fechas | ✅ | ✅ | PROYECTO_TEMPORADA_2026 (Jazmín) | Evento · Stock |
| 11 | Proyección de la temporada: faltantes actuales y futuros (lo que Jazmín pinta en rojo) | ✅ | ✅ | PROYECTO_TEMPORADA_2026 (Jazmín) | Stock → Alertas |
| 12 | Ver el material de cada evento y los eventos de cada material | ✅ | ✅ | Relevamiento Jazmín | Evento · Stock → Producto |
| 13 | Firmas de salida, llegada y retorno, con pendientes de firmar | ✅ | ✅ | — | Firmar movimiento |
| 14 | Carga por camión y por cuna | ✅ | — | CARGA_CAMIONES_NORTE ROCK (Jazmín) | Stock → Camiones / Cunas |
| 15 | Pasar material de un evento a otro sin volver al depósito, y registrar lo que se mandó de más | ✅ | ✅ | — | Stock |
| 16 | Rubro de la ficha cubierto con stock propio más un proveedor | — | ✅ | Ficha de evento (Daniel) | Evento → Ficha |

### Pañol

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 17 | Inventario de herramientas y consumibles; salida con responsable y evento; devolución con faltantes | ✅ | — | DOS57_STOCK_PAÑOL (Jazmín / Pablo) | Stock → Pañol |
| 18 | Pantalla simple para el pañolero | ✅ | — | Relevamiento Flor y Jazmín | Rol Pañolero |
| 19 | Lo que no vuelve del pañol se valoriza como pérdida del evento | ✅ | — | Matriz de costo real (Flor) | Evento → Costo real |

### Para definir con el cliente

- **Relevar a Sergio y Verónica:** son los dueños del depósito de DOS57 y no fueron entrevistados.
- **Stock de producción** (punto 9): ¿se lleva en el sistema? ¿Quién lo carga ("la colorada" y Mario, según Jazmín)?
- **Depósitos de DOS57** (punto 3): ¿cuántos son y qué hay en cada uno?
- **Alquileres de temporada** (punto 5): ¿el costo del alquiler va al evento que lo usa o al depósito?

---

## 06 · Logística

**DOS57: 86% construido (15,5 de 18) · Enjoy: 86% construido (9,5 de 11) · En uso: 0%**

Enjoy tiene flota propia: 4 vehículos operativos según "Info Flotas - Dos57_Enjoy" (Mayra), más una hoja de bajas y ventas. El módulo de Flota ya funciona para las dos empresas, pero los vehículos de Enjoy todavía no están cargados. Bitácora, combustible y movimiento diario hoy son solo de DOS57.

Responsables: en DOS57, Florencia (costo y logística de cada evento), Lorena (papeles de la flota), Santi y Nico (combustible y taller), Jazmín (comidas) y los choferes (bitácora). En Enjoy, Daniel y Chino.

Se conecta con: RRHH (choferes, viático por bitácora, carnets, multas, parte diario), Depósito (carga por camión, pañol), Administración (todo termina en el costo real del evento), Seguros (pólizas y siniestros de vehículos), Calendario (RTO, patentes, taller, controles de salida).

No se cuentan acá: seguros y siniestros de vehículos (Seguros), carnets y multas (RRHH, puntos 27 y 28), la carpeta del evento con planos y fotos (Varios / repositorio).

### Flota

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 1 | Padrón de vehículos (camiones, camionetas, trailers, autoelevadores) con titular | ✅ | ✅ | Pizarra de flota (Lorena) · Info Flotas - Dos57_Enjoy (Mayra) | Flota → Vehículos |
| 2 | Pizarra de flota como planilla descargable y reimportable, sin pisar lo actualizado | ✅ | — | cuadro_estado_vehiculos (Lorena) | Flota |
| 3 | RTO/ITV y patentes con vencimiento y semáforo | ✅ | ✅ | Relevamiento Lorena | Flota → Patentes y peajes |
| 4 | Peajes por vehículo (Caminos de las Sierras, Telepase) | ✅ | ✅ | Info Flotas · Planilla Peajes (Mayra) | Flota → Patentes y peajes |
| 5 | Taller: ingreso, presupuesto, retiro, costo final y cuenta corriente del taller | ✅ | ✅ | NOVEDADES Y PENDIENTES PARQUE AUTOMOTOR (Santi) | Flota → Taller |
| 6 | Service por kilómetros: último service, cambio de aceite, aviso del próximo | 🟡 | 🟡 | Relevamiento Santi · NOVEDADES Y PENDIENTES PARQUE AUTOMOTOR, hoja CAMBIO DE ACEITE (Santi) | El taller registra el servicio, pero no lleva km ni avisa el próximo |
| 7 | Control de salida antes de cada viaje: papeles en verde, amarillo o rojo, con foto de cómo estaba todo al salir | ✅ | ✅ | Relevamiento Lorena (revisión con David) | Flota → Controles de salida |
| 8 | Neumáticos y baterías por vehículo: fecha de colocación, km, próxima rotación | ⬜ | ⬜ | NOVEDADES Y PENDIENTES PARQUE AUTOMOTOR, hojas NEUMÁTICOS y BATERÍA (Santi) | — |

### Viajes y combustible

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 9 | Bitácora de viajes: choferes y planillas de camiones de Flor en un solo lugar, sin pagar dos veces el viático | ✅ | — | Excel de viajes de Luis · Planilla_Viajes_Camiones (Flor) | Bitácora |
| 10 | Movimiento diario: camiones y camionetas por separado | ✅ | — | Relevamiento Flor | Movimiento Diario |
| 11 | Combustible: importador de la planilla de la estación (cuenta corriente YPF), cargas por vehículo, km por litro | ✅ | — | Planilla de Combustible (Santi) · DETALLE TECNICO CONSUMO CAMIONES (Flor) | Combustible |
| 12 | Combustible pagado de la caja (fuera de la cuenta YPF), atado al vehículo y al evento | 🟡 | — | Relevamiento Santi y Flor | Entra como gasto de combustible en la caja, pero sin vehículo |
| 13 | Logística del evento: viajes y combustible de cada evento, con sugerencia de a qué evento corresponde cada viaje | ✅ | — | Relevamiento Flor | Evento → Logística |
| 14 | Cajas de los choferes por evento ("caja Luis, caja Tati…") | 🟡 | — | Matriz de costo real (Flor) | Se cargan a mano en el costo real; no salen de la caja de cada chofer |

### Operación del evento

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 15 | Remitos digitales de los 5 tipos (Layher, Nacional, Techos, Pañol, Lonas/Aforo), con catálogo, PDF y datos fiscales | ✅ | — | DOS57_REMITOS_2026 · REMITO LAYHER MATRIZ (Flor, Jazmín) | Evento → Logística |
| 16 | Cronograma por fase (viaje de ida, montaje, evento, desmontaje, vuelta), con tareas, responsables y plantillas por rubro | ✅ | ✅ | Carpeta del evento (Flor) · Planilla Producción Expo Village (Daniel) | Evento → Operación |
| 17 | Producción del evento: cronograma de montaje, espacios y lo que lleva cada uno, puntos de internet, branding, compras | — | ✅ | Planilla Produccion Expo Village (Daniel) | Evento → Producción |
| 18 | Comidas por evento y por día, sugeridas desde el parte diario (solo para los que vinieron) | ✅ | ✅ | DOS57_RESUMEN_COMIDAS (Jazmín) · Control de viandas (Daniel) | Evento → Comidas |
| 19 | Planillas de campo precargadas para trabajar sin señal (horas, viandas, alojamiento, pañol, combustible) y que después se importan al costo real | ✅ | — | Planillas de Controles Varios en Giras (Flor) | Evento → Costo real |
| 20 | Seguridad del evento por turnos, con importador de la planilla | — | ✅ | SEGURIDAD FESTIVAL KM (Daniel) | Evento → Ficha |

### Para definir con el cliente

- **Flota de Enjoy:** ¿quién lleva sus papeles, combustible y viajes? ¿Hace falta bitácora y combustible también para Enjoy?
- **Service por km** (punto 6): ¿cada cuántos km se hace el service de cada vehículo? ¿De dónde sale el km actual (bitácora, combustible, foto del tablero)?
- **Cajas de los choferes** (punto 14): ¿cada chofer tiene una caja propia que rinde por evento, o es plata de la caja de Santi o de Andrea?
- **Combustible de caja** (punto 12): ¿alcanza con elegir el vehículo y el evento al cargar el gasto en la caja?
- **Diferencias de litros** entre la hoja de logística y la hoja de cada camión (pendiente del relevamiento de Flor).

---

## 07 · Seguros

**DOS57: 61% construido (5,5 de 9) · Enjoy: 50% construido (4 de 8) · En uso: 0%**

Responsables: Lorena (pólizas y siniestros de la flota, siniestros del personal), Andrea (ART/AP del personal y altas y bajas con el productor), Mayra (cuadro de seguros y pagos de las dos empresas).

Se conecta con: RRHH (cada empleado y su cobertura), Logística (control de salida: un vehículo sin seguro vigente no sale), Finanzas (cuotas de las pólizas por echeq, débito o tarjeta), Administración (seguros del evento como rubro de la ficha), Calendario (vencimientos de pólizas), Novedades (los siniestros también son novedades del evento).

### Personas

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 1 | Seguro de cada empleado (ART si está registrado, AP si no): aseguradora, póliza, vencimiento y aviso | ⬜ | ⬜ | Relevamiento Andrea y Santi · Entrevista Mayra | Hoy solo hay un texto con el nombre de la aseguradora en el legajo |
| 2 | Alta y baja de los eventuales en el seguro de AP por evento o viaje, con el pedido al productor | ⬜ | ❓ | Relevamiento Andrea ("dar de alta a todos porque viajaban") | — |
| 3 | Siniestros del personal (ART): datos del accidente, póliza, diagnóstico, alta médica, documentos y gastos; importador | ✅ | — | 2026_Informe Siniestros Personal (Lorena) | Siniestros |

### Vehículos

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 4 | Seguro por vehículo: aseguradora, póliza, cobertura, vigencia, importe anual y PDF de la póliza | ✅ | ✅ | SEGUROS PARQUE AUTOMOTOR DOS57 2025 · Info Flotas (Mayra) · pizarra (Lorena) | Flota → Seguros |
| 5 | Vencimiento de las pólizas con semáforo, calendario y aviso a quien lleva la documentación | ✅ | ✅ | Relevamiento Lorena | Flota → Seguros · Calendario |
| 6 | Cuotas de cada póliza mes a mes, con forma de pago (echeq, débito, tarjeta) y suma asegurada | 🟡 | 🟡 | Cuadro Seguros Flota, hoja PAGOS (Mayra) | Se guarda el importe anual; faltan las cuotas mes a mes y la suma asegurada |
| 7 | Importador del cuadro de seguros de Mayra | 🟡 | ⬜ | SEGUROS PARQUE AUTOMOTOR · Info Flotas (Mayra) | En DOS57 la pizarra de Lorena actualiza aseguradora y vencimiento; el cuadro de Mayra no se importa |
| 8 | Siniestros de vehículos: número, chofer, vehículo, seguro, daños, denuncia, tercero, estado; importador | ✅ | ✅ | 2026_Informe siniestros vehiculos (Lorena) | Siniestros |

### Eventos

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 9 | Seguros del evento (responsabilidad civil, AP del público, certificados para el predio) | 🟡 | 🟡 | Rubro "Seguro" de la especificación · carpeta del evento (Flor) | Se cargan como rubro o gasto del evento; no queda la póliza ni el certificado |

### Para definir con el cliente

- **ART/AP del personal** (puntos 1 y 2): ¿quién es el productor? ¿El alta y la baja se le piden por mail o WhatsApp? ¿Alcanza con que el sistema arme la lista de quién viaja a cada evento?
- **Enjoy** (punto 2): ¿su personal eventual también se da de alta en AP por evento?
- **Seguros del evento** (punto 9): ¿quién los gestiona? ¿El predio pide certificado de cobertura?
- **Otros seguros** de la empresa (depósito, material, equipos): ¿existen y se quieren llevar acá?

---

## 10 · Novedades

**DOS57: 17% construido (1 de 6) · Enjoy: 17% construido (1 de 6) · En uso: 0%**

Qué es: el registro de lo que pasa y hay que dejar asentado en cada evento y en la operación. Por ejemplo, un choque, un accidente, una rotura, un faltante o un problema con un proveedor. Hoy esto viaja por los grupos de WhatsApp y se pierde.

Responsables: todos cargan. Santi lleva las novedades de la flota y Florencia la bitácora de cada evento. Matías y Mayra tienen que enterarse de las graves.

Se conecta con: Seguros (un siniestro es una novedad), Logística (roturas y pendientes de la flota, taller), RRHH (accidentes, faltas), Depósito (faltantes y roturas de material), Calendario.

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 1 | Libro de novedades por evento: qué pasó, cuándo, quién, gravedad, fotos, resolución y estado | ⬜ | ⬜ | Pedido del cliente (Kick-off, pilar 10) | — |
| 2 | Novedades de la flota: pendientes de reparación con resolución y estado | 🟡 | 🟡 | NOVEDADES Y PENDIENTES PARQUE AUTOMOTOR, hoja NOVEDADES IMPORTANTE (Santi) | El taller registra lo que entra al taller; los pendientes que todavía no entraron no quedan registrados |
| 3 | Bitácora diaria del armado (qué se armó cada día, con fotos), que hoy sale de los grupos de WhatsApp | ⬜ | ❓ | Carpeta del evento (Flor) | — |
| 4 | Siniestros de vehículos y del personal ligados al evento donde ocurrieron | 🟡 | 🟡 | Relevamiento Lorena | Los siniestros existen, pero no se los liga a un evento |
| 5 | Aviso inmediato a quien corresponde cuando se carga una novedad grave | ⬜ | ⬜ | — | — |
| 6 | Novedades a la vista en el resumen del evento y en el calendario | ⬜ | ⬜ | — | — |

### Para definir con el cliente

- **Qué es una novedad:** ¿hay categorías (accidente, rotura, faltante, proveedor, clima…) y niveles de gravedad?
- **Quién se entera:** ¿quién recibe el aviso de cada tipo de novedad?
- **Enjoy** (punto 3): ¿también lleva una bitácora diaria del armado?

---

## 11 · Varios y módulos auxiliares

**DOS57: 90% construido (9 de 10) · Enjoy: 90% construido (9 de 10) · En uso: 0%**

Qué es: lo que sostiene a todos los pilares: acceso, permisos, configuración, auditoría, ayuda y archivos.

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 1 | Dos empresas en una sola plataforma; el administrador global cambia de empresa o ve las dos | ✅ | ✅ | Kick-off ("una sola plataforma, dos empresas") | Selector de empresa |
| 2 | Usuarios, roles y permisos de carga por persona | ✅ | ✅ | Kick-off · Especificación §42 | Configuración → Usuarios |
| 3 | Pantalla de inicio propia por persona, con su menú acotado | ✅ | ✅ | Relevamientos por persona | Configuración → Usuarios |
| 4 | Contraseña inicial por persona y cambio obligatorio en el primer ingreso | ✅ | ✅ | Prueba en producción | Login |
| 5 | Logo, colores y tema oscuro por empresa | ✅ | ✅ | — | Configuración → Empresa |
| 6 | Uso desde el celular: menú inferior y tablas adaptadas | ✅ | ✅ | Kick-off ("acceso desde cualquier dispositivo") | Todo el sistema |
| 7 | Nombres de las pestañas configurables | ✅ | ✅ | Plan de desarrollo, fase 4 | Configuración |
| 8 | Auditoría: quién cambió qué y cuándo, con el valor anterior | ✅ | ✅ | Especificación §43 | Auditoría · Evento → Auditoría |
| 9 | Ayuda dentro del sistema, con buscador y links a cada pantalla | ✅ | ✅ | — | Ícono de ayuda |
| 10 | Repositorio de archivos: carpetas por evento, proveedor, factura y empleado (contratos, planos, fotos, videos, seguros, gráfica), y documentación general de la empresa (contrato constitutivo, DNI de los socios, constancias de inscripción, resúmenes bancarios y de FIMA, organigrama, manual de funciones) | ⬜ | ⬜ | Especificación §38 · Carpeta del evento (Flor) · Entrevista Mayra | Hoy solo se adjuntan PDF en facturas, pólizas, siniestros y planes de AFIP |

### Tareas de infraestructura que afectan a varios pilares (no cuentan para el %)

- **PDF en Render:** el servidor no trae Chromium, así que los PDF de recibos, remitos, tarjeta y exportaciones dan error en producción. Cuando se resuelva, mejoran RRHH, Administración, Logística y Finanzas.
- **Backups y restauración:** probar que un backup se restaura antes de cargar datos reales (ver `Preparacion_Prueba_Produccion.docx`).

### Para definir con el cliente

- **Repositorio** (punto 10): ¿dónde guardan hoy los archivos (Drive, WhatsApp)? ¿Cuánto pesan los videos? Esto define dónde se guardan: base de datos o almacenamiento aparte.
- **Planilla de dominios** del Grupo Enjoy (Mayra): ¿se quiere llevar en el sistema?
- **Datos sensibles:** Mayra hoy guarda fotos con los números de las tarjetas de la empresa y claves en planillas. El repositorio no debería guardar claves ni números completos de tarjetas.

---

## 12 · Calendario transversal *(pilar nuevo)*

**DOS57: 80% construido (12 de 15) · Enjoy: 80% construido (12 de 15) · En uso: 0%**

Por qué es un pilar propio: el calendario no pertenece a un área. Junta en un solo lugar lo que pasa y lo que vence en todos los pilares, y cada persona ve lo suyo. Hoy suma 22 tipos de ítems.

### Cómo se ve

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 1 | Un solo calendario para todo: vista mensual y agenda, filtros por tipo y por empresa, colores, semáforo de urgencia y link a la pantalla de cada ítem | ✅ | ✅ | Pedido del cliente | Calendario |
| 2 | Cada persona ve solo lo que le corresponde (lo financiero, solo los administradores) | ✅ | ✅ | — | Calendario |
| 3 | "Para hoy" y "próximos 7 días" en la pantalla de inicio de la Macro | ✅ | ✅ | — | Macro |
| 4 | Avisos en la campanita, solo a quien tiene ese tema a cargo | ✅ | ✅ | Relevamiento Lorena | Campanita |

### Qué junta, por pilar

| # | Funcionalidad | DOS57 | Enjoy | De dónde sale | Dónde está |
|---|---|---|---|---|---|
| 5 | Administración: eventos, de la fecha de inicio a la de fin | ✅ | ✅ | — | Calendario |
| 6 | Administración: días de montaje y desmontaje, diferenciados del evento | 🟡 | 🟡 | Relevamiento Flor (armado → evento → desarme) | Los días se cargan en el evento, pero el calendario no los muestra |
| 7 | Logística: tareas del cronograma de cada evento (Operación) | ⬜ | ⬜ | Carpeta del evento (Flor) · Planilla de producción (Daniel) | — |
| 8 | RRHH: jornadas, partes diarios y liquidaciones | ✅ | ✅ | — | Calendario |
| 9 | Finanzas: echeqs, cuotas de AFIP y de créditos, facturas a cobrar, rendiciones de caja, saldo bajo, cuentas corrientes sin movimiento | ✅ | ✅ | — | Calendario |
| 10 | Proveedores: vencimiento de facturas a pagar | ✅ | ✅ | — | Calendario |
| 11 | Depósito: retornos de stock pendientes, quiebre de stock de uniformes | ✅ | ✅ | — | Calendario |
| 12 | Logística: patentes, RTO/ITV, retiros del taller, controles de salida, multas, carnets | ✅ | ✅ | Relevamiento Lorena | Calendario |
| 13 | Seguros: vencimiento de pólizas, siniestros de vehículos abiertos | ✅ | ✅ | Relevamiento Lorena | Calendario |
| 14 | Cuatro tipos que el sistema ya calcula pero la pantalla no muestra: SGR, gastos de espacios compartidos, siniestros del personal, excedente de horas | 🟡 | 🟡 | — | Salen en la campanita, faltan en el calendario |
| 15 | RRHH: cumpleaños del personal | ⬜ | ⬜ | Entrevista Mayra | La fecha de nacimiento está en el legajo |

### Para más adelante (no cuentan para el %)

- Verlo en Google Calendar o en el calendario del celular.
- Recordatorios por mail o WhatsApp.
