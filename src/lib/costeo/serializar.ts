import DecimalBase from "decimal.js";

/** Tipo de T con cada Decimal reemplazado por string (apto para JSON / props de cliente). */
export type Serializado<T> = T extends DecimalBase
  ? string
  : T extends (infer U)[]
    ? Serializado<U>[]
    : T extends object
      ? { [K in keyof T]: Serializado<T[K]> }
      : T;

/** Convierte recursivamente todos los Decimal a string (para snapshot en BD o props). */
export function serializar<T>(valor: T): Serializado<T> {
  if (DecimalBase.isDecimal(valor)) return (valor as DecimalBase).toString() as Serializado<T>;
  if (Array.isArray(valor)) return valor.map(serializar) as Serializado<T>;
  if (valor && typeof valor === "object" && !(valor instanceof Date)) {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, serializar(v)])) as Serializado<T>;
  }
  return valor as Serializado<T>;
}
