/**
 * Datos semilla: roles y permisos, etapas, parámetros generales, usuarios de demostración
 * y la orden del caso de aceptación (OP-2026-0001, sección 13).
 * Es idempotente: no duplica datos si se ejecuta varias veces.
 * Para omitir los datos de demostración: SEMILLA_DEMO=false
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISOS_POR_ROL, ROLES, type ClavePermiso, type ClaveRol, type UsuarioActual } from "../src/lib/auth/permisos";
import { crearOrden } from "../src/lib/servicios/ordenes";
import { guardarConsumo, guardarRegistroIngenieria, guardarRegistroMOD } from "../src/lib/servicios/lineas";
import { cambiarEstado } from "../src/lib/servicios/estados";

const prisma = new PrismaClient();
const CONTRASENA_DEMO = "Costeo2026*";

const ETAPAS = [
  { nombre: "Ingeniería conceptual", grupo: "INGENIERIA_AUTOMATIZACION", orden: 1 },
  { nombre: "Ingeniería de detalle", grupo: "INGENIERIA_AUTOMATIZACION", orden: 2 },
  { nombre: "Programación (PLC/HMI)", grupo: "INGENIERIA_AUTOMATIZACION", orden: 3 },
  { nombre: "Configuración de equipos", grupo: "INGENIERIA_AUTOMATIZACION", orden: 4 },
  { nombre: "Pruebas", grupo: "PRUEBAS_PUESTA_MARCHA", orden: 5 },
  { nombre: "Puesta en marcha", grupo: "PRUEBAS_PUESTA_MARCHA", orden: 6 },
  { nombre: "Soporte", grupo: "PRUEBAS_PUESTA_MARCHA", orden: 7 },
] as const;

async function base() {
  await prisma.parametrosGenerales.upsert({
    where: { id: 1 },
    create: { id: 1, nombreEmpresa: "Empresa de Automatización Industrial S.A.S." },
    update: {},
  });
  for (const [clave, nombre] of Object.entries(ROLES)) {
    const rol = await prisma.rol.upsert({ where: { clave }, create: { clave, nombre }, update: {} });
    const existentes = await prisma.permiso.count({ where: { rolId: rol.id } });
    if (existentes === 0) {
      await prisma.permiso.createMany({
        data: PERMISOS_POR_ROL[clave as ClaveRol].map((p) => ({ rolId: rol.id, clave: p })),
      });
    }
  }
  for (const e of ETAPAS) {
    await prisma.etapa.upsert({ where: { nombre: e.nombre }, create: e, update: {} });
  }
}

async function demo() {
  const hash = await bcrypt.hash(CONTRASENA_DEMO, 10);
  const roles = Object.fromEntries((await prisma.rol.findMany()).map((r) => [r.clave, r.id]));

  const trabajador = async (documento: string, nombre: string, cargo: string, tipo: "FABRICACION" | "INGENIERIA" | "AMBOS", costoHora: string) => {
    let t = await prisma.trabajador.findFirst({ where: { documento } });
    if (!t) {
      t = await prisma.trabajador.create({
        data: { nombre, documento, cargo, tipo, tarifas: { create: { costoHora, vigenteDesde: new Date("2026-01-01T00:00:00Z") } } },
      });
    }
    return t;
  };
  const ensamblador = await trabajador("1001", "Carlos Pérez", "Ensamblador", "FABRICACION", "35000");
  const ingeniero = await trabajador("1002", "Laura Gómez", "Ingeniera de automatización", "INGENIERIA", "45000");
  const tecnico = await trabajador("1003", "Andrés Rojas", "Técnico de pruebas", "AMBOS", "40000");

  const usuario = (email: string, nombre: string, rol: ClaveRol, trabajadorId?: string) =>
    prisma.usuario.upsert({
      where: { email },
      create: { email, nombre, hashContrasena: hash, rolId: roles[rol], trabajadorId },
      update: {},
    });
  const admin = await usuario("admin@empresa.com", "Administrador", "ADMINISTRADOR");
  await usuario("contador@empresa.com", "Contadora", "CONTADOR");
  const coordinador = await usuario("coordinador@empresa.com", "Coordinador de proyectos", "COORDINADOR");
  await usuario("tecnico@empresa.com", tecnico.nombre, "TECNICO", tecnico.id);
  await usuario("ingeniera@empresa.com", ingeniero.nombre, "TECNICO", ingeniero.id);
  await usuario("gerencia@empresa.com", "Gerencia", "GERENCIA");

  let cliente = await prisma.cliente.findFirst({ where: { nit: "900123456-7" } });
  cliente ??= await prisma.cliente.create({
    data: { nombre: "Industrias Ejemplo S.A.S.", nit: "900123456-7", contacto: "Jefe de mantenimiento", ciudad: "Medellín", telefono: "6045550000", correo: "compras@ejemplo.com" },
  });

  const materiales = [
    ["PLC-01", "PLC", "und", "PLC", "1800000"],
    ["HMI-01", "Pantalla HMI", "und", "HMI", "1200000"],
    ["GAB-01", "Gabinete metálico", "und", "Gabinetes", "650000"],
    ["BRK-01", "Breaker", "und", "Protecciones", "45000"],
    ["CAB-01", "Cable de control", "m", "Cableado", "3000"],
    ["BOR-01", "Bornera", "und", "Borneras", "1000"],
  ] as const;
  const idMaterial: Record<string, string> = {};
  for (const [codigo, descripcion, unidad, categoria, costo] of materiales) {
    const m = await prisma.material.upsert({
      where: { codigo },
      create: { codigo, descripcion, unidad, categoria, costoReferencia: costo },
      update: {},
    });
    idMaterial[codigo] = m.id;
  }

  // CIF 2026: base Horas de MOD, tasa $30.000 por hora
  for (let mes = 1; mes <= 12; mes++) {
    const periodo = `2026-${String(mes).padStart(2, "0")}`;
    await prisma.parametroCIF.upsert({
      where: { periodo },
      create: { periodo, base: "HORAS_MOD", tasaDirecta: "30000", observaciones: "Semilla" },
      update: {},
    });
  }

  if (await prisma.ordenProyecto.findUnique({ where: { codigo: "OP-2026-0001" } })) return;

  const adminActual: UsuarioActual = {
    id: admin.id,
    nombre: admin.nombre,
    email: admin.email,
    rol: "ADMINISTRADOR",
    rolNombre: ROLES.ADMINISTRADOR,
    trabajadorId: null,
    permisos: new Set(PERMISOS_POR_ROL.ADMINISTRADOR as ClavePermiso[]),
  };

  await prisma.$transaction(
    async (tx) => {
      const orden = await crearOrden(tx, adminActual, {
        codigo: "OP-2026-0001",
        clienteId: cliente.id,
        descripcion: "Tablero de control con PLC y HMI",
        cantidadUnidades: "1",
        fechaCreacion: "2026-03-02",
        fechaEstimadaEntrega: "2026-12-15",
        responsableId: coordinador.id,
        valorCotizado: "9500000",
        margenEsperadoPct: "20",
        margenMinimoPct: "15",
        tecnicos: [tecnico.id, ingeniero.id],
      });
      const lineas = [
        ["PLC-01", "1", "1", "1"],
        ["HMI-01", "1", "1", "1"],
        ["GAB-01", "1", "1", "1"],
        ["BRK-01", "10", "10", "10"],
        ["CAB-01", "120", "150", "100"],
        ["BOR-01", "100", "100", "100"],
      ];
      const creadas = [];
      for (const [codigo, requerida] of lineas) {
        creadas.push(await guardarConsumo(tx, adminActual, orden.id, { materialId: idMaterial[codigo], cantidadRequerida: requerida }));
      }
      await cambiarEstado(tx, adminActual, orden.id, "COTIZADO", { comentario: "Cotización aprobada por el cliente" });
      await cambiarEstado(tx, adminActual, orden.id, "EN_INGENIERIA");

      const etapas = Object.fromEntries((await tx.etapa.findMany()).map((e) => [e.nombre, e.id]));
      const ing = [
        ["Ingeniería conceptual", ingeniero.id, "2026-03-03", "2026-03-03", "4", "Arquitectura de control y selección de equipos"],
        ["Ingeniería de detalle", ingeniero.id, "2026-03-04", "2026-03-05", "6", "Planos eléctricos y lista técnica"],
        ["Programación (PLC/HMI)", ingeniero.id, "2026-03-09", "2026-03-09", "4", "Programa PLC y pantallas HMI"],
        ["Configuración de equipos", ingeniero.id, "2026-03-10", "2026-03-10", "2", "Configuración de red y variadores"],
        ["Pruebas", tecnico.id, "2026-03-16", "2026-03-16", "4", "Pruebas FAT en taller"],
        ["Puesta en marcha", tecnico.id, "2026-03-18", "2026-03-19", "8", "Puesta en marcha en planta del cliente"],
      ] as const;
      for (const [etapa, resp, ini, fin, horas, desc] of ing.slice(0, 4)) {
        await guardarRegistroIngenieria(tx, adminActual, orden.id, { etapaId: etapas[etapa], responsableId: resp, fechaInicio: ini, fechaFin: fin, horas, descripcion: desc });
      }
      await cambiarEstado(tx, adminActual, orden.id, "EN_FABRICACION");
      await guardarRegistroMOD(tx, adminActual, orden.id, {
        trabajadorId: ensamblador.id,
        actividad: "Montaje, ensamble y cableado del tablero",
        fecha: "2026-03-11",
        horas: "30",
      });
      for (let i = 0; i < lineas.length; i++) {
        const [codigo, requerida, entregada, utilizada] = lineas[i];
        await guardarConsumo(tx, adminActual, orden.id, {
          id: creadas[i].id,
          materialId: idMaterial[codigo],
          cantidadRequerida: requerida,
          cantidadEntregada: entregada,
          cantidadUtilizada: utilizada,
          cantidadDevuelta: "0",
          causaMerma: codigo === "CAB-01" ? "Cortes y recorridos más largos de lo previsto" : null,
        });
      }
      await cambiarEstado(tx, adminActual, orden.id, "EN_PRUEBAS");
      for (const [etapa, resp, ini, fin, horas, desc] of ing.slice(4)) {
        await guardarRegistroIngenieria(tx, adminActual, orden.id, { etapaId: etapas[etapa], responsableId: resp, fechaInicio: ini, fechaFin: fin, horas, descripcion: desc });
      }
      await cambiarEstado(tx, adminActual, orden.id, "EN_PUESTA_MARCHA");
    },
    { timeout: 60_000 },
  );
}

async function main() {
  await base();
  if (process.env.SEMILLA_DEMO !== "false") await demo();
  console.log("Semilla aplicada.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
