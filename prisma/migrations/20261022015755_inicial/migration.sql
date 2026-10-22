-- CreateEnum
CREATE TYPE "TipoTrabajador" AS ENUM ('FABRICACION', 'INGENIERIA', 'AMBOS');

-- CreateEnum
CREATE TYPE "GrupoEtapa" AS ENUM ('INGENIERIA_AUTOMATIZACION', 'PRUEBAS_PUESTA_MARCHA');

-- CreateEnum
CREATE TYPE "EstadoOrden" AS ENUM ('BORRADOR', 'COTIZADO', 'EN_INGENIERIA', 'EN_FABRICACION', 'EN_PRUEBAS', 'EN_PUESTA_MARCHA', 'TERMINADO', 'FACTURADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "BaseCIF" AS ENUM ('HORAS_MOD', 'HORAS_TOTALES', 'COSTO_MOD', 'COSTO_DIRECTO', 'NUMERO_PROYECTOS');

-- CreateTable
CREATE TABLE "Rol" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permiso" (
    "id" TEXT NOT NULL,
    "rolId" TEXT NOT NULL,
    "clave" TEXT NOT NULL,

    CONSTRAINT "Permiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "hashContrasena" TEXT NOT NULL,
    "rolId" TEXT NOT NULL,
    "trabajadorId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametrosGenerales" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "nombreEmpresa" TEXT NOT NULL,
    "logo" TEXT,
    "margenMinimoGlobal" DECIMAL(9,4) NOT NULL DEFAULT 15,
    "formatoCodigoOrden" TEXT NOT NULL DEFAULT 'OP-{AAAA}-{NNNN}',
    "baseCifDefecto" "BaseCIF" NOT NULL DEFAULT 'HORAS_MOD',
    "umbralMermaPct" DECIMAL(9,4) NOT NULL DEFAULT 10,
    "moneda" TEXT NOT NULL DEFAULT 'COP',
    "modificadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParametrosGenerales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nit" TEXT,
    "contacto" TEXT,
    "telefono" TEXT,
    "correo" TEXT,
    "ciudad" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificadoEn" TIMESTAMP(3) NOT NULL,
    "eliminadoEn" TIMESTAMP(3),

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "costoReferencia" DECIMAL(18,4) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificadoEn" TIMESTAMP(3) NOT NULL,
    "eliminadoEn" TIMESTAMP(3),

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trabajador" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "documento" TEXT,
    "cargo" TEXT NOT NULL,
    "tipo" "TipoTrabajador" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificadoEn" TIMESTAMP(3) NOT NULL,
    "eliminadoEn" TIMESTAMP(3),

    CONSTRAINT "Trabajador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarifaTrabajador" (
    "id" TEXT NOT NULL,
    "trabajadorId" TEXT NOT NULL,
    "costoHora" DECIMAL(18,4) NOT NULL,
    "vigenteDesde" DATE NOT NULL,
    "vigenteHasta" DATE,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TarifaTrabajador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Etapa" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "grupo" "GrupoEtapa" NOT NULL,
    "orden" INTEGER NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Etapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenProyecto" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "clienteId" TEXT,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "cantidadUnidades" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "fechaCreacion" DATE NOT NULL,
    "fechaEstimadaEntrega" DATE,
    "fechaTerminacion" DATE,
    "estado" "EstadoOrden" NOT NULL DEFAULT 'BORRADOR',
    "responsableId" TEXT,
    "valorCotizado" DECIMAL(18,2),
    "margenEsperadoPct" DECIMAL(9,4),
    "margenMinimoPct" DECIMAL(9,4),
    "numeroFactura" TEXT,
    "fechaFactura" DATE,
    "observaciones" TEXT,
    "estimadoAlCotizar" JSONB,
    "snapshotCierre" JSONB,
    "cerradoPorId" TEXT,
    "cerradoEn" TIMESTAMP(3),
    "creadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificadoPorId" TEXT,
    "modificadoEn" TIMESTAMP(3) NOT NULL,
    "eliminadoEn" TIMESTAMP(3),

    CONSTRAINT "OrdenProyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsignacionTecnico" (
    "ordenId" TEXT NOT NULL,
    "trabajadorId" TEXT NOT NULL,

    CONSTRAINT "AsignacionTecnico_pkey" PRIMARY KEY ("ordenId","trabajadorId")
);

-- CreateTable
CREATE TABLE "ConsumoMaterial" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "etapaId" TEXT,
    "cantidadRequerida" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "cantidadEntregada" DECIMAL(18,4),
    "cantidadUtilizada" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "cantidadDevuelta" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "causaMerma" TEXT,
    "costoUnitarioAplicado" DECIMAL(18,4) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificadoEn" TIMESTAMP(3) NOT NULL,
    "eliminadoEn" TIMESTAMP(3),

    CONSTRAINT "ConsumoMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroMOD" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "trabajadorId" TEXT,
    "cargo" TEXT,
    "actividad" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "horas" DECIMAL(18,4) NOT NULL,
    "tarifaAplicada" DECIMAL(18,4) NOT NULL,
    "creadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificadoEn" TIMESTAMP(3) NOT NULL,
    "eliminadoEn" TIMESTAMP(3),

    CONSTRAINT "RegistroMOD_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroIngenieria" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "responsableId" TEXT NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "horas" DECIMAL(18,4) NOT NULL,
    "costoHoraAplicado" DECIMAL(18,4) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "observacionesTecnicas" TEXT,
    "creadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificadoEn" TIMESTAMP(3) NOT NULL,
    "eliminadoEn" TIMESTAMP(3),

    CONSTRAINT "RegistroIngenieria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicioAdicionalEtapa" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "etapaId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificadoEn" TIMESTAMP(3) NOT NULL,
    "eliminadoEn" TIMESTAMP(3),

    CONSTRAINT "ServicioAdicionalEtapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametroCIF" (
    "id" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "base" "BaseCIF" NOT NULL,
    "tasaDirecta" DECIMAL(18,6),
    "cifPresupuestado" DECIMAL(18,2),
    "baseEstimada" DECIMAL(18,4),
    "observaciones" TEXT,
    "modificadoEn" TIMESTAMP(3) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParametroCIF_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsignacionCIF" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "base" "BaseCIF" NOT NULL,
    "tasaAplicada" DECIMAL(18,6) NOT NULL,
    "cantidadBase" DECIMAL(18,4) NOT NULL,
    "valorAsignado" DECIMAL(18,2) NOT NULL,
    "justificacionCambioBase" TEXT,
    "usuarioId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AsignacionCIF_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistorialEstado" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "estadoAnterior" "EstadoOrden",
    "estadoNuevo" "EstadoOrden" NOT NULL,
    "comentario" TEXT,
    "usuarioId" TEXT,
    "usuarioNombre" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialEstado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "valorAnterior" TEXT,
    "valorNuevo" TEXT,
    "usuarioId" TEXT,
    "usuarioNombre" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rol_clave_key" ON "Rol"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "Permiso_rolId_clave_key" ON "Permiso"("rolId", "clave");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_trabajadorId_key" ON "Usuario"("trabajadorId");

-- CreateIndex
CREATE UNIQUE INDEX "Material_codigo_key" ON "Material"("codigo");

-- CreateIndex
CREATE INDEX "TarifaTrabajador_trabajadorId_vigenteDesde_idx" ON "TarifaTrabajador"("trabajadorId", "vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "Etapa_nombre_key" ON "Etapa"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenProyecto_codigo_key" ON "OrdenProyecto"("codigo");

-- CreateIndex
CREATE INDEX "OrdenProyecto_estado_idx" ON "OrdenProyecto"("estado");

-- CreateIndex
CREATE INDEX "OrdenProyecto_clienteId_idx" ON "OrdenProyecto"("clienteId");

-- CreateIndex
CREATE INDEX "ConsumoMaterial_ordenId_idx" ON "ConsumoMaterial"("ordenId");

-- CreateIndex
CREATE INDEX "RegistroMOD_ordenId_idx" ON "RegistroMOD"("ordenId");

-- CreateIndex
CREATE INDEX "RegistroIngenieria_ordenId_idx" ON "RegistroIngenieria"("ordenId");

-- CreateIndex
CREATE INDEX "ServicioAdicionalEtapa_ordenId_idx" ON "ServicioAdicionalEtapa"("ordenId");

-- CreateIndex
CREATE UNIQUE INDEX "ParametroCIF_periodo_key" ON "ParametroCIF"("periodo");

-- CreateIndex
CREATE UNIQUE INDEX "AsignacionCIF_ordenId_key" ON "AsignacionCIF"("ordenId");

-- CreateIndex
CREATE INDEX "HistorialEstado_ordenId_idx" ON "HistorialEstado"("ordenId");

-- CreateIndex
CREATE INDEX "Auditoria_entidad_entidadId_idx" ON "Auditoria"("entidad", "entidadId");

-- AddForeignKey
ALTER TABLE "Permiso" ADD CONSTRAINT "Permiso_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_trabajadorId_fkey" FOREIGN KEY ("trabajadorId") REFERENCES "Trabajador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarifaTrabajador" ADD CONSTRAINT "TarifaTrabajador_trabajadorId_fkey" FOREIGN KEY ("trabajadorId") REFERENCES "Trabajador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenProyecto" ADD CONSTRAINT "OrdenProyecto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenProyecto" ADD CONSTRAINT "OrdenProyecto_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionTecnico" ADD CONSTRAINT "AsignacionTecnico_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenProyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumoMaterial" ADD CONSTRAINT "ConsumoMaterial_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenProyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumoMaterial" ADD CONSTRAINT "ConsumoMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumoMaterial" ADD CONSTRAINT "ConsumoMaterial_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroMOD" ADD CONSTRAINT "RegistroMOD_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenProyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroMOD" ADD CONSTRAINT "RegistroMOD_trabajadorId_fkey" FOREIGN KEY ("trabajadorId") REFERENCES "Trabajador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroIngenieria" ADD CONSTRAINT "RegistroIngenieria_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenProyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroIngenieria" ADD CONSTRAINT "RegistroIngenieria_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroIngenieria" ADD CONSTRAINT "RegistroIngenieria_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Trabajador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioAdicionalEtapa" ADD CONSTRAINT "ServicioAdicionalEtapa_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenProyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioAdicionalEtapa" ADD CONSTRAINT "ServicioAdicionalEtapa_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "Etapa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionCIF" ADD CONSTRAINT "AsignacionCIF_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenProyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialEstado" ADD CONSTRAINT "HistorialEstado_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenProyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
