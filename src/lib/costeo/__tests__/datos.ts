import type { EntradaOrden, EtapaInfo } from "../index";

export const ETAPAS: EtapaInfo[] = [
  { id: "conceptual", nombre: "Ingeniería conceptual", grupo: "INGENIERIA_AUTOMATIZACION", orden: 1 },
  { id: "detalle", nombre: "Ingeniería de detalle", grupo: "INGENIERIA_AUTOMATIZACION", orden: 2 },
  { id: "programacion", nombre: "Programación (PLC/HMI)", grupo: "INGENIERIA_AUTOMATIZACION", orden: 3 },
  { id: "configuracion", nombre: "Configuración de equipos", grupo: "INGENIERIA_AUTOMATIZACION", orden: 4 },
  { id: "pruebas", nombre: "Pruebas", grupo: "PRUEBAS_PUESTA_MARCHA", orden: 5 },
  { id: "puesta", nombre: "Puesta en marcha", grupo: "PRUEBAS_PUESTA_MARCHA", orden: 6 },
  { id: "soporte", nombre: "Soporte", grupo: "PRUEBAS_PUESTA_MARCHA", orden: 7 },
];

/** Caso de aceptación de la sección 13 del documento de requisitos. */
export function ordenCaso13(): EntradaOrden {
  return {
    estado: "EN_PUESTA_MARCHA",
    cantidadUnidades: 1,
    valorCotizado: "9500000",
    margenMinimoPct: 15,
    etapas: ETAPAS,
    materiales: [
      { codigo: "PLC-01", descripcion: "PLC", unidad: "und", requerida: 1, entregada: 1, utilizada: 1, devuelta: 0, costoUnitario: "1800000" },
      { codigo: "HMI-01", descripcion: "Pantalla HMI", unidad: "und", requerida: 1, entregada: 1, utilizada: 1, devuelta: 0, costoUnitario: "1200000" },
      { codigo: "GAB-01", descripcion: "Gabinete metálico", unidad: "und", requerida: 1, entregada: 1, utilizada: 1, devuelta: 0, costoUnitario: "650000" },
      { codigo: "BRK-01", descripcion: "Breaker", unidad: "und", requerida: 10, entregada: 10, utilizada: 10, devuelta: 0, costoUnitario: "45000" },
      { codigo: "CAB-01", descripcion: "Cable de control", unidad: "m", requerida: 120, entregada: 150, utilizada: 100, devuelta: 0, costoUnitario: "3000" },
      { codigo: "BOR-01", descripcion: "Bornera", unidad: "und", requerida: 100, entregada: 100, utilizada: 100, devuelta: 0, costoUnitario: "1000" },
    ],
    mod: [{ trabajador: "Ensamblador", actividad: "Ensamble y cableado", horas: 30, tarifa: "35000" }],
    ingenieria: [
      { etapaId: "conceptual", horas: 4, costoHora: "45000" },
      { etapaId: "detalle", horas: 6, costoHora: "45000" },
      { etapaId: "programacion", horas: 4, costoHora: "45000" },
      { etapaId: "configuracion", horas: 2, costoHora: "45000" },
      { etapaId: "pruebas", horas: 4, costoHora: "40000" },
      { etapaId: "puesta", horas: 8, costoHora: "40000" },
    ],
    cif: { base: "HORAS_MOD", tasa: "30000" },
  };
}
