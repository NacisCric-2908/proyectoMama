import { requerirPagina, tiene } from "@/lib/auth/sesion";
import { PERMISOS } from "@/lib/auth/permisos";
import { prisma } from "@/lib/db";
import { BASES_CIF, NOMBRE_GRUPO } from "@/lib/costeo";
import { FormularioAccion } from "@/components/FormularioAccion";
import { Boton, Campo, Entrada, Selector, Tarjeta, Titulo } from "@/components/ui";
import { accionGuardarEtapa, accionGuardarParametros, accionGuardarPermisos, accionGuardarUsuario } from "./acciones";

export default async function Admin() {
  const u = await requerirPagina("usuarios.gestionar", "parametros.gestionar");
  const [p, usuarios, roles, trabajadores, etapas] = await Promise.all([
    prisma.parametrosGenerales.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.usuario.findMany({ include: { rol: true, trabajador: true }, orderBy: { nombre: "asc" } }),
    prisma.rol.findMany({ include: { permisos: true }, orderBy: { nombre: "asc" } }),
    prisma.trabajador.findMany({ where: { eliminadoEn: null }, orderBy: { nombre: "asc" } }),
    prisma.etapa.findMany({ orderBy: { orden: "asc" } }),
  ]);

  const camposUsuario = (v?: (typeof usuarios)[number]) => (
    <>
      {v && <input type="hidden" name="id" value={v.id} />}
      <Campo etiqueta="Nombre">
        <Entrada name="nombre" required defaultValue={v?.nombre} />
      </Campo>
      <Campo etiqueta="Correo">
        <Entrada name="email" type="email" required defaultValue={v?.email} />
      </Campo>
      <Campo etiqueta="Rol">
        <Selector name="rolId" defaultValue={v?.rolId}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </Selector>
      </Campo>
      <Campo etiqueta="Trabajador asociado" ayuda="Para técnicos e ingenieros que registran sus horas">
        <Selector name="trabajadorId" defaultValue={v?.trabajadorId ?? ""}>
          <option value="">— Ninguno —</option>
          {trabajadores.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </Selector>
      </Campo>
      <Campo etiqueta={v ? "Nueva contraseña (opcional)" : "Contraseña"} ayuda="Mínimo 8 caracteres">
        <Entrada name="contrasena" type="password" autoComplete="new-password" required={!v} />
      </Campo>
      <Campo etiqueta="Estado">
        <Selector name="activo" defaultValue={v && !v.activo ? "false" : "true"}>
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </Selector>
      </Campo>
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <Titulo>Administración</Titulo>

      {tiene(u, "parametros.gestionar") && (
        <Tarjeta titulo="Parámetros generales">
          <FormularioAccion accion={accionGuardarParametros} className="grid items-end gap-3 sm:grid-cols-3">
            <Campo etiqueta="Nombre de la empresa">
              <Entrada name="nombreEmpresa" required defaultValue={p.nombreEmpresa} />
            </Campo>
            <Campo etiqueta="Margen mínimo global %">
              <Entrada name="margenMinimoGlobal" inputMode="decimal" defaultValue={p.margenMinimoGlobal.toString()} />
            </Campo>
            <Campo etiqueta="Formato de código de orden" ayuda="{AAAA} = año, {NNNN} = consecutivo">
              <Entrada name="formatoCodigoOrden" defaultValue={p.formatoCodigoOrden} />
            </Campo>
            <Campo etiqueta="Base de CIF por defecto">
              <Selector name="baseCifDefecto" defaultValue={p.baseCifDefecto}>
                {Object.entries(BASES_CIF).map(([k, b]) => (
                  <option key={k} value={k}>
                    {b.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Umbral de merma alta %">
              <Entrada name="umbralMermaPct" inputMode="decimal" defaultValue={p.umbralMermaPct.toString()} />
            </Campo>
            <Campo etiqueta="Merma anormal" ayuda="Política de tratamiento contable">
              <Selector name="excluirMermaAnormal" defaultValue={p.excluirMermaAnormal ? "true" : "false"}>
                <option value="false">Se incluye en el costo de la orden</option>
                <option value="true">Se reconoce como pérdida del período</option>
              </Selector>
            </Campo>
            <Campo etiqueta="Moneda">
              <Entrada value="COP" readOnly />
            </Campo>
            <Campo etiqueta="Logo (PNG o JPG, máx. 300 KB)">
              <Entrada type="file" name="logo" accept="image/png,image/jpeg" />
            </Campo>
            <div className="flex items-center gap-3 text-sm">
              {p.logo && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.logo} alt="Logo actual" className="h-10" />
                  <label className="flex items-center gap-1">
                    <input type="checkbox" name="quitarLogo" /> Quitar logo
                  </label>
                </>
              )}
            </div>
            <div>
              <Boton>Guardar parámetros</Boton>
            </div>
          </FormularioAccion>
        </Tarjeta>
      )}

      {tiene(u, "usuarios.gestionar") && (
        <>
          <Tarjeta titulo="Usuarios">
            <div className="overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Trabajador</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((x) => (
                    <tr key={x.id}>
                      <td>{x.nombre}</td>
                      <td>{x.email}</td>
                      <td>{x.rol.nombre}</td>
                      <td>{x.trabajador?.nombre ?? "—"}</td>
                      <td>{x.activo ? "Activo" : "Inactivo"}</td>
                      <td>
                        <details>
                          <summary className="cursor-pointer text-xs text-primario">Editar</summary>
                          <FormularioAccion accion={accionGuardarUsuario} className="mt-2 grid min-w-[40rem] gap-2 sm:grid-cols-3">
                            {camposUsuario(x)}
                            <div>
                              <Boton>Guardar</Boton>
                            </div>
                          </FormularioAccion>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="mt-4 mb-2 text-sm font-semibold">Nuevo usuario</h3>
            <FormularioAccion accion={accionGuardarUsuario} reiniciar className="grid items-end gap-3 sm:grid-cols-3">
              {camposUsuario()}
              <div>
                <Boton>Crear usuario</Boton>
              </div>
            </FormularioAccion>
          </Tarjeta>

          <Tarjeta titulo="Permisos por rol">
            <p className="mb-3 text-sm text-tenue">El Administrador conserva siempre todos los permisos. Los permisos se verifican en el servidor.</p>
            <div className="grid gap-4 lg:grid-cols-2">
              {roles
                .filter((r) => r.clave !== "ADMINISTRADOR")
                .map((r) => (
                  <FormularioAccion key={r.id} accion={accionGuardarPermisos.bind(null, r.id)} className="rounded-md border border-borde p-3">
                    <h3 className="mb-2 font-medium">{r.nombre}</h3>
                    <div className="grid gap-1 text-sm">
                      {Object.entries(PERMISOS).map(([clave, texto]) => (
                        <label key={clave} className="flex items-center gap-2">
                          <input type="checkbox" name="permisos[]" value={clave} defaultChecked={r.permisos.some((x) => x.clave === clave)} />
                          {texto}
                        </label>
                      ))}
                    </div>
                    <Boton className="mt-2">Guardar permisos</Boton>
                  </FormularioAccion>
                ))}
            </div>
          </Tarjeta>
        </>
      )}

      {tiene(u, "parametros.gestionar") && (
        <Tarjeta titulo="Etapas técnicas">
          <table className="tabla">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Etapa</th>
                <th>Grupo para el informe</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {etapas.map((e) => (
                <tr key={e.id}>
                  <td>{e.orden}</td>
                  <td>{e.nombre}</td>
                  <td>{NOMBRE_GRUPO[e.grupo]}</td>
                  <td>{e.activa ? "Activa" : "Inactiva"}</td>
                  <td>
                    <details>
                      <summary className="cursor-pointer text-xs text-primario">Editar</summary>
                      <FormularioAccion accion={accionGuardarEtapa} className="mt-2 grid min-w-[36rem] items-end gap-2 sm:grid-cols-5">
                        <input type="hidden" name="id" value={e.id} />
                        <CamposEtapa e={e} />
                        <Boton>Guardar</Boton>
                      </FormularioAccion>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="mt-4 mb-2 text-sm font-semibold">Nueva etapa</h3>
          <FormularioAccion accion={accionGuardarEtapa} reiniciar className="grid items-end gap-3 sm:grid-cols-5">
            <CamposEtapa e={{ orden: etapas.length + 1 }} />
            <Boton>Agregar etapa</Boton>
          </FormularioAccion>
        </Tarjeta>
      )}
    </div>
  );
}

function CamposEtapa({ e }: { e: { nombre?: string; grupo?: string; orden?: number; activa?: boolean } }) {
  return (
    <>
      <Campo etiqueta="Nombre">
        <Entrada name="nombre" required defaultValue={e.nombre} />
      </Campo>
      <Campo etiqueta="Grupo">
        <Selector name="grupo" defaultValue={e.grupo}>
          {Object.entries(NOMBRE_GRUPO).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Selector>
      </Campo>
      <Campo etiqueta="Orden">
        <Entrada name="orden" type="number" defaultValue={e.orden} />
      </Campo>
      <Campo etiqueta="Estado">
        <Selector name="activa" defaultValue={e.activa === false ? "false" : "true"}>
          <option value="true">Activa</option>
          <option value="false">Inactiva</option>
        </Selector>
      </Campo>
    </>
  );
}
