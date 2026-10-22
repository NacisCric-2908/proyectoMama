import type { Material } from "@prisma/client";
import { requerirPagina } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import { formatearPesos } from "@/lib/costeo";
import { CATEGORIAS_MATERIAL } from "@/lib/servicios/catalogos";
import { FormularioAccion } from "@/components/FormularioAccion";
import { EliminarCatalogo } from "@/components/EliminarCatalogo";
import { Boton, Campo, Entrada, Selector, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { accionGuardarMaterial } from "../catalogos-acciones";

function Campos({ m }: { m?: Material }) {
  return (
    <>
      {m && <input type="hidden" name="id" value={m.id} />}
      <Campo etiqueta="Código">
        <Entrada name="codigo" required defaultValue={m?.codigo} />
      </Campo>
      <Campo etiqueta="Descripción" className="sm:col-span-2">
        <Entrada name="descripcion" required defaultValue={m?.descripcion} />
      </Campo>
      <Campo etiqueta="Unidad">
        <Entrada name="unidad" required defaultValue={m?.unidad} placeholder="und, m, kg…" />
      </Campo>
      <Campo etiqueta="Categoría">
        <Selector name="categoria" defaultValue={m?.categoria}>
          {[...new Set([...CATEGORIAS_MATERIAL, ...(m ? [m.categoria] : [])])].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Selector>
      </Campo>
      <Campo etiqueta="Costo unitario de referencia">
        <Entrada name="costoReferencia" inputMode="decimal" required defaultValue={m?.costoReferencia.toString()} />
      </Campo>
      <Campo etiqueta="Estado">
        <Selector name="activo" defaultValue={m && !m.activo ? "false" : "true"}>
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </Selector>
      </Campo>
    </>
  );
}

export default async function Materiales({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requerirPagina("materiales.gestionar");
  const { q } = await searchParams;
  const materiales = await prisma.material.findMany({
    where: {
      eliminadoEn: null,
      ...(q ? { OR: [{ codigo: { contains: q, mode: "insensitive" } }, { descripcion: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { codigo: "asc" },
  });
  return (
    <div className="flex flex-col gap-4">
      <Titulo>Catálogo de materiales</Titulo>
      <Tarjeta>
        <form className="mb-3 flex gap-2">
          <Entrada name="q" defaultValue={q} placeholder="Buscar por código o descripción" className="max-w-sm" />
          <Boton variante="secundario">Buscar</Boton>
        </form>
        <p className="mb-3 text-xs text-tenue">
          El costo de referencia se copia a la orden al agregar el material; los cambios posteriores en el catálogo no afectan las órdenes existentes.
        </p>
        {materiales.length === 0 ? (
          <Vacio>No hay materiales.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Unidad</th>
                  <th>Categoría</th>
                  <th className="num">Costo de referencia</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {materiales.map((m) => (
                  <tr key={m.id}>
                    <td>{m.codigo}</td>
                    <td>{m.descripcion}</td>
                    <td>{m.unidad}</td>
                    <td>{m.categoria}</td>
                    <td className="num">{formatearPesos(m.costoReferencia.toString())}</td>
                    <td>{m.activo ? "Activo" : "Inactivo"}</td>
                    <td>
                      <details>
                        <summary className="cursor-pointer text-xs text-primario">Editar</summary>
                        <FormularioAccion accion={accionGuardarMaterial} className="mt-2 grid min-w-[40rem] items-end gap-2 sm:grid-cols-4">
                          <Campos m={m} />
                          <Boton>Guardar</Boton>
                        </FormularioAccion>
                      </details>
                      <EliminarCatalogo tipo="material" id={m.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
      <Tarjeta titulo="Nuevo material">
        <FormularioAccion accion={accionGuardarMaterial} reiniciar className="grid items-end gap-3 sm:grid-cols-4">
          <Campos />
          <Boton>Crear material</Boton>
        </FormularioAccion>
      </Tarjeta>
    </div>
  );
}
