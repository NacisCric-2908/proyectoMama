import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  CONCEPTOS,
  d,
  formatearCantidad,
  formatearFecha,
  formatearPesos,
  formatearPorcentaje,
  NOMBRE_ESTADO,
  NOMBRE_GRUPO,
  type EstadoOrden,
} from "@/lib/costeo";
import type { ResumenSerializado } from "@/lib/servicios/ordenes";

const s = StyleSheet.create({
  pagina: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#1b2230" },
  encabezado: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  logo: { width: 90, height: 40, objectFit: "contain" },
  titulo: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  tenue: { color: "#5b6474" },
  seccion: { marginTop: 12 },
  subtitulo: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  fila: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2e5ea", paddingVertical: 3 },
  filaTotal: { flexDirection: "row", paddingVertical: 3, fontFamily: "Helvetica-Bold" },
  th: { fontFamily: "Helvetica-Bold", color: "#5b6474" },
  num: { textAlign: "right" },
  barra: { height: 6, backgroundColor: "#1f5fbf", borderRadius: 2 },
  alerta: { padding: 4, marginBottom: 2, borderWidth: 0.5, borderColor: "#e2e5ea" },
});

type Col = { t: string; w: number; num?: boolean };
function Tabla({ cols, filas, total }: { cols: Col[]; filas: string[][]; total?: string[] }) {
  return (
    <View>
      <View style={s.fila}>
        {cols.map((c) => (
          <Text key={c.t} style={[s.th, { width: `${c.w}%` }, c.num ? s.num : {}]}>{c.t}</Text>
        ))}
      </View>
      {filas.map((f, i) => (
        <View key={i} style={s.fila} wrap={false}>
          {f.map((v, j) => (
            <Text key={j} style={[{ width: `${cols[j].w}%` }, cols[j].num ? s.num : {}]}>{v}</Text>
          ))}
        </View>
      ))}
      {total && (
        <View style={s.filaTotal}>
          {total.map((v, j) => (
            <Text key={j} style={[{ width: `${cols[j].w}%` }, cols[j].num ? s.num : {}]}>{v}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

export interface DatosInforme {
  empresa: string;
  logo: string | null;
  codigo: string;
  cliente: string;
  descripcion: string;
  estado: EstadoOrden;
  r: ResumenSerializado;
  estimado: ResumenSerializado | null;
  verMargen: boolean;
  cierre: { cerradoEn: string; cerradoPor: string } | null;
}

export function InformePDF({ empresa, logo, codigo, cliente, descripcion, estado, r, estimado, verMargen, cierre }: DatosInforme) {
  const max = r.participacion.reduce((m, p) => (d(p.pct).greaterThan(m) ? d(p.pct) : m), d(0));
  const filasResumen = CONCEPTOS.map((c) => [c.nombre, formatearPesos(r.elementos[c.clave]), formatearPorcentaje(r.participacion.find((p) => p.clave === c.clave)!.pct)]);
  const sinCot = "Sin cotización";
  return (
    <Document title={`Informe ${codigo}`} author={empresa} language="es-CO">
      <Page size="LETTER" style={s.pagina}>
        <View style={s.encabezado}>
          <View>
            <Text style={s.titulo}>{cierre ? "Informe de cierre" : "Resumen de costos"} · {codigo}</Text>
            <Text style={s.tenue}>{empresa}</Text>
            <Text>{cliente} · {descripcion}</Text>
            <Text style={s.tenue}>Estado: {NOMBRE_ESTADO[estado]}</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {logo && <Image src={logo} style={s.logo} />}
        </View>

        <View style={s.seccion}>
          <Tabla
            cols={[{ t: "Concepto", w: 55 }, { t: "Valor", w: 25, num: true }, { t: "Participación", w: 20, num: true }]}
            filas={[
              ...filasResumen,
              ["Costo total del proyecto", formatearPesos(r.costoTotal), "100,00%"],
              ...(verMargen
                ? [
                    ["Valor cotizado", r.valorCotizado && d(r.valorCotizado).greaterThan(0) ? formatearPesos(r.valorCotizado) : sinCot, ""],
                    ["Margen bruto", r.margenBruto ? formatearPesos(r.margenBruto) : sinCot, ""],
                    ["Margen porcentual", r.margenPct ? formatearPorcentaje(r.margenPct) : sinCot, ""],
                  ]
                : []),
            ]}
          />
          <Text style={{ marginTop: 4 }}>
            Cantidad de unidades: {formatearCantidad(r.cantidadUnidades)} · Costo unitario: {formatearPesos(r.costoUnitario)}
          </Text>
        </View>

        <View style={s.seccion}>
          <Text style={s.subtitulo}>Participación de cada elemento en el costo total</Text>
          {r.participacion.map((p) => (
            <View key={p.clave} style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
              <Text style={{ width: "35%" }}>{p.concepto}</Text>
              <View style={{ width: "50%" }}>
                <View style={[s.barra, { width: `${max.isZero() ? 0 : d(p.pct).div(max).times(100).toNumber()}%` }]} />
              </View>
              <Text style={[{ width: "15%" }, s.num]}>{formatearPorcentaje(p.pct)}</Text>
            </View>
          ))}
        </View>

        {r.alertas.length > 0 && (
          <View style={s.seccion}>
            <Text style={s.subtitulo}>Alertas</Text>
            {r.alertas.map((a, i) => (
              <Text key={i} style={s.alerta}>[{a.nivel === "CRITICA" ? "Crítica" : a.nivel === "ADVERTENCIA" ? "Advertencia" : "Informativa"}] {a.mensaje}</Text>
            ))}
          </View>
        )}

        <View style={s.seccion}>
          <Text style={s.subtitulo}>Ingeniería, pruebas y puesta en marcha por etapa</Text>
          <Tabla
            cols={[{ t: "Etapa", w: 40 }, { t: "Grupo", w: 30 }, { t: "Horas", w: 12, num: true }, { t: "Costo", w: 18, num: true }]}
            filas={r.ingenieria.porEtapa.filter((e) => !d(e.horas).isZero() || !d(e.costo).isZero()).map((e) => [e.nombre, NOMBRE_GRUPO[e.grupo], formatearCantidad(e.horas), formatearPesos(e.costo)])}
            total={["Total", "", formatearCantidad(r.ingenieria.horasIngenieria), formatearPesos(r.ingenieria.costoIngenieria)]}
          />
        </View>

        <View style={s.seccion}>
          <Text style={s.subtitulo}>Detalle de materiales</Text>
          <Tabla
            cols={[
              { t: "Código", w: 10 }, { t: "Descripción", w: 22 }, { t: "Und", w: 6 }, { t: "Req.", w: 8, num: true }, { t: "Entr.", w: 8, num: true },
              { t: "Util.", w: 8, num: true }, { t: "Merma", w: 8, num: true }, { t: "Costo unit.", w: 10, num: true }, { t: "Costo", w: 10, num: true }, { t: "C. merma", w: 10, num: true },
            ]}
            filas={r.materiales.lineas.map((l) => [l.codigo ?? "", l.descripcion, l.unidad ?? "", formatearCantidad(l.requerida), formatearCantidad(l.entregada), formatearCantidad(l.utilizada), formatearCantidad(l.merma), formatearPesos(l.costoUnitario), formatearPesos(l.costoLinea), formatearPesos(l.costoMerma)])}
            total={["Totales", "", "", "", "", "", "", "", formatearPesos(r.materiales.costoMaterialesDirectos), formatearPesos(r.materiales.costoMermas)]}
          />
        </View>

        <View style={s.seccion}>
          <Text style={s.subtitulo}>Detalle de mano de obra directa</Text>
          <Tabla
            cols={[{ t: "Fecha", w: 12 }, { t: "Trabajador", w: 22 }, { t: "Actividad", w: 30 }, { t: "Horas", w: 10, num: true }, { t: "Tarifa", w: 13, num: true }, { t: "Costo", w: 13, num: true }]}
            filas={r.mod.registros.map((m) => [formatearFecha(m.fecha), m.trabajador ?? "", m.actividad ?? "", formatearCantidad(m.horas), formatearPesos(m.tarifa), formatearPesos(m.costo)])}
            total={["Total", "", "", formatearCantidad(r.mod.horasMOD), "", formatearPesos(r.mod.costoMOD)]}
          />
        </View>

        <View style={s.seccion}>
          <Text style={s.subtitulo}>Cálculo del CIF</Text>
          <Text>
            {r.cif
              ? `Base: ${r.cif.nombreBase} · Cantidad de la base: ${formatearCantidad(r.cif.cantidadBase)} · Tasa: ${formatearCantidad(r.cif.tasa)} (${r.cif.unidadTasa}) · CIF asignado: ${formatearPesos(r.cif.valor)}`
              : "Sin CIF asignado"}
          </Text>
        </View>

        {estimado && (
          <View style={s.seccion}>
            <Text style={s.subtitulo}>Estimado al cotizar vs real</Text>
            <Tabla
              cols={[{ t: "Concepto", w: 40 }, { t: "Estimado", w: 20, num: true }, { t: "Real", w: 20, num: true }, { t: "Diferencia", w: 20, num: true }]}
              filas={CONCEPTOS.map((c) => [c.nombre, formatearPesos(estimado.elementos[c.clave]), formatearPesos(r.elementos[c.clave]), formatearPesos(d(r.elementos[c.clave]).minus(d(estimado.elementos[c.clave])))])}
              total={["Costo total", formatearPesos(estimado.costoTotal), formatearPesos(r.costoTotal), formatearPesos(d(r.costoTotal).minus(d(estimado.costoTotal)))]}
            />
          </View>
        )}

        <Text style={[s.seccion, s.tenue]}>
          {cierre ? `Cerrada el ${formatearFecha(cierre.cerradoEn)} por ${cierre.cerradoPor}.` : "Orden abierta: valores calculados en tiempo real."}
        </Text>
        <Text style={[s.tenue, { position: "absolute", bottom: 16, right: 32 }]} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
