import { Decimal, d, pesos, sumar, type Num } from "./decimal";
import { ErrorCosteo, MENSAJES } from "./errores";

export type GrupoEtapa = "INGENIERIA_AUTOMATIZACION" | "PRUEBAS_PUESTA_MARCHA";

export const NOMBRE_GRUPO: Record<GrupoEtapa, string> = {
  INGENIERIA_AUTOMATIZACION: "Ingeniería y automatización",
  PRUEBAS_PUESTA_MARCHA: "Pruebas y puesta en marcha",
};

export interface EtapaInfo {
  id: string;
  nombre: string;
  grupo: GrupoEtapa;
  orden?: number;
}

export interface RegistroIngenieriaEntrada {
  id?: string;
  etapaId: string;
  responsable?: string | null;
  /** 'aaaa-mm-dd' */
  fechaInicio?: string | null;
  fechaFin?: string | null;
  horas: Num;
  costoHora: Num;
}

export interface ServicioAdicionalEntrada {
  id?: string;
  etapaId: string;
  descripcion?: string;
  valor: Num;
}

export interface ResumenEtapa {
  etapaId: string;
  nombre: string;
  grupo: GrupoEtapa;
  horas: Decimal;
  costoHoras: Decimal;
  costoServicios: Decimal;
  /** Redondeado a pesos. */
  costo: Decimal;
}

export interface ResultadoIngenieria {
  porEtapa: ResumenEtapa[];
  porGrupo: Record<GrupoEtapa, { horas: Decimal; costo: Decimal }>;
  horasIngenieria: Decimal;
  costoIngenieria: Decimal;
  advertencias: string[];
}

/** Días hábiles (lunes a viernes) entre dos fechas 'aaaa-mm-dd', ambos inclusive. */
export function diasHabiles(inicio: string, fin: string): number {
  const a = new Date(`${inicio}T00:00:00Z`);
  const b = new Date(`${fin}T00:00:00Z`);
  let dias = 0;
  for (let t = a.getTime(); t <= b.getTime(); t += 86_400_000) {
    const dia = new Date(t).getUTCDay();
    if (dia !== 0 && dia !== 6) dias++;
  }
  return dias;
}

/**
 * Valida un registro de ingeniería. Lanza error si es inválido; devuelve una
 * advertencia (sin bloquear) si las horas superan días hábiles × 10.
 */
export function validarRegistroIngenieria(r: RegistroIngenieriaEntrada): string | null {
  const horas = d(r.horas);
  if (!horas.greaterThan(0)) throw new ErrorCosteo(MENSAJES.horasNoPositivas, "HORAS_INVALIDAS");
  if (d(r.costoHora).isNegative()) throw new ErrorCosteo(MENSAJES.negativo("el costo hora"), "VALOR_NEGATIVO");
  if (r.fechaInicio && r.fechaFin) {
    if (r.fechaFin < r.fechaInicio) throw new ErrorCosteo(MENSAJES.fechasInvertidas, "FECHAS_INVERTIDAS");
    const maximo = diasHabiles(r.fechaInicio, r.fechaFin) * 10;
    if (horas.greaterThan(maximo)) {
      return `Las horas registradas (${horas.toString().replace(".", ",")}) superan los días hábiles del rango × 10 (${maximo})`;
    }
  }
  return null;
}

export function calcularIngenieria(
  etapas: EtapaInfo[],
  registros: RegistroIngenieriaEntrada[],
  servicios: ServicioAdicionalEntrada[] = [],
): ResultadoIngenieria {
  const mapa = new Map(etapas.map((e) => [e.id, e]));
  const advertencias: string[] = [];

  for (const r of registros) {
    if (!mapa.has(r.etapaId)) throw new ErrorCosteo(MENSAJES.etapaDesconocida(r.etapaId), "ETAPA_DESCONOCIDA");
    const adv = validarRegistroIngenieria(r);
    if (adv) advertencias.push(adv);
  }
  for (const s of servicios) {
    if (!mapa.has(s.etapaId)) throw new ErrorCosteo(MENSAJES.etapaDesconocida(s.etapaId), "ETAPA_DESCONOCIDA");
    if (d(s.valor).isNegative()) throw new ErrorCosteo(MENSAJES.negativo("el valor del servicio"), "VALOR_NEGATIVO");
  }

  const ordenadas = [...etapas].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const porEtapa: ResumenEtapa[] = ordenadas.map((e) => {
    const regs = registros.filter((r) => r.etapaId === e.id);
    const servs = servicios.filter((s) => s.etapaId === e.id);
    const horas = sumar(regs.map((r) => d(r.horas)));
    const costoHoras = sumar(regs.map((r) => d(r.horas).times(d(r.costoHora))));
    const costoServicios = sumar(servs.map((s) => d(s.valor)));
    return {
      etapaId: e.id,
      nombre: e.nombre,
      grupo: e.grupo,
      horas,
      costoHoras,
      costoServicios,
      costo: pesos(costoHoras.plus(costoServicios)),
    };
  });

  // Los grupos y el total se suman a partir de las etapas ya redondeadas,
  // para que el resumen por etapas sume exactamente el total.
  const grupo = (g: GrupoEtapa) => {
    const es = porEtapa.filter((e) => e.grupo === g);
    return { horas: sumar(es.map((e) => e.horas)), costo: sumar(es.map((e) => e.costo)) };
  };
  const porGrupo = {
    INGENIERIA_AUTOMATIZACION: grupo("INGENIERIA_AUTOMATIZACION"),
    PRUEBAS_PUESTA_MARCHA: grupo("PRUEBAS_PUESTA_MARCHA"),
  };

  return {
    porEtapa,
    porGrupo,
    horasIngenieria: sumar(porEtapa.map((e) => e.horas)),
    costoIngenieria: sumar(porEtapa.map((e) => e.costo)),
    advertencias,
  };
}
