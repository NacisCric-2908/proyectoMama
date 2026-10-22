import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/** Crea (si no existe) y migra la base de pruebas (sin borrar datos: las pruebas crean datos únicos), y aplica la semilla base sin datos demo. */
export default async function prepararBD() {
  const url = process.env.DATABASE_URL_TEST ?? "postgresql://costeo:costeo@localhost:5433/costeo_test";
  const nombre = new URL(url).pathname.slice(1);
  const admin = new PrismaClient({ datasourceUrl: url.replace(new RegExp(`/${nombre}$`), "/postgres") });
  const existe = await admin.$queryRawUnsafe<unknown[]>(`SELECT 1 FROM pg_database WHERE datname = '${nombre}'`);
  if (existe.length === 0) await admin.$executeRawUnsafe(`CREATE DATABASE "${nombre}"`);
  await admin.$disconnect();
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url, SEMILLA_DEMO: "false", PRISMA_HIDE_UPDATE_MESSAGE: "1" };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "pipe" });
}
