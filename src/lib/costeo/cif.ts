import { CIEN, Decimal, d, pesos, type Num } from "./decimal";
import { ErrorCosteo, MENSAJES } from "./errores";

export type BaseCIF = "HORAS_MOD" | "HORAS_TOTALES" | "COSTO_MOD" | "COSTO_DIRECTO" | "NUMERO_PROYECTOS" | "ACTIVIDADES";

/**
 * Actividades para la asignación diferenciada de CIF (enfoque híbrido órdenes + ABC simplificado):
 * cada actividad tiene su propia tasa predeterminada y su propio inductor.
 */
export type ActividadCIF = "ENSAMBLE" | "INGENIERIA" | "PRUEBAS_PUESTA_MARCHA" | "MATERIALES";

export const ACTIVIDADES_CIF: Record<ActividadCIF, { nombre: string; inductor: string; unidadTasa: string; esPorcentaje: boolean }> = {
  ENSAMBLE: { nombre: "Ensamble y cableado", inductor: "Horas de MOD", unidadTasa: "$ por hora", esPorcentaje: false },
  INGENIERIA: { nombre: "Ingeniería y automatización", inductor: "Horas de ingeniería y automatización", unidadTasa: "$ por hora", esPorcentaje: false },
  PRUEBAS_PUESTA_MARCHA: { nombre: "Pruebas y puesta en marcha", inductor: "Horas de pruebas y puesta en marcha", unidadTasa: "$ por hora", esPorcentaje: false },
  MATERIALES: { nombre: "Manejo de materiales", inductor: "Costo de materiales directos", unidadTasa: "%", esPorcentaje: true },
};

export interface TasaActividad {
  actividad: ActividadCIF;
  tasa: Num;
}

export interface DetalleActividadCIF {
  actividad: ActividadCIF;
  nombre: string;
  inductor: string;
  unidadTasa: string;
  cantidadBase: Decimal;
  tasa: Decimal;
  valor: Decimal;
}

export const BASES_CIF: Record<BaseCIF, { nombre: string; unidadTasa: string; esPorcentaje: boolean }> = {
  HORAS_MOD: { nombre: "Horas de MOD", unidadTasa: "$ por hora", esPorcentaje: false },
  HORAS_TOTALES: { nombre: "Horas totales del proyecto", unidadTasa: "$ por hora", esPorcentaje: false },
  COSTO_MOD: { nombre: "Costo de MOD", unidadTasa: "%", esPorcentaje: true },
  COSTO_DIRECTO: { nombre: "Costo directo", unidadTasa: "%", esPorcentaje: true },
  NUMERO_PROYECTOS: { nombre: "Número de proyectos", unidadTasa: "$ por proyecto", esPorcentaje: false },
  ACTIVIDADES: { nombre: "Tasas diferenciadas por actividad", unidadTasa: "según la actividad", esPorcentaje: false },
};

export interface InsumosCIF {
  horasMOD: Num;
  horasIngenieria: Num;
  costoMOD: Num;
  /** Materiales directos + MOD (sección 6.4). */
  costoDirecto: Num;
  /** Para tasas por actividad. */
  costoMateriales?: Num;
  horasIngAutomatizacion?: Num;
  horasPruebasPuestaMarcha?: Num;
}

export interface ResultadoCIF {
  base: BaseCIF;
  nombreBase: string;
  unidadTasa: string;
  cantidadBase: Decimal;
  tasa: Decimal;
  valor: Decimal;
  /** Solo para la base ACTIVIDADES. */
  detalle?: DetalleActividadCIF[];
}

export function cantidadBaseActividad(actividad: ActividadCIF, insumos: InsumosCIF): Decimal {
  switch (actividad) {
    case "ENSAMBLE":
      return d(insumos.horasMOD);
    case "INGENIERIA":
      return d(insumos.horasIngAutomatizacion);
    case "PRUEBAS_PUESTA_MARCHA":
      return d(insumos.horasPruebasPuestaMarcha);
    case "MATERIALES":
      return d(insumos.costoMateriales);
  }
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
    case "ACTIVIDADES":
      return d(insumos.horasMOD).plus(d(insumos.horasIngenieria));
  }
}

/**
 * Tasa predeterminada = CIF presupuestado ÷ base total estimada.
 * Para bases en porcentaje se expresa en % (× 100).
 * Para "Número de proyectos" la base estimada es el N.º de proyectos del período.
 */
export function tasaPredeterminada(base: BaseCIF | ActividadCIF, cifPresupuestado: Num, baseEstimada: Num): Decimal {
  const b = d(baseEstimada);
  if (!b.greaterThan(0)) throw new ErrorCosteo(MENSAJES.baseEstimadaCero, "BASE_ESTIMADA_CERO");
  const tasa = d(cifPresupuestado).div(b);
  const porcentaje = base in BASES_CIF ? BASES_CIF[base as BaseCIF].esPorcentaje : ACTIVIDADES_CIF[base as ActividadCIF].esPorcentaje;
  return (porcentaje ? tasa.times(CIEN) : tasa).toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
}

function calcularCIFActividades(tasas: TasaActividad[], insumos: InsumosCIF): ResultadoCIF {
  if (!tasas.length) throw new ErrorCosteo("La base por actividades requiere al menos una tasa de actividad", "SIN_TASAS_ACTIVIDAD");
  const detalle = tasas.map(({ actividad, tasa }) => {
    const t = d(tasa);
    if (t.isNegative()) throw new ErrorCosteo(MENSAJES.negativo("la tasa de CIF"), "VALOR_NEGATIVO");
    const info = ACTIVIDADES_CIF[actividad];
    const cantidadBase = cantidadBaseActividad(actividad, insumos);
    return {
      actividad,
      nombre: info.nombre,
      inductor: info.inductor,
      unidadTasa: info.unidadTasa,
      cantidadBase,
      tasa: t,
      valor: pesos(info.esPorcentaje ? cantidadBase.times(t).div(CIEN) : cantidadBase.times(t)),
    };
  });
  return {
    base: "ACTIVIDADES",
    nombreBase: BASES_CIF.ACTIVIDADES.nombre,
    unidadTasa: BASES_CIF.ACTIVIDADES.unidadTasa,
    cantidadBase: cantidadBaseCIF("ACTIVIDADES", insumos),
    tasa: new Decimal(0),
    valor: detalle.reduce((a, x) => a.plus(x.valor), new Decimal(0)),
    detalle,
  };
}

export function calcularCIF(base: BaseCIF, tasa: Num, insumos: InsumosCIF, tasasActividad: TasaActividad[] = []): ResultadoCIF {
  if (base === "ACTIVIDADES") return calcularCIFActividades(tasasActividad, insumos);
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
