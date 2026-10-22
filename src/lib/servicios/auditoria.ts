import type { UsuarioActual } from "@/lib/auth/permisos";
import type { Tx } from "./util";

function aTexto(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return v.toString?.() === "[object Object]" ? JSON.stringify(v) : String(v);
  return String(v);
}

/**
 * Registra en Auditoria cada campo que cambió entre `antes` y `despues`.
 * Si `antes` es null se registra la creación; si `despues` es null, la eliminación.
 */
export async function auditar(
  tx: Tx,
  usuario: UsuarioActual | null,
  entidad: string,
  entidadId: string,
  antes: Record<string, unknown> | null,
  despues: Record<string, unknown> | null,
  campos?: string[],
) {
  const claves = campos ?? Object.keys({ ...(antes ?? {}), ...(despues ?? {}) });
  const filas = [];
  for (const campo of claves) {
    if (["modificadoEn", "creadoEn", "id"].includes(campo)) continue;
    const a = antes ? aTexto(antes[campo]) : null;
    const b = despues ? aTexto(despues[campo]) : null;
    if (a === b) continue;
    filas.push({
      entidad,
      entidadId,
      campo: antes === null ? `${campo} (creación)` : despues === null ? `${campo} (eliminación)` : campo,
      valorAnterior: a,
      valorNuevo: b,
      usuarioId: usuario?.id ?? null,
      usuarioNombre: usuario?.nombre ?? null,
    });
  }
  if (filas.length) await tx.auditoria.createMany({ data: filas });
}
