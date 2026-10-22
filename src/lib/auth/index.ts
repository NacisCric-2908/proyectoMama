import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authConfig } from "./auth.config";

const esquemaLogin = z.object({ email: z.string().email(), password: z.string().min(1) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credenciales) {
        const datos = esquemaLogin.safeParse(credenciales);
        if (!datos.success) throw new CredentialsSignin();
        const usuario = await prisma.usuario.findUnique({ where: { email: datos.data.email.toLowerCase() } });
        if (!usuario || !usuario.activo) return null;
        const valida = await bcrypt.compare(datos.data.password, usuario.hashContrasena);
        if (!valida) return null;
        return { id: usuario.id, name: usuario.nombre, email: usuario.email };
      },
    }),
  ],
});
