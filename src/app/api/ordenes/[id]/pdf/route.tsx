import { renderToBuffer } from "@react-pdf/renderer";
import { obtenerUsuario, tiene } from "@/lib/auth/sesion";
import { ErrorPermiso } from "@/lib/auth/permisos";
import { prisma } from "@/lib/db";
import type { EstadoOrden } from "@/lib/costeo";
import { InformePDF } from "@/lib/pdf/InformePDF";
import { cargarOrden, puedeVerOrden, resumenOrden, type ResumenSerializado, type SnapshotCierre } from "@/lib/servicios/ordenes";
import { ErrorNegocio } from "@/lib/servicios/util";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await obtenerUsuario();
  if (!u) return new Response("Sesión expirada", { status: 401 });
  if (!tiene(u, "costos.ver")) return new Response("No tiene permiso", { status: 403 });
  const { id } = await params;
  try {
    const orden = await cargarOrden(prisma, id);
    if (!puedeVerOrden(u, orden)) throw new ErrorPermiso();
    const [r, p] = await Promise.all([resumenOrden(prisma, orden), prisma.parametrosGenerales.findUnique({ where: { id: 1 } })]);
    const snap = orden.snapshotCierre as unknown as SnapshotCierre | null;
    const pdf = await renderToBuffer(
      <InformePDF
        empresa={p?.nombreEmpresa ?? ""}
        logo={p?.logo ?? null}
        codigo={orden.codigo}
        cliente={orden.cliente?.nombre ?? "Sin cliente"}
        descripcion={orden.descripcion}
        estado={orden.estado as EstadoOrden}
        r={r}
        estimado={orden.estimadoAlCotizar as unknown as ResumenSerializado | null}
        verMargen={tiene(u, "margenes.ver")}
        cierre={snap ? { cerradoEn: snap.cerradoEn, cerradoPor: snap.cerradoPor } : null}
      />,
    );
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="informe-${orden.codigo}.pdf"`,
      },
    });
  } catch (e) {
    if (e instanceof ErrorPermiso) return new Response(e.message, { status: 403 });
    if (e instanceof ErrorNegocio) return new Response(e.message, { status: 404 });
    throw e;
  }
}
