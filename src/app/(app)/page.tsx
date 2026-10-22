import Link from "next/link";
import { redirect } from "next/navigation";
import { requerirSesion, tiene } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import { esActiva, formatearPesos, formatearPorcentaje, hoyBogota, NOMBRE_ESTADO, SECUENCIA_ESTADOS, d } from "@/lib/costeo";
import { listarOrdenes } from "@/lib/servicios/ordenes";
import { IconoAlertas, InsigniaEstado, Tarjeta, Vacio } from "@/components/ui";

export default async function Inicio() {
  const u = await requerirSesion();
  if (!tiene(u, "ordenes.verTodas") && !tiene(u, "ordenes.verPropias")) {
    if (tiene(u, "horas.registrarPropias")) redirect("/mis-horas");
    return <Vacio>Bienvenido. No tiene órdenes para consultar.</Vacio>;
  }
  const ordenes = (await listarOrdenes(prisma, u)).filter((o) => o.estado !== "BORRADOR");
  const verMargen = tiene(u, "margenes.ver");
  const activas = ordenes.filter((o) => esActiva(o.estado));
  const conAlertas = ordenes.filter((o) => o.alertas.some((a) => a.codigo === "COSTO_SUPERA_COTIZADO" || a.codigo === "MARGEN_BAJO_MINIMO"));
  const vencidas = ordenes.filter((o) => o.alertas.some((a) => a.codigo === "ORDEN_VENCIDA"));
  const mes = hoyBogota().slice(0, 7);
  const conMargen = activas.filter((o) => o.margenPct !== null);
  const margenPromedio = conMargen.length
    ? conMargen.reduce((a, o) => a.plus(d(o.margenPct)), d(0)).div(conMargen.length)
    : null;
  const costoActivas = activas.reduce((a, o) => a.plus(d(o.costoTotal)), d(0));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Inicio</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta>
          <p className="text-sm text-tenue">Órdenes activas</p>
          <p className="text-2xl font-semibold">{activas.length}</p>
        </Tarjeta>
        <Tarjeta>
          <p className="text-sm text-tenue">Costo acumulado en órdenes activas</p>
          <p className="text-2xl font-semibold">{formatearPesos(costoActivas)}</p>
        </Tarjeta>
        {verMargen && (
          <Tarjeta>
            <p className="text-sm text-tenue">Margen promedio (activas)</p>
            <p className="text-2xl font-semibold">{margenPromedio ? formatearPorcentaje(margenPromedio) : "—"}</p>
          </Tarjeta>
        )}
        <Tarjeta>
          <p className="text-sm text-tenue">Órdenes vencidas</p>
          <p className="text-2xl font-semibold">{vencidas.length}</p>
        </Tarjeta>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Órdenes activas por estado">
          <ul className="text-sm">
            {SECUENCIA_ESTADOS.filter((e) => esActiva(e)).map((e) => (
              <li key={e} className="flex justify-between border-b border-borde py-1.5">
                <Link href={`/ordenes?estado=${e}`} className="hover:underline">
                  {NOMBRE_ESTADO[e]}
                </Link>
                <span className="num">{activas.filter((o) => o.estado === e).length}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta titulo="Órdenes con alertas de costo o margen">
          {conAlertas.length === 0 ? (
            <Vacio>Sin alertas críticas ni de margen.</Vacio>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {conAlertas.map((o) => (
                <li key={o.id} className="border-b border-borde pb-2">
                  <Link href={`/ordenes/${o.id}`} className="font-medium hover:underline">
                    {o.codigo}
                  </Link>{" "}
                  <InsigniaEstado estado={o.estado} /> <IconoAlertas alertas={o.alertas} />
                  <ul className="mt-1 text-tenue">
                    {o.alertas
                      .filter((a) => a.codigo === "COSTO_SUPERA_COTIZADO" || a.codigo === "MARGEN_BAJO_MINIMO")
                      .map((a) => (
                        <li key={a.codigo}>{a.mensaje}</li>
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
      <p className="text-xs text-tenue">Mes actual: {mes}. El tablero completo y los reportes llegan en la fase 2.</p>
    </div>
  );
}
