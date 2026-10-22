import { d, formatearPesos, formatearPorcentaje } from "@/lib/costeo";
import type { ResumenSerializado } from "@/lib/servicios/ordenes";

/** Barras horizontales (una sola serie): participación de cada elemento en el costo total. */
export function GraficoParticipacion({ r }: { r: ResumenSerializado }) {
  const max = r.participacion.reduce((m, p) => (d(p.pct).greaterThan(m) ? d(p.pct) : m), d(0));
  return (
    <figure>
      <figcaption className="mb-2 text-sm font-medium">Participación de cada elemento en el costo total</figcaption>
      <ul className="flex flex-col gap-2">
        {r.participacion.map((p) => {
          const ancho = max.isZero() ? 0 : d(p.pct).div(max).times(100).toNumber();
          return (
            <li key={p.clave} className="grid grid-cols-[minmax(8rem,12rem)_1fr] items-center gap-2 text-sm" title={`${p.concepto}: ${formatearPesos(p.valor)} (${formatearPorcentaje(p.pct)})`}>
              <span className="text-tenue">{p.concepto}</span>
              <span className="flex items-center gap-2">
                <span className="h-3 rounded-r bg-primario" style={{ width: `${Math.max(ancho * 0.75, d(p.pct).isZero() ? 0 : 0.5)}%` }} />
                <span className="num text-texto">{formatearPorcentaje(p.pct)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
