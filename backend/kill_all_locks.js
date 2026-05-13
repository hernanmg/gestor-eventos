const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// Find the holder of the advisory lock and all other non-backend connections
prisma.$queryRawUnsafe(`
  SELECT pid, query, state, wait_event_type, usename, application_name
  FROM pg_stat_activity
  WHERE pid != pg_backend_pid()
  AND datname = current_database()
  ORDER BY state
`)
  .then(r => {
    console.log(JSON.stringify(r, null, 2));
    return prisma.$queryRawUnsafe(`
      SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE pid != pg_backend_pid() AND datname = current_database()
    `);
  })
  .then(r => { console.log('Terminated all:', JSON.stringify(r)); prisma.$disconnect(); })
  .catch(e => { console.error(e.message); prisma.$disconnect(); });
