import { Decimal, d, type Num } from "./decimal";

export const ZONA_HORARIA = "America/Bogota";

function separarMiles(entero: string): string {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** `$4.500.000` (punto de miles, sin decimales). Negativos: `-$300.000`. */
export function formatearPesos(valor: Num | null | undefined): string {
  const v = d(valor).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const signo = v.isNegative() && !v.isZero() ? "-" : "";
  return `${signo}$${separarMiles(v.abs().toFixed(0))}`;
}

/** `17,89%` (coma decimal, 2 decimales por defecto). */
export function formatearPorcentaje(valor: Num | null | undefined, decimales = 2): string {
  const v = d(valor).toDecimalPlaces(decimales, Decimal.ROUND_HALF_UP);
  const [entero, frac] = v.abs().toFixed(decimales).split(".");
  const signo = v.isNegative() && !v.isZero() ? "-" : "";
  return `${signo}${separarMiles(entero)}${frac ? "," + frac : ""}%`;
}

/** Cantidades con hasta 4 decimales: `1.234,5`. */
export function formatearCantidad(valor: Num | null | undefined, maxDecimales = 4): string {
  const v = d(valor).toDecimalPlaces(maxDecimales, Decimal.ROUND_HALF_UP);
  const [entero, frac] = v.abs().toFixed().split(".");
  const signo = v.isNegative() && !v.isZero() ? "-" : "";
  return `${signo}${separarMiles(entero)}${frac ? "," + frac : ""}`;
}

/** `dd/mm/aaaa` en zona America/Bogota. Acepta Date o 'aaaa-mm-dd'. */
export function formatearFecha(fecha: Date | string | null | undefined): string {
  if (!fecha) return "";
  if (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const [a, m, dia] = fecha.split("-");
    return `${dia}/${m}/${a}`;
  }
  const f = typeof fecha === "string" ? new Date(fecha) : fecha;
  const partes = new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA_HORARIA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(f);
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "";
  return `${p("day")}/${p("month")}/${p("year")}`;
}

/** Fecha de hoy en Bogotá como 'aaaa-mm-dd'. */
export function hoyBogota(ahora: Date = new Date()): string {
  return fechaISOBogota(ahora);
}

export function fechaISOBogota(fecha: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(fecha);
  return partes; // en-CA => aaaa-mm-dd
}
