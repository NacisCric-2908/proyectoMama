import { describe, expect, it } from "vitest";
import {
  calcularCIF,
  calcularIngenieria,
  calcularLineaMaterial,
  calcularMateriales,
  calcularMOD,
  calcularResumen,
  calcularResumenEstimado,
  calcularTotales,
  d,
  diasHabiles,
  ErrorCosteo,
  evaluarAlertas,
  formatearCantidad,
  formatearFecha,
  formatearPesos,
  formatearPorcentaje,
  hoyBogota,
  MENSAJES,
  serializar,
  tasaPredeterminada,
  validarLineaMaterial,
  validarRegistroIngenieria,
} from "../index";
import { ETAPAS, ordenCaso13 } from "./datos";

const cero = () => d(0);
const elementos = (total: number) => ({
  materialesDirectos: d(total),
  manoObraDirecta: cero(),
  ingenieriaAutomatizacion: cero(),
  pruebasPuestaMarcha: cero(),
  cif: cero(),
  mermas: cero(),
});

describe("Materiales (6.1)", () => {
  it("sin entregada registrada asume merma 0", () => {
    const l = calcularLineaMaterial({ descripcion: "X", requerida: 5, utilizada: 4, devuelta: 1, costoUnitario: 100 });
    expect(l.merma.toString()).toBe("0");
    expect(l.entregada.toString()).toBe("5");
    expect(l.entregadaRegistrada).toBe(false);
  });

  it("admite cantidades decimales (metros de cable)", () => {
    const m = calcularMateriales([{ descripcion: "Cable", requerida: "12.5", entregada: "13.25", utilizada: "12.75", costoUnitario: "3000" }]);
    expect(m.costoMaterialesDirectos.toString()).toBe("38250");
    expect(m.costoMermas.toString()).toBe("1500");
  });

  it("ahorro vs lista técnica da diferencia negativa", () => {
    const l = calcularLineaMaterial({ descripcion: "X", requerida: 10, entregada: 10, utilizada: 8, devuelta: 2, costoUnitario: 50 });
    expect(l.diferenciaCantidad.toString()).toBe("-2");
    expect(l.diferenciaValor.toString()).toBe("-100");
  });

  it("rechaza valores negativos", () => {
    expect(() => calcularLineaMaterial({ descripcion: "X", requerida: -1, costoUnitario: 1 })).toThrow(MENSAJES.negativo("la cantidad requerida"));
    expect(() => calcularLineaMaterial({ descripcion: "X", requerida: 1, costoUnitario: -1 })).toThrow(ErrorCosteo);
  });

  it("validarLineaMaterial devuelve el mensaje sin lanzar", () => {
    expect(validarLineaMaterial({ descripcion: "X", requerida: 1, entregada: 1, utilizada: 1, devuelta: 1, costoUnitario: 1 })).toBe(
      MENSAJES.mermaNegativa,
    );
    expect(validarLineaMaterial({ descripcion: "X", requerida: 1, utilizada: 1, costoUnitario: 1 })).toBeNull();
  });

  it("costo estimado = Σ requerida × costo y se muestra en Borrador sin utilizadas", () => {
    const base = ordenCaso13();
    const r = calcularResumen({
      ...base,
      estado: "BORRADOR",
      materiales: base.materiales.map((l) => ({ ...l, entregada: null, utilizada: null, devuelta: null })),
    });
    expect(r.mostrarCostoEstimadoMateriales).toBe(true);
    expect(r.materiales.costoEstimado.toString()).toBe("4560000");
    expect(calcularResumen(base).mostrarCostoEstimadoMateriales).toBe(false);
  });

  it("merma con entregada 0 tiene porcentaje 0", () => {
    expect(calcularLineaMaterial({ descripcion: "X", requerida: 1, entregada: 0, costoUnitario: 1 }).mermaPct.toString()).toBe("0");
  });
});

describe("MOD (6.2)", () => {
  it("rechaza horas no positivas y tarifas negativas", () => {
    expect(() => calcularMOD([{ horas: 0, tarifa: 1 }])).toThrow(MENSAJES.horasNoPositivas);
    expect(() => calcularMOD([{ horas: -2, tarifa: 1 }])).toThrow(MENSAJES.horasNoPositivas);
    expect(() => calcularMOD([{ horas: 1, tarifa: -1 }])).toThrow(MENSAJES.negativo("la tarifa"));
  });

  it("redondea el total a pesos", () => {
    expect(calcularMOD([{ horas: "1.5", tarifa: "33333" }]).costoMOD.toString()).toBe("50000");
  });
});

