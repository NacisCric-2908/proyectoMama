import { CIEN, CERO, Decimal, d, pesos, sumar, type Num } from "./decimal";
import { ErrorCosteo, MENSAJES } from "./errores";

/** Clasificación de la merma según la política de la empresa (D16 del artículo). */
export type ClasificacionMerma = "NORMAL" | "ANORMAL" | "RECUPERABLE";

export const NOMBRE_CLASIFICACION_MERMA: Record<ClasificacionMerma | "SIN_CLASIFICAR", string> = {
  NORMAL: "Normal (inherente al proceso)",
  ANORMAL: "Anormal (evitable)",
  RECUPERABLE: "Recuperable",
  SIN_CLASIFICAR: "Sin clasificar",
};

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
  clasificacionMerma?: ClasificacionMerma | null;
  /** Valor recuperado de una merma recuperable (venta de chatarra, reutilización…). */
  valorRecuperado?: Num | null;
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
  /** Merma × costo unitario (bruto). */
  costoMerma: Decimal;
  clasificacionMerma: ClasificacionMerma | null;
  valorRecuperado: Decimal;
  /** Costo de la merma menos el valor recuperado. Es el que se suma al costo. */
  costoMermaNeto: Decimal;
  costoEstimado: Decimal;
  /** (utilizada + merma) − requerida. Positiva = sobreconsumo; negativa = ahorro. */
  diferenciaCantidad: Decimal;
  diferenciaValor: Decimal;
}

export interface ResultadoMateriales {
  lineas: LineaMaterialResultado[];
  /** Σ utilizada × costo unitario (pesos). */
  costoMaterialesDirectos: Decimal;
  /** Σ costo neto de mermas incluidas en el costo (pesos). No se suma dentro de materiales directos. */
  costoMermas: Decimal;
  /** Costo neto de mermas por clasificación (pesos). */
  mermasPorClase: Record<ClasificacionMerma | "SIN_CLASIFICAR", Decimal>;
  valorRecuperadoTotal: Decimal;
  /** Merma anormal llevada a pérdida del período en lugar del costo de la orden (si la política lo indica). */
  mermaAnormalExcluida: Decimal;
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

  const costoMerma = merma.times(costoUnitario);
  const valorRecuperado = d(linea.valorRecuperado);
  noNegativo(valorRecuperado, "el valor recuperado");
  if (valorRecuperado.greaterThan(0) && linea.clasificacionMerma !== "RECUPERABLE")
    throw new ErrorCosteo("Solo una merma clasificada como recuperable puede tener valor recuperado", "RECUPERADO_SIN_CLASE");
  if (valorRecuperado.greaterThan(costoMerma))
    throw new ErrorCosteo("El valor recuperado no puede superar el costo de la merma", "RECUPERADO_EXCESIVO");

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
    costoMerma,
    clasificacionMerma: linea.clasificacionMerma ?? null,
    valorRecuperado,
    costoMermaNeto: costoMerma.minus(valorRecuperado),
    costoEstimado: requerida.times(costoUnitario),
    diferenciaCantidad,
    diferenciaValor: diferenciaCantidad.times(costoUnitario),
  };
}

export function calcularMateriales(lineas: LineaMaterialEntrada[], opciones: { excluirMermaAnormal?: boolean } = {}): ResultadoMateriales {
  const resultado = lineas.map(calcularLineaMaterial);
  const clase = (c: ClasificacionMerma | "SIN_CLASIFICAR") =>
    pesos(sumar(resultado.filter((l) => (l.clasificacionMerma ?? "SIN_CLASIFICAR") === c).map((l) => l.costoMermaNeto)));
  const excluida = (l: LineaMaterialResultado) => !!opciones.excluirMermaAnormal && l.clasificacionMerma === "ANORMAL";
  return {
    lineas: resultado,
    costoMaterialesDirectos: pesos(sumar(resultado.map((l) => l.costoLinea))),
    costoMermas: pesos(sumar(resultado.filter((l) => !excluida(l)).map((l) => l.costoMermaNeto))),
    mermasPorClase: { NORMAL: clase("NORMAL"), ANORMAL: clase("ANORMAL"), RECUPERABLE: clase("RECUPERABLE"), SIN_CLASIFICAR: clase("SIN_CLASIFICAR") },
    valorRecuperadoTotal: pesos(sumar(resultado.map((l) => l.valorRecuperado))),
    mermaAnormalExcluida: pesos(sumar(resultado.filter(excluida).map((l) => l.costoMermaNeto))),
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
