import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorPermiso, type UsuarioActual } from "@/lib/auth/permisos";
import { elegirPresupuestos } from "@/lib/costeo";
import { guardarParametroCIF } from "../cif";
import { agregarConceptoCIFReal, anularConciliacion, conciliarPeriodo, previsualizarConciliacion } from "../conciliacion";
import { cambiarEstado } from "../estados";
import { guardarConsumo, guardarRegistroMOD } from "../lineas";
import { cargarOrden, crearOrden } from "../ordenes";
import { aprobarPresupuesto, crearVersionPresupuesto } from "../presupuestos";
import { clienteDePrueba, materialDePrueba, prisma, trabajadorDePrueba, usuarioDePrueba } from "./ayudas";

let admin: UsuarioActual, contador: UsuarioActual, coordinador: UsuarioActual;
// La base de pruebas no se reinicia: cada ejecución usa un período nuevo.
const anio = 2100 + (Math.floor(Date.now() / 1000) % 800);
const PERIODO = `${anio}-06`;

beforeAll(async () => {
  admin = await usuarioDePrueba("ADMINISTRADOR");
  contador = await usuarioDePrueba("CONTADOR");
  coordinador = await usuarioDePrueba("COORDINADOR");
  await guardarParametroCIF(prisma, contador, { periodo: PERIODO, base: "HORAS_MOD", tasaDirecta: "30000" });
});
afterAll(() => prisma.$disconnect());

async function ordenConMOD(horas: string, cotizado: string) {
  const [m, t] = await Promise.all([materialDePrueba("1000000"), trabajadorDePrueba("35000")]);
  const orden = await crearOrden(prisma, coordinador, {
    clienteId: (await clienteDePrueba()).id,
    descripcion: "Tablero",
    fechaCreacion: `${PERIODO}-02`,
    fechaEstimadaEntrega: `${PERIODO}-28`,
    valorCotizado: cotizado,
  });
  await guardarConsumo(prisma, coordinador, orden.id, { materialId: m.id, cantidadRequerida: "1", cantidadUtilizada: "1" });
  await guardarRegistroMOD(prisma, coordinador, orden.id, { trabajadorId: t.id, actividad: "Ensamble", fecha: `${PERIODO}-05`, horas });
  return orden;
}

describe("Presupuesto de costo por componente y versiones", () => {
  it("versiona, exige motivo desde la versión 2 y requiere aprobación con permiso", async () => {
    const orden = await crearOrden(prisma, coordinador, { fechaCreacion: `${anio}-07-01` });
    const base = { materialesDirectos: "4560000", manoObraDirecta: "980000", ingenieriaAutomatizacion: "675000", pruebasPuestaMarcha: "440000", cif: "840000", horasEnsamble: "28", horasIngenieria: "26" };
    const v1 = await crearVersionPresupuesto(prisma, coordinador, orden.id, base);
    expect(v1.version).toBe(1);
    await expect(crearVersionPresupuesto(prisma, coordinador, orden.id, base)).rejects.toThrow(/motivo/);
    await expect(crearVersionPresupuesto(prisma, coordinador, orden.id, { ...base, cif: "-1", motivo: "x" })).rejects.toThrow(/número no negativo/);

    await expect(aprobarPresupuesto(prisma, coordinador, orden.id, v1.id)).rejects.toBeInstanceOf(ErrorPermiso);
    await aprobarPresupuesto(prisma, contador, orden.id, v1.id);
    await expect(aprobarPresupuesto(prisma, contador, orden.id, v1.id)).rejects.toThrow(/ya fue aprobada/);

    const v2 = await crearVersionPresupuesto(prisma, coordinador, orden.id, { ...base, materialesDirectos: "5000000", motivo: "Cambio de especificación: PLC de mayor capacidad" });
    expect(v2.version).toBe(2);
    let o = await cargarOrden(prisma, orden.id);
    expect(elegirPresupuestos(o.presupuestos).vigente?.version).toBe(1); // v2 aún sin aprobar
    await aprobarPresupuesto(prisma, contador, orden.id, v2.id);
    o = await cargarOrden(prisma, orden.id);
    const { original, vigente } = elegirPresupuestos(o.presupuestos);
    expect([original?.version, vigente?.version]).toEqual([1, 2]);
  });
});

