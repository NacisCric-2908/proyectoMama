import Link from "next/link";
import { requerirPagina, tiene } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import { d, formatearCantidad, formatearFecha, formatearPesos, hoyBogota } from "@/lib/costeo";
import { inventarioActual } from "@/lib/servicios/inventario";
import { FormularioAccion } from "@/components/FormularioAccion";
import { Boton, Campo, Entrada, Selector, Tarjeta, Titulo } from "@/components/ui";
import { accionAjuste, accionEntrada } from "./acciones";

export default async function Inventario() {
  const u = await requerirPagina("inventario.gestionar", "costos.ver");
  const filas = await inventarioActual(prisma);
  const total = filas.reduce((a, f) => a.plus(d(f.valor)), d(0));
  const puede = tiene(u, "inventario.gestionar");
  const opciones = filas
    .filter((f) => f.material.activo)
    .map((f) => (
      <option key={f.material.id} value={f.material.id}>
        {f.material.codigo} · {f.material.descripcion} ({f.material.unidad})
      </option>
    ));

  return (
    <div className="flex flex-col gap-4">
      <Titulo>Inventario de materiales (kárdex)</Titulo>
      <p className="text-sm text-tenue">
        Inventario perpetuo valorado por <strong>promedio ponderado</strong> (fórmula de costo de la Sección 13 de la NIIF para las PYMES). Las salidas a órdenes se valoran al
        promedio vigente y las devoluciones al costo con que salieron. Los movimientos no se editan ni se borran: se corrigen con devoluciones o ajustes, y no se admiten
        fechas anteriores al último movimiento del material.
      </p>
      <Tarjeta titulo="Existencias" acciones={<span className="text-sm">Valor total del inventario: <strong>{formatearPesos(total)}</strong></span>}>
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th>Und</th>
                <th className="num">Saldo</th>
                <th className="num">Costo promedio</th>
                <th className="num">Valor</th>
                <th>Último movimiento</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.material.id}>
                  <td>
                    <Link href={`/inventario/${f.material.id}`} className="font-medium text-primario hover:underline">
                      {f.material.codigo}
                    </Link>
                  </td>
                  <td>{f.material.descripcion}</td>
                  <td>{f.material.unidad}</td>
                  <td className="num">{formatearCantidad(f.cantidad)}</td>
                  <td className="num">{f.costoPromedio ? formatearPesos(f.costoPromedio) : <span className="text-tenue">Sin movimientos</span>}</td>
                  <td className="num">{formatearPesos(f.valor)}</td>
                  <td>{formatearFecha(f.ultimaFecha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>
      {puede && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Tarjeta titulo="Registrar entrada (compra)">
            <FormularioAccion accion={accionEntrada} reiniciar className="grid items-end gap-3 sm:grid-cols-2">
              <Campo etiqueta="Material" className="sm:col-span-2">
                <Selector name="materialId" required>
                  <option value="">— Seleccione —</option>
                  {opciones}
                </Selector>
              </Campo>
              <Campo etiqueta="Fecha">
                <Entrada type="date" name="fecha" required defaultValue={hoyBogota()} />
              </Campo>
              <Campo etiqueta="Cantidad">
                <Entrada name="cantidad" inputMode="decimal" required />
              </Campo>
              <Campo etiqueta="Costo unitario de adquisición">
                <Entrada name="costoUnitario" inputMode="decimal" required />
              </Campo>
              <Campo etiqueta="Factura u orden de compra">
                <Entrada name="documento" />
              </Campo>
              <Campo etiqueta="Proveedor" className="sm:col-span-2">
                <Entrada name="tercero" />
              </Campo>
              <Boton>Registrar entrada</Boton>
            </FormularioAccion>
          </Tarjeta>
          <Tarjeta titulo="Ajuste por inventario físico">
            <FormularioAccion accion={accionAjuste} reiniciar className="grid items-end gap-3 sm:grid-cols-2">
              <Campo etiqueta="Material" className="sm:col-span-2">
                <Selector name="materialId" required>
                  <option value="">— Seleccione —</option>
                  {opciones}
                </Selector>
              </Campo>
              <Campo etiqueta="Tipo">
                <Selector name="tipo">
                  <option value="AJUSTE_NEGATIVO">Faltante (ajuste negativo)</option>
                  <option value="AJUSTE_POSITIVO">Sobrante (ajuste positivo)</option>
                </Selector>
              </Campo>
              <Campo etiqueta="Fecha">
                <Entrada type="date" name="fecha" required defaultValue={hoyBogota()} />
              </Campo>
              <Campo etiqueta="Cantidad">
                <Entrada name="cantidad" inputMode="decimal" required />
              </Campo>
              <Campo etiqueta="Costo unitario (solo sobrantes)" ayuda="Vacío = costo promedio">
                <Entrada name="costoUnitario" inputMode="decimal" />
              </Campo>
              <Campo etiqueta="Motivo" className="sm:col-span-2">
                <Entrada name="observaciones" required placeholder="Conteo físico del…" />
              </Campo>
              <Boton variante="secundario">Registrar ajuste</Boton>
            </FormularioAccion>
          </Tarjeta>
        </div>
      )}
      <p className="text-xs text-tenue">Las requisiciones (salidas) y devoluciones se registran desde la pestaña Materiales de cada orden.</p>
    </div>
  );
}
