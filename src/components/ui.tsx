import Link from "next/link";
import { cloneElement, isValidElement, useId, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { NOMBRE_ESTADO, type Alerta, type EstadoOrden } from "@/lib/costeo";

export function Tarjeta({ titulo, acciones, children, className = "" }: { titulo?: ReactNode; acciones?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-borde bg-superficie p-4 ${className}`}>
      {(titulo || acciones) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {titulo && <h2 className="text-base font-semibold">{titulo}</h2>}
          {acciones}
        </div>
      )}
      {children}
    </section>
  );
}

type Variante = "primario" | "secundario" | "peligro";
const estilosBoton: Record<Variante, string> = {
  primario: "bg-primario text-white hover:bg-primario-hover",
  secundario: "border border-borde bg-superficie hover:bg-fondo",
  peligro: "border border-peligro text-peligro hover:bg-red-50",
};

export function Boton({ variante = "primario", className = "", ...props }: ComponentProps<"button"> & { variante?: Variante }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${estilosBoton[variante]} ${className}`}
    />
  );
}

export function EnlaceBoton({ variante = "primario", className = "", ...props }: ComponentProps<typeof Link> & { variante?: Variante }) {
  return (
    <Link
      {...props}
      className={`inline-flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium ${estilosBoton[variante]} ${className}`}
    />
  );
}

export function Campo({ etiqueta, children, ayuda, className = "" }: { etiqueta: string; children: ReactNode; ayuda?: string; className?: string }) {
  const generado = useId();
  const control = isValidElement<{ id?: string }>(children) ? (children as ReactElement<{ id?: string }>) : null;
  const id = control?.props.id ?? generado;
  return (
    <div className={`flex flex-col gap-1 text-sm ${className}`}>
      <label htmlFor={control ? id : undefined} className="font-medium text-tenue">
        {etiqueta}
      </label>
      {control ? cloneElement(control, { id }) : children}
      {ayuda && <span className="text-xs text-tenue">{ayuda}</span>}
    </div>
  );
}

export function Entrada(props: ComponentProps<"input">) {
  return <input {...props} className={`entrada ${props.className ?? ""}`} />;
}

export function Selector(props: ComponentProps<"select">) {
  return <select {...props} className={`entrada ${props.className ?? ""}`} />;
}

export function AreaTexto(props: ComponentProps<"textarea">) {
  return <textarea rows={2} {...props} className={`entrada ${props.className ?? ""}`} />;
}

const colorEstado: Record<EstadoOrden, string> = {
  BORRADOR: "bg-gray-100 text-gray-700",
  COTIZADO: "bg-sky-100 text-sky-800",
  EN_INGENIERIA: "bg-indigo-100 text-indigo-800",
  EN_FABRICACION: "bg-amber-100 text-amber-800",
  EN_PRUEBAS: "bg-violet-100 text-violet-800",
  EN_PUESTA_MARCHA: "bg-teal-100 text-teal-800",
  TERMINADO: "bg-green-100 text-green-800",
  FACTURADO: "bg-emerald-200 text-emerald-900",
  ANULADO: "bg-red-100 text-red-800",
};

export function InsigniaEstado({ estado }: { estado: EstadoOrden }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${colorEstado[estado]}`}>{NOMBRE_ESTADO[estado]}</span>;
}

const estiloAlerta = {
  CRITICA: "border-red-300 bg-red-50 text-red-800",
  ADVERTENCIA: "border-amber-300 bg-amber-50 text-amber-900",
  INFORMATIVA: "border-sky-200 bg-sky-50 text-sky-900",
} as const;
const iconoAlerta = { CRITICA: "⛔", ADVERTENCIA: "⚠️", INFORMATIVA: "ℹ️" } as const;

export function ListaAlertas({ alertas }: { alertas: Pick<Alerta, "nivel" | "mensaje">[] }) {
  if (!alertas.length) return null;
  return (
    <ul className="flex flex-col gap-1">
      {alertas.map((a, i) => (
        <li key={i} className={`rounded-md border px-3 py-1.5 text-sm ${estiloAlerta[a.nivel]}`}>
          <span aria-hidden>{iconoAlerta[a.nivel]}</span> {a.mensaje}
        </li>
      ))}
    </ul>
  );
}

export function IconoAlertas({ alertas }: { alertas: Pick<Alerta, "nivel" | "mensaje">[] }) {
  if (!alertas.length) return null;
  const nivel = alertas.some((a) => a.nivel === "CRITICA") ? "CRITICA" : alertas.some((a) => a.nivel === "ADVERTENCIA") ? "ADVERTENCIA" : "INFORMATIVA";
  return (
    <span title={alertas.map((a) => a.mensaje).join("\n")} aria-label={`${alertas.length} alertas`}>
      {iconoAlerta[nivel]}
    </span>
  );
}

export function Titulo({ children, acciones }: { children: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-xl font-semibold">{children}</h1>
      {acciones}
    </div>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-tenue">{children}</p>;
}
