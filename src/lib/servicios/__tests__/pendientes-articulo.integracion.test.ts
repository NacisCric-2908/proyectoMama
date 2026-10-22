import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorPermiso, type UsuarioActual } from "@/lib/auth/permisos";
import { asignarCIF, estadoCIF, guardarParametroCIF } from "../cif";
import { guardarExplicacion } from "../desviaciones";
import { cambiarEstado } from "../estados";
import { inventarioActual, registrarAjuste, registrarDevolucion, registrarEntrada, registrarRequisicion, saldoMaterial } from "../inventario";
import { eliminarConsumo, guardarConsumo, guardarRegistroIngenieria, guardarRegistroMOD } from "../lineas";
import { cargarOrden, crearOrden, resumenOrden } from "../ordenes";
import { aprobarPresupuesto, crearVersionPresupuesto } from "../presupuestos";
import { reporteRentabilidad } from "../reportes";
import { clienteDePrueba, etapa, materialDePrueba, prisma, trabajadorDePrueba, unico, usuarioDePrueba } from "./ayudas";

let contador: UsuarioActual, coordinador: UsuarioActual, gerencia: UsuarioActual;
const anio = 2100 + (Math.floor(Date.now() / 1000) % 800);

beforeAll(async () => {
  contador = await usuarioDePrueba("CONTADOR");
  coordinador = await usuarioDePrueba("COORDINADOR");
  gerencia = await usuarioDePrueba("GERENCIA");
  await guardarParametroCIF(prisma, contador, { periodo: `${anio}-01`, base: "HORAS_MOD", tasaDirecta: "30000" });
});
afterAll(() => prisma.$disconnect());

const datosOrden = async (mes = "01") => ({
  clienteId: (await clienteDePrueba()).id,
  descripcion: "Tablero",
  fechaCreacion: `${anio}-${mes}-02`,
  fechaEstimadaEntrega: `${anio}-12-28`,
  valorCotizado: "10000000",
});

describe("Kárdex: entradas, requisiciones a órdenes y devoluciones (promedio ponderado)", () => {
  it("valora las salidas al promedio, actualiza la línea y bloquea fechas anteriores", async () => {
    const cable = await materialDePrueba("3000", "m");
    const f = (dia: string) => `${anio}-01-${dia}`;
    await registrarEntrada(prisma, coordinador, { materialId: cable.id, fecha: f("03"), cantidad: "100", costoUnitario: "3000", documento: "FAC-1", tercero: "Proveedor" });
    await registrarEntrada(prisma, coordinador, { materialId: cable.id, fecha: f("04"), cantidad: "100", costoUnitario: "3400" });
    await expect(registrarEntrada(prisma, gerencia, { materialId: cable.id, fecha: f("04"), cantidad: "1", costoUnitario: "1" })).rejects.toBeInstanceOf(ErrorPermiso);

    const orden = await crearOrden(prisma, coordinador, await datosOrden());
    const sal = await registrarRequisicion(prisma, coordinador, orden.id, { materialId: cable.id, fecha: f("05"), cantidad: "150", solicitante: "Carlos", documento: "REQ-1" });
    expect(sal.costoUnitario.toString()).toBe("3200");
    expect(sal.autorizadoPorNombre).toBe(coordinador.nombre);

    let linea = (await cargarOrden(prisma, orden.id)).materiales[0];
    expect(linea.cantidadEntregada?.toString()).toBe("150");
    expect(linea.costoUnitarioAplicado.toString()).toBe("3200");

    // la línea se completa a mano con la cantidad utilizada; entregada y costo no se pueden alterar
    await guardarConsumo(prisma, coordinador, orden.id, {
      id: linea.id, materialId: cable.id, cantidadRequerida: "120", cantidadEntregada: "999", cantidadUtilizada: "100", costoUnitario: "1",
    });
    linea = (await cargarOrden(prisma, orden.id)).materiales[0];
    expect([linea.cantidadEntregada?.toString(), linea.costoUnitarioAplicado.toString()]).toEqual(["150", "3200"]);

    await expect(registrarDevolucion(prisma, coordinador, orden.id, { consumoId: linea.id, fecha: f("06"), cantidad: "60" })).rejects.toThrow(/supera la entregada/);
    await registrarDevolucion(prisma, coordinador, orden.id, { consumoId: linea.id, fecha: f("06"), cantidad: "30", solicitante: "Carlos" });
    const r = await resumenOrden(prisma, await cargarOrden(prisma, orden.id));
    expect(r.materiales.lineas[0].merma).toBe("20"); // 150 − 100 − 30
    expect(r.elementos.mermas).toBe("64000");

    const saldo = await saldoMaterial(prisma, cable.id);
    expect(saldo.cantidad.toString()).toBe("80"); // 200 − 150 + 30
    expect(saldo.valor.toString()).toBe("256000");
    expect((await inventarioActual(prisma)).find((x) => x.material.id === cable.id)?.costoPromedio).toBe("3200");

    await expect(registrarEntrada(prisma, coordinador, { materialId: cable.id, fecha: f("01"), cantidad: "1", costoUnitario: "1" })).rejects.toThrow(/anterior al último movimiento/);
    await expect(registrarRequisicion(prisma, coordinador, orden.id, { materialId: cable.id, fecha: f("07"), cantidad: "500", solicitante: "x" })).rejects.toThrow(/Existencias insuficientes/);
    await expect(registrarAjuste(prisma, coordinador, { materialId: cable.id, fecha: f("07"), tipo: "AJUSTE_NEGATIVO", cantidad: "1" })).rejects.toThrow(/motivo/);
    await registrarAjuste(prisma, coordinador, { materialId: cable.id, fecha: f("07"), tipo: "AJUSTE_NEGATIVO", cantidad: "1", observaciones: "Conteo físico" });
    await expect(eliminarConsumo(prisma, coordinador, orden.id, linea.id)).rejects.toThrow(/cantidad utilizada/);

    await cambiarEstado(prisma, coordinador, orden.id, "COTIZADO");
    await cambiarEstado(prisma, contador, orden.id, "TERMINADO", { comentario: "Cierre" });
    await expect(registrarRequisicion(prisma, coordinador, orden.id, { materialId: cable.id, fecha: f("08"), cantidad: "1", solicitante: "x" })).rejects.toThrow(/cerrada/);
  });

  it("no mezcla cantidades manuales con requisiciones", async () => {
    const m = await materialDePrueba("1000");
    await registrarEntrada(prisma, coordinador, { materialId: m.id, fecha: `${anio}-01-03`, cantidad: "10", costoUnitario: "1000" });
    const orden = await crearOrden(prisma, coordinador, await datosOrden());
    await guardarConsumo(prisma, coordinador, orden.id, { materialId: m.id, cantidadRequerida: "5", cantidadEntregada: "5", cantidadUtilizada: "5" });
    await expect(registrarRequisicion(prisma, coordinador, orden.id, { materialId: m.id, fecha: `${anio}-01-05`, cantidad: "1", solicitante: "x" })).rejects.toThrow(/manualmente/);
  });
});

