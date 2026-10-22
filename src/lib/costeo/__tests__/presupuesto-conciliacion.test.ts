import { describe, expect, it } from "vitest";
import {
  calcularResumen,
  compararConPresupuesto,
  conciliarCIF,
  elegirPresupuestos,
  ErrorCosteo,
  formatearPorcentaje,
  serializar,
  totalPresupuesto,
} from "../index";
import { ordenCaso13 } from "./datos";

const presupuesto = {
  materialesDirectos: "4560000",
  manoObraDirecta: "980000",
  ingenieriaAutomatizacion: "675000",
  pruebasPuestaMarcha: "440000",
  cif: "840000",
  mermas: "0",
  horasEnsamble: "28",
  horasIngenieria: "26",
};

describe("Presupuesto de costo por componente", () => {
  it("total presupuestado = suma de componentes", () => {
    expect(totalPresupuesto(presupuesto).toString()).toBe("7495000");
    expect(() => totalPresupuesto({ ...presupuesto, cif: "-1" })).toThrow(ErrorCosteo);
  });

  it("compara con el costo real del caso §13: monto, signo y porcentaje por componente", () => {
    const r = serializar(calcularResumen(ordenCaso13()));
    const c = compararConPresupuesto(presupuesto, {
      elementos: r.elementos,
      costoTotal: r.costoTotal,
      horasMOD: r.mod.horasMOD,
      horasIngenieria: r.ingenieria.horasIngenieria,
    });
    const mat = c.filas.find((f) => f.clave === "materialesDirectos")!;
    expect(mat.diferencia.toString()).toBe("-60000");
    expect(mat.signo).toBe("MENOR");
    const mermas = c.filas.find((f) => f.clave === "mermas")!;
    expect(mermas.diferencia.toString()).toBe("150000");
    expect(mermas.pct).toBeNull(); // presupuesto 0
    expect(c.total.diferencia.toString()).toBe("305000");
    expect(c.total.signo).toBe("MAYOR");
    expect(formatearPorcentaje(c.total.pct)).toBe("4,07%");
    expect(c.horas.map((h) => h.diferencia.toString())).toEqual(["2", "2"]);
  });

  it("sin diferencia el signo es IGUAL", () => {
    const c = compararConPresupuesto(
      { materialesDirectos: 1, manoObraDirecta: 0, ingenieriaAutomatizacion: 0, pruebasPuestaMarcha: 0, cif: 0 },
      { elementos: { materialesDirectos: 1, manoObraDirecta: 0, ingenieriaAutomatizacion: 0, pruebasPuestaMarcha: 0, cif: 0, mermas: 0 }, costoTotal: 1, horasMOD: 0, horasIngenieria: 0 },
    );
    expect(c.total.signo).toBe("IGUAL");
    expect(c.horas[0].signo).toBe("IGUAL");
  });

  it("original = primera versión aprobada; vigente = última aprobada", () => {
    const v = [
      { version: 3, aprobadoEn: null },
      { version: 1, aprobadoEn: "2026-03-01" },
      { version: 2, aprobadoEn: "2026-03-10" },
    ];
    const { original, vigente } = elegirPresupuestos(v);
    expect(original?.version).toBe(1);
    expect(vigente?.version).toBe(2);
    expect(elegirPresupuestos([{ version: 1, aprobadoEn: null }])).toEqual({ original: null, vigente: null });
  });
});

describe("Conciliación del CIF real vs aplicado", () => {
  const ordenes = [
    { id: "a", cifAplicado: "900000", costoTotal: "7800000", valorCotizado: "9500000" },
    { id: "b", cifAplicado: "300000", costoTotal: "2650000", valorCotizado: "5000000" },
  ];

  it("subaplicación: la diferencia se prorratea según el CIF aplicado", () => {
    const r = conciliarCIF("1300000", ordenes, "PRORRATEO_CIF_APLICADO");
    expect(r.cifAplicado.toString()).toBe("1200000");
    expect(r.diferencia.toString()).toBe("100000");
    expect(r.tipo).toBe("SUBAPLICADO");
    expect(r.ajustes.map((a) => a.ajuste.toString())).toEqual(["75000", "25000"]);
    expect(r.ajustes[0].costoAjustado.toString()).toBe("7875000");
    expect(formatearPorcentaje(r.ajustes[0].margenAjustadoPct)).toBe("17,11%");
    expect(r.ajusteCostoVentas.toString()).toBe("0");
  });

  it("sobreaplicación reduce el costo ajustado", () => {
    const r = conciliarCIF("1100000", ordenes, "PRORRATEO_CIF_APLICADO");
    expect(r.tipo).toBe("SOBREAPLICADO");
    expect(r.ajustes.map((a) => a.ajuste.toString())).toEqual(["-75000", "-25000"]);
  });

  it("el residuo de redondeo va a la orden con mayor CIF aplicado y la suma es exacta", () => {
    const tres = [
      { id: "x", cifAplicado: 1, costoTotal: 10 },
      { id: "y", cifAplicado: 1, costoTotal: 10 },
      { id: "z", cifAplicado: 2, costoTotal: 10 },
    ];
    const r = conciliarCIF(14, tres, "PRORRATEO_CIF_APLICADO"); // diferencia 10 → 2,5 / 2,5 / 5
    const suma = r.ajustes.reduce((s, a) => s.plus(a.ajuste), r.diferencia.minus(r.diferencia));
    expect(suma.toString()).toBe("10");
    expect(r.ajustes.map((a) => a.ajuste.toString())).toEqual(["3", "3", "4"]);
    expect(r.ajustes[0].margenAjustado).toBeNull();
  });

  it("política costo de ventas: las órdenes no cambian", () => {
    const r = conciliarCIF("1300000", ordenes, "COSTO_DE_VENTAS");
    expect(r.ajustes.every((a) => a.ajuste.isZero() && a.costoAjustado.equals(a.costoAcumulado))).toBe(true);
    expect(r.ajusteCostoVentas.toString()).toBe("100000");
  });

  it("sin diferencia, sin ajustes", () => {
    const r = conciliarCIF("1200000", ordenes, "PRORRATEO_CIF_APLICADO");
    expect(r.tipo).toBe("SIN_DIFERENCIA");
    expect(r.ajustes.every((a) => a.ajuste.isZero())).toBe(true);
  });

  it("valida CIF real negativo y prorrateo sin base", () => {
    expect(() => conciliarCIF(-1, ordenes, "PRORRATEO_CIF_APLICADO")).toThrow(ErrorCosteo);
    expect(() => conciliarCIF(100, [{ id: "a", cifAplicado: 0, costoTotal: 5 }], "PRORRATEO_CIF_APLICADO")).toThrow(/costo de ventas/);
    expect(conciliarCIF(100, [], "COSTO_DE_VENTAS").ajusteCostoVentas.toString()).toBe("100");
  });
});
