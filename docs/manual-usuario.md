# Manual de usuario

Ingrese con su correo y contraseña. El menú superior muestra solo las opciones de su rol.

## Conceptos rápidos

- **Orden de proyecto:** acumula todos los costos de un tablero o proyecto. Ciclo: Borrador → Cotizado → En ingeniería → En fabricación → En pruebas → En puesta en marcha → Terminado → Facturado (o Anulado antes de Terminado).
- **Merma** = entregada − utilizada − devuelta. Se muestra aparte; no se suma dentro de los materiales directos.
- **Costo total** = materiales directos + MOD + ingeniería y puesta en marcha + CIF + mermas. **Margen %** = (cotizado − costo) ÷ cotizado.
- **Alertas:** rojo (costo supera lo cotizado), amarillo (margen bajo el mínimo o consumo ≥ 90 % del cotizado), azul (merma alta, orden vencida).

## Coordinador de proyectos

1. **Órdenes → Nueva orden.** Complete cliente (o créelo con «+ Crear cliente nuevo»), descripción, unidades, fecha estimada de entrega, valor cotizado y márgenes. Marque los técnicos que podrán registrar horas. Se guarda como Borrador; el código se genera solo (OP-AAAA-NNNN) y se puede editar mientras sea Borrador.
2. **Pestaña Materiales.** Elija el material del catálogo (o «+ Nuevo material en catálogo») y registre las cantidades requerida, entregada, utilizada y devuelta. El formulario muestra al instante la merma, el costo y la diferencia contra la lista técnica. Si la utilizada más la devuelta supera la entregada, no deja guardar. El costo unitario se copia del catálogo y luego puede editarse; los cambios del catálogo no afectan la orden.
   - **Requisición de almacén:** si el material sale del almacén, regístrelo en «Requisición de almacén» (material, cantidad, solicitante, N.º de requisición). La salida se valora al costo promedio del kárdex y llena la cantidad entregada y el costo de la línea. Para el sobrante use «Devolver al almacén» en la línea.
   - **Mermas:** en cada línea indique la causa, la clasificación (normal, anormal o recuperable) y la disposición autorizada; si es recuperable, el valor recuperado.
3. **Pestaña Mano de obra.** Trabajador (o cargo), actividad, fecha y horas. La tarifa se prellena con la vigente en esa fecha.
4. **Pestaña Ingeniería y puesta en marcha.** Etapa, responsable, fechas, horas y descripción; servicios adicionales por etapa (transporte, alquiler, terceros). Muestra el resumen por etapa.
5. **Pestaña Presupuesto.** Registre el presupuesto de costo por componente (materiales, mano de obra, ingeniería, pruebas y puesta en marcha, CIF, mermas) y las horas estimadas, antes de iniciar la orden. Queda como versión 1 pendiente de aprobación. Si el cliente cambia la especificación, registre una nueva versión con el motivo.
6. **Cambiar estado** (panel bajo el encabezado). Para pasar a Cotizado se exige cliente, descripción, fecha de entrega y valor cotizado. Saltar o retroceder estados pide comentario.

## Ingeniero / Técnico

Entre a **Mis horas** (funciona en el celular). Elija una de sus órdenes asignadas y registre horas de fabricación o de una etapa técnica. Puede eliminar sus propios registros mientras la orden esté abierta. No se muestran costos ni tarifas.

## Contador

1. **CIF:** configure cada período (año-mes) con su base de asignación y la tasa directa, o el CIF presupuestado y la base estimada (tasa predeterminada = CIF ÷ base). Método del Excel actual: base «Costo de MOD», tasa 20 %.
2. **Pestaña CIF de la orden:** revise base, cantidad, tasa y valor. Si cambió el parámetro del período, use «Recalcular CIF». Para usar otra base o tasa en una orden concreta, indique la justificación.
3. **Cerrar la orden:** cambie el estado a Terminado. El sistema verifica que haya materiales u horas y CIF asignado; luego congela los valores y bloquea la edición. Después puede registrar la factura (Facturado: número y fecha).
4. **Aprobar presupuestos:** en la pestaña Presupuesto de la orden, botón «Aprobar». La primera versión aprobada es el presupuesto original y la última, el vigente; la pestaña Cotización y margen y el informe comparan ambos con el costo acumulado (monto, signo y porcentaje por componente, y horas estimadas vs. registradas).
5. **CIF real y conciliación:** en CIF, abra el período. Registre el CIF real por concepto (arriendo, energía, depreciación…) con su soporte. Cuando todas las órdenes del período estén cerradas, revise la vista previa, elija la política (prorrateo o costo de ventas) y pulse «Conciliar período». Cada orden muestra su costo ajustado y su margen ajustado. Para corregir, anule la conciliación con un motivo.
6. **Explicar desviaciones:** en Cotización y margen, cada diferencia frente al presupuesto tiene «Explicar»: elija la causa declarada, escriba la explicación y el soporte. Se puede hacer también con la orden cerrada.
7. **CIF por actividad (opcional):** al configurar un período elija la base «Tasas diferenciadas por actividad» y llene la tasa (o el CIF presupuestado y el inductor estimado) de cada actividad que use.
8. **Rentabilidad:** menú Rentabilidad, por cliente y por proyecto, con descarga CSV para Excel.
9. **Informe de cierre:** botón «Resumen de costos / Informe de cierre» en el encabezado; «Descargar PDF».

## Almacén e inventario (Coordinador o Administrador)

Menú **Inventario**: existencias, costo promedio y valor de cada material. Registre las **entradas** (compras, con factura y proveedor) y los **ajustes** por conteo físico (con motivo). Cada material tiene su **kárdex** con todos los movimientos y saldos. Los movimientos no se modifican: los errores se corrigen con devoluciones o ajustes, y las fechas no pueden ser anteriores al último movimiento del material.

## Gerencia

Consulta de inicio, órdenes, costos, márgenes, informes y PDF. No puede modificar.

## Administrador

Todo lo anterior y además, en **Administración**: parámetros generales (empresa, logo, margen mínimo global, formato del código, umbral de merma, tratamiento de la merma anormal), usuarios (rol, trabajador asociado, contraseña, activar/desactivar), matriz de permisos por rol y etapas técnicas. También gestiona **Trabajadores y tarifas** (cada nueva tarifa conserva el historial) y es el único que puede **reabrir** una orden cerrada (con justificación; queda en auditoría y el informe se regenera al volver a cerrar).
