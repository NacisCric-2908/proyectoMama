import { CIEN, Decimal, d, pesos, precision4, sumar, type Num } from "./decimal";
import { ErrorCosteo, MENSAJES } from "./errores";
import { calcularMateriales, type LineaMaterialEntrada, type ResultadoMateriales } from "./materiales";
import { calcularMOD, type RegistroMODEntrada, type ResultadoMOD } from "./mod";
import {
  calcularIngenieria,
  type EtapaInfo,
  type RegistroIngenieriaEntrada,
  type ResultadoIngenieria,
  type ServicioAdicionalEntrada,
} from "./ingenieria";
import { calcularCIF, type BaseCIF, type ResultadoCIF, type TasaActividad } from "./cif";
import { evaluarAlertas, type Alerta } from "./alertas";
import { esEditable, estaCerrada, type EstadoOrden } from "./estados";

export interface ElementosCosto {
  materialesDirectos: Decimal;
  manoObraDirecta: Decimal;
  ingenieriaAutomatizacion: Decimal;
  pruebasPuestaMarcha: Decimal;
  cif: Decimal;
  mermas: Decimal;
}

export const CONCEPTOS: { clave: keyof ElementosCosto; nombre: string }[] = [
  { clave: "materialesDirectos", nombre: "Materiales directos" },
  { clave: "manoObraDirecta", nombre: "Mano de obra directa" },
  { clave: "ingenieriaAutomatizacion", nombre: "Ingeniería y automatización" },
  { clave: "pruebasPuestaMarcha", nombre: "Pruebas y puesta en marcha" },
  { clave: "cif", nombre: "Costos indirectos asignados" },
  { clave: "mermas", nombre: "Mermas" },
];

export interface DatosCotizacion {
  cantidadUnidades: Num;
  valorCotizado?: Num | null;
  margenEsperadoPct?: Num | null;
}

export interface Totales {
  costoTotal: Decimal;
  costoUnitario: Decimal;
  valorCotizado: Decimal | null;
  /** null = "Sin cotización". */
  margenBruto: Decimal | null;
  margenPct: Decimal | null;
  precioSugerido: Decimal | null;
  participacion: { clave: keyof ElementosCosto; concepto: string; valor: Decimal; pct: Decimal }[];
}

const vacio = (v: Num | null | undefined) => v === null || v === undefined || v === "";

export function calcularTotales(el: ElementosCosto, cot: DatosCotizacion): Totales {
  const unidades = d(cot.cantidadUnidades);
  if (!unidades.greaterThan(0)) throw new ErrorCosteo(MENSAJES.unidadesInvalidas, "UNIDADES_INVALIDAS");

  const costoTotal = sumar(CONCEPTOS.map((c) => el[c.clave]));
  const cotizado = vacio(cot.valorCotizado) ? null : d(cot.valorCotizado);
  if (cotizado?.isNegative()) throw new ErrorCosteo(MENSAJES.negativo("el valor cotizado"), "VALOR_NEGATIVO");
  const hayCotizacion = cotizado !== null && cotizado.greaterThan(0);

  let precioSugerido: Decimal | null = null;
  if (!vacio(cot.margenEsperadoPct)) {
    const m = d(cot.margenEsperadoPct);
    if (m.isNegative() || m.greaterThanOrEqualTo(100))
      throw new ErrorCosteo(MENSAJES.margenEsperadoInvalido, "MARGEN_ESPERADO_INVALIDO");
    precioSugerido = pesos(costoTotal.div(new Decimal(1).minus(m.div(CIEN))));
  }

  const margenBruto = hayCotizacion ? cotizado!.minus(costoTotal) : null;
  return {
    costoTotal,
    costoUnitario: pesos(costoTotal.div(unidades)),
    valorCotizado: cotizado,
    margenBruto,
    margenPct: hayCotizacion ? precision4(margenBruto!.div(cotizado!).times(CIEN)) : null,
    precioSugerido,
    participacion: CONCEPTOS.map((c) => ({
      clave: c.clave,
      concepto: c.nombre,
      valor: el[c.clave],
      pct: costoTotal.isZero() ? new Decimal(0) : precision4(el[c.clave].div(costoTotal).times(CIEN)),
    })),
  };
}

