import 'dotenv/config';
import app from './app';
import { actualizarIndicadoresSiHaceFalta } from './lib/indicadoresService';

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`[server] escuchando en http://localhost:${PORT}`);
  console.log(`[server] entorno: ${process.env.NODE_ENV || 'development'}`);
  // Indicadores económicos (dólar/IPC) — no bloquea el arranque; si falla, sólo se loguea
  actualizarIndicadoresSiHaceFalta()
    .then(r => { if (r?.errores.length) console.warn('[indicadores] fuentes con error:', r.errores.map(e => `${e.tipo}: ${e.mensaje}`).join(' · ')); })
    .catch(err => console.warn('[indicadores] fetch al arrancar falló:', err.message));
});
