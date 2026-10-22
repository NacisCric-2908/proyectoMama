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
3. **Pestaña Mano de obra.** Trabajador (o cargo), actividad, fecha y horas. La tarifa se prellena con la vigente en esa fecha.
4. **Pestaña Ingeniería y puesta en marcha.** Etapa, responsable, fechas, horas y descripción; servicios adicionales por etapa (transporte, alquiler, terceros). Muestra el resumen por etapa.
5. **Cambiar estado** (panel bajo el encabezado). Para pasar a Cotizado se exige cliente, descripción, fecha de entrega y valor cotizado. Saltar o retroceder estados pide comentario.

## Ingeniero / Técnico

Entre a **Mis horas** (funciona en el celular). Elija una de sus órdenes asignadas y registre horas de fabricación o de una etapa técnica. Puede eliminar sus propios registros mientras la orden esté abierta. No se muestran costos ni tarifas.

## Contador

1. **CIF:** configure cada período (año-mes) con su base de asignación y la tasa directa, o el CIF presupuestado y la base estimada (tasa predeterminada = CIF ÷ base). Método del Excel actual: base «Costo de MOD», tasa 20 %.
2. **Pestaña CIF de la orden:** revise base, cantidad, tasa y valor. Si cambió el parámetro del período, use «Recalcular CIF». Para usar otra base o tasa en una orden concreta, indique la justificación.
3. **Cerrar la orden:** cambie el estado a Terminado. El sistema verifica que haya materiales u horas y CIF asignado; luego congela los valores y bloquea la edición. Después puede registrar la factura (Facturado: número y fecha).
4. **Informe de cierre:** botón «Resumen de costos / Informe de cierre» en el encabezado; «Descargar PDF».

## Gerencia

Consulta de inicio, órdenes, costos, márgenes, informes y PDF. No puede modificar.

## Administrador

Todo lo anterior y además, en **Administración**: parámetros generales (empresa, logo, margen mínimo global, formato del código, umbral de merma), usuarios (rol, trabajador asociado, contraseña, activar/desactivar), matriz de permisos por rol y etapas técnicas. También gestiona **Trabajadores y tarifas** (cada nueva tarifa conserva el historial) y es el único que puede **reabrir** una orden cerrada (con justificación; queda en auditoría y el informe se regenera al volver a cerrar).
