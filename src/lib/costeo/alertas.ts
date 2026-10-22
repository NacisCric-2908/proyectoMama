import { CIEN, Decimal, d, type Num } from "./decimal";
import { formatearPesos, formatearPorcentaje } from "./formato";
import type { LineaMaterialResultado } from "./materiales";

export type NivelAlerta = "CRITICA" | "ADVERTENCIA" | "INFORMATIVA";

export interface Alerta {
  codigo: "COSTO_SUPERA_COTIZADO" | "MARGEN_BAJO_MINIMO" | "CONSUMO_90" | "MERMA_ALTA" | "ORDEN_VENCIDA";
  nivel: NivelAlerta;
  mensaje: string;
}

export interface EntradaAlertas {
  costoTotal: Decimal;
  valorCotizado: Decimal | null;
  margenPct: Decimal | null;
  margenMinimoPct: Num | null | undefined;
  abierta: boolean;
  terminada: boolean;
  lineasMaterial: LineaMaterialResultado[];
  umbralMermaPct: Num;
  /** 'aaaa-mm-dd' */
  fechaEstimadaEntrega?: string | null;
  /** 'aaaa-mm-dd' en America/Bogota */
  hoy?: string | null;
}

export function evaluarAlertas(e: EntradaAlertas): Alerta[] {
  const alertas: Alerta[] = [];
  const cotizado = e.valorCotizado;

  if (cotizado && cotizado.greaterThan(0)) {
    if (e.costoTotal.greaterThan(cotizado)) {
      alertas.push({
        codigo: "COSTO_SUPERA_COTIZADO",
        nivel: "CRITICA",
        mensaje: `El costo del proyecto supera el valor cotizado en ${formatearPesos(e.costoTotal.minus(cotizado))}`,
      });
    }
    if (e.margenPct && e.margenMinimoPct !== null && e.margenMinimoPct !== undefined && e.margenMinimoPct !== "") {
      const minimo = d(e.margenMinimoPct);
      if (e.margenPct.lessThan(minimo)) {
        alertas.push({
          codigo: "MARGEN_BAJO_MINIMO",
          nivel: "ADVERTENCIA",
          mensaje: `El margen (${formatearPorcentaje(e.margenPct)}) está por debajo del mínimo definido (${formatearPorcentaje(minimo)})`,
        });
      }
    }
    const consumo = e.costoTotal.div(cotizado).times(CIEN);
    if (e.abierta && consumo.greaterThanOrEqualTo(90)) {
      alertas.push({
        codigo: "CONSUMO_90",
        nivel: "ADVERTENCIA",
        mensaje: `El proyecto ya consumió el ${formatearPorcentaje(consumo)} del valor cotizado`,
      });
    }
  }

  const umbral = d(e.umbralMermaPct);
  for (const l of e.lineasMaterial) {
    if (l.mermaPct.greaterThan(umbral)) {
      alertas.push({ codigo: "MERMA_ALTA", nivel: "INFORMATIVA", mensaje: `Merma alta en ${l.descripcion}` });
    }
  }

  if (e.fechaEstimadaEntrega && e.hoy && !e.terminada && e.fechaEstimadaEntrega < e.hoy) {
    alertas.push({ codigo: "ORDEN_VENCIDA", nivel: "INFORMATIVA", mensaje: "Orden vencida" });
  }

  return alertas;
}
