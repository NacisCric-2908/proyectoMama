import { Decimal, d, pesos, sumar, type Num } from "./decimal";
import { ErrorCosteo, MENSAJES } from "./errores";

export interface RegistroMODEntrada {
  id?: string;
  trabajador?: string | null;
  actividad?: string;
  fecha?: string;
  horas: Num;
  tarifa: Num;
}

export interface RegistroMODResultado extends Omit<RegistroMODEntrada, "horas" | "tarifa"> {
  horas: Decimal;
  tarifa: Decimal;
  costo: Decimal;
}

export interface ResultadoMOD {
  registros: RegistroMODResultado[];
  horasMOD: Decimal;
  costoMOD: Decimal;
}

export function calcularRegistroMOD(r: RegistroMODEntrada): RegistroMODResultado {
  const horas = d(r.horas);
  const tarifa = d(r.tarifa);
  if (!horas.greaterThan(0)) throw new ErrorCosteo(MENSAJES.horasNoPositivas, "HORAS_INVALIDAS");
  if (tarifa.isNegative()) throw new ErrorCosteo(MENSAJES.negativo("la tarifa"), "VALOR_NEGATIVO");
  return { ...r, horas, tarifa, costo: horas.times(tarifa) };
}

export function calcularMOD(registros: RegistroMODEntrada[]): ResultadoMOD {
  const resultado = registros.map(calcularRegistroMOD);
  return {
    registros: resultado,
    horasMOD: sumar(resultado.map((r) => r.horas)),
    costoMOD: pesos(sumar(resultado.map((r) => r.costo))),
  };
}