describe("Eliminar líneas alimentadas por el kárdex", () => {
  const f = (dia: string) => `${anio}-01-${dia}`;

  it("requisición 100 y devolución 100: la línea se elimina sin tocar el inventario", async () => {
    const m = await materialDePrueba("1000");
    await registrarEntrada(prisma, coordinador, { materialId: m.id, fecha: f("03"), cantidad: "500", costoUnitario: "1000" });
    const orden = await crearOrden(prisma, coordinador, await datosOrden());
    await registrarRequisicion(prisma, coordinador, orden.id, { materialId: m.id, fecha: f("05"), cantidad: "100", solicitante: "x" });
    const linea = (await cargarOrden(prisma, orden.id)).materiales[0];
    await registrarDevolucion(prisma, coordinador, orden.id, { consumoId: linea.id, fecha: f("05"), cantidad: "100" });

    await eliminarConsumo(prisma, coordinador, orden.id, linea.id);
    const o = await cargarOrden(prisma, orden.id);
    expect(o.materiales).toHaveLength(0);
    expect((await resumenOrden(prisma, o)).elementos.materialesDirectos).toBe("0");
    expect(await prisma.movimientoInventario.count({ where: { consumoId: linea.id } })).toBe(2);
    expect((await saldoMaterial(prisma, m.id)).cantidad.toString()).toBe("500");
  });

  it("con unidades pendientes las devuelve automáticamente y permite volver a pedir el material", async () => {
    const m = await materialDePrueba("1000");
    await registrarEntrada(prisma, coordinador, { materialId: m.id, fecha: f("03"), cantidad: "50", costoUnitario: "1000" });
    const orden = await crearOrden(prisma, coordinador, await datosOrden());
    await registrarRequisicion(prisma, coordinador, orden.id, { materialId: m.id, fecha: f("05"), cantidad: "40", solicitante: "x" });
    const linea = (await cargarOrden(prisma, orden.id)).materiales[0];

    await expect(eliminarConsumo(prisma, await usuarioDePrueba("ADMINISTRADOR").then((a) => ({ ...a, rol: "COORDINADOR" as const, permisos: new Set(["ordenes.editar", "ordenes.verTodas"] as const) })), orden.id, linea.id)).rejects.toBeInstanceOf(ErrorPermiso);
    await eliminarConsumo(prisma, coordinador, orden.id, linea.id);
    const devolucion = await prisma.movimientoInventario.findFirst({ where: { consumoId: linea.id, tipo: "DEVOLUCION_ORDEN" } });
    expect(devolucion?.cantidad.toString()).toBe("40");
    expect(devolucion?.observaciones).toMatch(/automática/);
    expect((await saldoMaterial(prisma, m.id)).cantidad.toString()).toBe("50");
    expect((await cargarOrden(prisma, orden.id)).materiales).toHaveLength(0);

    await registrarRequisicion(prisma, coordinador, orden.id, { materialId: m.id, fecha: f("06"), cantidad: "5", solicitante: "x" });
    const nueva = (await cargarOrden(prisma, orden.id)).materiales;
    expect(nueva).toHaveLength(1);
    expect(nueva[0].cantidadEntregada?.toString()).toBe("5");
  });

  it("no elimina una línea con cantidad utilizada", async () => {
    const m = await materialDePrueba("1000");
    await registrarEntrada(prisma, coordinador, { materialId: m.id, fecha: f("03"), cantidad: "10", costoUnitario: "1000" });
    const orden = await crearOrden(prisma, coordinador, await datosOrden());
    await registrarRequisicion(prisma, coordinador, orden.id, { materialId: m.id, fecha: f("05"), cantidad: "10", solicitante: "x" });
    const linea = (await cargarOrden(prisma, orden.id)).materiales[0];
    await guardarConsumo(prisma, coordinador, orden.id, { id: linea.id, materialId: m.id, cantidadUtilizada: "8" });
    await expect(eliminarConsumo(prisma, coordinador, orden.id, linea.id)).rejects.toThrow(/cantidad utilizada/);
  });
});

