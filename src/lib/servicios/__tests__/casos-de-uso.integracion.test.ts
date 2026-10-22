import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorPermiso, type UsuarioActual } from "@/lib/auth/permisos";
import { MENSAJES } from "@/lib/costeo";
import { asignarCIF, estadoCIF, guardarParametroCIF } from "../cif";
import { cambiarEstado } from "../estados";
import { guardarConsumo, guardarRegistroIngenieria, guardarRegistroMOD, guardarServicio } from "../lineas";
import { actualizarOrden, cargarOrden, crearOrden, listarOrdenes, resumenOrden, type SnapshotCierre } from "../ordenes";
import { ErrorNegocio } from "../util";
import { clienteDePrueba, etapa, materialDePrueba, prisma, trabajadorDePrueba, unico, usuarioDePrueba } from "./ayudas";

let admin: UsuarioActual, contador: UsuarioActual, coordinador: UsuarioActual, gerencia: UsuarioActual;

beforeAll(async () => {
  admin = await usuarioDePrueba("ADMINISTRADOR");
  contador = await usuarioDePrueba("CONTADOR");
  coordinador = await usuarioDePrueba("COORDINADOR");
  gerencia = await usuarioDePrueba("GERENCIA");
  await guardarParametroCIF(prisma, contador, { periodo: "2026-03", base: "HORAS_MOD", tasaDirecta: "30000" });
});
afterAll(() => prisma.$disconnect());

const datosActivos = async () => ({
  clienteId: (await clienteDePrueba()).id,
  descripcion: "Tablero de prueba",
  fechaCreacion: "2026-03-02",
  fechaEstimadaEntrega: "2026-12-31",
  valorCotizado: "9500000",
});

describe("CU-01 — crear orden y calcular costo directo", () => {
  it("2 materiales + 30 h de MOD → $750.000 + $1.050.000 = $1.800.000", async () => {
    const [breaker, cable, trab] = await Promise.all([materialDePrueba("45000"), materialDePrueba("3000", "m"), trabajadorDePrueba("35000")]);
    const orden = await crearOrden(prisma, coordinador, { descripcion: "Tablero CU-01", fechaCreacion: "2026-03-02" });
    expect(orden.codigo).toMatch(/^OP-2026-\d{4}$/);
    expect(orden.estado).toBe("BORRADOR");

    await guardarConsumo(prisma, coordinador, orden.id, { materialId: breaker.id, cantidadRequerida: "10", cantidadUtilizada: "10" });
    await guardarConsumo(prisma, coordinador, orden.id, { materialId: cable.id, cantidadRequerida: "100", cantidadUtilizada: "100" });
    const mod = await guardarRegistroMOD(prisma, coordinador, orden.id, { trabajadorId: trab.id, actividad: "Ensamble", fecha: "2026-03-05", horas: "30" });
    expect(mod.tarifaAplicada.toString()).toBe("35000"); // tarifa vigente prellenada

    const r = await resumenOrden(prisma, await cargarOrden(prisma, orden.id));
    expect(r.elementos.materialesDirectos).toBe("750000");
    expect(r.elementos.manoObraDirecta).toBe("1050000");
    expect(r.costoDirecto).toBe("1800000");
  });

  it("el costo unitario aplicado no cambia si luego cambia el catálogo", async () => {
    const m = await materialDePrueba("1000");
    const orden = await crearOrden(prisma, coordinador, { fechaCreacion: "2026-03-02" });
    const linea = await guardarConsumo(prisma, coordinador, orden.id, { materialId: m.id, cantidadRequerida: "1" });
    await prisma.material.update({ where: { id: m.id }, data: { costoReferencia: "5000" } });
    await guardarConsumo(prisma, coordinador, orden.id, { id: linea.id, materialId: m.id, cantidadRequerida: "1", cantidadUtilizada: "1" });
    const r = await resumenOrden(prisma, await cargarOrden(prisma, orden.id));
    expect(r.elementos.materialesDirectos).toBe("1000");
  });

  it("rechaza cantidades, horas y tarifas negativas", async () => {
    const [m, t] = await Promise.all([materialDePrueba("1000"), trabajadorDePrueba("1000")]);
    const orden = await crearOrden(prisma, coordinador, { fechaCreacion: "2026-03-02" });
    await expect(guardarConsumo(prisma, coordinador, orden.id, { materialId: m.id, cantidadRequerida: "-1" })).rejects.toThrow(ErrorNegocio);
    await expect(
      guardarRegistroMOD(prisma, coordinador, orden.id, { trabajadorId: t.id, actividad: "x", fecha: "2026-03-05", horas: "-3" }),
    ).rejects.toThrow(MENSAJES.horasNoPositivas);
    await expect(
      guardarRegistroMOD(prisma, coordinador, orden.id, { cargo: "Auxiliar", actividad: "x", fecha: "2026-03-05", horas: "3", tarifa: "-5" }),
    ).rejects.toThrow(MENSAJES.negativo("la tarifa"));
  });

  it("el código de orden no se puede repetir", async () => {
    const codigo = unico("OP");
    await crearOrden(prisma, coordinador, { codigo });
    await expect(crearOrden(prisma, coordinador, { codigo })).rejects.toThrow(`El código ${codigo} ya existe`);
  });

  it("para activar exige cliente, descripción, fecha de entrega y valor cotizado", async () => {
    const orden = await crearOrden(prisma, coordinador, { fechaCreacion: "2026-03-02" });
    const error = await cambiarEstado(prisma, coordinador, orden.id, "COTIZADO").catch((e) => e);
    expect(error).toBeInstanceOf(ErrorNegocio);
    expect(error.detalles).toEqual(["Cliente", "Descripción", "Fecha estimada de entrega", "Valor cotizado"]);
    await actualizarOrden(prisma, coordinador, orden.id, await datosActivos());
    const activa = await cambiarEstado(prisma, coordinador, orden.id, "COTIZADO");
    expect(activa.estado).toBe("COTIZADO");
    expect(activa.estimadoAlCotizar).not.toBeNull();
  });

  it("gerencia no puede crear órdenes", async () => {
    await expect(crearOrden(prisma, gerencia, {})).rejects.toBeInstanceOf(ErrorPermiso);
  });
});

