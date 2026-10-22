import { Campo, AreaTexto, Entrada, Selector } from "@/components/ui";

export interface ValoresOrden {
  codigo?: string;
  clienteId?: string | null;
  descripcion?: string;
  cantidadUnidades?: string;
  fechaCreacion?: string | null;
  fechaEstimadaEntrega?: string | null;
  responsableId?: string | null;
  valorCotizado?: string | null;
  margenEsperadoPct?: string | null;
  margenMinimoPct?: string | null;
  observaciones?: string | null;
  tecnicos?: string[];
}

/** Campos del formulario de orden (crear y editar). */
export function CamposOrden({
  v,
  clientes,
  responsables,
  trabajadores,
  verMargen,
  codigoEditable,
  nueva,
}: {
  v: ValoresOrden;
  clientes: { id: string; nombre: string }[];
  responsables: { id: string; nombre: string }[];
  trabajadores: { id: string; nombre: string; cargo: string }[];
  verMargen: boolean;
  codigoEditable: boolean;
  nueva?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Campo etiqueta="Código" ayuda={nueva ? "Vacío = autogenerado" : codigoEditable ? "Editable solo en Borrador" : undefined}>
        <Entrada name="codigo" defaultValue={v.codigo} readOnly={!codigoEditable} placeholder={nueva ? "OP-AAAA-NNNN" : undefined} />
      </Campo>
      <Campo etiqueta="Cliente" className="lg:col-span-2">
        <Selector name="clienteId" defaultValue={v.clienteId ?? ""}>
          <option value="">— Seleccione —</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Selector>
      </Campo>
      <Campo etiqueta="Cantidad de unidades">
        <Entrada name="cantidadUnidades" inputMode="decimal" defaultValue={v.cantidadUnidades ?? "1"} required />
      </Campo>
      <Campo etiqueta="Descripción del tablero o proyecto" className="sm:col-span-2 lg:col-span-4">
        <AreaTexto name="descripcion" defaultValue={v.descripcion} />
      </Campo>
      {nueva && (
        <Campo etiqueta="Fecha de creación">
          <Entrada type="date" name="fechaCreacion" defaultValue={v.fechaCreacion ?? undefined} />
        </Campo>
      )}
      <Campo etiqueta="Fecha estimada de entrega">
        <Entrada type="date" name="fechaEstimadaEntrega" defaultValue={v.fechaEstimadaEntrega ?? ""} />
      </Campo>
      <Campo etiqueta="Responsable / coordinador">
        <Selector name="responsableId" defaultValue={v.responsableId ?? ""}>
          <option value="">— Usuario actual —</option>
          {responsables.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </Selector>
      </Campo>
      {verMargen && (
        <>
          <Campo etiqueta="Valor cotizado (antes de IVA)">
            <Entrada name="valorCotizado" inputMode="decimal" defaultValue={v.valorCotizado ?? ""} />
          </Campo>
          <Campo etiqueta="Margen esperado %">
            <Entrada name="margenEsperadoPct" inputMode="decimal" defaultValue={v.margenEsperadoPct ?? ""} />
          </Campo>
          <Campo etiqueta="Margen mínimo %" ayuda="Vacío = margen mínimo global">
            <Entrada name="margenMinimoPct" inputMode="decimal" defaultValue={v.margenMinimoPct ?? ""} />
          </Campo>
        </>
      )}
      <Campo etiqueta="Observaciones" className="sm:col-span-2 lg:col-span-4">
        <AreaTexto name="observaciones" defaultValue={v.observaciones ?? ""} />
      </Campo>
      <fieldset className="sm:col-span-2 lg:col-span-4">
        <legend className="mb-1 text-sm font-medium text-tenue">Técnicos e ingenieros asignados (pueden registrar sus horas)</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {trabajadores.map((t) => (
            <label key={t.id} className="flex items-center gap-1">
              <input type="checkbox" name="tecnicos[]" value={t.id} defaultChecked={v.tecnicos?.includes(t.id)} />
              {t.nombre} <span className="text-tenue">({t.cargo})</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