describe("Clasificación de mermas", () => {
  it("guarda clasificación, disposición y valor recuperado; aplica la política de merma anormal", async () => {
    const cable = await materialDePrueba("3000", "m");
    const orden = await crearOrden(prisma, coordinador, await datosOrden());
    const base = { materialId: cable.id, cantidadRequerida: "120", cantidadEntregada: "150", cantidadUtilizada: "100" };
    await expect(guardarConsumo(prisma, coordinador, orden.id, { ...base, clasificacionMerma: "NORMAL", valorRecuperado: "1000" })).rejects.toThrow(/recuperable/);
    const l = await guardarConsumo(prisma, coordinador, orden.id, {
      ...base, clasificacionMerma: "RECUPERABLE", disposicionMerma: "Venta como chatarra", valorRecuperado: "30000", causaMerma: "Cortes",
    });
    let r = await resumenOrden(prisma, await cargarOrden(prisma, orden.id));
    expect(r.elementos.mermas).toBe("120000");
    expect(r.materiales.mermasPorClase.RECUPERABLE).toBe("120000");

    await guardarConsumo(prisma, coordinador, orden.id, { ...base, id: l.id, clasificacionMerma: "ANORMAL" });
    const p = await prisma.parametrosGenerales.update({ where: { id: 1 }, data: { excluirMermaAnormal: true } });
    try {
      r = await resumenOrden(prisma, await cargarOrden(prisma, orden.id));
      expect(r.elementos.mermas).toBe("0");
      expect(r.perdidaMermaAnormal).toBe("150000");
    } finally {
      await prisma.parametrosGenerales.update({ where: { id: 1 }, data: { excluirMermaAnormal: !p.excluirMermaAnormal } });
    }
  });
});

