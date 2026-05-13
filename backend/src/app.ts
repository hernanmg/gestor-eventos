import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler';
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

const app = express();

app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

app.use(errorHandler);

export default app;
