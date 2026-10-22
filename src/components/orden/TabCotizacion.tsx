import Link from "next/link";
import { formatearPesos, formatearPorcentaje } from "@/lib/costeo";
import type { OrdenCompleta, ResumenSerializado } from "@/lib/servicios/ordenes";
import { txt } from "@/lib/servicios/util";
import { ListaAlertas, Tarjeta } from "@/components/ui";
import { EstimadoVsReal, TablaCostos } from "./TablaCostos";

export function TabCotizacion({ orden, resumen }: { orden: OrdenCompleta; resumen: ResumenSerializado }) {
  const estimado = orden.estimadoAlCotizar as unknown as ResumenSerializado | null;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Resumen de costos">
          <TablaCostos r={resumen} verMargen />
          <p className="mt-3 text-sm">
            Unidades: <strong>{orden.cantidadUnidades.toString()}</strong> · Costo unitario: <strong>{formatearPesos(resumen.costoUnitario)}</strong>
          </p>
        </Tarjeta>
        <Tarjeta titulo="Cotización">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-tenue">Valor cotizado (antes de IVA)</dt>
            <dd className="num">{orden.valorCotizado ? formatearPesos(txt(orden.valorCotizado)) : "Sin cotización"}</dd>
            <dt className="text-tenue">Margen esperado</dt>
            <dd className="num">{orden.margenEsperadoPct ? formatearPorcentaje(txt(orden.margenEsperadoPct)) : "—"}</dd>
            <dt className="text-tenue">Precio de venta sugerido</dt>
            <dd className="num font-semibold">{resumen.precioSugerido ? formatearPesos(resumen.precioSugerido) : "—"}</dd>
            <dt className="text-tenue">Margen mínimo</dt>
            <dd className="num">{orden.margenMinimoPct ? formatearPorcentaje(txt(orden.margenMinimoPct)) : "—"}</dd>
          </dl>
          <p className="mt-3 text-xs text-tenue">
            Precio sugerido = costo total ÷ (1 − margen esperado). El margen se calcula sobre el precio de venta. Los valores se editan en Datos generales.
          </p>
          <div className="mt-3">
            <ListaAlertas alertas={resumen.alertas} />
          </div>
        </Tarjeta>
      </div>
      <Tarjeta titulo="Estimado al cotizar vs real" acciones={<Link href={`/ordenes/${orden.id}/informe`} className="text-sm text-primario hover:underline">Ver informe →</Link>}>
        {estimado ? (
          <EstimadoVsReal estimado={estimado} real={resumen} />
        ) : (
          <p className="text-sm text-tenue">La estimación se guarda cuando la orden pasa de Borrador a Cotizado.</p>
        )}
      </Tarjeta>
    </div>
  );
}
