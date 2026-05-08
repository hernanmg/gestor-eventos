import 'dotenv/config';
import app from './app';

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`[server] escuchando en http://localhost:${PORT}`);
  console.log(`[server] entorno: ${process.env.NODE_ENV || 'development'}`);
});
