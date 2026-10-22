"use client";

import { Boton, Tarjeta } from "@/components/ui";

export default function ErrorPagina({ reset }: { error: Error; reset: () => void }) {
  return (
    <Tarjeta titulo="Ocurrió un error">
      <p className="text-sm">No fue posible cargar esta página. Intente de nuevo; si el problema continúa, informe al administrador.</p>
      <Boton className="mt-3" onClick={reset}>
        Reintentar
      </Boton>
    </Tarjeta>
  );
}
