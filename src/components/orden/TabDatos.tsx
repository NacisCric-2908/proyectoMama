import { prisma } from "@/lib/db";
import { tiene, type UsuarioActual } from "@/lib/auth/permisos";
import { formatearFecha } from "@/lib/costeo";
import type { OrdenCompleta } from "@/lib/servicios/ordenes";
import { aISO, txt } from "@/lib/servicios/util";
import { FormularioAccion } from "@/components/FormularioAccion";
import { Boton, Tarjeta } from "@/components/ui";
import { CamposOrden } from "./CamposOrden";
import { ClienteRapido } from "./ClienteRapido";
import { accionActualizarOrden } from "@/app/(app)/ordenes/acciones";

export async function TabDatos({ orden, usuario, editable }: { orden: OrdenCompleta; usuario: UsuarioActual; editable: boolean }) {
  const [clientes, responsables, trabajadores] = await Promise.all([
    prisma.cliente.findMany({ where: { eliminadoEn: null }, orderBy: { nombre: "asc" } }),
    prisma.usuario.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.trabajador.findMany({ where: { eliminadoEn: null }, orderBy: { nombre: "asc" } }),
  ]);
  const campos = (
    <CamposOrden
      v={{
        codigo: orden.codigo,
        clienteId: orden.clienteId,
        descripcion: orden.descripcion,
        cantidadUnidades: orden.cantidadUnidades.toString(),
        fechaEstimadaEntrega: aISO(orden.fechaEstimadaEntrega),
        responsableId: orden.responsableId,
        valorCotizado: txt(orden.valorCotizado),
        margenEsperadoPct: txt(orden.margenEsperadoPct),
        margenMinimoPct: txt(orden.margenMinimoPct),
        observaciones: orden.observaciones,
        tecnicos: orden.tecnicos.map((t) => t.trabajadorId),
      }}
      clientes={clientes}
      responsables={responsables}
      trabajadores={trabajadores}
      verMargen={tiene(usuario, "margenes.ver")}
      codigoEditable={editable && orden.estado === "BORRADOR"}
    />
  );
  return (
    <div className="flex flex-col gap-4">
      <Tarjeta titulo="Datos generales">
        {editable ? (
          <FormularioAccion accion={accionActualizarOrden.bind(null, orden.id)}>
            {campos}
            <div className="mt-3">
              <Boton>Guardar cambios</Boton>
            </div>
          </FormularioAccion>
        ) : (
          <fieldset disabled>{campos}</fieldset>
        )}
        <dl className="mt-4 grid gap-2 text-sm text-tenue sm:grid-cols-4">
          <div>Creada: {formatearFecha(aISO(orden.fechaCreacion))}</div>
          <div>Terminada: {formatearFecha(aISO(orden.fechaTerminacion)) || "—"}</div>
          <div>Factura: {orden.numeroFactura ? `${orden.numeroFactura} (${formatearFecha(aISO(orden.fechaFactura))})` : "—"}</div>
          <div>Última modificación: {formatearFecha(orden.modificadoEn)}</div>
        </dl>
      </Tarjeta>
      {editable && tiene(usuario, "clientes.gestionar") && <ClienteRapido />}
    </div>
  );
}
