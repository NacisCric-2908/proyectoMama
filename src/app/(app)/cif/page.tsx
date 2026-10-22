import { requerirPagina } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import { BASES_CIF, formatearCantidad, formatearPesos, hoyBogota, type BaseCIF } from "@/lib/costeo";
import { tasaDelParametro } from "@/lib/servicios/cif";
import { FormularioAccion } from "@/components/FormularioAccion";
import { AreaTexto, Boton, Campo, Entrada, Selector, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { accionGuardarParametroCIF } from "./acciones";

export default async function CIF() {
  await requerirPagina("cif.configurar");
  const [parametros, generales] = await Promise.all([
    prisma.parametroCIF.findMany({ orderBy: { periodo: "desc" } }),
    prisma.parametrosGenerales.findUnique({ where: { id: 1 } }),
  ]);
  const filas = await Promise.all(
    parametros.map(async (p) => {
      try {
        return { p, ...(await tasaDelParametro(prisma, p)), error: null };
      } catch (e) {
        return { p, tasa: null, detalle: null, error: (e as Error).message };
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
      <Tarjeta titulo="Períodos configurados">
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
                {filas.map(({ p, tasa, detalle, error }) => (
                  <tr key={p.id}>
                    <td>{p.periodo}</td>
                    <td>{BASES_CIF[p.base as BaseCIF].nombre}</td>
                    <td className="num">{p.cifPresupuestado ? formatearPesos(p.cifPresupuestado.toString()) : "—"}</td>
                    <td className="num">{p.baseEstimada ? formatearCantidad(p.baseEstimada.toString()) : "—"}</td>
                    <td className="num">{tasa ? tasaTexto(p.base as BaseCIF, tasa) : <span className="text-peligro">{error}</span>}</td>
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
