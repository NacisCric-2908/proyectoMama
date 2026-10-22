import type { Tx } from "./util";
import { aISO } from "./util";

/** Trabajadores activos con su historial de tarifas, listo para formularios del cliente. */
export async function trabajadoresConTarifas(tx: Tx, soloId?: string | null) {
  const lista = await tx.trabajador.findMany({
    where: { eliminadoEn: null, activo: true, ...(soloId ? { id: soloId } : {}) },
    include: { tarifas: { orderBy: { vigenteDesde: "desc" } } },
    orderBy: { nombre: "asc" },
  });
  return lista.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    cargo: t.cargo,
    tipo: t.tipo,
    tarifas: t.tarifas.map((x) => ({ desde: aISO(x.vigenteDesde)!, hasta: aISO(x.vigenteHasta), costo: x.costoHora.toString() })),
  }));
}
