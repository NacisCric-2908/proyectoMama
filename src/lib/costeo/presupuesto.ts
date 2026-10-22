import { CIEN, Decimal, d, pesos, precision4, sumar, type Num } from "./decimal";
import { ErrorCosteo, MENSAJES } from "./errores";
import { CONCEPTOS, type ElementosCosto } from "./totales";

/** Presupuesto de costo de una orden por componente (D04 del artículo). */
export interface PresupuestoComponentes {
  materialesDirectos: Num;
  manoObraDirecta: Num;
  ingenieriaAutomatizacion: Num;
  pruebasPuestaMarcha: Num;
  cif: Num;
  mermas?: Num | null;
  horasEnsamble?: Num | null;
  horasIngenieria?: Num | null;
}

export type SignoDiferencia = "MAYOR" | "MENOR" | "IGUAL";

export interface FilaComparacion {
  clave: keyof ElementosCosto | "total";
  concepto: string;
  presupuesto: Decimal;
  real: Decimal;
  /** real − presupuesto: positiva = costó más de lo presupuestado. */
  diferencia: Decimal;
  /** diferencia ÷ presupuesto × 100; null si el presupuesto es 0. */
  pct: Decimal | null;
  signo: SignoDiferencia;
}

export interface ComparacionPresupuesto {
  filas: FilaComparacion[];
  total: FilaComparacion;
  horas: { concepto: string; estimadas: Decimal; reales: Decimal; diferencia: Decimal; signo: SignoDiferencia }[];
}

const signo = (x: Decimal): SignoDiferencia => (x.greaterThan(0) ? "MAYOR" : x.lessThan(0) ? "MENOR" : "IGUAL");

function fila(clave: FilaComparacion["clave"], concepto: string, presupuesto: Decimal, real: Decimal): FilaComparacion {
  const diferencia = real.minus(presupuesto);
  return {
    clave,
    concepto,
    presupuesto,
    real,
    diferencia,
    pct: presupuesto.isZero() ? null : precision4(diferencia.div(presupuesto).times(CIEN)),
    signo: signo(diferencia),
  };
}

export function validarPresupuesto(p: PresupuestoComponentes): void {
  const valores = [...CONCEPTOS.map((c) => p[c.clave]), p.horasEnsamble, p.horasIngenieria];
  if (valores.some((v) => v !== null && v !== undefined && v !== "" && d(v).isNegative()))
    throw new ErrorCosteo(MENSAJES.negativo("el presupuesto"), "VALOR_NEGATIVO");
}

/** Costo total presupuestado (pesos). */
export function totalPresupuesto(p: PresupuestoComponentes): Decimal {
  validarPresupuesto(p);
  return pesos(sumar(CONCEPTOS.map((c) => d(p[c.clave]))));
}

/**
 * Compara el presupuesto con el costo acumulado real por componente,
 * con monto y signo de cada diferencia (D11), y las horas estimadas contra las registradas (Q14).
 */
export function compararConPresupuesto(
  p: PresupuestoComponentes,
  real: { elementos: Record<keyof ElementosCosto, Num>; costoTotal: Num; horasMOD: Num; horasIngenieria: Num },
): ComparacionPresupuesto {
  validarPresupuesto(p);
  const filas = CONCEPTOS.map((c) => fila(c.clave, c.nombre, d(p[c.clave]), d(real.elementos[c.clave])));
  const horas = (concepto: string, est: Num | null | undefined, reales: Num) => {
    const diferencia = d(reales).minus(d(est));
    return { concepto, estimadas: d(est), reales: d(reales), diferencia, signo: signo(diferencia) };
  };
  return {
    filas,
    total: fila("total", "Costo total", totalPresupuesto(p), d(real.costoTotal)),
    horas: [horas("Horas de ensamble (MOD)", p.horasEnsamble, real.horasMOD), horas("Horas de ingeniería", p.horasIngenieria, real.horasIngenieria)],
  };
}

/**
 * De las versiones de presupuesto de una orden: el original es la primera versión aprobada
 * y el vigente la última aprobada. Las versiones sin aprobar no se usan para comparar.
 */
export function elegirPresupuestos<T extends { version: number; aprobadoEn: Date | string | null }>(versiones: T[]) {
  const aprobadas = versiones.filter((v) => v.aprobadoEn).sort((a, b) => a.version - b.version);
  return { original: aprobadas[0] ?? null, vigente: aprobadas[aprobadas.length - 1] ?? null };
}
