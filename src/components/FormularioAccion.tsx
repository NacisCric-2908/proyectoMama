"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ResultadoAccion } from "@/lib/acciones";

type Accion = (previo: ResultadoAccion | null, fd: FormData) => Promise<ResultadoAccion>;

/** Formulario que ejecuta una acción del servidor y muestra el resultado (éxito, error, advertencia). */
export function FormularioAccion({
  accion,
  children,
  className = "",
  reiniciar = false,
  alExito,
  confirmar,
}: {
  accion: Accion;
  children: ReactNode;
  className?: string;
  reiniciar?: boolean;
  alExito?: () => void;
  confirmar?: string;
}) {
  const [estado, ejecutar, pendiente] = useActionState(accion, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok) {
      if (reiniciar) ref.current?.reset();
      alExito?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  return (
    <form
      ref={ref}
      action={ejecutar}
      className={className}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      <fieldset disabled={pendiente} className="contents">
        {children}
      </fieldset>
      {estado && (
        <div className="col-span-full mt-2 text-sm" role="status">
          {estado.ok ? (
            <p className="text-exito">{estado.mensaje}</p>
          ) : (
            <div className="text-peligro">
              <p>{estado.error}</p>
              {estado.detalles && estado.detalles.length > 1 && (
                <ul className="list-disc pl-5">
                  {estado.detalles.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {estado.advertencia && <p className="text-advertencia">⚠️ {estado.advertencia}</p>}
        </div>
      )}
    </form>
  );
}
