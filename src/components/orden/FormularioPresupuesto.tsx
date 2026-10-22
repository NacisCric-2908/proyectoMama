"use client";

import { useState } from "react";
import { CONCEPTOS, ErrorCosteo, formatearPesos, totalPresupuesto } from "@/lib/costeo";
import type { ResultadoAccion } from "@/lib/acciones";
import { FormularioAccion } from "@/components/FormularioAccion";
import { Boton, Campo, Entrada } from "@/components/ui";

type Valores = Record<string, string>;

export function FormularioPresupuesto({
  accion,
  inicial,
  pideMotivo,
  sugerencias,
}: {
  accion: (p: ResultadoAccion | null, fd: FormData) => Promise<ResultadoAccion>;
  inicial: Valores;
  pideMotivo: boolean;
  sugerencias: string[];
}) {
  const [v, setV] = useState<Valores>(inicial);
  const cambiar = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  let total: string | null = null;
  let error: string | null = null;
  try {
    total = formatearPesos(
      totalPresupuesto({
        materialesDirectos: (v.materialesDirectos || "0").replace(",", "."),
        manoObraDirecta: (v.manoObraDirecta || "0").replace(",", "."),
        ingenieriaAutomatizacion: (v.ingenieriaAutomatizacion || "0").replace(",", "."),
        pruebasPuestaMarcha: (v.pruebasPuestaMarcha || "0").replace(",", "."),
        cif: (v.cif || "0").replace(",", "."),
        mermas: (v.mermas || "0").replace(",", "."),
      }),
    );
  } catch (e) {
    error = e instanceof ErrorCosteo ? e.message : "Valores inválidos";
  }
  return (
    <FormularioAccion accion={accion} className="grid items-end gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {CONCEPTOS.map((c) => (
        <Campo key={c.clave} etiqueta={c.nombre}>
          <Entrada name={c.clave} inputMode="decimal" value={v[c.clave] ?? ""} onChange={cambiar(c.clave)} />
        </Campo>
      ))}
      <Campo etiqueta="Horas de ensamble estimadas">
        <Entrada name="horasEnsamble" inputMode="decimal" value={v.horasEnsamble ?? ""} onChange={cambiar("horasEnsamble")} />
      </Campo>
      <Campo etiqueta="Horas de ingeniería estimadas">
        <Entrada name="horasIngenieria" inputMode="decimal" value={v.horasIngenieria ?? ""} onChange={cambiar("horasIngenieria")} />
      </Campo>
      {pideMotivo && (
        <Campo etiqueta="Motivo de la nueva versión (obligatorio)" ayuda="Por ejemplo: cambio de especificación autorizado por el cliente" className="sm:col-span-3 lg:col-span-4">
          <Entrada name="motivo" required value={v.motivo ?? ""} onChange={cambiar("motivo")} />
        </Campo>
      )}
      <div className="flex flex-wrap items-center gap-3 text-sm sm:col-span-3 lg:col-span-4">
        {error ? <span className="text-peligro">{error}</span> : <span>Costo total presupuestado: <strong>{total}</strong></span>}
        <Boton disabled={!!error}>Registrar versión</Boton>
      </div>
      {sugerencias.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-tenue sm:col-span-3 lg:col-span-4">
          {sugerencias.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
    </FormularioAccion>
  );
}