describe("Ingeniería (6.3)", () => {
  it("servicios adicionales suman al costo de la etapa", () => {
    const r = calcularIngenieria(ETAPAS, [{ etapaId: "puesta", horas: 8, costoHora: 40000 }], [
      { etapaId: "puesta", descripcion: "Transporte", valor: 200000 },
    ]);
    expect(r.porGrupo.PRUEBAS_PUESTA_MARCHA.costo.toString()).toBe("520000");
    expect(r.costoIngenieria.toString()).toBe("520000");
  });

  it("valida fechas, horas, etapa y servicios", () => {
    expect(() => validarRegistroIngenieria({ etapaId: "x", horas: 1, costoHora: 1, fechaInicio: "2026-03-05", fechaFin: "2026-03-04" })).toThrow(
      MENSAJES.fechasInvertidas,
    );
    expect(() => validarRegistroIngenieria({ etapaId: "x", horas: 0, costoHora: 1 })).toThrow(MENSAJES.horasNoPositivas);
    expect(() => validarRegistroIngenieria({ etapaId: "x", horas: 1, costoHora: -1 })).toThrow(ErrorCosteo);
    expect(() => calcularIngenieria(ETAPAS, [{ etapaId: "nada", horas: 1, costoHora: 1 }])).toThrow(MENSAJES.etapaDesconocida("nada"));
    expect(() => calcularIngenieria(ETAPAS, [], [{ etapaId: "nada", valor: 1 }])).toThrow(ErrorCosteo);
    expect(() => calcularIngenieria(ETAPAS, [], [{ etapaId: "puesta", valor: -1 }])).toThrow(ErrorCosteo);
  });

  it("advierte sin bloquear si las horas superan días hábiles × 10", () => {
    // 2026-03-06 es viernes, 2026-03-09 lunes → 2 días hábiles → máx 20 h
    expect(diasHabiles("2026-03-06", "2026-03-09")).toBe(2);
    const r = calcularIngenieria(ETAPAS, [{ etapaId: "pruebas", horas: 25, costoHora: 1, fechaInicio: "2026-03-06", fechaFin: "2026-03-09" }]);
    expect(r.advertencias).toHaveLength(1);
    expect(validarRegistroIngenieria({ etapaId: "x", horas: 20, costoHora: 1, fechaInicio: "2026-03-06", fechaFin: "2026-03-09" })).toBeNull();
  });
});

describe("CIF (6.5)", () => {
  const insumos = { horasMOD: 30, horasIngenieria: 28, costoMOD: 1050000, costoDirecto: 5550000 };

  it("calcula las cinco bases", () => {
    expect(calcularCIF("HORAS_MOD", 30000, insumos).valor.toString()).toBe("900000");
    expect(calcularCIF("HORAS_TOTALES", 10000, insumos).valor.toString()).toBe("580000");
    expect(calcularCIF("COSTO_MOD", 20, insumos).valor.toString()).toBe("210000");
    expect(calcularCIF("COSTO_DIRECTO", 10, insumos).valor.toString()).toBe("555000");
    const np = calcularCIF("NUMERO_PROYECTOS", 1200000, insumos);
    expect(np.cantidadBase.toString()).toBe("1");
    expect(np.valor.toString()).toBe("1200000");
  });

  it("tasa predeterminada = CIF presupuestado ÷ base estimada", () => {
    expect(tasaPredeterminada("HORAS_MOD", 6000000, 200).toString()).toBe("30000");
    expect(tasaPredeterminada("COSTO_MOD", 2000000, 10000000).toString()).toBe("20");
    expect(tasaPredeterminada("NUMERO_PROYECTOS", 6000000, 4).toString()).toBe("1500000");
    expect(() => tasaPredeterminada("HORAS_MOD", 1, 0)).toThrow(MENSAJES.baseEstimadaCero);
  });

  it("rechaza tasas negativas", () => {
    expect(() => calcularCIF("HORAS_MOD", -1, insumos)).toThrow(ErrorCosteo);
  });

  it("sin CIF asignado el elemento vale 0", () => {
    const r = calcularResumen({ ...ordenCaso13(), cif: null });
    expect(r.cif).toBeNull();
    expect(r.costoTotal.toString()).toBe("6900000");
  });
});