describe("CIF con tasas diferenciadas por actividad", () => {
  it("asigna las tasas del período, detalla el CIF por actividad y detecta cambios", async () => {
    const periodo = `${anio}-02`;
    await guardarParametroCIF(prisma, contador, {
      periodo, base: "ACTIVIDADES", act_ENSAMBLE_tasaDirecta: "20000", act_PRUEBAS_PUESTA_MARCHA_cifPresupuestado: "1000000", act_PRUEBAS_PUESTA_MARCHA_baseEstimada: "200", act_MATERIALES_tasaDirecta: "2",
    });
    await expect(guardarParametroCIF(prisma, contador, { periodo: `${anio}-03`, base: "ACTIVIDADES" })).rejects.toThrow(/al menos una actividad/);
    await expect(
      guardarParametroCIF(prisma, contador, { periodo: `${anio}-03`, base: "ACTIVIDADES", act_INGENIERIA_cifPresupuestado: "100" }),
    ).rejects.toThrow(/Ingeniería y automatización/);

    const [m, t, ing] = await Promise.all([materialDePrueba("1000000"), trabajadorDePrueba("35000"), trabajadorDePrueba("40000")]);
    const orden = await crearOrden(prisma, coordinador, await datosOrden("02"));
    await guardarConsumo(prisma, coordinador, orden.id, { materialId: m.id, cantidadRequerida: "1", cantidadUtilizada: "1" });
    await guardarRegistroMOD(prisma, coordinador, orden.id, { trabajadorId: t.id, actividad: "Ensamble", fecha: `${periodo}-05`, horas: "10" });
    const pruebas = await etapa("Pruebas");
    await guardarRegistroIngenieria(prisma, coordinador, orden.id, { etapaId: pruebas.id, responsableId: ing.id, fechaInicio: `${periodo}-06`, fechaFin: `${periodo}-06`, horas: "4", descripcion: "FAT" });

    const r = await resumenOrden(prisma, await cargarOrden(prisma, orden.id));
    // ensamble 10 h × 20.000 = 200.000; pruebas 4 h × 5.000 = 20.000; materiales 2 % × 1.000.000 = 20.000
    expect(r.cif?.detalle?.map((x) => [x.actividad, x.valor])).toEqual([["ENSAMBLE", "200000"], ["PRUEBAS_PUESTA_MARCHA", "20000"], ["MATERIALES", "20000"]]);
    expect(r.cif?.valor).toBe("240000");

    await guardarParametroCIF(prisma, contador, { periodo, base: "ACTIVIDADES", act_ENSAMBLE_tasaDirecta: "25000", act_MATERIALES_tasaDirecta: "2" });
    expect((await estadoCIF(prisma, orden.id)).desactualizado).toBe(true);
    await asignarCIF(prisma, contador, orden.id);
    expect((await estadoCIF(prisma, orden.id)).desactualizado).toBe(false);
    await expect(asignarCIF(prisma, contador, (await crearOrden(prisma, coordinador, await datosOrden())).id, { base: "ACTIVIDADES" as never, tasa: "1", justificacion: "x" })).rejects.toThrow(/parámetros del período/);
  });
});

describe("Explicaciones documentadas de desviaciones y rentabilidad por cliente", () => {
  it("documenta la causa declarada con la diferencia vigente y reporta la rentabilidad del cliente", async () => {
    const m = await materialDePrueba("4500000");
    const cliente = await prisma.cliente.create({ data: { nombre: unico("Cliente rentabilidad") } });
    const orden = await crearOrden(prisma, coordinador, { ...(await datosOrden()), clienteId: cliente.id, valorCotizado: "6000000" });
    await guardarConsumo(prisma, coordinador, orden.id, { materialId: m.id, cantidadRequerida: "1", cantidadUtilizada: "1" });
    const v1 = await crearVersionPresupuesto(prisma, coordinador, orden.id, { materialesDirectos: "4300000", cif: "0" });
    const datos = { presupuestoId: v1.id, componente: "materialesDirectos", causa: "PRECIO_MATERIALES", explicacion: "El proveedor subió el precio del PLC", soporte: "FAC-9" };
    await expect(guardarExplicacion(prisma, coordinador, orden.id, datos)).rejects.toThrow(/aprobada/);
    await aprobarPresupuesto(prisma, contador, orden.id, v1.id);
    await expect(guardarExplicacion(prisma, gerencia, orden.id, datos)).rejects.toBeInstanceOf(ErrorPermiso);
    await expect(guardarExplicacion(prisma, coordinador, orden.id, { ...datos, explicacion: "corta" })).rejects.toThrow(/10 caracteres/);
    const e = await guardarExplicacion(prisma, coordinador, orden.id, datos);
    expect(e.diferencia.toString()).toBe("200000");
    await guardarExplicacion(prisma, coordinador, orden.id, { ...datos, causa: "CAMBIO_CLIENTE", explicacion: "El cliente pidió un PLC de mayor capacidad" });
    expect(await prisma.explicacionDesviacion.count({ where: { ordenId: orden.id } })).toBe(1);

    await cambiarEstado(prisma, coordinador, orden.id, "COTIZADO");
    await cambiarEstado(prisma, contador, orden.id, "TERMINADO", { comentario: "Cierre" });
    // documentar sigue siendo posible con la orden cerrada
    await guardarExplicacion(prisma, contador, orden.id, { ...datos, componente: "total", causa: "METODO_ESTIMACION", explicacion: "El presupuesto omitió el CIF" });

    const rep = await reporteRentabilidad(prisma, contador);
    const fila = rep.filas.find((x) => x.clienteId === cliente.id)!;
    expect(fila.ordenes).toBe(1);
    expect(fila.costo.toString()).toBe("4500000");
    expect(fila.margen.toString()).toBe("1500000");
    await expect(reporteRentabilidad(prisma, await usuarioDePrueba("TECNICO"))).rejects.toBeInstanceOf(ErrorPermiso);
  });
});
