const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.$queryRawUnsafe("SELECT pid, query, state, wait_event_type FROM pg_stat_activity WHERE state != 'idle' ORDER BY state")
  .then(r => { console.log(JSON.stringify(r, null, 2)); prisma.$disconnect(); })
  .catch(e => { console.error(e.message); prisma.$disconnect(); });
