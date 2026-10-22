import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { obtenerUsuario } from "@/lib/auth/sesion";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await obtenerUsuario()) redirect("/");
  const { error } = await searchParams;

  async function ingresar(fd: FormData) {
    "use server";
    try {
      await signIn("credentials", { email: fd.get("email"), password: fd.get("password"), redirectTo: "/" });
    } catch (e) {
      if (e instanceof AuthError) redirect("/login?error=1");
      throw e;
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={ingresar} className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-borde bg-superficie p-6">
        <h1 className="text-lg font-semibold">Costeo de proyectos</h1>
        <p className="text-sm text-tenue">Ingrese con su correo y contraseña.</p>
        <label className="flex flex-col gap-1 text-sm">
          Correo
          <input name="email" type="email" required autoComplete="email" className="entrada" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Contraseña
          <input name="password" type="password" required autoComplete="current-password" className="entrada" />
        </label>
        {error && <p className="text-sm text-peligro">Correo o contraseña incorrectos.</p>}
        <button className="rounded-md bg-primario px-3 py-2 text-sm font-medium text-white hover:bg-primario-hover">Ingresar</button>
      </form>
    </main>
  );
}
