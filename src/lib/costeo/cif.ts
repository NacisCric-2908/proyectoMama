import { CIEN, Decimal, d, pesos, type Num } from "./decimal";
import { ErrorCosteo, MENSAJES } from "./errores";

export type BaseCIF = "HORAS_MOD" | "HORAS_TOTALES" | "COSTO_MOD" | "COSTO_DIRECTO" | "NUMERO_PROYECTOS";

export const BASES_CIF: Record<BaseCIF, { nombre: string; unidadTasa: string; esPorcentaje: boolean }> = {
  HORAS_MOD: { nombre: "Horas de MOD", unidadTasa: "$ por hora", esPorcentaje: false },
  HORAS_TOTALES: { nombre: "Horas totales del proyecto", unidadTasa: "$ por hora", esPorcentaje: false },
  COSTO_MOD: { nombre: "Costo de MOD", unidadTasa: "%", esPorcentaje: true },
  COSTO_DIRECTO: { nombre: "Costo directo", unidadTasa: "%", esPorcentaje: true },
  NUMERO_PROYECTOS: { nombre: "Número de proyectos", unidadTasa: "$ por proyecto", esPorcentaje: false },
};

export interface InsumosCIF {
  horasMOD: Num;
  horasIngenieria: Num;
  costoMOD: Num;
  /** Materiales directos + MOD (sección 6.4). */
  costoDirecto: Num;
}

export interface ResultadoCIF {
  base: BaseCIF;
  nombreBase: string;
  unidadTasa: string;
  cantidadBase: Decimal;
  tasa: Decimal;
  valor: Decimal;
}

export function cantidadBaseCIF(base: BaseCIF, insumos: InsumosCIF): Decimal {
  switch (base) {
    case "HORAS_MOD":
      return d(insumos.horasMOD);
    case "HORAS_TOTALES":
      return d(insumos.horasMOD).plus(d(insumos.horasIngenieria));
    case "COSTO_MOD":
      return d(insumos.costoMOD);
    case "COSTO_DIRECTO":
      return d(insumos.costoDirecto);
    case "NUMERO_PROYECTOS":
      return new Decimal(1);
  }
}

/**
 * Tasa predeterminada = CIF presupuestado ÷ base total estimada.
 * Para bases en porcentaje se expresa en % (× 100).
 * Para "Número de proyectos" la base estimada es el N.º de proyectos del período.
 */
export function tasaPredeterminada(base: BaseCIF, cifPresupuestado: Num, baseEstimada: Num): Decimal {
  const b = d(baseEstimada);
  if (!b.greaterThan(0)) throw new ErrorCosteo(MENSAJES.baseEstimadaCero, "BASE_ESTIMADA_CERO");
  const tasa = d(cifPresupuestado).div(b);
  return (BASES_CIF[base].esPorcentaje ? tasa.times(CIEN) : tasa).toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
}

export function calcularCIF(base: BaseCIF, tasa: Num, insumos: InsumosCIF): ResultadoCIF {
  const t = d(tasa);
  if (t.isNegative()) throw new ErrorCosteo(MENSAJES.negativo("la tasa de CIF"), "VALOR_NEGATIVO");
  const info = BASES_CIF[base];
  const cantidadBase = cantidadBaseCIF(base, insumos);
  const bruto = info.esPorcentaje ? cantidadBase.times(t).div(CIEN) : cantidadBase.times(t);
  return {
    base,
    nombreBase: info.nombre,
    unidadTasa: info.unidadTasa,
    cantidadBase,
    tasa: t,
    valor: pesos(bruto),
  };
}
