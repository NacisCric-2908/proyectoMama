import { describe, expect, it } from "vitest";
import {
  aplicarMovimiento,
  calcularCIF,
  calcularLineaMaterial,
  calcularMateriales,
  calcularResumen,
  costoPromedioEntregado,
  ErrorCosteo,
  formatearPorcentaje,
  reconstruirKardex,
  rentabilidadPorCliente,
  saldoInicial,
  tasaPredeterminada,
} from "../index";
import { ordenCaso13 } from "./datos";

describe("Kárdex con promedio ponderado", () => {
  it("entradas, salidas a orden, devolución y ajustes", () => {
    const k = reconstruirKardex([
      { tipo: "ENTRADA", cantidad: 100, costoUnitario: 3000 },
      { tipo: "ENTRADA", cantidad: 100, costoUnitario: 3400 },
      { tipo: "SALIDA_ORDEN", cantidad: 150 },
      { tipo: "DEVOLUCION_ORDEN", cantidad: 20, costoUnitario: 3200 },
      { tipo: "AJUSTE_NEGATIVO", cantidad: 5 },
      { tipo: "AJUSTE_POSITIVO", cantidad: 5 },
    ] as const);
    expect(k[1].saldo.costoPromedio.toString()).toBe("3200");
    expect(k[2].costoUnitario.toString()).toBe("3200");
    expect(k[2].costoTotal.toString()).toBe("480000");
    expect(k[2].saldo.cantidad.toString()).toBe("50");
    expect(k[3].saldo.valor.toString()).toBe("224000");
    expect(k[5].costoUnitario.toString()).toBe("3200"); // ajuste positivo sin costo usa el promedio
    expect(k[5].saldo.cantidad.toString()).toBe("70");
  });

  it("recalcula el promedio con precisión de 4 decimales y descarta el residuo al agotar", () => {
    let s = aplicarMovimiento(saldoInicial(), { tipo: "ENTRADA", cantidad: 3, costoUnitario: 1000 }).saldo;
    s = aplicarMovimiento(s, { tipo: "ENTRADA", cantidad: 1, costoUnitario: 1001 }).saldo;
    expect(s.costoPromedio.toString()).toBe("1000.25");
    s = aplicarMovimiento(saldoInicial(), { tipo: "ENTRADA", cantidad: 3, costoUnitario: 1 }).saldo;
    s = aplicarMovimiento(s, { tipo: "ENTRADA", cantidad: 3, costoUnitario: 2 }).saldo;
    s = aplicarMovimiento(s, { tipo: "ENTRADA", cantidad: 1, costoUnitario: 2 }).saldo; // 11/7
    expect(s.costoPromedio.toString()).toBe("1.5714");
    const fin = aplicarMovimiento(s, { tipo: "SALIDA_ORDEN", cantidad: 7 });
    expect(fin.saldo.valor.toString()).toBe("0");
    expect(fin.saldo.costoPromedio.toString()).toBe("1.5714");
  });

  it("valida existencias, cantidades y costos", () => {
    expect(() => aplicarMovimiento(saldoInicial(), { tipo: "SALIDA_ORDEN", cantidad: 1 })).toThrow(/Existencias insuficientes/);
    expect(() => aplicarMovimiento(saldoInicial(), { tipo: "ENTRADA", cantidad: 0, costoUnitario: 1 })).toThrow(ErrorCosteo);
    expect(() => aplicarMovimiento(saldoInicial(), { tipo: "ENTRADA", cantidad: 1 })).toThrow(/costo unitario/);
    expect(() => aplicarMovimiento(saldoInicial(), { tipo: "AJUSTE_POSITIVO", cantidad: 1 })).toThrow(/costo unitario/);
    expect(() => aplicarMovimiento(saldoInicial(), { tipo: "ENTRADA", cantidad: 1, costoUnitario: -1 })).toThrow(/negativo/);
  });

  it("costo de lo entregado a una orden = Σ costo de salidas ÷ Σ cantidades", () => {
    expect(costoPromedioEntregado([{ cantidad: 100, costoTotal: 300000 }, { cantidad: 50, costoTotal: 170000 }])?.toString()).toBe("3133.3333");
    expect(costoPromedioEntregado([])).toBeNull();
  });
});

