export interface TrabajadorConTarifas {
  id: string;
  nombre: string;
  cargo: string;
  tipo: string;
  tarifas: { desde: string; hasta: string | null; costo: string }[];
}

/** Tarifa vigente en la fecha (para prellenar el formulario; el servidor la vuelve a validar). */
export function tarifaEnFecha(t: TrabajadorConTarifas | undefined, fecha: string): string {
  if (!t || !fecha) return "";
  const vigente = t.tarifas
    .filter((x) => x.desde <= fecha && (!x.hasta || x.hasta >= fecha))
    .sort((a, b) => (a.desde < b.desde ? 1 : -1))[0];
  return vigente?.costo ?? "";
}