describe("CU-02 — ingeniería, automatización y puesta en marcha", () => {
  it("el técnico solo registra sus propias horas, en órdenes asignadas y no cerradas", async () => {
    const [propio, otro] = await Promise.all([trabajadorDePrueba("45000"), trabajadorDePrueba("40000")]);
    const tecnico = await usuarioDePrueba("TECNICO", propio.id);
    const prog = await etapa("Programación (PLC/HMI)");
    const orden = await crearOrden(prisma, coordinador, { ...(await datosActivos()), tecnicos: [propio.id] });
    const noAsignada = await crearOrden(prisma, coordinador, await datosActivos());

    const reg = { etapaId: prog.id, fechaInicio: "2026-03-09", fechaFin: "2026-03-09", horas: "4", descripcion: "Programa PLC" };
    const { registro } = await guardarRegistroIngenieria(prisma, tecnico, orden.id, { ...reg, responsableId: propio.id, costoHora: "1" });
    expect(registro.costoHoraAplicado.toString()).toBe("45000"); // el técnico no puede cambiar la tarifa

    await expect(guardarRegistroIngenieria(prisma, tecnico, orden.id, { ...reg, responsableId: otro.id })).rejects.toThrow(
      "Solo puede registrar sus propias horas",
    );
    await expect(guardarRegistroIngenieria(prisma, tecnico, noAsignada.id, { ...reg, responsableId: propio.id })).rejects.toBeInstanceOf(
      ErrorPermiso,
    );
    const ajeno = await guardarRegistroIngenieria(prisma, coordinador, orden.id, { ...reg, responsableId: otro.id });
    await expect(
      guardarRegistroIngenieria(prisma, tecnico, orden.id, { ...reg, id: ajeno.registro.id, responsableId: propio.id }),
    ).rejects.toThrow("Solo puede editar sus propias horas");

    // el técnico no puede agregar materiales ni servicios
    const m = await materialDePrueba("1");
    await expect(guardarConsumo(prisma, tecnico, orden.id, { materialId: m.id })).rejects.toBeInstanceOf(ErrorPermiso);

    // en el listado solo ve la orden asignada
    const visibles = await listarOrdenes(prisma, tecnico);
    expect(visibles.map((o) => o.id)).toEqual([orden.id]);
  });

  it("valida fechas y advierte (sin bloquear) por exceso de horas", async () => {
    const t = await trabajadorDePrueba("40000");
    const pruebas = await etapa("Pruebas");
    const orden = await crearOrden(prisma, coordinador, await datosActivos());
    const base = { etapaId: pruebas.id, responsableId: t.id, descripcion: "FAT" };
    await expect(
      guardarRegistroIngenieria(prisma, coordinador, orden.id, { ...base, fechaInicio: "2026-03-10", fechaFin: "2026-03-09", horas: "2" }),
    ).rejects.toThrow(MENSAJES.fechasInvertidas);
    const r = await guardarRegistroIngenieria(prisma, coordinador, orden.id, { ...base, fechaInicio: "2026-03-10", fechaFin: "2026-03-10", horas: "12" });
    expect(r.advertencia).toMatch(/superan los días hábiles/);
  });

  it("el resumen por etapas suma exactamente el total, incluyendo servicios adicionales", async () => {
    const t = await trabajadorDePrueba("45000");
    const [conceptual, puesta] = await Promise.all([etapa("Ingeniería conceptual"), etapa("Puesta en marcha")]);
    const orden = await crearOrden(prisma, coordinador, await datosActivos());
    await guardarRegistroIngenieria(prisma, coordinador, orden.id, { etapaId: conceptual.id, responsableId: t.id, fechaInicio: "2026-03-03", fechaFin: "2026-03-03", horas: "4", descripcion: "x" });
    await guardarRegistroIngenieria(prisma, coordinador, orden.id, { etapaId: puesta.id, responsableId: t.id, fechaInicio: "2026-03-18", fechaFin: "2026-03-19", horas: "8", descripcion: "x", costoHora: "40000" });
    await guardarServicio(prisma, coordinador, orden.id, { etapaId: puesta.id, descripcion: "Transporte al sitio", valor: "200000" });
    const r = await resumenOrden(prisma, await cargarOrden(prisma, orden.id));
    const suma = r.ingenieria.porEtapa.reduce((a, e) => a + Number(e.costo), 0);
    expect(suma).toBe(Number(r.ingenieria.costoIngenieria));
    expect(r.elementos.ingenieriaAutomatizacion).toBe("180000");
    expect(r.elementos.pruebasPuestaMarcha).toBe("520000");
  });
});

