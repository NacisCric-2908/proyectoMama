import { CIEN, Decimal, d, precision4, type Num } from "./decimal";

export interface OrdenRentabilidad {
  clienteId: string;
  cliente: string;
  valorCotizado: Num | null;
  /** Costo acumulado (con CIF aplicado). */
  costoTotal: Num;
  /** Costo ajustado tras la conciliación del CIF, si existe. */
  costoAjustado?: Num | null;
}

export interface FilaRentabilidad {
  clienteId: string;
  cliente: string;
  ordenes: number;
  cotizado: Decimal;
  costo: Decimal;
  /** Costo ajustado cuando existe; si no, el acumulado. */
  costoAjustado: Decimal;
  ordenesAjustadas: number;
  margen: Decimal;
  margenPct: Decimal | null;
  margenAjustado: Decimal;
  margenAjustadoPct: Decimal | null;
}

const pct = (m: Decimal, c: Decimal) => (c.greaterThan(0) ? precision4(m.div(c).times(CIEN)) : null);

function fila(clienteId: string, cliente: string, ordenes: OrdenRentabilidad[]): FilaRentabilidad {
  const cotizado = ordenes.reduce((a, o) => a.plus(d(o.valorCotizado)), new Decimal(0));
  const costo = ordenes.reduce((a, o) => a.plus(d(o.costoTotal)), new Decimal(0));
  const costoAjustado = ordenes.reduce((a, o) => a.plus(d(o.costoAjustado ?? o.costoTotal)), new Decimal(0));
  const margen = cotizado.minus(costo);
  const margenAjustado = cotizado.minus(costoAjustado);
  return {
    clienteId,
    cliente,
    ordenes: ordenes.length,
    cotizado,
    costo,
    costoAjustado,
    ordenesAjustadas: ordenes.filter((o) => o.costoAjustado !== null && o.costoAjustado !== undefined).length,
    margen,
    margenPct: pct(margen, cotizado),
    margenAjustado,
    margenAjustadoPct: pct(margenAjustado, cotizado),
  };
}

/** Rentabilidad por cliente (Módulo 5 del artículo), ordenada de mayor a menor margen. */
export function rentabilidadPorCliente(ordenes: OrdenRentabilidad[]) {
  const grupos = new Map<string, OrdenRentabilidad[]>();
  for (const o of ordenes) grupos.set(o.clienteId, [...(grupos.get(o.clienteId) ?? []), o]);
  const filas = [...grupos.entries()].map(([id, os]) => fila(id, os[0].cliente, os)).sort((a, b) => b.margen.comparedTo(a.margen));
  return { filas, total: fila("total", "Total", ordenes) };
}
