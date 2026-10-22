export const SECUENCIA_ESTADOS = [
  "BORRADOR",
  "COTIZADO",
  "EN_INGENIERIA",
  "EN_FABRICACION",
  "EN_PRUEBAS",
  "EN_PUESTA_MARCHA",
  "TERMINADO",
  "FACTURADO",
] as const;

export type EstadoOrden = (typeof SECUENCIA_ESTADOS)[number] | "ANULADO";

export const NOMBRE_ESTADO: Record<EstadoOrden, string> = {
  BORRADOR: "Borrador",
  COTIZADO: "Cotizado",
  EN_INGENIERIA: "En ingeniería",
  EN_FABRICACION: "En fabricación",
  EN_PRUEBAS: "En pruebas",
  EN_PUESTA_MARCHA: "En puesta en marcha",
  TERMINADO: "Terminado",
  FACTURADO: "Facturado",
  ANULADO: "Anulado",
};

const idx = (e: EstadoOrden) => (e === "ANULADO" ? -1 : SECUENCIA_ESTADOS.indexOf(e));

/** Borrador o activa: se puede editar. */
export function esEditable(e: EstadoOrden): boolean {
  return e !== "ANULADO" && idx(e) < idx("TERMINADO");
}

/** Activa: entre Cotizado y En puesta en marcha. */
export function esActiva(e: EstadoOrden): boolean {
  return e !== "ANULADO" && idx(e) >= idx("COTIZADO") && idx(e) < idx("TERMINADO");
}

export function estaCerrada(e: EstadoOrden): boolean {
  return e === "TERMINADO" || e === "FACTURADO";
}

export interface DatosActivacion {
  clienteId?: string | null;
  descripcion?: string | null;
  fechaEstimadaEntrega?: string | Date | null;
  valorCotizado?: string | number | null;
}

/** Campos que faltan para pasar de Borrador a Cotizado. */
export function faltantesParaActivar(o: DatosActivacion): string[] {
  const faltan: string[] = [];
  if (!o.clienteId) faltan.push("Cliente");
  if (!o.descripcion || !String(o.descripcion).trim()) faltan.push("Descripción");
  if (!o.fechaEstimadaEntrega) faltan.push("Fecha estimada de entrega");
  if (o.valorCotizado === null || o.valorCotizado === undefined || o.valorCotizado === "" || Number(o.valorCotizado) <= 0)
    faltan.push("Valor cotizado");
  return faltan;
}

export interface ContextoTransicion {
  comentario?: string | null;
  puedeReabrir?: boolean;
  datos?: DatosActivacion;
}

export type ResultadoTransicion =
  | { ok: true; tipo: "avance" | "salto" | "retroceso" | "anulacion" | "cierre" | "facturacion" | "reapertura" }
  | { ok: false; error: string; faltantes?: string[] };

export function validarTransicion(actual: EstadoOrden, nuevo: EstadoOrden, ctx: ContextoTransicion = {}): ResultadoTransicion {
  const comentario = ctx.comentario?.trim();
  if (actual === nuevo) return { ok: false, error: "La orden ya está en ese estado" };
  if (actual === "ANULADO") return { ok: false, error: "Una orden anulada no puede cambiar de estado" };

  if (nuevo === "ANULADO") {
    if (idx(actual) >= idx("TERMINADO")) return { ok: false, error: "Solo se puede anular una orden antes de Terminado" };
    if (!comentario) return { ok: false, error: "Debe indicar un comentario para anular la orden" };
    return { ok: true, tipo: "anulacion" };
  }

  const i = idx(actual);
  const j = idx(nuevo);

  if (j < i) {
    if (i - j > 1) return { ok: false, error: "Solo se puede retroceder un estado a la vez" };
    if (!comentario) return { ok: false, error: "Debe indicar un comentario para retroceder de estado" };
    if (actual === "TERMINADO") {
      if (!ctx.puedeReabrir) return { ok: false, error: "Solo el administrador puede reabrir una orden cerrada" };
      return { ok: true, tipo: "reapertura" };
    }
    return { ok: true, tipo: "retroceso" };
  }

  if (nuevo === "FACTURADO" && actual !== "TERMINADO")
    return { ok: false, error: "Solo se puede facturar una orden terminada" };

  if (actual === "BORRADOR") {
    const faltantes = faltantesParaActivar(ctx.datos ?? {});
    if (faltantes.length)
      return { ok: false, error: `Faltan datos obligatorios para activar la orden: ${faltantes.join(", ")}`, faltantes };
  }

  const salto = j - i > 1;
  if (salto && !comentario) return { ok: false, error: "Debe indicar un comentario para saltar etapas" };
  if (nuevo === "TERMINADO") return { ok: true, tipo: "cierre" };
  if (nuevo === "FACTURADO") return { ok: true, tipo: "facturacion" };
  return { ok: true, tipo: salto ? "salto" : "avance" };
}

/** Estados a los que se puede intentar pasar desde `actual` (para la interfaz). */
export function estadosDestino(actual: EstadoOrden): EstadoOrden[] {
  if (actual === "ANULADO") return [];
  const i = idx(actual);
  const destinos: EstadoOrden[] = [];
  if (i > 0) destinos.push(SECUENCIA_ESTADOS[i - 1]);
  for (let j = i + 1; j < SECUENCIA_ESTADOS.length; j++) {
    const e = SECUENCIA_ESTADOS[j];
    if (e === "FACTURADO" && actual !== "TERMINADO") continue;
    destinos.push(e);
  }
  if (i < idx("TERMINADO")) destinos.push("ANULADO");
  return destinos;
}
