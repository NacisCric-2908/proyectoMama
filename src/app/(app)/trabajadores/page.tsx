import type { Trabajador } from "@prisma/client";
import { requerirPagina } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import { formatearFecha, formatearPesos, hoyBogota } from "@/lib/costeo";
import { aISO } from "@/lib/servicios/util";
import { FormularioAccion } from "@/components/FormularioAccion";
import { EliminarCatalogo } from "@/components/EliminarCatalogo";
import { Boton, Campo, Entrada, Selector, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { accionGuardarTrabajador, accionNuevaTarifa } from "../catalogos-acciones";

const TIPOS = { FABRICACION: "Fabricación", INGENIERIA: "Ingeniería", AMBOS: "Ambos" };

function Campos({ t }: { t?: Trabajador }) {
  return (
    <>
      {t && <input type="hidden" name="id" value={t.id} />}
      <Campo etiqueta="Nombre">
        <Entrada name="nombre" required defaultValue={t?.nombre} />
      </Campo>
      <Campo etiqueta="Documento">
        <Entrada name="documento" defaultValue={t?.documento ?? ""} />
      </Campo>
      <Campo etiqueta="Cargo">
        <Entrada name="cargo" required defaultValue={t?.cargo} placeholder="Ensamblador, técnico, ingeniero…" />
      </Campo>
      <Campo etiqueta="Tipo">
        <Selector name="tipo" defaultValue={t?.tipo ?? "FABRICACION"}>
          {Object.entries(TIPOS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Selector>
      </Campo>
      <Campo etiqueta="Estado">
        <Selector name="activo" defaultValue={t && !t.activo ? "false" : "true"}>
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </Selector>
      </Campo>
    </>
  );
}

export default async function Trabajadores() {
  await requerirPagina("trabajadores.gestionar");
  const trabajadores = await prisma.trabajador.findMany({
    where: { eliminadoEn: null },
    include: { tarifas: { orderBy: { vigenteDesde: "desc" } } },
    orderBy: { nombre: "asc" },
  });
  return (
    <div className="flex flex-col gap-4">
      <Titulo>Trabajadores y tarifas</Titulo>
      <p className="text-sm text-tenue">
        El costo hora debe ser el costo «cargado» para la empresa (salario + prestaciones + seguridad social + parafiscales ÷ horas laborables). Al cambiar la tarifa se conserva el historial; los registros de horas guardan la tarifa vigente en su fecha.
      </p>
      {trabajadores.length === 0 && <Vacio>No hay trabajadores.</Vacio>}
      <div className="grid gap-4 lg:grid-cols-2">
        {trabajadores.map((t) => (
          <Tarjeta
            key={t.id}
            titulo={`${t.nombre} · ${t.cargo}`}
            acciones={<span className="text-xs text-tenue">{TIPOS[t.tipo]} · {t.activo ? "Activo" : "Inactivo"}</span>}
          >
            <table className="tabla">
              <thead>
                <tr>
                  <th>Vigente desde</th>
                  <th>Hasta</th>
                  <th className="num">Costo hora</th>
                </tr>
              </thead>
              <tbody>
                {t.tarifas.map((x) => (
                  <tr key={x.id}>
                    <td>{formatearFecha(aISO(x.vigenteDesde))}</td>
                    <td>{x.vigenteHasta ? formatearFecha(aISO(x.vigenteHasta)) : "Vigente"}</td>
                    <td className="num">{formatearPesos(x.costoHora.toString())}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <FormularioAccion accion={accionNuevaTarifa} reiniciar className="mt-3 grid items-end gap-2 sm:grid-cols-3">
              <input type="hidden" name="trabajadorId" value={t.id} />
              <Campo etiqueta="Nuevo costo hora">
                <Entrada name="costoHora" inputMode="decimal" required />
              </Campo>
              <Campo etiqueta="Vigente desde">
                <Entrada type="date" name="vigenteDesde" required defaultValue={hoyBogota()} />
              </Campo>
              <Boton variante="secundario">Registrar tarifa</Boton>
            </FormularioAccion>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-primario">Editar datos</summary>
              <FormularioAccion accion={accionGuardarTrabajador} className="mt-2 grid items-end gap-2 sm:grid-cols-3">
                <Campos t={t} />
                <Boton>Guardar</Boton>
              </FormularioAccion>
            </details>
            <div className="mt-2">
              <EliminarCatalogo tipo="trabajador" id={t.id} />
            </div>
          </Tarjeta>
        ))}
      </div>
      <Tarjeta titulo="Nuevo trabajador">
        <FormularioAccion accion={accionGuardarTrabajador} reiniciar className="grid items-end gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Campos />
          <Boton>Crear trabajador</Boton>
        </FormularioAccion>
        <p className="mt-2 text-xs text-tenue">Después de crearlo, registre su tarifa. Los datos personales se tratan conforme a la Ley 1581 de 2012.</p>
      </Tarjeta>
    </div>
  );
}
