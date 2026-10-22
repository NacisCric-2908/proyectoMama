import { describe, expect, it } from "vitest";
import { esActiva, esEditable, estadosDestino, estaCerrada, faltantesParaActivar, validarTransicion } from "../index";

const datosCompletos = { clienteId: "c1", descripcion: "Tablero", fechaEstimadaEntrega: "2026-12-01", valorCotizado: "1000" };

describe("Ciclo de vida de la orden (§7)", () => {
  it("Borrador → Cotizado exige cliente, descripción, fecha de entrega y valor cotizado", () => {
    const r = validarTransicion("BORRADOR", "COTIZADO", { datos: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.faltantes).toEqual(["Cliente", "Descripción", "Fecha estimada de entrega", "Valor cotizado"]);
    expect(validarTransicion("BORRADOR", "COTIZADO", { datos: datosCompletos })).toEqual({ ok: true, tipo: "avance" });
    expect(faltantesParaActivar({ ...datosCompletos, valorCotizado: 0 })).toEqual(["Valor cotizado"]);
  });

  it("saltar etapas hacia adelante requiere comentario", () => {
    expect(validarTransicion("COTIZADO", "EN_FABRICACION").ok).toBe(false);
    expect(validarTransicion("COTIZADO", "EN_FABRICACION", { comentario: "Sin ingeniería" })).toEqual({ ok: true, tipo: "salto" });
  });

  it("retroceder solo un estado y con comentario", () => {
    expect(validarTransicion("EN_PRUEBAS", "EN_FABRICACION").ok).toBe(false);
    expect(validarTransicion("EN_PRUEBAS", "EN_INGENIERIA", { comentario: "x" }).ok).toBe(false);
    expect(validarTransicion("EN_PRUEBAS", "EN_FABRICACION", { comentario: "Falla" })).toEqual({ ok: true, tipo: "retroceso" });
  });

  it("cierre, facturación y reapertura", () => {
    expect(validarTransicion("EN_PUESTA_MARCHA", "TERMINADO")).toEqual({ ok: true, tipo: "cierre" });
    expect(validarTransicion("EN_PRUEBAS", "FACTURADO", { comentario: "x" }).ok).toBe(false);
    expect(validarTransicion("TERMINADO", "FACTURADO")).toEqual({ ok: true, tipo: "facturacion" });
    expect(validarTransicion("TERMINADO", "EN_PUESTA_MARCHA", { comentario: "Error" }).ok).toBe(false);
    expect(validarTransicion("TERMINADO", "EN_PUESTA_MARCHA", { comentario: "Error", puedeReabrir: true })).toEqual({
      ok: true,
      tipo: "reapertura",
    });
  });

  it("anulación solo antes de Terminado, con comentario", () => {
    expect(validarTransicion("EN_FABRICACION", "ANULADO").ok).toBe(false);
    expect(validarTransicion("EN_FABRICACION", "ANULADO", { comentario: "Cliente canceló" })).toEqual({ ok: true, tipo: "anulacion" });
    expect(validarTransicion("TERMINADO", "ANULADO", { comentario: "x" }).ok).toBe(false);
    expect(validarTransicion("ANULADO", "BORRADOR", { comentario: "x" }).ok).toBe(false);
    expect(validarTransicion("COTIZADO", "COTIZADO").ok).toBe(false);
  });

  it("clasifica estados", () => {
    expect(esEditable("BORRADOR")).toBe(true);
    expect(esEditable("TERMINADO")).toBe(false);
    expect(esEditable("ANULADO")).toBe(false);
    expect(esActiva("BORRADOR")).toBe(false);
    expect(esActiva("EN_PRUEBAS")).toBe(true);
    expect(esActiva("ANULADO")).toBe(false);
    expect(estaCerrada("FACTURADO")).toBe(true);
  });

  it("estados destino para la interfaz", () => {
    expect(estadosDestino("BORRADOR")).toEqual([
      "COTIZADO", "EN_INGENIERIA", "EN_FABRICACION", "EN_PRUEBAS", "EN_PUESTA_MARCHA", "TERMINADO", "ANULADO",
    ]);
    expect(estadosDestino("TERMINADO")).toEqual(["EN_PUESTA_MARCHA", "FACTURADO"]);
    expect(estadosDestino("FACTURADO")).toEqual(["TERMINADO"]);
    expect(estadosDestino("ANULADO")).toEqual([]);
  });
});
