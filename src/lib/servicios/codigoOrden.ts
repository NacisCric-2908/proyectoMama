import type { Tx } from "./util";

/**
 * Genera el siguiente código según el formato configurado.
 * Marcadores: {AAAA} año, {NNNN} consecutivo (la cantidad de N define el relleno).
 */
export async function siguienteCodigo(tx: Tx, formato: string, anio: number): Promise<string> {
  const coincidencia = formato.match(/\{(N+)\}/);
  const ancho = coincidencia ? coincidencia[1].length : 4;
  const prefijo = formato.replace("{AAAA}", String(anio)).split(/\{N+\}/)[0];
  const existentes = await tx.ordenProyecto.findMany({
    where: { codigo: { startsWith: prefijo } },
    select: { codigo: true },
  });
  let max = 0;
  for (const { codigo } of existentes) {
    const n = parseInt(codigo.slice(prefijo.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  const consecutivo = String(max + 1).padStart(ancho, "0");
  return formato.replace("{AAAA}", String(anio)).replace(/\{N+\}/, consecutivo);
}
