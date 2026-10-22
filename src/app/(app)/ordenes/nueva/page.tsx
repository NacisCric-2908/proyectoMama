import { requerirPagina, tiene } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import { hoyBogota } from "@/lib/costeo";
import { FormularioAccion } from "@/components/FormularioAccion";
import { CamposOrden } from "@/components/orden/CamposOrden";
import { Boton, Tarjeta, Titulo } from "@/components/ui";
import { ClienteRapido } from "@/components/orden/ClienteRapido";
import { accionCrearOrden } from "../acciones";

export default async function NuevaOrden() {
  const u = await requerirPagina("ordenes.editar");
  const [clientes, responsables, trabajadores, p] = await Promise.all([
    prisma.cliente.findMany({ where: { eliminadoEn: null, activo: true }, orderBy: { nombre: "asc" } }),
    prisma.usuario.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.trabajador.findMany({ where: { eliminadoEn: null, activo: true }, orderBy: { nombre: "asc" } }),
    prisma.parametrosGenerales.findUnique({ where: { id: 1 } }),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <Titulo>Nueva orden de proyecto</Titulo>
      <Tarjeta>
        <FormularioAccion accion={accionCrearOrden}>
          <CamposOrden
            nueva
            codigoEditable
            v={{ fechaCreacion: hoyBogota(), responsableId: u.id, margenMinimoPct: p?.margenMinimoGlobal.toString() }}
            clientes={clientes}
            responsables={responsables}
            trabajadores={trabajadores}
            verMargen={tiene(u, "margenes.ver")}
          />
          <p className="mt-3 text-sm text-tenue">
            La orden se guarda como <strong>Borrador</strong>. Para activarla (Cotizado) se exige cliente, descripción, fecha estimada de entrega y valor cotizado.
          </p>
          <div className="mt-3">
            <Boton>Guardar borrador</Boton>
          </div>
        </FormularioAccion>
      </Tarjeta>
      {tiene(u, "clientes.gestionar") && <ClienteRapido />}
    </div>
  );
}
