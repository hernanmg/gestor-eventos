import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler';
import { restrictedRoleGate } from './middleware/restrictedRoleGate';
import authRouter                    from './routes/auth';
import eventosRouter                 from './routes/eventos';
import movimientosRouter             from './routes/movimientos';
import configuracionRouter           from './routes/configuracion';
import { cuentasRouter, movCajaRouter } from './routes/caja';
import echeqsRouter                  from './routes/echeqs';
import usuariosRouter                from './routes/usuarios';
import importerRouter                from './routes/importer';
import exportarRouter               from './routes/exportar';
import dashboardRouter              from './routes/dashboard';
import proveedoresRouter            from './routes/proveedores';
import auditoriaRouter             from './routes/auditoria';
import stockRouter, { eventoStockRouter } from './routes/stock';
import { facturasRouter, pagosRouter, facturasEventoRouter } from './routes/facturas';
import { empresasRouter, empresaActualRouter } from './routes/empresas';
import rrhhRouter from './routes/rrhh';
import panolRouter from './routes/panol';
import activosRouter from './routes/activos';
import rubrosRouter from './routes/rubros';
import { fichaEventoRouter, rubrosEventoRouter, pedidoItemsRouter } from './routes/fichaEvento';
import parteDiarioRouter from './routes/parteDiario';
import { comidasEventoRouter, comidasRouter } from './routes/comidas';
import calendarioRouter from './routes/calendario';
import preMacroRouter from './routes/preMacro';

const app = express();

// FRONTEND_URL (si está seteado) + puertos habituales de Vite en desarrollo
// (Vite pasa al siguiente puerto libre — 5174, 5175... — cuando 5173 está
// ocupado, por ejemplo por otra instancia del dev server corriendo en paralelo).
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
].filter((o): o is string => Boolean(o));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  // Sin esto, el navegador bloquea la lectura de este header en las
  // respuestas cross-origin — los hooks de descarga (Excel/PDF) no pueden
  // leer el filename real y caen siempre a su nombre por defecto.
  exposedHeaders: ['Content-Disposition'],
}));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Corta acá para JORNALERO/PAÑOLERO antes de entrar a cualquier router — ver
// restrictedRoleGate.ts para el porqué de este approach.
app.use(restrictedRoleGate);

app.use('/api/auth',             authRouter);
app.use('/api/eventos',          eventosRouter);
app.use('/api/movimientos',      movimientosRouter);
app.use('/api/configuracion',    configuracionRouter);
app.use('/api/cuentas',          cuentasRouter);
app.use('/api/movimientos-caja', movCajaRouter);
app.use('/api/echeqs',           echeqsRouter);
app.use('/api/usuarios',         usuariosRouter);
app.use('/api/importer',         importerRouter);
app.use('/api/eventos',          exportarRouter);
app.use('/api/dashboard',        dashboardRouter);
app.use('/api/proveedores',      proveedoresRouter);
app.use('/api/auditoria',        auditoriaRouter);
app.use('/api/stock',            stockRouter);
app.use('/api/eventos/:id/stock', eventoStockRouter);
app.use('/api/facturas',          facturasRouter);
app.use('/api/pagos',             pagosRouter);
app.use('/api/eventos',           facturasEventoRouter);
app.use('/api/empresas',          empresasRouter);
app.use('/api/empresa',           empresaActualRouter);
app.use('/api/rrhh',              rrhhRouter);
app.use('/api/panol',             panolRouter);
app.use('/api/activos',           activosRouter);
app.use('/api/rubros',            rubrosRouter);
app.use('/api/eventos/:id/ficha', fichaEventoRouter);
app.use('/api/rubros-evento',     rubrosEventoRouter);
app.use('/api/pedido-items',      pedidoItemsRouter);
app.use('/api/parte-diario',      parteDiarioRouter);
app.use('/api/eventos/:id/comidas', comidasEventoRouter);
app.use('/api/comidas',             comidasRouter);
app.use('/api/calendario',          calendarioRouter);
app.use('/api/pre-macro',           preMacroRouter);

app.use(errorHandler);

export default app;
