import type { AjusteCIFOrden, ConciliacionCIF } from "@prisma/client";
import { d, formatearFecha, formatearPesos, formatearPorcentaje, NOMBRE_POLITICA, precision4 } from "@/lib/costeo";

/** Costo ajustado tras conciliar el CIF real del período (modelo analítico del artículo). */
export function CostoAjustado({ ajuste, valorCotizado }: { ajuste: AjusteCIFOrden & { conciliacion: ConciliacionCIF }; valorCotizado: string | null }) {
  const ajustado = d(ajuste.costoAjustado.toString());
  const cot = valorCotizado && d(valorCotizado).greaterThan(0) ? d(valorCotizado) : null;
  const margen = cot ? cot.minus(ajustado) : null;
  const c = ajuste.conciliacion;
  return (
    <div className="flex flex-col gap-2">
      <dl className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <dt className="text-tenue">Costo acumulado (CIF aplicado)</dt>
          <dd className="font-medium">{formatearPesos(ajuste.costoAcumulado.toString())}</dd>
        </div>
        <div>
          <dt className="text-tenue">CIF aplicado</dt>
          <dd className="font-medium">{formatearPesos(ajuste.cifAplicado.toString())}</dd>
        </div>
        <div>
          <dt className="text-tenue">Ajuste por conciliación</dt>
          <dd className="font-medium">{formatearPesos(ajuste.ajuste.toString())}</dd>
        </div>
        <div>
          <dt className="text-tenue">Costo ajustado</dt>
          <dd className="text-lg font-semibold">{formatearPesos(ajustado)}</dd>
        </div>
        {margen && cot && (
          <>
            <div>
              <dt className="text-tenue">Margen ajustado</dt>
              <dd className="font-medium">{formatearPesos(margen)}</dd>
            </div>
            <div>
              <dt className="text-tenue">Margen ajustado %</dt>
              <dd className="font-medium">{formatearPorcentaje(precision4(margen.div(cot).times(100)))}</dd>
            </div>
          </>
        )}
      </dl>
      <p className="text-xs text-tenue">
        Período {c.periodo}: CIF real {formatearPesos(c.cifReal.toString())} − CIF aplicado {formatearPesos(c.cifAplicado.toString())} = diferencia{" "}
        {formatearPesos(c.diferencia.toString())}. Política: {NOMBRE_POLITICA[c.politica]}. Conciliado el {formatearFecha(c.fecha)} por {c.usuarioNombre}.
      </p>
    </div>
  );
}