export interface EntradaOrden {
  estado: EstadoOrden;
  cantidadUnidades: Num;
  valorCotizado?: Num | null;
  margenEsperadoPct?: Num | null;
  margenMinimoPct?: Num | null;
  /** 'aaaa-mm-dd' */
  fechaEstimadaEntrega?: string | null;
  /** 'aaaa-mm-dd' (Bogotá). Si se omite no se evalúa "Orden vencida". */
  hoy?: string | null;
  umbralMermaPct?: Num;
  etapas: EtapaInfo[];
  materiales: LineaMaterialEntrada[];
  mod: RegistroMODEntrada[];
  ingenieria: RegistroIngenieriaEntrada[];
  servicios?: ServicioAdicionalEntrada[];
  /** Asignación de CIF guardada en la orden (snapshot de la tasa). null = sin asignar. */
  cif?: { base: BaseCIF; tasa: Num; tasasActividad?: TasaActividad[] } | null;
  /** Política: llevar la merma anormal a pérdida del período en lugar del costo de la orden. */
  excluirMermaAnormal?: boolean;
}

export interface ResumenCostos extends Totales {
  materiales: ResultadoMateriales;
  mod: ResultadoMOD;
  ingenieria: ResultadoIngenieria;
  costoDirecto: Decimal;
  cif: ResultadoCIF | null;
  elementos: ElementosCosto;
  cantidadUnidades: Decimal;
  margenMinimoPct: Decimal | null;
  /** Mostrar "costo estimado de materiales" (Borrador/Cotizado sin cantidades utilizadas). */
  mostrarCostoEstimadoMateriales: boolean;
  alertas: Alerta[];
  advertencias: string[];
  /** Merma anormal excluida del costo de la orden y reconocida como pérdida del período. */
  perdidaMermaAnormal: Decimal;
}

export function calcularResumen(o: EntradaOrden): ResumenCostos {
  const materiales = calcularMateriales(o.materiales, { excluirMermaAnormal: o.excluirMermaAnormal });
  const mod = calcularMOD(o.mod);
  const ingenieria = calcularIngenieria(o.etapas, o.ingenieria, o.servicios ?? []);
  const costoDirecto = materiales.costoMaterialesDirectos.plus(mod.costoMOD);

  const cif = o.cif
    ? calcularCIF(o.cif.base, o.cif.tasa, {
        horasMOD: mod.horasMOD,
        horasIngenieria: ingenieria.horasIngenieria,
        costoMOD: mod.costoMOD,
        costoDirecto,
        costoMateriales: materiales.costoMaterialesDirectos,
        horasIngAutomatizacion: ingenieria.porGrupo.INGENIERIA_AUTOMATIZACION.horas,
        horasPruebasPuestaMarcha: ingenieria.porGrupo.PRUEBAS_PUESTA_MARCHA.horas,
      }, o.cif.tasasActividad ?? [])
    : null;

  const elementos: ElementosCosto = {
    materialesDirectos: materiales.costoMaterialesDirectos,
    manoObraDirecta: mod.costoMOD,
    ingenieriaAutomatizacion: ingenieria.porGrupo.INGENIERIA_AUTOMATIZACION.costo,
    pruebasPuestaMarcha: ingenieria.porGrupo.PRUEBAS_PUESTA_MARCHA.costo,
    cif: cif?.valor ?? new Decimal(0),
    mermas: materiales.costoMermas,
  };

  const totales = calcularTotales(elementos, o);
  const margenMinimoPct = vacio(o.margenMinimoPct) ? null : d(o.margenMinimoPct);

  const alertas = evaluarAlertas({
    costoTotal: totales.costoTotal,
    valorCotizado: totales.valorCotizado,
    margenPct: totales.margenPct,
    margenMinimoPct,
    abierta: esEditable(o.estado),
    terminada: estaCerrada(o.estado) || o.estado === "ANULADO",
    lineasMaterial: materiales.lineas,
    umbralMermaPct: o.umbralMermaPct ?? 10,
    fechaEstimadaEntrega: o.fechaEstimadaEntrega,
    hoy: o.hoy,
  });

  return {
    ...totales,
    materiales,
    mod,
    ingenieria,
    costoDirecto,
    cif,
    elementos,
    cantidadUnidades: d(o.cantidadUnidades),
    margenMinimoPct,
    mostrarCostoEstimadoMateriales:
      (o.estado === "BORRADOR" || o.estado === "COTIZADO") && !materiales.hayCantidadUtilizada,
    alertas,
    advertencias: ingenieria.advertencias,
    perdidaMermaAnormal: materiales.mermaAnormalExcluida,
  };
}

/**
 * Resumen estimado (al cotizar): se asume que se usará exactamente lo requerido
 * en la lista técnica, sin mermas.
 */
export function calcularResumenEstimado(o: EntradaOrden): ResumenCostos {
  return calcularResumen({
    ...o,
    materiales: o.materiales.map((l) => ({ ...l, entregada: l.requerida, utilizada: l.requerida, devuelta: 0 })),
  });
}
