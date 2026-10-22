import { Decimal, d, type Num } from "./decimal";
import { ErrorCosteo } from "./errores";
import { formatearCantidad } from "./formato";

/**
 * Kárdex de materiales con inventario perpetuo valorado por promedio ponderado
 * (fórmula de costo permitida por la Sección 13 de la NIIF para las PYMES).
 */
export type TipoMovimiento = "ENTRADA" | "SALIDA_ORDEN" | "DEVOLUCION_ORDEN" | "AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO";

export const NOMBRE_MOVIMIENTO: Record<TipoMovimiento, string> = {
  ENTRADA: "Entrada (compra)",
  SALIDA_ORDEN: "Salida a orden (requisición)",
  DEVOLUCION_ORDEN: "Devolución de orden",
  AJUSTE_POSITIVO: "Ajuste positivo (inventario físico)",
  AJUSTE_NEGATIVO: "Ajuste negativo (inventario físico)",
};

export const ES_ENTRADA: Record<TipoMovimiento, boolean> = {
  ENTRADA: true,
  SALIDA_ORDEN: false,
  DEVOLUCION_ORDEN: true,
  AJUSTE_POSITIVO: true,
  AJUSTE_NEGATIVO: false,
};

export interface SaldoInventario {
  cantidad: Decimal;
  valor: Decimal;
  /** Costo promedio ponderado vigente (se conserva el último cuando el saldo llega a cero). */
  costoPromedio: Decimal;
}

export interface MovimientoEntrada {
  tipo: TipoMovimiento;
  cantidad: Num;
  /** Obligatorio en ENTRADA y DEVOLUCION_ORDEN; opcional en AJUSTE_POSITIVO; se ignora en salidas. */
  costoUnitario?: Num | null;
}

export interface MovimientoAplicado {
  costoUnitario: Decimal;
  costoTotal: Decimal;
  saldo: SaldoInventario;
}

const DP = 4;
const r4 = (x: Decimal) => x.toDecimalPlaces(DP, Decimal.ROUND_HALF_UP);

export function saldoInicial(): SaldoInventario {
  return { cantidad: new Decimal(0), valor: new Decimal(0), costoPromedio: new Decimal(0) };
}

export function aplicarMovimiento(saldo: SaldoInventario, mov: MovimientoEntrada): MovimientoAplicado {
  const cantidad = d(mov.cantidad);
  if (!cantidad.greaterThan(0)) throw new ErrorCosteo("La cantidad del movimiento debe ser mayor que cero", "CANTIDAD_INVALIDA");
  const hayCosto = mov.costoUnitario !== null && mov.costoUnitario !== undefined && mov.costoUnitario !== "";

  let costoUnitario: Decimal;
  if (ES_ENTRADA[mov.tipo]) {
    if (hayCosto) costoUnitario = d(mov.costoUnitario);
    else if (mov.tipo === "AJUSTE_POSITIVO" && saldo.costoPromedio.greaterThan(0)) costoUnitario = saldo.costoPromedio;
    else throw new ErrorCosteo("Indique el costo unitario del movimiento", "COSTO_REQUERIDO");
    if (costoUnitario.isNegative()) throw new ErrorCosteo("El costo unitario no puede ser negativo", "VALOR_NEGATIVO");
  } else {
    if (cantidad.greaterThan(saldo.cantidad))
      throw new ErrorCosteo(`Existencias insuficientes: el saldo es ${formatearCantidad(saldo.cantidad)}`, "EXISTENCIAS_INSUFICIENTES");
    costoUnitario = saldo.costoPromedio;
  }

  const costoTotal = r4(cantidad.times(costoUnitario));
  const nuevaCantidad = ES_ENTRADA[mov.tipo] ? saldo.cantidad.plus(cantidad) : saldo.cantidad.minus(cantidad);
  // Al agotar el saldo se descarta el residuo de redondeo del valor.
  const nuevoValor = nuevaCantidad.isZero() ? new Decimal(0) : ES_ENTRADA[mov.tipo] ? saldo.valor.plus(costoTotal) : saldo.valor.minus(costoTotal);
  return {
    costoUnitario: r4(costoUnitario),
    costoTotal,
    saldo: {
      cantidad: nuevaCantidad,
      valor: nuevoValor,
      costoPromedio: nuevaCantidad.isZero() ? saldo.costoPromedio : r4(nuevoValor.div(nuevaCantidad)),
    },
  };
}

/** Reconstruye el kárdex desde los movimientos en orden cronológico. */
export function reconstruirKardex<T extends MovimientoEntrada>(movimientos: T[]) {
  let saldo = saldoInicial();
  return movimientos.map((m) => {
    const r = aplicarMovimiento(saldo, m);
    saldo = r.saldo;
    return { ...m, ...r };
  });
}

/** Costo unitario de los materiales entregados a una orden: Σ costo de salidas ÷ Σ cantidad de salidas. */
export function costoPromedioEntregado(salidas: { cantidad: Num; costoTotal: Num }[]): Decimal | null {
  const cantidad = salidas.reduce((a, s) => a.plus(d(s.cantidad)), new Decimal(0));
  if (cantidad.isZero()) return null;
  return r4(salidas.reduce((a, s) => a.plus(d(s.costoTotal)), new Decimal(0)).div(cantidad));
}
