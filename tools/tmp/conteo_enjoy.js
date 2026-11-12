const { PrismaClient } = require(process.cwd() + '/node_modules/@prisma/client');
const p = new PrismaClient();
(async () => {
  const e = 1;
  const q = {
    eventos: p.evento.count({ where: { empresa_id: e, deleted_at: null } }),
    productosStock: p.producto ? p.producto.count({ where: { empresa_id: e } }) : null,
    empleados: p.empleado.count({ where: { empresa_id: e } }),
    cajas: p.cuentaBancaria.count({ where: { empresa_id: e } }),
    facturas: p.factura.count({ where: { empresa_id: e } }),
    proveedores: p.proveedor.count(),
    cortesias: p.cortesiaEvento ? p.cortesiaEvento.count() : null,
  };
  for (const [k, v] of Object.entries(q)) { try { console.log(k, await v); } catch (err) { console.log(k, 'ERR', err.message.split('\n').slice(-1)[0]); } }
  const ev = await p.evento.findMany({ where: { empresa_id: e }, select: { id: true, nombre: true, deleted_at: true }, take: 5 });
  console.log(ev);
  await p.$disconnect();
})();