describe("CU-03 — CIF, mermas, costo total y cierre", () => {
  async function ordenCompleta() {
    const [plc, cable, ens] = await Promise.all([materialDePrueba("4350000"), materialDePrueba("3000", "m"), trabajadorDePrueba("35000")]);
    const orden = await crearOrden(prisma, coordinador, { ...(await datosActivos()), margenMinimoPct: "15" });
    await guardarConsumo(prisma, coordinador, orden.id, { materialId: plc.id, cantidadRequerida: "1", cantidadEntregada: "1", cantidadUtilizada: "1" });
    await guardarConsumo(prisma, coordinador, orden.id, { materialId: cable.id, cantidadRequerida: "120", cantidadEntregada: "100", cantidadUtilizada: "50" });
    await guardarRegistroMOD(prisma, coordinador, orden.id, { trabajadorId: ens.id, actividad: "Ensamble", fecha: "2026-03-05", horas: "30" });
    return orden;
  }

  it("asigna CIF automáticamente con la tasa del período y calcula costo total y margen", async () => {
    const orden = await ordenCompleta();
    const o = await cargarOrden(prisma, orden.id);
    expect(o.asignacionCIF?.base).toBe("HORAS_MOD");
    const r = await resumenOrden(prisma, o);
    expect(r.cif?.valor).toBe("900000");
    expect(r.elementos.materialesDirectos).toBe("4500000");
    expect(r.elementos.mermas).toBe("150000");
    expect(r.costoTotal).toBe("6600000");
    expect(r.margenBruto).toBe("2900000");
  });

  it("bloquea merma negativa", async () => {
    const orden = await crearOrden(prisma, coordinador, await datosActivos());
    const cable = await materialDePrueba("3000", "m");
    await expect(
      guardarConsumo(prisma, coordinador, orden.id, { materialId: cable.id, cantidadEntregada: "150", cantidadUtilizada: "100", cantidadDevuelta: "60" }),
    ).rejects.toThrow(MENSAJES.mermaNegativa);
  });

  it("si cambia el parámetro del período avisa y permite recalcular; cambio de base exige justificación", async () => {
    await guardarParametroCIF(prisma, contador, { periodo: "2026-04", base: "HORAS_MOD", tasaDirecta: "30000" });
    const orden = await crearOrden(prisma, coordinador, { ...(await datosActivos()), fechaCreacion: "2026-04-01" });
    await guardarParametroCIF(prisma, contador, { periodo: "2026-04", base: "HORAS_MOD", cifPresupuestado: "7000000", baseEstimada: "200" });
    expect((await estadoCIF(prisma, orden.id)).desactualizado).toBe(true);
    await expect(asignarCIF(prisma, coordinador, orden.id)).rejects.toBeInstanceOf(ErrorPermiso);
    const a = await asignarCIF(prisma, contador, orden.id);
    expect(a.tasaAplicada.toString()).toBe("35000");
    expect((await estadoCIF(prisma, orden.id)).desactualizado).toBe(false);
    await expect(asignarCIF(prisma, contador, orden.id, { base: "COSTO_MOD", tasa: "20" })).rejects.toThrow(/justificar/);
    const b = await asignarCIF(prisma, contador, orden.id, { base: "COSTO_MOD", tasa: "20", justificacion: "Método del Excel" });
    expect(b.base).toBe("COSTO_MOD");
  });

  it("cierra la orden, congela el snapshot y bloquea la edición; solo el admin reabre", async () => {
    const orden = await ordenCompleta();
    await cambiarEstado(prisma, coordinador, orden.id, "COTIZADO");
    await cambiarEstado(prisma, coordinador, orden.id, "EN_PUESTA_MARCHA", { comentario: "Proyecto sin ingeniería" });
    await expect(cambiarEstado(prisma, coordinador, orden.id, "TERMINADO")).rejects.toBeInstanceOf(ErrorPermiso);

    const cerrada = await cambiarEstado(prisma, contador, orden.id, "TERMINADO");
    const snap = cerrada.snapshotCierre as unknown as SnapshotCierre;
    expect(snap.resumen.costoTotal).toBe("6600000");
    expect(cerrada.fechaTerminacion).not.toBeNull();

    // cambiar la tasa del período no afecta la orden cerrada
    await guardarParametroCIF(prisma, contador, { periodo: "2026-03", base: "HORAS_MOD", tasaDirecta: "50000" });
    expect((await resumenOrden(prisma, await cargarOrden(prisma, orden.id))).costoTotal).toBe("6600000");
    await guardarParametroCIF(prisma, contador, { periodo: "2026-03", base: "HORAS_MOD", tasaDirecta: "30000" });

    const m = await materialDePrueba("1");
    await expect(guardarConsumo(prisma, coordinador, orden.id, { materialId: m.id })).rejects.toThrow("cerrada o anulada");

    await expect(cambiarEstado(prisma, contador, orden.id, "FACTURADO")).rejects.toThrow("número y la fecha");
    const facturada = await cambiarEstado(prisma, contador, orden.id, "FACTURADO", { numeroFactura: "FE-123", fechaFactura: "2026-10-01" });
    expect(facturada.numeroFactura).toBe("FE-123");

    await cambiarEstado(prisma, contador, orden.id, "TERMINADO", { comentario: "Factura anulada" });
    await expect(
      cambiarEstado(prisma, contador, orden.id, "EN_PUESTA_MARCHA", { comentario: "Corrección" }),
    ).rejects.toBeInstanceOf(ErrorPermiso);
    await expect(cambiarEstado(prisma, admin, orden.id, "EN_PUESTA_MARCHA")).rejects.toThrow("comentario");
    const reabierta = await cambiarEstado(prisma, admin, orden.id, "EN_PUESTA_MARCHA", { comentario: "Faltó registrar un material" });
    expect(reabierta.snapshotCierre).toBeNull();
    const auditoria = await prisma.auditoria.findFirst({ where: { entidadId: orden.id, campo: "reapertura" } });
    expect(auditoria?.valorNuevo).toBe("Faltó registrar un material");
  });

  it("no cierra una orden sin CIF ni registros", async () => {
    const orden = await crearOrden(prisma, coordinador, { ...(await datosActivos()), fechaCreacion: "2025-01-15" });
    await cambiarEstado(prisma, coordinador, orden.id, "COTIZADO");
    const e = await cambiarEstado(prisma, contador, orden.id, "TERMINADO", { comentario: "Cierre directo" }).catch((x) => x);
    expect(e.detalles).toEqual(["Debe existir al menos un material o un registro de horas", "El CIF no está asignado"]);
  });
});
