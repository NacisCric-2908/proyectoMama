import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirPagina } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import { ES_ENTRADA, formatearCantidad, formatearFecha, formatearPesos, NOMBRE_MOVIMIENTO } from "@/lib/costeo";
import { aISO } from "@/lib/servicios/util";
import { Tarjeta, Titulo, Vacio } from "@/components/ui";

export default async function Kardex({ params }: { params: Promise<{ materialId: string }> }) {
  await requerirPagina("inventario.gestionar", "costos.ver");
  const { materialId } = await params;
  const material = await prisma.material.findUnique({ where: { id: materialId } });
  if (!material) notFound();
  const movs = await prisma.movimientoInventario.findMany({
    where: { materialId },
    include: { orden: { select: { id: true, codigo: true } } },
    orderBy: { secuencia: "asc" },
  });
  return (
    <div className="flex flex-col gap-4">
      <Link href="/inventario" className="text-sm text-primario hover:underline">
        ← Inventario
      </Link>
      <Titulo>
        Kárdex · {material.codigo} {material.descripcion} ({material.unidad})
      </Titulo>
      <Tarjeta>
        {movs.length === 0 ? (
          <Vacio>Sin movimientos.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Movimiento</th>
                  <th>Documento / orden</th>
                  <th>Tercero o solicitante</th>
                  <th className="num">Entrada</th>
                  <th className="num">Salida</th>
                  <th className="num">Costo unit.</th>
                  <th className="num">Costo total</th>
                  <th className="num">Saldo</th>
                  <th className="num">Costo promedio</th>
                  <th className="num">Valor saldo</th>
                  <th>Autorizó</th>
                </tr>
              </thead>
              <tbody>
                {movs.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap">{formatearFecha(aISO(m.fecha))}</td>
                    <td>
                      {NOMBRE_MOVIMIENTO[m.tipo]}
                      {m.observaciones && <div className="text-xs text-tenue">{m.observaciones}</div>}
                    </td>
                    <td>
                      {m.documento}
                      {m.orden && (
                        <div>
                          <Link href={`/ordenes/${m.orden.id}?tab=materiales`} className="text-xs text-primario hover:underline">
                            {m.orden.codigo}
                          </Link>
                        </div>
                      )}
                    </td>
                    <td>{m.tercero ?? m.solicitante}</td>
                    <td className="num">{ES_ENTRADA[m.tipo] ? formatearCantidad(m.cantidad.toString()) : ""}</td>
                    <td className="num">{ES_ENTRADA[m.tipo] ? "" : formatearCantidad(m.cantidad.toString())}</td>
                    <td className="num">{formatearPesos(m.costoUnitario.toString())}</td>
                    <td className="num">{formatearPesos(m.costoTotal.toString())}</td>
                    <td className="num">{formatearCantidad(m.saldoCantidad.toString())}</td>
                    <td className="num">{formatearPesos(m.costoPromedio.toString())}</td>
                    <td className="num">{formatearPesos(m.saldoValor.toString())}</td>
                    <td className="text-xs">{m.autorizadoPorNombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-tenue">Los valores en pesos se muestran redondeados; el kárdex calcula con 4 decimales.</p>
      </Tarjeta>
    </div>
  );
}