describe("Clasificación de mermas", () => {
  const cable = { descripcion: "Cable", requerida: 120, entregada: 150, utilizada: 100, devuelta: 0, costoUnitario: 3000 };

  it("el valor recuperado reduce el costo de una merma recuperable", () => {
    const l = calcularLineaMaterial({ ...cable, clasificacionMerma: "RECUPERABLE", valorRecuperado: 30000 });
    expect(l.costoMerma.toString()).toBe("150000");
    expect(l.costoMermaNeto.toString()).toBe("120000");
  });

  it("valida el valor recuperado", () => {
    expect(() => calcularLineaMaterial({ ...cable, clasificacionMerma: "NORMAL", valorRecuperado: 1 })).toThrow(/recuperable/);
    expect(() => calcularLineaMaterial({ ...cable, clasificacionMerma: "RECUPERABLE", valorRecuperado: 200000 })).toThrow(/superar/);
    expect(() => calcularLineaMaterial({ ...cable, clasificacionMerma: "RECUPERABLE", valorRecuperado: -1 })).toThrow(ErrorCosteo);
  });

  it("totaliza por clase y puede llevar la merma anormal a pérdida del período", () => {
    const lineas = [
      { ...cable, clasificacionMerma: "ANORMAL" as const },
      { descripcion: "Bornera", requerida: 10, entregada: 12, utilizada: 10, costoUnitario: 1000, clasificacionMerma: "NORMAL" as const },
    ];
    const incluida = calcularMateriales(lineas);
    expect(incluida.costoMermas.toString()).toBe("152000");
    expect(incluida.mermasPorClase.ANORMAL.toString()).toBe("150000");
    expect(incluida.mermasPorClase.NORMAL.toString()).toBe("2000");
    expect(incluida.mermasPorClase.SIN_CLASIFICAR.toString()).toBe("0");
    const excluida = calcularMateriales(lineas, { excluirMermaAnormal: true });
    expect(excluida.costoMermas.toString()).toBe("2000");
    expect(excluida.mermaAnormalExcluida.toString()).toBe("150000");
  });

  it("caso §13 con la merma del cable anormal y política de exclusión", () => {
    const base = ordenCaso13();
    const r = calcularResumen({
      ...base,
      excluirMermaAnormal: true,
      materiales: base.materiales.map((m) => (m.codigo === "CAB-01" ? { ...m, clasificacionMerma: "ANORMAL" } : m)),
    });
    expect(r.elementos.mermas.toString()).toBe("0");
    expect(r.perdidaMermaAnormal.toString()).toBe("150000");
    expect(r.costoTotal.toString()).toBe("7650000");
    expect(calcularResumen(base).perdidaMermaAnormal.toString()).toBe("0");
  });
});

describe("CIF con tasas diferenciadas por actividad", () => {
  it("suma el CIF de cada actividad con su propio inductor", () => {
    const r = calcularResumen({
      ...ordenCaso13(),
      cif: {
        base: "ACTIVIDADES",
        tasa: 0,
        tasasActividad: [
          { actividad: "ENSAMBLE", tasa: 20000 }, // 30 h → 600.000
          { actividad: "INGENIERIA", tasa: 10000 }, // 16 h → 160.000
          { actividad: "PRUEBAS_PUESTA_MARCHA", tasa: 5000 }, // 12 h → 60.000
          { actividad: "MATERIALES", tasa: 2 }, // 2 % × 4.500.000 → 90.000
        ],
      },
    });
    expect(r.cif?.valor.toString()).toBe("910000");
    expect(r.cif?.detalle?.map((x) => x.valor.toString())).toEqual(["600000", "160000", "60000", "90000"]);
    expect(r.cif?.cantidadBase.toString()).toBe("58");
  });

  it("valida tasas y calcula la tasa predeterminada por actividad", () => {
    const insumos = { horasMOD: 1, horasIngenieria: 0, costoMOD: 0, costoDirecto: 0 };
    expect(() => calcularCIF("ACTIVIDADES", 0, insumos, [])).toThrow(/al menos una tasa/);
    expect(() => calcularCIF("ACTIVIDADES", 0, insumos, [{ actividad: "ENSAMBLE", tasa: -1 }])).toThrow(ErrorCosteo);
    expect(tasaPredeterminada("MATERIALES", 1000000, 50000000).toString()).toBe("2");
    expect(tasaPredeterminada("INGENIERIA", 2000000, 200).toString()).toBe("10000");
  });
});

describe("Rentabilidad por cliente", () => {
  it("agrupa por cliente, usa el costo ajustado cuando existe y ordena por margen", () => {
    const { filas, total } = rentabilidadPorCliente([
      { clienteId: "a", cliente: "Industrias A", valorCotizado: "9500000", costoTotal: "7800000", costoAjustado: "7900000" },
      { clienteId: "a", cliente: "Industrias A", valorCotizado: "5000000", costoTotal: "2650000" },
      { clienteId: "b", cliente: "Planta B", valorCotizado: "1000000", costoTotal: "1200000" },
      { clienteId: "c", cliente: "Sin cotizar", valorCotizado: null, costoTotal: "100" },
    ]);
    expect(filas.map((f) => f.cliente)).toEqual(["Industrias A", "Sin cotizar", "Planta B"]);
    expect(filas[0].ordenes).toBe(2);
    expect(filas[0].margen.toString()).toBe("4050000");
    expect(filas[0].margenAjustado.toString()).toBe("3950000");
    expect(filas[0].ordenesAjustadas).toBe(1);
    expect(formatearPorcentaje(filas[0].margenPct)).toBe("27,93%");
    expect(filas[2].margen.toString()).toBe("-200000");
    expect(filas[1].margenPct).toBeNull();
    expect(total.ordenes).toBe(4);
  });
});
