import type { Prisma, PrismaClient } from "@prisma/client";

export type Tx = Prisma.TransactionClient | PrismaClient;

/** Error de regla de negocio: su mensaje se muestra tal cual al usuario. */
export class ErrorNegocio extends Error {
  constructor(
    message: string,
    public readonly detalles?: string[],
  ) {
    super(message);
    this.name = "ErrorNegocio";
  }
}

/** 'aaaa-mm-dd' → Date (medianoche UTC, para columnas @db.Date). */
export function aFechaDB(iso: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new ErrorNegocio(`Fecha inválida: ${iso}`);
  return new Date(`${iso}T00:00:00Z`);
}

/** Date de columna @db.Date → 'aaaa-mm-dd'. */
export function aISO(fecha: Date | null | undefined): string | null {
  return fecha ? fecha.toISOString().slice(0, 10) : null;
}

/** Decimal de Prisma (o null) → string. */
export function txt(v: { toString(): string } | null | undefined): string | null {
  return v === null || v === undefined ? null : v.toString();
}

export function periodoDe(iso: string): string {
  return iso.slice(0, 7);
}
