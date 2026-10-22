import type { Cliente } from "@prisma/client";
import { requerirPagina } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import { FormularioAccion } from "@/components/FormularioAccion";
import { EliminarCatalogo } from "@/components/EliminarCatalogo";
import { Boton, Campo, Entrada, Selector, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { accionGuardarCliente } from "../catalogos-acciones";

function Campos({ c }: { c?: Cliente }) {
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <Campo etiqueta="Nombre o razón social" className="sm:col-span-2">
        <Entrada name="nombre" required defaultValue={c?.nombre} />
      </Campo>
      <Campo etiqueta="NIT / cédula">
        <Entrada name="nit" defaultValue={c?.nit ?? ""} />
      </Campo>
      <Campo etiqueta="Contacto">
        <Entrada name="contacto" defaultValue={c?.contacto ?? ""} />
      </Campo>
      <Campo etiqueta="Teléfono">
        <Entrada name="telefono" defaultValue={c?.telefono ?? ""} />
      </Campo>
      <Campo etiqueta="Correo">
        <Entrada name="correo" type="email" defaultValue={c?.correo ?? ""} />
      </Campo>
      <Campo etiqueta="Ciudad">
        <Entrada name="ciudad" defaultValue={c?.ciudad ?? ""} />
      </Campo>
      <Campo etiqueta="Estado">
        <Selector name="activo" defaultValue={c && !c.activo ? "false" : "true"}>
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </Selector>
      </Campo>
    </>
  );
}

export default async function Clientes() {
  await requerirPagina("clientes.gestionar");
  const clientes = await prisma.cliente.findMany({ where: { eliminadoEn: null }, orderBy: { nombre: "asc" } });
  return (
    <div className="flex flex-col gap-4">
      <Titulo>Clientes</Titulo>
      <Tarjeta>
        {clientes.length === 0 ? (
          <Vacio>No hay clientes.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>NIT</th>
                  <th>Contacto</th>
                  <th>Teléfono</th>
                  <th>Correo</th>
                  <th>Ciudad</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id}>
                    <td>{c.nombre}</td>
                    <td>{c.nit}</td>
                    <td>{c.contacto}</td>
                    <td>{c.telefono}</td>
                    <td>{c.correo}</td>
                    <td>{c.ciudad}</td>
                    <td>{c.activo ? "Activo" : "Inactivo"}</td>
                    <td>
                      <details>
                        <summary className="cursor-pointer text-xs text-primario">Editar</summary>
                        <FormularioAccion accion={accionGuardarCliente} className="mt-2 grid min-w-[40rem] items-end gap-2 sm:grid-cols-3">
                          <Campos c={c} />
                          <Boton>Guardar</Boton>
                        </FormularioAccion>
                      </details>
                      <EliminarCatalogo tipo="cliente" id={c.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
      <Tarjeta titulo="Nuevo cliente">
        <FormularioAccion accion={accionGuardarCliente} reiniciar className="grid items-end gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Campos />
          <Boton>Crear cliente</Boton>
        </FormularioAccion>
        <p className="mt-2 text-xs text-tenue">Los datos personales se tratan conforme a la Ley 1581 de 2012.</p>
      </Tarjeta>
    </div>
  );
}
