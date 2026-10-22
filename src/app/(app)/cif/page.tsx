import Link from "next/link";
import { requerirPagina } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import { ACTIVIDADES_CIF, BASES_CIF, formatearCantidad, formatearPesos, hoyBogota, type ActividadCIF, type BaseCIF } from "@/lib/costeo";
import { tasaDelParametro } from "@/lib/servicios/cif";
import { FormularioAccion } from "@/components/FormularioAccion";
import { AreaTexto, Boton, Campo, Entrada, Selector, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { accionGuardarParametroCIF } from "./acciones";

export default async function CIF() {
  await requerirPagina("cif.configurar", "cif.conciliar");
  const [parametros, generales, vigentes] = await Promise.all([
    prisma.parametroCIF.findMany({ orderBy: { periodo: "desc" }, include: { tasasActividad: true } }),
    prisma.parametrosGenerales.findUnique({ where: { id: 1 } }),
    prisma.conciliacionCIF.findMany({ where: { anuladaEn: null }, select: { periodo: true } }),
  ]);
  const conciliados = new Set(vigentes.map((v) => v.periodo));
  const filas = await Promise.all(
    parametros.map(async (p) => {
      try {
        return { p, ...(await tasaDelParametro(prisma, p)), error: null };
      } catch (e) {
        return { p, tasa: null, detalle: null, tasasActividad: null, error: (e as Error).message };
      }
    }),
  );
  const tasaTexto = (base: BaseCIF, t: string) => (BASES_CIF[base].esPorcentaje ? `${formatearCantidad(t)} %` : formatearPesos(t));

  return (
    <div className="flex flex-col gap-4">
      <Titulo>Costos indirectos de fabricación por período</Titulo>
      <Tarjeta titulo="Configurar período">
        <FormularioAccion accion={accionGuardarParametroCIF} className="grid items-end gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Campo etiqueta="Período">
            <Entrada type="month" name="periodo" required defaultValue={hoyBogota().slice(0, 7)} />
          </Campo>
          <Campo etiqueta="Base de asignación" className="lg:col-span-2">
            <Selector name="base" defaultValue={generales?.baseCifDefecto}>
              {Object.entries(BASES_CIF).map(([k, b]) => (
                <option key={k} value={k}>
                  {b.nombre} ({b.unidadTasa})
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Tasa directa" ayuda="$/hora, % o $/proyecto">
            <Entrada name="tasaDirecta" inputMode="decimal" />
          </Campo>
          <Campo etiqueta="CIF presupuestado del período">
            <Entrada name="cifPresupuestado" inputMode="decimal" />
          </Campo>
          <Campo etiqueta="Base total estimada" ayuda="Horas, $ o N.º de proyectos">
            <Entrada name="baseEstimada" inputMode="decimal" />
          </Campo>
          <fieldset className="rounded-md border border-borde p-3 sm:col-span-3 lg:col-span-6">
            <legend className="px-1 text-sm font-medium">Tasas por actividad (solo para la base «Tasas diferenciadas por actividad»)</legend>
            <div className="grid gap-2 text-sm">
              <div className="hidden grid-cols-4 gap-2 font-medium text-tenue sm:grid">
                <span>Actividad e inductor</span>
                <span>Tasa directa</span>
                <span>CIF presupuestado de la actividad</span>
                <span>Inductor estimado</span>
              </div>
              {(Object.keys(ACTIVIDADES_CIF) as ActividadCIF[]).map((a) => (
                <div key={a} className="grid gap-2 sm:grid-cols-4">
                  <span>
                    {ACTIVIDADES_CIF[a].nombre}
                    <span className="block text-xs text-tenue">
                      {ACTIVIDADES_CIF[a].inductor} · {ACTIVIDADES_CIF[a].unidadTasa}
                    </span>
                  </span>
                  <Entrada name={`act_${a}_tasaDirecta`} inputMode="decimal" aria-label={`Tasa directa ${ACTIVIDADES_CIF[a].nombre}`} />
                  <Entrada name={`act_${a}_cifPresupuestado`} inputMode="decimal" aria-label={`CIF presupuestado ${ACTIVIDADES_CIF[a].nombre}`} />
                  <Entrada name={`act_${a}_baseEstimada`} inputMode="decimal" aria-label={`Inductor estimado ${ACTIVIDADES_CIF[a].nombre}`} />
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-tenue">
              Asignación diferenciada (enfoque híbrido de órdenes con elementos de costeo por actividades): cada actividad reparte su propio CIF con su inductor. Deje vacías las
              actividades que no use.
            </p>
          </fieldset>
          <Campo etiqueta="Observaciones" className="sm:col-span-3 lg:col-span-5">
            <AreaTexto name="observaciones" />
          </Campo>
          <div>
            <Boton>Guardar</Boton>
          </div>
        </FormularioAccion>
        <p className="mt-3 text-xs text-tenue">
          Ingrese la tasa directamente, o el CIF presupuestado y la base estimada para calcular la tasa predeterminada (CIF ÷ base). Ejemplo del Excel actual: base Costo de MOD con tasa 20 %.
          Para «Número de proyectos» la tasa es el CIF del período ÷ las órdenes terminadas en el mes (o la base estimada si aún no hay).
        </p>
      </Tarjeta>
      <Tarjeta titulo="Períodos configurados" acciones={<span className="text-xs text-tenue">Abra un período para registrar el CIF real y conciliarlo</span>}>
        {filas.length === 0 ? (
          <Vacio>No hay períodos configurados.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Base</th>
                  <th className="num">CIF presupuestado</th>
                  <th className="num">Base estimada</th>
                  <th className="num">Tasa vigente</th>
                  <th>Origen</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(({ p, tasa, detalle, error, tasasActividad }) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/cif/${p.periodo}`} className="font-medium text-primario hover:underline">
                        {p.periodo}
                      </Link>
                      {conciliados.has(p.periodo) && <div className="text-xs text-exito">Conciliado</div>}
                    </td>
                    <td>{BASES_CIF[p.base as BaseCIF].nombre}</td>
                    <td className="num">{p.cifPresupuestado ? formatearPesos(p.cifPresupuestado.toString()) : "—"}</td>
                    <td className="num">{p.baseEstimada ? formatearCantidad(p.baseEstimada.toString()) : "—"}</td>
                    <td className="num">
                      {error ? (
                        <span className="text-peligro">{error}</span>
                      ) : tasasActividad ? (
                        tasasActividad.map((t) => (
                          <div key={t.actividad} className="text-xs">
                            {ACTIVIDADES_CIF[t.actividad].nombre}: {ACTIVIDADES_CIF[t.actividad].esPorcentaje ? `${formatearCantidad(t.tasa)} %` : formatearPesos(t.tasa)}
                          </div>
                        ))
                      ) : (
                        tasa && tasaTexto(p.base as BaseCIF, tasa)
                      )}
                    </td>
                    <td className="text-tenue">{detalle}</td>
                    <td>{p.observaciones}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
