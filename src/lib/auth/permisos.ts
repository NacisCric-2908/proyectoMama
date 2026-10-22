/** Catálogo de permisos. La matriz por rol es configurable por el administrador (tabla Permiso). */
export const PERMISOS = {
  "usuarios.gestionar": "Gestionar usuarios y permisos",
  "parametros.gestionar": "Gestionar parámetros generales y etapas",
  "materiales.gestionar": "Gestionar catálogo de materiales",
  "clientes.gestionar": "Gestionar clientes",
  "trabajadores.gestionar": "Gestionar trabajadores y tarifas",
  "cif.configurar": "Configurar CIF por período",
  "cif.asignar": "Asignar y recalcular CIF en órdenes",
  "ordenes.verTodas": "Ver todas las órdenes",
  "ordenes.verPropias": "Ver las órdenes de las que es responsable",
  "ordenes.verAsignadas": "Ver las órdenes a las que está asignado como técnico",
  "ordenes.editar": "Crear y editar órdenes, materiales, MOD e ingeniería",
  "ordenes.cambiarEstado": "Cambiar el estado de las órdenes",
  "ordenes.cerrar": "Cerrar órdenes (pasar a Terminado) y registrar facturación",
  "ordenes.reabrir": "Reabrir órdenes cerradas",
  "costos.ver": "Ver costos de materiales, tarifas y totales",
  "margenes.ver": "Ver valor cotizado y márgenes",
  "horas.registrarPropias": "Registrar sus propias horas",
  "tarifas.editarEnRegistro": "Modificar la tarifa al registrar horas",
  "auditoria.ver": "Ver auditoría",
} as const;

export type ClavePermiso = keyof typeof PERMISOS;
export type ClaveRol = "ADMINISTRADOR" | "CONTADOR" | "COORDINADOR" | "TECNICO" | "GERENCIA";

export const ROLES: Record<ClaveRol, string> = {
  ADMINISTRADOR: "Administrador",
  CONTADOR: "Contador",
  COORDINADOR: "Coordinador de proyectos",
  TECNICO: "Ingeniero / Técnico",
  GERENCIA: "Gerencia (solo lectura)",
};

const todos = Object.keys(PERMISOS) as ClavePermiso[];

/** Matriz por defecto (sección 3). Se usa en la semilla. */
export const PERMISOS_POR_ROL: Record<ClaveRol, ClavePermiso[]> = {
  ADMINISTRADOR: todos,
  CONTADOR: [
    "cif.configurar",
    "cif.asignar",
    "ordenes.verTodas",
    "ordenes.cambiarEstado",
    "ordenes.cerrar",
    "costos.ver",
    "margenes.ver",
    "auditoria.ver",
  ],
  COORDINADOR: [
    "clientes.gestionar",
    "materiales.gestionar",
    "ordenes.verPropias",
    "ordenes.editar",
    "ordenes.cambiarEstado",
    "costos.ver",
    "margenes.ver",
    "tarifas.editarEnRegistro",
  ],
  TECNICO: ["ordenes.verAsignadas", "horas.registrarPropias"],
  GERENCIA: ["ordenes.verTodas", "costos.ver", "margenes.ver", "auditoria.ver"],
};

export interface UsuarioActual {
  id: string;
  nombre: string;
  email: string;
  rol: ClaveRol;
  rolNombre: string;
  trabajadorId: string | null;
  permisos: Set<ClavePermiso>;
}

export class ErrorPermiso extends Error {
  constructor(mensaje = "No tiene permiso para realizar esta acción") {
    super(mensaje);
    this.name = "ErrorPermiso";
  }
}

export function tiene(u: UsuarioActual, permiso: ClavePermiso): boolean {
  // El administrador conserva siempre todos los permisos (evita quedar bloqueado).
  return u.rol === "ADMINISTRADOR" || u.permisos.has(permiso);
}

export function exigir(u: UsuarioActual, ...permisos: ClavePermiso[]): void {
  if (!permisos.some((p) => tiene(u, p))) throw new ErrorPermiso();
}
