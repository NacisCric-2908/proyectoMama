import { CIEN, Decimal, d, pesos, precision4, sumar, type Num } from "./decimal";
import { ErrorCosteo } from "./errores";

/**
 * Política para tratar la diferencia entre el CIF real y el CIF aplicado del período:
 * - PRORRATEO_CIF_APLICADO: se reparte entre las órdenes del período en proporción a su CIF aplicado.
 * - COSTO_DE_VENTAS: se lleva completa al costo de ventas del período; las órdenes no cambian.
 */
export type PoliticaAjusteCIF = "PRORRATEO_CIF_APLICADO" | "COSTO_DE_VENTAS";

export const NOMBRE_POLITICA: Record<PoliticaAjusteCIF, string> = {
  PRORRATEO_CIF_APLICADO: "Prorrateo entre las órdenes según su CIF aplicado",
  COSTO_DE_VENTAS: "Ajuste al costo de ventas del período (sin modificar las órdenes)",
};

export type TipoDiferenciaCIF = "SUBAPLICADO" | "SOBREAPLICADO" | "SIN_DIFERENCIA";

export const NOMBRE_TIPO_DIFERENCIA: Record<TipoDiferenciaCIF, string> = {
  SUBAPLICADO: "CIF subaplicado (real mayor que aplicado)",
  SOBREAPLICADO: "CIF sobreaplicado (real menor que aplicado)",
  SIN_DIFERENCIA: "Sin diferencia",
};

export interface OrdenConciliable {
  id: string;
  codigo?: string;
  cifAplicado: Num;
  /** Costo acumulado de la orden (con CIF aplicado). */
  costoTotal: Num;
  valorCotizado?: Num | null;
}

export interface AjusteOrden {
  id: string;
  codigo?: string;
  cifAplicado: Decimal;
  ajuste: Decimal;
  costoAcumulado: Decimal;
  costoAjustado: Decimal;
  margenAjustado: Decimal | null;
  margenAjustadoPct: Decimal | null;
}

export interface ResultadoConciliacion {
  cifReal: Decimal;
  cifAplicado: Decimal;
  /** CIF real − Σ CIF aplicado. Positiva = subaplicación; negativa = sobreaplicación. */
  diferencia: Decimal;
  tipo: TipoDiferenciaCIF;
  politica: PoliticaAjusteCIF;
  ajustes: AjusteOrden[];
  /** Parte de la diferencia llevada al costo de ventas del período. */
  ajusteCostoVentas: Decimal;
}

/**
 * Conciliación del CIF del período (modelo analítico del artículo):
 * Diferencia de CIF = CIF real − Σ CIF aplicado;
 * Costo ajustado de la orden = costo acumulado + parte de la diferencia según la política.
 * Con prorrateo, los ajustes se redondean a pesos y el residuo de redondeo se asigna a la orden
 * con mayor CIF aplicado, para que la suma de ajustes sea exactamente la diferencia.
 */
export function conciliarCIF(cifRealEntrada: Num, ordenes: OrdenConciliable[], politica: PoliticaAjusteCIF): ResultadoConciliacion {
  const cifReal = pesos(d(cifRealEntrada));
  if (cifReal.isNegative()) throw new ErrorCosteo("El CIF real no puede ser negativo", "VALOR_NEGATIVO");
  const cifAplicado = pesos(sumar(ordenes.map((o) => d(o.cifAplicado))));
  const diferencia = cifReal.minus(cifAplicado);
  const tipo: TipoDiferenciaCIF = diferencia.greaterThan(0) ? "SUBAPLICADO" : diferencia.lessThan(0) ? "SOBREAPLICADO" : "SIN_DIFERENCIA";

  const prorratear = politica === "PRORRATEO_CIF_APLICADO" && !diferencia.isZero();
  if (prorratear && cifAplicado.isZero())
    throw new ErrorCosteo(
      "No hay CIF aplicado en el período para prorratear la diferencia; use la política de ajuste al costo de ventas",
      "SIN_BASE_PRORRATEO",
    );

  const partes = ordenes.map((o) => (prorratear ? pesos(diferencia.times(d(o.cifAplicado)).div(cifAplicado)) : new Decimal(0)));
  if (prorratear && ordenes.length) {
    const residuo = diferencia.minus(sumar(partes));
    let mayor = 0;
    ordenes.forEach((o, i) => {
      if (d(o.cifAplicado).greaterThan(d(ordenes[mayor].cifAplicado))) mayor = i;
    });
    partes[mayor] = partes[mayor].plus(residuo);
  }

  const ajustes = ordenes.map((o, i) => {
    const costoAcumulado = d(o.costoTotal);
    const costoAjustado = costoAcumulado.plus(partes[i]);
    const cot = o.valorCotizado === null || o.valorCotizado === undefined || o.valorCotizado === "" ? null : d(o.valorCotizado);
    const conCot = cot !== null && cot.greaterThan(0);
    const margenAjustado = conCot ? cot!.minus(costoAjustado) : null;
    return {
      id: o.id,
      codigo: o.codigo,
      cifAplicado: d(o.cifAplicado),
      ajuste: partes[i],
      costoAcumulado,
      costoAjustado,
      margenAjustado,
      margenAjustadoPct: conCot ? precision4(margenAjustado!.div(cot!).times(CIEN)) : null,
    };
  });

  return {
    cifReal,
    cifAplicado,
    diferencia,
    tipo,
    politica,
    ajustes,
    ajusteCostoVentas: politica === "COSTO_DE_VENTAS" ? diferencia : new Decimal(0),
  };
}
