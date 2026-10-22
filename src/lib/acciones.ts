import "server-only";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { ErrorCosteo } from "@/lib/costeo";
import { ErrorPermiso } from "@/lib/auth/permisos";
import { ErrorNegocio } from "@/lib/servicios/util";

export type ResultadoAccion = { ok: boolean; mensaje?: string; error?: string; detalles?: string[]; advertencia?: string | null };

/**
 * Ejecuta una acción del servidor y traduce los errores de negocio/permiso
 * a un mensaje en español. Los demás errores se registran y se ocultan.
 */
export async function ejecutar(
  fn: () => Promise<{ mensaje?: string; advertencia?: string | null } | void>,
  revalidar: string[] = [],
): Promise<ResultadoAccion> {
  try {
    const r = (await fn()) ?? {};
    revalidar.forEach((p) => revalidatePath(p));
    return { ok: true, mensaje: r.mensaje ?? "Cambios guardados", advertencia: r.advertencia ?? null };
  } catch (e) {
    if (e instanceof ErrorNegocio) return { ok: false, error: e.message, detalles: e.detalles };
    if (e instanceof ErrorPermiso || e instanceof ErrorCosteo) return { ok: false, error: e.message };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { ok: false, error: "Ya existe un registro con ese valor único (por ejemplo, el código)" };
    console.error(e);
    return { ok: false, error: "Ocurrió un error inesperado. Intente de nuevo" };
  }
}

/** FormData → objeto plano (los campos repetidos se vuelven arreglos con `[]` en el nombre). */
export function datosDe(fd: FormData): Record<string, string | string[]> {
  const r: Record<string, string | string[]> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string" || k.startsWith("$ACTION")) continue;
    if (k.endsWith("[]")) {
      const clave = k.slice(0, -2);
      r[clave] = [...((r[clave] as string[]) ?? []), v];
    } else r[k] = v;
  }
  return r;
}
