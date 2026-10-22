import DecimalBase from "decimal.js";

/**
 * Decimal configurado para el motor de costeo.
 * Nunca se usa `number` para dinero: todo pasa por esta clase.
 */
export const Decimal = DecimalBase.clone({
  precision: 40,
  rounding: DecimalBase.ROUND_HALF_UP,
});
export type Decimal = InstanceType<typeof Decimal>;

/** Valor numérico aceptado como entrada (string recomendado para valores que vienen de BD). */
export type Num = string | number | DecimalBase;

export const CERO = new Decimal(0);
export const CIEN = new Decimal(100);

export function d(valor: Num | null | undefined): Decimal {
  if (valor === null || valor === undefined || valor === "") return new Decimal(0);
  return new Decimal(valor as DecimalBase.Value);
}

/** Redondea a pesos (0 decimales, mitad hacia arriba). */
export function pesos(valor: Decimal): Decimal {
  return valor.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

/** Redondea tasas / cantidades / porcentajes internos (≥ 4 decimales). */
export function precision4(valor: Decimal): Decimal {
  return valor.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

export function sumar(valores: Decimal[]): Decimal {
  return valores.reduce((acc, v) => acc.plus(v), new Decimal(0));
}
