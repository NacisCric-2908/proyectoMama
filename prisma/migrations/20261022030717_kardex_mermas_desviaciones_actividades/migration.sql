-- CreateEnum
CREATE TYPE "ClasificacionMerma" AS ENUM ('NORMAL', 'ANORMAL', 'RECUPERABLE');

-- CreateEnum
CREATE TYPE "CausaDesviacion" AS ENUM ('PRECIO_MATERIALES', 'CANTIDAD_MATERIALES', 'HORAS', 'TARIFAS', 'CAMBIO_CLIENTE', 'METODO_ESTIMACION', 'CIF', 'OTRA');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ENTRADA', 'SALIDA_ORDEN', 'DEVOLUCION_ORDEN', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO');

-- CreateEnum
CREATE TYPE "ActividadCIF" AS ENUM ('ENSAMBLE', 'INGENIERIA', 'PRUEBAS_PUESTA_MARCHA', 'MATERIALES');

-- AlterEnum
ALTER TYPE "BaseCIF" ADD VALUE 'ACTIVIDADES';

-- AlterTable
ALTER TABLE "AsignacionCIF" ADD COLUMN     "tasasActividad" JSONB;

-- AlterTable
ALTER TABLE "ConsumoMaterial" ADD COLUMN     "clasificacionMerma" "ClasificacionMerma",
ADD COLUMN     "disposicionMerma" TEXT,
ADD COLUMN     "valorRecuperado" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ParametrosGenerales" ADD COLUMN     "excluirMermaAnormal" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ExplicacionDesviacion" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "presupuestoId" TEXT NOT NULL,
    "componente" TEXT NOT NULL,
    "diferencia" DECIMAL(18,2) NOT NULL,
    "causa" "CausaDesviacion" NOT NULL,
    "explicacion" TEXT NOT NULL,
    "soporte" TEXT,
    "usuarioId" TEXT,
    "usuarioNombre" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExplicacionDesviacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoInventario" (
    "id" TEXT NOT NULL,
    "secuencia" SERIAL NOT NULL,
    "materialId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "cantidad" DECIMAL(18,4) NOT NULL,
    "costoUnitario" DECIMAL(18,4) NOT NULL,
    "costoTotal" DECIMAL(18,4) NOT NULL,
    "saldoCantidad" DECIMAL(18,4) NOT NULL,
    "saldoValor" DECIMAL(18,4) NOT NULL,
    "costoPromedio" DECIMAL(18,4) NOT NULL,
    "ordenId" TEXT,
    "consumoId" TEXT,
    "documento" TEXT,
    "tercero" TEXT,
    "solicitante" TEXT,
    "autorizadoPorId" TEXT,
    "autorizadoPorNombre" TEXT,
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoInventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TasaActividadCIF" (
    "id" TEXT NOT NULL,
    "parametroId" TEXT NOT NULL,
    "actividad" "ActividadCIF" NOT NULL,
    "tasaDirecta" DECIMAL(18,6),
    "cifPresupuestado" DECIMAL(18,2),
    "baseEstimada" DECIMAL(18,4),

    CONSTRAINT "TasaActividadCIF_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExplicacionDesviacion_presupuestoId_componente_key" ON "ExplicacionDesviacion"("presupuestoId", "componente");

-- CreateIndex
CREATE INDEX "MovimientoInventario_materialId_secuencia_idx" ON "MovimientoInventario"("materialId", "secuencia");

-- CreateIndex
CREATE INDEX "MovimientoInventario_ordenId_idx" ON "MovimientoInventario"("ordenId");

-- CreateIndex
CREATE UNIQUE INDEX "TasaActividadCIF_parametroId_actividad_key" ON "TasaActividadCIF"("parametroId", "actividad");

-- AddForeignKey
ALTER TABLE "ExplicacionDesviacion" ADD CONSTRAINT "ExplicacionDesviacion_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenProyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExplicacionDesviacion" ADD CONSTRAINT "ExplicacionDesviacion_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "PresupuestoOrden"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenProyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_consumoId_fkey" FOREIGN KEY ("consumoId") REFERENCES "ConsumoMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TasaActividadCIF" ADD CONSTRAINT "TasaActividadCIF_parametroId_fkey" FOREIGN KEY ("parametroId") REFERENCES "ParametroCIF"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nuevo permiso de inventario para el Coordinador en bases existentes
INSERT INTO "Permiso" ("id", "rolId", "clave")
SELECT 'perm_' || md5(r."id" || 'inventario.gestionar'), r."id", 'inventario.gestionar'
FROM "Rol" r WHERE r."clave" = 'COORDINADOR'
ON CONFLICT ("rolId", "clave") DO NOTHING;
