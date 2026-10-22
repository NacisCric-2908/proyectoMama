import { describe, expect, it } from "vitest";
import {
  calcularCIF,
  calcularMateriales,
  calcularMOD,
  calcularResumen,
  formatearPesos,
  formatearPorcentaje,
  MENSAJES,
} from "../index";
import { ordenCaso13 } from "./datos";

const s = (v: { toString(): string } | null) => v?.toString() ?? null;

describe("Caso de aceptación §13 — reproduce la tabla de la sección 10.2", () => {
  const r = calcularResumen(ordenCaso13());

  it("materiales directos $4.500.000 y mermas $150.000", () => {
    expect(s(r.elementos.materialesDirectos)).toBe("4500000");
    expect(s(r.elementos.mermas)).toBe("150000");
    const cable = r.materiales.lineas.find((l) => l.codigo === "CAB-01")!;
    expect(s(cable.merma)).toBe("50");
    expect(s(cable.diferenciaCantidad)).toBe("30");
    expect(s(cable.diferenciaValor)).toBe("90000");
  });

  it("MOD $1.050.000 con 30 horas", () => {
    expect(s(r.elementos.manoObraDirecta)).toBe("1050000");
    expect(s(r.mod.horasMOD)).toBe("30");
  });

  it("ingeniería y automatización $720.000; pruebas y puesta en marcha $480.000", () => {
    expect(s(r.elementos.ingenieriaAutomatizacion)).toBe("720000");
    expect(s(r.elementos.pruebasPuestaMarcha)).toBe("480000");
    const porEtapa = Object.fromEntries(r.ingenieria.porEtapa.map((e) => [e.etapaId, e.costo.toString()]));
    expect(porEtapa).toMatchObject({
      conceptual: "180000",
      detalle: "270000",
      programacion: "180000",
      configuracion: "90000",
      pruebas: "160000",
      puesta: "320000",
      soporte: "0",
    });
  });

  it("CIF por horas de MOD 30 × $30.000 = $900.000", () => {
    expect(s(r.cif!.cantidadBase)).toBe("30");
    expect(s(r.elementos.cif)).toBe("900000");
  });

  it("costo total $7.800.000, unitario $7.800.000, margen $1.700.000 (17,89%)", () => {
    expect(formatearPesos(r.costoTotal)).toBe("$7.800.000");
    expect(formatearPesos(r.costoUnitario)).toBe("$7.800.000");
    expect(formatearPesos(r.valorCotizado)).toBe("$9.500.000");
    expect(formatearPesos(r.margenBruto)).toBe("$1.700.000");
    expect(formatearPorcentaje(r.margenPct)).toBe("17,89%");
    expect(s(r.costoDirecto)).toBe("5550000");
  });

  it("sin alertas críticas ni de margen", () => {
    expect(r.alertas.filter((a) => a.nivel === "CRITICA")).toHaveLength(0);
    expect(r.alertas.find((a) => a.codigo === "MARGEN_BAJO_MINIMO")).toBeUndefined();
    // la merma del cable (33 %) supera el umbral del 10 % → informativa
    expect(r.alertas).toContainEqual({ codigo: "MERMA_ALTA", nivel: "INFORMATIVA", mensaje: "Merma alta en Cable de control" });
  });

  it("el resumen por etapas suma exactamente el total de ingeniería", () => {
    const suma = r.ingenieria.porEtapa.reduce((a, e) => a + Number(e.costo), 0);
    expect(suma).toBe(Number(r.ingenieria.costoIngenieria));
    expect(s(r.ingenieria.costoIngenieria)).toBe("1200000");
    expect(s(r.ingenieria.horasIngenieria)).toBe("28");
  });

  it("participación de cada elemento suma 100 %", () => {
    const total = r.participacion.reduce((a, p) => a.plus(p.pct), r.participacion[0].pct.minus(r.participacion[0].pct));
    expect(total.toDecimalPlaces(2).toString()).toBe("100");
  });
});

describe("Pruebas adicionales §13", () => {
  it("margen mínimo 20 % → advertencia de margen bajo", () => {
    const r = calcularResumen({ ...ordenCaso13(), margenMinimoPct: 20 });
    expect(r.alertas).toContainEqual({
      codigo: "MARGEN_BAJO_MINIMO",
      nivel: "ADVERTENCIA",
      mensaje: "El margen (17,89%) está por debajo del mínimo definido (20,00%)",
    });
  });

  it("valor cotizado $7.500.000 → alerta crítica por $300.000 y margen −4,00%", () => {
    const r = calcularResumen({ ...ordenCaso13(), valorCotizado: "7500000" });
    expect(r.alertas).toContainEqual({
      codigo: "COSTO_SUPERA_COTIZADO",
      nivel: "CRITICA",
      mensaje: "El costo del proyecto supera el valor cotizado en $300.000",
    });
    expect(formatearPorcentaje(r.margenPct)).toBe("-4,00%");
    expect(formatearPesos(r.margenBruto)).toBe("-$300.000");
  });

  it("margen esperado 25 % → precio sugerido $10.400.000", () => {
    const r = calcularResumen({ ...ordenCaso13(), margenEsperadoPct: 25 });
    expect(s(r.precioSugerido)).toBe("10400000");
  });

  it("2 unidades → costo unitario $3.900.000", () => {
    const r = calcularResumen({ ...ordenCaso13(), cantidadUnidades: 2 });
    expect(s(r.costoUnitario)).toBe("3900000");
  });

  it("base Costo de MOD con tasa 20 % y MOD $80.000 → CIF $16.000 (método Excel)", () => {
    const cif = calcularCIF("COSTO_MOD", 20, { horasMOD: 0, horasIngenieria: 0, costoMOD: 80000, costoDirecto: 0 });
    expect(s(cif.valor)).toBe("16000");
  });

  it("utilizada 100 + devuelta 60 con entregada 150 → error de merma negativa", () => {
    expect(() =>
      calcularMateriales([{ descripcion: "Cable", requerida: 120, entregada: 150, utilizada: 100, devuelta: 60, costoUnitario: 3000 }]),
    ).toThrow(MENSAJES.mermaNegativa);
  });
});

describe("CU-01 — costo directo", () => {
  it("2 materiales y 30 h de MOD → $750.000 + $1.050.000 = $1.800.000", () => {
    const mat = calcularMateriales([
      { descripcion: "Breaker", requerida: 10, utilizada: 10, costoUnitario: 45000 },
      { descripcion: "Cable", requerida: 100, utilizada: 100, costoUnitario: 3000 },
    ]);
    const mod = calcularMOD([{ horas: 30, tarifa: 35000 }]);
    expect(s(mat.costoMaterialesDirectos)).toBe("750000");
    expect(s(mod.costoMOD)).toBe("1050000");
    expect(s(mat.costoMaterialesDirectos.plus(mod.costoMOD))).toBe("1800000");
    expect(s(mat.costoMermas)).toBe("0");
  });
});
