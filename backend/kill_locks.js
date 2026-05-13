const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.$queryRawUnsafe("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE query LIKE '%advisory_lock%' AND pid != pg_backend_pid()")
  .then(r => { console.log('Terminated:', JSON.stringify(r)); prisma.$disconnect(); })
  .catch(e => { console.error(e.message); prisma.$disconnect(); });
