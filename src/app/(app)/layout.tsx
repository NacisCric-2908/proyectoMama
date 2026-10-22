import Link from "next/link";
import { signOut } from "@/lib/auth";
import { requerirSesion, tiene } from "@/lib/auth/sesion";
import type { ClavePermiso } from "@/lib/auth/permisos";
import { prisma } from "@/lib/db";

const MENU: { href: string; texto: string; permisos: ClavePermiso[] | null }[] = [
  { href: "/", texto: "Inicio", permisos: null },
  { href: "/ordenes", texto: "Órdenes", permisos: ["ordenes.verTodas", "ordenes.verPropias"] },
  { href: "/mis-horas", texto: "Mis horas", permisos: ["horas.registrarPropias"] },
  { href: "/clientes", texto: "Clientes", permisos: ["clientes.gestionar"] },
  { href: "/materiales", texto: "Materiales", permisos: ["materiales.gestionar"] },
  { href: "/inventario", texto: "Inventario", permisos: ["inventario.gestionar", "costos.ver"] },
  { href: "/trabajadores", texto: "Trabajadores", permisos: ["trabajadores.gestionar"] },
  { href: "/cif", texto: "CIF", permisos: ["cif.configurar", "cif.conciliar"] },
  { href: "/reportes/rentabilidad", texto: "Rentabilidad", permisos: ["margenes.ver"] },
  { href: "/admin", texto: "Administración", permisos: ["usuarios.gestionar", "parametros.gestionar"] },
];

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const u = await requerirSesion();
  const p = await prisma.parametrosGenerales.findUnique({ where: { id: 1 }, select: { nombreEmpresa: true } });

  async function salir() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-borde bg-superficie">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
          <Link href="/" className="font-semibold">
            {p?.nombreEmpresa ?? "Costeo"}
          </Link>
          <nav className="flex flex-1 flex-wrap gap-x-4 gap-y-1 text-sm">
            {MENU.filter((m) => !m.permisos || m.permisos.some((x) => tiene(u, x))).map((m) => (
              <Link key={m.href} href={m.href} className="text-tenue hover:text-texto">
                {m.texto}
              </Link>
            ))}
          </nav>
          <form action={salir} className="flex items-center gap-3 text-sm">
            <span className="text-tenue">
              {u.nombre} · {u.rolNombre}
            </span>
            <button className="text-primario hover:underline">Salir</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
