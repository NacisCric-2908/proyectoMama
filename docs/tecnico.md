# Documento técnico

## Arquitectura

```
src/lib/costeo/      Motor de cálculo puro (sin BD ni UI). Fórmulas, alertas, ciclo de estados, formato es-CO.
src/lib/servicios/   Reglas de aplicación sobre Prisma: órdenes, líneas, CIF, estados/cierre, catálogos, auditoría.
src/lib/auth/        Auth.js, catálogo de permisos y guardas (los permisos se verifican en el servidor).
src/app/(app)/       Pantallas (componentes de servidor) y Server Actions.
src/app/api/         Endpoints HTTP: Auth.js y PDF del informe.
src/components/      Componentes de interfaz; los formularios de líneas usan el motor en el navegador para el cálculo en vivo.
prisma/              Esquema, migraciones y semilla.
```

El mismo motor se ejecuta en el navegador (vista previa en vivo) y en el servidor (fuente de verdad al guardar y al cerrar). Al cerrar una orden el resumen completo se guarda como JSON en `OrdenProyecto.snapshotCierre`; las órdenes cerradas se muestran desde ese snapshot.

## Modelo de datos (Prisma)

| Entidad | Campos principales |
|---|---|
| Rol / Permiso / Usuario | Rol(clave, nombre); Permiso(rol, clave); Usuario(email, nombre, hash, rol, trabajador?, activo) |
| ParametrosGenerales | nombreEmpresa, logo, margenMinimoGlobal, formatoCodigoOrden, baseCifDefecto, umbralMermaPct, moneda |
| Cliente | nombre, nit, contacto, teléfono, correo, ciudad, activo, eliminadoEn |
| Material | código único, descripción, unidad, categoría, costoReferencia, activo, eliminadoEn |
| Trabajador / TarifaTrabajador | nombre, documento, cargo, tipo; costoHora, vigenteDesde, vigenteHasta (historial) |
| Etapa | nombre, grupo (INGENIERIA_AUTOMATIZACION / PRUEBAS_PUESTA_MARCHA), orden, activa |
| OrdenProyecto | código único, cliente, descripción, unidades, fechas, estado, responsable, valorCotizado, márgenes, factura, estimadoAlCotizar (JSON), snapshotCierre (JSON), cerradoPor/En, auditoría de creación/modificación |
| AsignacionTecnico | orden, trabajador (quién puede registrar horas) |
| ConsumoMaterial | orden, material, etapa?, requerida, entregada?, utilizada, devuelta, causa, clasificación y disposición de la merma, valor recuperado, costoUnitarioAplicado |
| RegistroMOD | orden, trabajador?/cargo, actividad, fecha, horas, tarifaAplicada |
| RegistroIngenieria | orden, etapa, responsable, fechaInicio, fechaFin, horas, costoHoraAplicado, descripción, observaciones |
| ServicioAdicionalEtapa | orden, etapa, descripción, valor |
| ParametroCIF | período (aaaa-mm, único), base, tasaDirecta?, cifPresupuestado?, baseEstimada? |
| AsignacionCIF | orden (única), período, base, tasaAplicada, cantidadBase, valorAsignado, justificación |
| PresupuestoOrden | orden, versión, MD, MOD, ingeniería, pruebas y PM, CIF, mermas, horas estimadas de ensamble e ingeniería, motivo, creado por/en, aprobado por/en |
| ConceptoCIFReal | período, concepto, valor, soporte (CIF real del período) |
| ConciliacionCIF | período, CIF real, CIF aplicado, diferencia, política, ajuste al costo de ventas, usuario, fecha, anulación (una vigente por período, índice único parcial) |
| AjusteCIFOrden | conciliación, orden, CIF aplicado, ajuste, costo acumulado, costo ajustado |
| MovimientoInventario | material, secuencia, fecha, tipo (entrada, salida a orden, devolución, ajuste ±), cantidad, costo unitario y total, saldo (cantidad, valor, costo promedio), orden y línea, documento, proveedor, solicitante, autorizado por |
| TasaActividadCIF | parámetro del período, actividad, tasa directa o CIF presupuestado e inductor estimado |
| ExplicacionDesviacion | orden, versión del presupuesto, componente, diferencia al explicar, causa declarada, explicación, soporte, usuario, fecha |
| HistorialEstado | orden, anterior, nuevo, comentario, usuario, fecha |
| Auditoria | entidad, id, campo, valor anterior, valor nuevo, usuario, fecha |

Tipos: cantidades y tasas `Decimal(18,4)` / `Decimal(18,6)`; dinero `Decimal(18,2)` o `Decimal(18,4)` para costos unitarios. Borrado lógico con `eliminadoEn`.

## Fórmulas (src/lib/costeo)

