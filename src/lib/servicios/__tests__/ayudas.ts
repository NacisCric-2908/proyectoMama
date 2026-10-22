import { PrismaClient } from "@prisma/client";
import type { ClavePermiso, ClaveRol, UsuarioActual } from "@/lib/auth/permisos";

export const prisma = new PrismaClient();
let consecutivo = 0;
export const unico = (p: string) => `${p}-${Date.now().toString(36)}-${++consecutivo}`;

export async function usuarioDePrueba(rol: ClaveRol, trabajadorId: string | null = null): Promise<UsuarioActual> {
  const r = await prisma.rol.findUniqueOrThrow({ where: { clave: rol }, include: { permisos: true } });
  const u = await prisma.usuario.create({
    data: { email: `${unico(rol.toLowerCase())}@prueba.co`, nombre: `Usuario ${rol}`, hashContrasena: "x", rolId: r.id, trabajadorId },
  });
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol,
    rolNombre: r.nombre,
    trabajadorId,
    permisos: new Set(r.permisos.map((p) => p.clave as ClavePermiso)),
  };
}

export async function trabajadorDePrueba(costoHora: string, tipo: "FABRICACION" | "INGENIERIA" | "AMBOS" = "AMBOS") {
  return prisma.trabajador.create({
    data: {
      nombre: unico("Trabajador"),
      cargo: "Técnico",
      tipo,
      tarifas: { create: { costoHora, vigenteDesde: new Date("2026-01-01T00:00:00Z") } },
    },
  });
}

export async function materialDePrueba(costo: string, unidad = "und") {
  return prisma.material.create({
    data: { codigo: unico("MAT"), descripcion: unico("Material"), unidad, categoria: "Pruebas", costoReferencia: costo },
  });
}

export async function clienteDePrueba() {
  return prisma.cliente.create({ data: { nombre: unico("Cliente") } });
}

export async function etapa(nombre: string) {
  return prisma.etapa.findUniqueOrThrow({ where: { nombre } });
}
