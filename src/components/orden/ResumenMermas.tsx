import { formatearPesos, NOMBRE_CLASIFICACION_MERMA } from "@/lib/costeo";
import type { ResumenSerializado } from "@/lib/servicios/ordenes";

/** Mermas por clasificación y merma anormal llevada a pérdida del período. */
export function ResumenMermas({ r }: { r: ResumenSerializado }) {
  const clases = (["NORMAL", "ANORMAL", "RECUPERABLE", "SIN_CLASIFICAR"] as const).filter((c) => Number(r.materiales.mermasPorClase[c]) > 0);
  if (!clases.length && Number(r.perdidaMermaAnormal) === 0) return null;
  return (
    <ul className="mt-3 text-sm">
      {clases.map((c) => (
        <li key={c}>
          Merma {NOMBRE_CLASIFICACION_MERMA[c].toLowerCase()}: <strong>{formatearPesos(r.materiales.mermasPorClase[c])}</strong>
        </li>
      ))}
      {Number(r.materiales.valorRecuperadoTotal) > 0 && <li>Valor recuperado de mermas: {formatearPesos(r.materiales.valorRecuperadoTotal)}</li>}
      {Number(r.perdidaMermaAnormal) > 0 && (
        <li className="text-advertencia">
          Merma anormal reconocida como pérdida del período (excluida del costo): <strong>{formatearPesos(r.perdidaMermaAnormal)}</strong>
        </li>
      )}
    </ul>
  );
}
