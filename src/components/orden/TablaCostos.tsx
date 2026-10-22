import { CONCEPTOS, d, formatearPesos, formatearPorcentaje } from "@/lib/costeo";
import type { ResumenSerializado } from "@/lib/servicios/ordenes";

/** Tabla de resumen de costos en el formato de la clienta (sección 10.2). */
export function TablaCostos({ r, verMargen }: { r: ResumenSerializado; verMargen: boolean }) {
  return (
    <table className="tabla max-w-xl">
      <thead>
        <tr>
          <th>Concepto</th>
          <th className="num">Valor</th>
          <th className="num">Participación</th>
        </tr>
      </thead>
      <tbody>
        {CONCEPTOS.map((c) => {
          const p = r.participacion.find((x) => x.clave === c.clave)!;
          return (
            <tr key={c.clave}>
              <td>{c.nombre}</td>
              <td className="num">{formatearPesos(r.elementos[c.clave])}</td>
              <td className="num text-tenue">{formatearPorcentaje(p.pct)}</td>
            </tr>
          );
        })}
        <tr className="font-semibold">
          <td>Costo total del proyecto</td>
          <td className="num">{formatearPesos(r.costoTotal)}</td>
          <td className="num text-tenue">100,00%</td>
        </tr>
        {verMargen && (
          <>
            <tr>
              <td>Valor cotizado</td>
              <td className="num">{r.valorCotizado && d(r.valorCotizado).greaterThan(0) ? formatearPesos(r.valorCotizado) : "Sin cotización"}</td>
              <td />
            </tr>
            <tr>
              <td>Margen bruto</td>
              <td className={`num ${r.margenBruto && d(r.margenBruto).isNegative() ? "text-peligro" : ""}`}>{r.margenBruto ? formatearPesos(r.margenBruto) : "Sin cotización"}</td>
              <td />
            </tr>
            <tr>
              <td>Margen porcentual</td>
              <td className={`num ${r.margenPct && d(r.margenPct).isNegative() ? "text-peligro" : ""}`}>{r.margenPct ? formatearPorcentaje(r.margenPct) : "Sin cotización"}</td>
              <td />
            </tr>
          </>
        )}
      </tbody>
    </table>
  );
}

/** Comparación por elemento del costo entre la estimación al cotizar y el costo real. */
export function EstimadoVsReal({ estimado, real }: { estimado: ResumenSerializado; real: ResumenSerializado }) {
  return (
    <table className="tabla max-w-2xl">
      <thead>
        <tr>
          <th>Concepto</th>
          <th className="num">Estimado al cotizar</th>
          <th className="num">Real</th>
          <th className="num">Diferencia</th>
        </tr>
      </thead>
      <tbody>
        {CONCEPTOS.map((c) => {
          const dif = d(real.elementos[c.clave]).minus(d(estimado.elementos[c.clave]));
          return (
            <tr key={c.clave}>
              <td>{c.nombre}</td>
              <td className="num">{formatearPesos(estimado.elementos[c.clave])}</td>
              <td className="num">{formatearPesos(real.elementos[c.clave])}</td>
              <td className={`num ${dif.greaterThan(0) ? "text-peligro" : dif.isNegative() ? "text-exito" : ""}`}>{formatearPesos(dif)}</td>
            </tr>
          );
        })}
        <tr className="font-semibold">
          <td>Costo total</td>
          <td className="num">{formatearPesos(estimado.costoTotal)}</td>
          <td className="num">{formatearPesos(real.costoTotal)}</td>
          <td className="num">{formatearPesos(d(real.costoTotal).minus(d(estimado.costoTotal)))}</td>
        </tr>
      </tbody>
    </table>
  );
}
