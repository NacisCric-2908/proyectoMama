import { CIEN, CERO, Decimal, d, pesos, sumar, type Num } from "./decimal";
import { ErrorCosteo, MENSAJES } from "./errores";

export interface LineaMaterialEntrada {
  id?: string;
  codigo?: string;
  descripcion: string;
  unidad?: string;
  etapaId?: string | null;
  requerida: Num;
  /** Si no se registra, se asume igual a utilizada + devuelta (merma = 0). */
  entregada?: Num | null;
  utilizada?: Num | null;
  devuelta?: Num | null;
  costoUnitario: Num;
}

export interface LineaMaterialResultado {
  id?: string;
  codigo?: string;
  descripcion: string;
  unidad?: string;
  etapaId?: string | null;
  requerida: Decimal;
  entregada: Decimal;
  entregadaRegistrada: boolean;
  utilizada: Decimal;
  devuelta: Decimal;
  costoUnitario: Decimal;
  merma: Decimal;
  /** merma ÷ entregada × 100 (0 si no hay entregada). */
  mermaPct: Decimal;
  costoLinea: Decimal;
  costoMerma: Decimal;
  costoEstimado: Decimal;
  /** (utilizada + merma) − requerida. Positiva = sobreconsumo; negativa = ahorro. */
  diferenciaCantidad: Decimal;
  diferenciaValor: Decimal;
}

export interface ResultadoMateriales {
  lineas: LineaMaterialResultado[];
  /** Σ utilizada × costo unitario (pesos). */
  costoMaterialesDirectos: Decimal;
  /** Σ merma × costo unitario (pesos). No se suma dentro de materiales directos. */
  costoMermas: Decimal;
  /** Σ requerida × costo unitario (pesos). */
  costoEstimado: Decimal;
  diferenciaValorTotal: Decimal;
  hayCantidadUtilizada: boolean;
}

function noNegativo(valor: Decimal, campo: string) {
  if (valor.isNegative()) throw new ErrorCosteo(MENSAJES.negativo(campo), "VALOR_NEGATIVO");
}

export function calcularLineaMaterial(linea: LineaMaterialEntrada): LineaMaterialResultado {
  const requerida = d(linea.requerida);
  const utilizada = d(linea.utilizada);
  const devuelta = d(linea.devuelta);
  const costoUnitario = d(linea.costoUnitario);
  const entregadaRegistrada = linea.entregada !== null && linea.entregada !== undefined && linea.entregada !== "";
  const entregada = entregadaRegistrada ? d(linea.entregada) : utilizada.plus(devuelta);

  noNegativo(requerida, "la cantidad requerida");
  noNegativo(entregada, "la cantidad entregada");
  noNegativo(utilizada, "la cantidad utilizada");
  noNegativo(devuelta, "la cantidad devuelta");
  noNegativo(costoUnitario, "el costo unitario");

  const merma = entregada.minus(utilizada).minus(devuelta);
  if (merma.isNegative()) throw new ErrorCosteo(MENSAJES.mermaNegativa, "MERMA_NEGATIVA");

  const diferenciaCantidad = utilizada.plus(merma).minus(requerida);

  return {
    id: linea.id,
    codigo: linea.codigo,
    descripcion: linea.descripcion,
    unidad: linea.unidad,
    etapaId: linea.etapaId ?? null,
    requerida,
    entregada,
    entregadaRegistrada,
    utilizada,
    devuelta,
    costoUnitario,
    merma,
    mermaPct: entregada.isZero() ? CERO : merma.div(entregada).times(CIEN),
    costoLinea: utilizada.times(costoUnitario),
    costoMerma: merma.times(costoUnitario),
    costoEstimado: requerida.times(costoUnitario),
    diferenciaCantidad,
    diferenciaValor: diferenciaCantidad.times(costoUnitario),
  };
}

export function calcularMateriales(lineas: LineaMaterialEntrada[]): ResultadoMateriales {
  const resultado = lineas.map(calcularLineaMaterial);
  return {
    lineas: resultado,
    costoMaterialesDirectos: pesos(sumar(resultado.map((l) => l.costoLinea))),
    costoMermas: pesos(sumar(resultado.map((l) => l.costoMerma))),
    costoEstimado: pesos(sumar(resultado.map((l) => l.costoEstimado))),
    diferenciaValorTotal: pesos(sumar(resultado.map((l) => l.diferenciaValor))),
    hayCantidadUtilizada: resultado.some((l) => l.utilizada.greaterThan(0)),
  };
}

/** Valida una línea sin lanzar: devuelve el mensaje de error o null. */
export function validarLineaMaterial(linea: LineaMaterialEntrada): string | null {
  try {
    calcularLineaMaterial(linea);
    return null;
  } catch (e) {
    if (e instanceof ErrorCosteo) return e.message;
    throw e;
  }
}
