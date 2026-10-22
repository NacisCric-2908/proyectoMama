-- CreateEnum
CREATE TYPE "PoliticaAjusteCIF" AS ENUM ('PRORRATEO_CIF_APLICADO', 'COSTO_DE_VENTAS');

-- CreateTable
CREATE TABLE "PresupuestoOrden" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "materialesDirectos" DECIMAL(18,2) NOT NULL,
    "manoObraDirecta" DECIMAL(18,2) NOT NULL,
    "ingenieriaAutomatizacion" DECIMAL(18,2) NOT NULL,
    "pruebasPuestaMarcha" DECIMAL(18,2) NOT NULL,
    "cif" DECIMAL(18,2) NOT NULL,
    "mermas" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "horasEnsamble" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "horasIngenieria" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "motivo" TEXT,
    "creadoPorId" TEXT,
    "creadoPorNombre" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aprobadoPorId" TEXT,
    "aprobadoPorNombre" TEXT,
    "aprobadoEn" TIMESTAMP(3),

    CONSTRAINT "PresupuestoOrden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptoCIFReal" (
    "id" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "soporte" TEXT,
    "observaciones" TEXT,
    "creadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eliminadoEn" TIMESTAMP(3),

    CONSTRAINT "ConceptoCIFReal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConciliacionCIF" (
    "id" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "cifReal" DECIMAL(18,2) NOT NULL,
    "cifAplicado" DECIMAL(18,2) NOT NULL,
    "diferencia" DECIMAL(18,2) NOT NULL,
    "ajusteCostoVentas" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "politica" "PoliticaAjusteCIF" NOT NULL,
    "observaciones" TEXT,
    "usuarioId" TEXT,
    "usuarioNombre" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anuladaEn" TIMESTAMP(3),
    "anuladaPor" TEXT,
    "motivoAnulacion" TEXT,

    CONSTRAINT "ConciliacionCIF_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AjusteCIFOrden" (
    "id" TEXT NOT NULL,
    "conciliacionId" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "cifAplicado" DECIMAL(18,2) NOT NULL,
    "ajuste" DECIMAL(18,2) NOT NULL,
    "costoAcumulado" DECIMAL(18,2) NOT NULL,
    "costoAjustado" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "AjusteCIFOrden_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PresupuestoOrden_ordenId_version_key" ON "PresupuestoOrden"("ordenId", "version");

-- CreateIndex
CREATE INDEX "ConceptoCIFReal_periodo_idx" ON "ConceptoCIFReal"("periodo");

-- CreateIndex
CREATE INDEX "ConciliacionCIF_periodo_idx" ON "ConciliacionCIF"("periodo");

-- CreateIndex
CREATE INDEX "AjusteCIFOrden_ordenId_idx" ON "AjusteCIFOrden"("ordenId");

-- CreateIndex
CREATE UNIQUE INDEX "AjusteCIFOrden_conciliacionId_ordenId_key" ON "AjusteCIFOrden"("conciliacionId", "ordenId");

-- AddForeignKey
ALTER TABLE "PresupuestoOrden" ADD CONSTRAINT "PresupuestoOrden_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenProyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AjusteCIFOrden" ADD CONSTRAINT "AjusteCIFOrden_conciliacionId_fkey" FOREIGN KEY ("conciliacionId") REFERENCES "ConciliacionCIF"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AjusteCIFOrden" ADD CONSTRAINT "AjusteCIFOrden_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenProyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Solo una conciliación vigente (no anulada) por período
CREATE UNIQUE INDEX "ConciliacionCIF_periodo_vigente_key" ON "ConciliacionCIF"("periodo") WHERE "anuladaEn" IS NULL;

-- Nuevos permisos para el rol Contador en bases existentes (el Administrador tiene todos)
INSERT INTO "Permiso" ("id", "rolId", "clave")
SELECT 'perm_' || md5(r."id" || p.clave), r."id", p.clave
FROM "Rol" r CROSS JOIN (VALUES ('presupuesto.aprobar'), ('cif.conciliar')) AS p(clave)
WHERE r."clave" = 'CONTADOR'
ON CONFLICT ("rolId", "clave") DO NOTHING;
