module.exports = {
  apps: [
    {
      name: 'eventos-backend',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      kill_timeout: 5000,
      wait_ready: false,
      merge_logs: true,
      out_file: '/var/log/pm2/eventos-backend-out.log',
      error_file: '/var/log/pm2/eventos-backend-error.log',
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001,
        DATABASE_URL: process.env.DATABASE_URL,
        JWT_SECRET: process.env.JWT_SECRET,
        FRONTEND_URL: process.env.FRONTEND_URL,
        ADMIN_EMAIL: process.env.ADMIN_EMAIL,
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
        // Puppeteer: ruta al Chromium instalado por setup.sh
        PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      },
    },
  ],
};