```
Merma                = Entregada − Utilizada − Devuelta      (error si < 0)
Costo línea          = Utilizada × Costo unitario aplicado
Costo merma          = Merma × Costo unitario aplicado
Dif. vs lista técnica = (Utilizada + Merma) − Requerida
Costo estimado mat.  = Σ Requerida × Costo unitario
Costo MOD            = Σ Horas × Tarifa aplicada
Costo etapa          = Σ Horas × Costo hora + Σ Servicios de la etapa
Costo directo        = Materiales directos + MOD
CIF                  = Horas MOD × tasa | (Horas MOD + Horas ing.) × tasa | Costo MOD × tasa % | Costo directo × tasa % | tasa por proyecto
Tasa predeterminada  = CIF presupuestado ÷ Base estimada   (× 100 en bases porcentuales)
Costo total          = Materiales + MOD + Ingeniería y PM + CIF + Mermas
Costo unitario       = Costo total ÷ Unidades
Margen bruto         = Cotizado − Costo total;  Margen % = Margen ÷ Cotizado × 100
Precio sugerido      = Costo total ÷ (1 − Margen esperado %)

Costo neto merma     = Merma × Costo unitario − Valor recuperado   (merma anormal excluida si la política lo indica)
Promedio ponderado   = (Valor del saldo + Cantidad × Costo de entrada) ÷ (Saldo + Cantidad)
Costo de salida      = Cantidad × Promedio vigente;  Costo de la línea = Σ costo salidas ÷ Σ cantidad salidas
CIF por actividades  = Σ (Inductor de la actividad × Tasa de la actividad)   (materiales: % del costo de materiales)
Diferencia vs presupuesto = Costo acumulado − Presupuesto (por componente; positiva = sobrecosto)
Diferencia de CIF    = CIF real del período − Σ CIF aplicado   (positiva = subaplicación)
Ajuste de la orden i = Diferencia × CIF aplicado_i ÷ Σ CIF aplicado   (política de prorrateo)
Costo ajustado_i     = Costo acumulado_i + Ajuste_i
```

Equivalencia con el modelo del artículo: Ci = MDi + MODens,i + MODing,i + CIFapl,i, donde MODing,i corresponde a «Ingeniería y automatización» + «Pruebas y puesta en marcha», y con la base «Horas totales del proyecto» CIFapl,i = TPC × HADi. Los cuatro conceptos del artículo son: precio (valor cotizado), presupuesto de costo (PresupuestoOrden), costo acumulado (resumen con CIF aplicado) y costo ajustado (AjusteCIFOrden).

Redondeo: cálculos con 40 dígitos de precisión; cada elemento se redondea a pesos (mitad hacia arriba) y el total es la suma de elementos redondeados.

## Endpoints y acciones

| Ruta / acción | Método | Permiso | Descripción |
|---|---|---|---|
| `/api/auth/*` | GET/POST | — | Inicio y cierre de sesión (Auth.js) |
| `/api/ordenes/{id}/pdf` | GET | costos.ver + acceso a la orden | Informe de cierre / resumen en PDF |
| `accionCrearOrden`, `accionActualizarOrden` | Server Action | ordenes.editar | Crear / editar orden |
| `accionCambiarEstado` | Server Action | ordenes.cambiarEstado / cerrar / reabrir | Cambios de estado, cierre, facturación, reapertura |
| `accionGuardarConsumo`, `accionGuardarServicio` | Server Action | ordenes.editar | Líneas de material y servicios |
| `accionGuardarMOD`, `accionGuardarIngenieria`, `accionEliminarLinea` | Server Action | ordenes.editar o horas.registrarPropias (solo propias, órdenes asignadas) | Registro de horas |
| `accionAsignarCIF` | Server Action | cif.asignar | Asignar / recalcular / cambiar base del CIF |
| `accionCrearPresupuesto`, `accionAprobarPresupuesto` | Server Action | ordenes.editar / presupuesto.aprobar | Versiones del presupuesto de costo |
| `accionAgregarConceptoCIF`, `accionEliminarConceptoCIF`, `accionConciliar`, `accionAnularConciliacion` | Server Action | cif.conciliar | CIF real, conciliación y costo ajustado |
| `accionEntrada`, `accionAjuste` | Server Action | inventario.gestionar | Entradas y ajustes del kárdex |
| `accionRequisicion`, `accionDevolucion` | Server Action | inventario.gestionar | Salidas a orden y devoluciones (orden abierta) |
| `accionExplicarDesviacion` | Server Action | ordenes.editar u ordenes.cerrar | Explicación documentada de diferencias |
| `/api/reportes/rentabilidad` | GET | margenes.ver | CSV de rentabilidad por cliente y proyecto |
| `accionGuardarParametroCIF` | Server Action | cif.configurar | Parámetros de CIF por período |
| Catálogos (`accionGuardarCliente`, `…Material`, `…Trabajador`, `accionNuevaTarifa`) | Server Action | clientes / materiales / trabajadores.gestionar | CRUD con borrado lógico |
| Administración (`accionGuardarUsuario`, `…Permisos`, `…Parametros`, `…Etapa`) | Server Action | usuarios / parametros.gestionar | Configuración |

Toda la lógica vive en `src/lib/servicios`; las acciones solo autentican, abren la transacción y traducen errores.

## Pruebas

- `src/lib/costeo/__tests__`: caso de aceptación §13, pruebas adicionales, presupuesto y conciliación del CIF; cobertura > 99 %.
- `src/lib/servicios/__tests__/*.integracion.test.ts`: CU-01, CU-02 y CU-03 contra PostgreSQL (permisos de técnico, CIF desactualizado, cierre, snapshot, reapertura); `presupuesto-conciliacion.integracion.test.ts`: versiones y aprobación del presupuesto, conciliación, bloqueo y anulación; `pendientes-articulo.integracion.test.ts`: kárdex, mermas, CIF por actividad, explicaciones y rentabilidad.
- `e2e/humo.spec.ts`: flujo completo en navegador.

## Seguridad y datos personales

Contraseñas con bcrypt; sesión JWT firmada con expiración de 8 h; middleware que exige sesión; cada acción verifica permisos en el servidor y los datos de costos no se envían a usuarios sin `costos.ver`. Auditoría de cambios en costos, tarifas, cantidades, estados y CIF. Datos personales de trabajadores y clientes tratados conforme a la Ley 1581 de 2012 (acceso restringido por rol).

## Concurrencia del kárdex

Cada movimiento bloquea la fila del material (`SELECT … FOR UPDATE`) dentro de la transacción antes de leer el saldo, de modo que dos requisiciones simultáneas no partan del mismo saldo.
