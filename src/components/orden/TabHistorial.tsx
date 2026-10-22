import { prisma } from "@/lib/db";
import { NOMBRE_ESTADO, ZONA_HORARIA, type EstadoOrden } from "@/lib/costeo";
import type { OrdenCompleta } from "@/lib/servicios/ordenes";
import { Tarjeta, Vacio } from "@/components/ui";

const fechaHora = (f: Date) =>
  new Intl.DateTimeFormat("es-CO", { timeZone: ZONA_HORARIA, dateStyle: "short", timeStyle: "short" }).format(f);

export async function TabHistorial({ orden, verAuditoria }: { orden: OrdenCompleta; verAuditoria: boolean }) {
  const ids = [orden.id, ...orden.materiales.map((m) => m.id), ...orden.registrosMOD.map((r) => r.id), ...orden.registrosIng.map((r) => r.id), ...orden.servicios.map((s) => s.id)];
  const auditoria = verAuditoria
    ? await prisma.auditoria.findMany({ where: { entidadId: { in: ids } }, orderBy: { fecha: "desc" }, take: 300 })
    : [];
  return (
    <div className="flex flex-col gap-4">
      <Tarjeta titulo="Historial de estados">
        <table className="tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cambio</th>
              <th>Usuario</th>
              <th>Comentario</th>
            </tr>
          </thead>
          <tbody>
            {orden.historial.map((h) => (
              <tr key={h.id}>
                <td className="whitespace-nowrap">{fechaHora(h.fecha)}</td>
                <td>
                  {h.estadoAnterior ? `${NOMBRE_ESTADO[h.estadoAnterior as EstadoOrden]} → ` : ""}
                  {NOMBRE_ESTADO[h.estadoNuevo as EstadoOrden]}
                </td>
                <td>{h.usuarioNombre}</td>
                <td>{h.comentario}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>
      {verAuditoria && (
        <Tarjeta titulo="Auditoría de cambios">
          {auditoria.length === 0 ? (
            <Vacio>Sin registros de auditoría.</Vacio>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Entidad</th>
                    <th>Campo</th>
                    <th>Anterior</th>
                    <th>Nuevo</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {auditoria.map((a) => (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap">{fechaHora(a.fecha)}</td>
                      <td>{a.entidad}</td>
                      <td>{a.campo}</td>
                      <td className="max-w-48 truncate">{a.valorAnterior}</td>
                      <td className="max-w-48 truncate">{a.valorNuevo}</td>
                      <td>{a.usuarioNombre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>
      )}
    </div>
  );
}