describe("Totales y margen (6.6)", () => {
  it("sin cotización no calcula margen", () => {
    const t = calcularTotales(elementos(1000), { cantidadUnidades: 1, valorCotizado: null });
    expect(t.margenBruto).toBeNull();
    expect(t.margenPct).toBeNull();
    expect(calcularTotales(elementos(1000), { cantidadUnidades: 1, valorCotizado: 0 }).margenPct).toBeNull();
  });

  it("valida margen esperado, unidades y cotizado", () => {
    expect(() => calcularTotales(elementos(1), { cantidadUnidades: 1, margenEsperadoPct: 100 })).toThrow(MENSAJES.margenEsperadoInvalido);
    expect(() => calcularTotales(elementos(1), { cantidadUnidades: 1, margenEsperadoPct: -1 })).toThrow(ErrorCosteo);
    expect(() => calcularTotales(elementos(1), { cantidadUnidades: 0 })).toThrow(MENSAJES.unidadesInvalidas);
    expect(() => calcularTotales(elementos(1), { cantidadUnidades: 1, valorCotizado: -5 })).toThrow(ErrorCosteo);
  });

  it("participación es 0 cuando el costo total es 0", () => {
    const t = calcularTotales(elementos(0), { cantidadUnidades: 1 });
    expect(t.participacion.every((p) => p.pct.isZero())).toBe(true);
  });

  it("resumen estimado usa la cantidad requerida sin mermas", () => {
    const r = calcularResumenEstimado(ordenCaso13());
    expect(r.elementos.materialesDirectos.toString()).toBe("4560000");
    expect(r.elementos.mermas.toString()).toBe("0");
  });
});

describe("Alertas (6.7)", () => {
  const base = {
    costoTotal: d(9000000),
    valorCotizado: d(9500000),
    margenPct: d("5.2632"),
    margenMinimoPct: null,
    abierta: true,
    terminada: false,
    lineasMaterial: [],
    umbralMermaPct: 10,
  };

  it("advierte consumo ≥ 90 % con la orden abierta", () => {
    const a = evaluarAlertas(base);
    expect(a).toEqual([{ codigo: "CONSUMO_90", nivel: "ADVERTENCIA", mensaje: "El proyecto ya consumió el 94,74% del valor cotizado" }]);
    expect(evaluarAlertas({ ...base, abierta: false })).toEqual([]);
  });

  it("orden vencida solo si no está terminada", () => {
    const e = { ...base, costoTotal: d(1), fechaEstimadaEntrega: "2026-01-10", hoy: "2026-02-01" };
    expect(evaluarAlertas(e).map((x) => x.codigo)).toEqual(["ORDEN_VENCIDA"]);
    expect(evaluarAlertas({ ...e, terminada: true })).toEqual([]);
    expect(evaluarAlertas({ ...e, hoy: "2026-01-10" })).toEqual([]);
  });

  it("umbral de merma configurable", () => {
    const r = calcularResumen({ ...ordenCaso13(), umbralMermaPct: 50 });
    expect(r.alertas.find((a) => a.codigo === "MERMA_ALTA")).toBeUndefined();
  });

  it("Orden vencida desde el resumen", () => {
    const r = calcularResumen({ ...ordenCaso13(), fechaEstimadaEntrega: "2026-01-01", hoy: "2026-05-01" });
    expect(r.alertas.some((a) => a.codigo === "ORDEN_VENCIDA")).toBe(true);
  });
});

describe("Formato (6.8)", () => {
  it("moneda, porcentaje, cantidades y fechas en formato colombiano", () => {
    expect(formatearPesos("4500000")).toBe("$4.500.000");
    expect(formatearPesos(0)).toBe("$0");
    expect(formatearPesos(null)).toBe("$0");
    expect(formatearPesos("999.5")).toBe("$1.000");
    expect(formatearPorcentaje("17.8947")).toBe("17,89%");
    expect(formatearPorcentaje(5, 0)).toBe("5%");
    expect(formatearPorcentaje("-0.001")).toBe("0,00%");
    expect(formatearCantidad("1234.5")).toBe("1.234,5");
    expect(formatearCantidad("-3")).toBe("-3");
    expect(formatearFecha("2026-03-07")).toBe("07/03/2026");
    // 2026-03-07T03:00Z es 06/03/2026 22:00 en Bogotá
    expect(formatearFecha(new Date("2026-03-07T03:00:00Z"))).toBe("06/03/2026");
    expect(formatearFecha("2026-03-07T03:00:00Z")).toBe("06/03/2026");
    expect(formatearFecha(null)).toBe("");
    expect(hoyBogota(new Date("2026-03-07T03:00:00Z"))).toBe("2026-03-06");
  });
});

describe("Serialización", () => {
  it("convierte Decimal a string recursivamente", () => {
    const fecha = new Date();
    expect(serializar({ a: d(1.5), b: [d(2)], c: "x", f: fecha, n: null })).toEqual({ a: "1.5", b: ["2"], c: "x", f: fecha, n: null });
  });
});
