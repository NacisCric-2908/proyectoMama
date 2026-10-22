import { aFechaDB, type Tx } from "./util";

/** Tarifa (costo hora) vigente de un trabajador en una fecha 'aaaa-mm-dd'. */
export async function tarifaVigente(tx: Tx, trabajadorId: string, fechaISO: string): Promise<string | null> {
  const fecha = aFechaDB(fechaISO);
  const t = await tx.tarifaTrabajador.findFirst({
    where: {
      trabajadorId,
      vigenteDesde: { lte: fecha },
      OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fecha } }],
    },
    orderBy: { vigenteDesde: "desc" },
  });
  return t ? t.costoHora.toString() : null;
}