describe("Conciliación del CIF real vs aplicado y costo ajustado", () => {
  it("exige órdenes cerradas, prorratea la diferencia y bloquea cambios hasta anular", async () => {
    const a = await ordenConMOD("30", "9500000"); // CIF aplicado 900.000
    const b = await ordenConMOD("10", "5000000"); // CIF aplicado 300.000
    await expect(conciliarPeriodo(prisma, contador, PERIODO, "PRORRATEO_CIF_APLICADO")).rejects.toThrow(/CIF real/);
    await agregarConceptoCIFReal(prisma, contador, { periodo: PERIODO, concepto: "Arriendo de planta", valor: "800000", soporte: "FAC-1" });
    await agregarConceptoCIFReal(prisma, contador, { periodo: PERIODO, concepto: "Energía", valor: "500000" });
    await expect(agregarConceptoCIFReal(prisma, coordinador, { periodo: PERIODO, concepto: "x", valor: "1" })).rejects.toBeInstanceOf(ErrorPermiso);

    const pendiente = await conciliarPeriodo(prisma, contador, PERIODO, "PRORRATEO_CIF_APLICADO").catch((e) => e);
    expect(pendiente.message).toMatch(/sin cerrar/);
    expect(pendiente.detalles).toHaveLength(2);

    for (const o of [a, b]) {
      await cambiarEstado(prisma, coordinador, o.id, "COTIZADO");
      await cambiarEstado(prisma, contador, o.id, "TERMINADO", { comentario: "Entregado" });
    }
    const vista = await previsualizarConciliacion(prisma, PERIODO, "PRORRATEO_CIF_APLICADO");
    expect(vista.cifReal).toBe("1300000");
    expect(vista.resultado?.diferencia.toString()).toBe("100000");

    await expect(conciliarPeriodo(prisma, coordinador, PERIODO, "PRORRATEO_CIF_APLICADO")).rejects.toBeInstanceOf(ErrorPermiso);
    const c = await conciliarPeriodo(prisma, contador, PERIODO, "PRORRATEO_CIF_APLICADO", "Cierre de junio");
    expect(c.diferencia.toString()).toBe("100000");

    const oa = await cargarOrden(prisma, a.id);
    expect(oa.ajustesCIF[0].ajuste.toString()).toBe("75000");
    // costo acumulado: 1.000.000 + 1.050.000 + 900.000 = 2.950.000 → ajustado 3.025.000
    expect(oa.ajustesCIF[0].costoAcumulado.toString()).toBe("2950000");
    expect(oa.ajustesCIF[0].costoAjustado.toString()).toBe("3025000");

    await expect(conciliarPeriodo(prisma, contador, PERIODO, "COSTO_DE_VENTAS")).rejects.toThrow(/ya está conciliado/);
    await expect(agregarConceptoCIFReal(prisma, contador, { periodo: PERIODO, concepto: "Tarde", valor: "1" })).rejects.toThrow(/ya está conciliado/);
    await expect(cambiarEstado(prisma, admin, a.id, "EN_PUESTA_MARCHA", { comentario: "Corrección" })).rejects.toThrow(/Anule primero la conciliación/);

    await expect(anularConciliacion(prisma, contador, c.id, "")).rejects.toThrow(/motivo/);
    await anularConciliacion(prisma, contador, c.id, "Se debe corregir una orden");
    expect((await cargarOrden(prisma, a.id)).ajustesCIF).toHaveLength(0);
    const reabierta = await cambiarEstado(prisma, admin, a.id, "EN_PUESTA_MARCHA", { comentario: "Corrección" });
    expect(reabierta.estado).toBe("EN_PUESTA_MARCHA");
  });
});
