export class ErrorCosteo extends Error {
  constructor(
    message: string,
    public readonly codigo: string,
  ) {
    super(message);
    this.name = "ErrorCosteo";
  }
}

export const MENSAJES = {
  mermaNegativa: "La cantidad utilizada más la devuelta supera la entregada",
  negativo: (campo: string) => `No se permiten valores negativos en ${campo}`,
  horasNoPositivas: "Las horas deben ser mayores que cero",
  fechasInvertidas: "La fecha de finalización debe ser igual o posterior a la fecha de inicio",
  margenEsperadoInvalido: "El margen esperado debe ser mayor o igual a 0 y menor que 100 %",
  unidadesInvalidas: "La cantidad de unidades debe ser mayor que cero",
  baseEstimadaCero: "La base total estimada del período debe ser mayor que cero",
  etapaDesconocida: (id: string) => `La etapa ${id} no existe en el catálogo`,
} as const;
