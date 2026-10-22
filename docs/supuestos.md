# Supuestos y preguntas abiertas (sección 16)

Mientras la clienta no confirme, se usan los valores por defecto del documento de requisitos:

| # | Pregunta | Valor usado | Dónde cambiarlo |
|---|---|---|---|
| 1 | Fórmula de mermas | Merma = entregada − utilizada − devuelta | `src/lib/costeo/materiales.ts` |
| 2 | Costo directo como base de CIF | Solo materiales + MOD | `src/lib/costeo/totales.ts` |
| 3 | Proyectos del período (base «Número de proyectos») | Órdenes no anuladas terminadas en el mes; si no hay, la base estimada del período | `src/lib/servicios/cif.ts` |
| 4 | «Otros costos de producción» del Excel | Dentro de los CIF | — |
| 5 | Servicios adicionales de una etapa | Suman al costo de la etapa | `src/lib/costeo/ingenieria.ts` |
| 6 | Inventario | Catálogo con costo de referencia (sin kárdex) | Fase 3 |
| 7 | Visibilidad para técnicos | No ven costos, tarifas ni márgenes | Matriz de permisos (Administración) |
| 8 | Costo hora | Se ingresa ya «cargado»; no hay calculadora | — |
| 9 | Margen mínimo global | 15 % | Administración → Parámetros |
| 10 | IVA | El valor cotizado se registra antes de IVA | — |

## Supuestos adicionales de la implementación

- **Período de CIF de una orden:** el mes de su fecha de creación. La tasa queda guardada en la orden; si cambia el parámetro del período, la orden abierta muestra el aviso y el botón «Recalcular CIF».
- **Entregada sin registrar:** se asume igual a utilizada + devuelta (merma = 0).
- **Redondeo:** cada elemento del costo (materiales, MOD, cada etapa, CIF, mermas) se redondea a pesos y el costo total es la suma de los elementos redondeados, para que la tabla del informe sume exactamente. Redondeo «mitad hacia arriba».
- **Saltar estados:** saltar etapas hacia adelante y retroceder exigen comentario; facturar solo desde Terminado; reabrir (Terminado → En puesta en marcha) solo el administrador con justificación.
- **Alerta del 90 %:** se evalúa solo con la orden abierta (Borrador a En puesta en marcha).
- **Coordinador:** ve las órdenes de las que es responsable (permiso «Ver propias»). Contador y gerencia ven todas.
- **Estimado al cotizar:** se guarda al pasar de Borrador a Cotizado, con los materiales a su cantidad requerida y las horas registradas hasta ese momento (las horas estimadas por etapa son de la fase 3).
- **Logo:** se guarda en la base de datos (PNG/JPG, máx. 300 KB).
- **Presupuesto de costo:** versionado por orden; la primera versión aprobada es el presupuesto original y la última aprobada el vigente. Las versiones no se modifican (se crea otra con su motivo). Solo el usuario con permiso «Aprobar presupuestos» (por defecto Contador y Administrador) aprueba. No se exige presupuesto aprobado para activar la orden; la comparación avisa si falta.
- **Conciliación del CIF:** el CIF aplicado del período es el de las órdenes no anuladas cuyo CIF se asignó a ese período (mes de creación). Solo se concilia cuando todas están cerradas, porque el CIF de una orden abierta aún puede cambiar. Política por defecto: prorrateo de la diferencia según el CIF aplicado de cada orden (el residuo de redondeo va a la orden con mayor CIF aplicado); alternativa: llevarla al costo de ventas sin modificar las órdenes. Una orden de un período conciliado no se puede reabrir hasta anular la conciliación.
- **Costo ajustado:** se guarda aparte del snapshot de cierre; el informe muestra el costo acumulado (con CIF aplicado) y, si existe, el costo ajustado y el margen ajustado.

## Kárdex, mermas, desviaciones, CIF por actividad y rentabilidad

- **Kárdex:** inventario perpetuo con promedio ponderado (NIIF para las PYMES, Sección 13). Las salidas a órdenes se valoran al promedio vigente; las devoluciones, al costo con que salieron; los ajustes negativos, al promedio; los positivos, al costo indicado o al promedio. Los movimientos no se editan ni se borran y no se admiten fechas anteriores al último movimiento del material, para que no cambie el costo de salidas ya cargadas a órdenes. El cálculo usa 4 decimales.
- **Órdenes y kárdex:** una línea de material que recibe requisiciones toma del kárdex la cantidad entregada, la devuelta y el costo unitario (promedio de sus salidas); la cantidad utilizada se sigue registrando a mano. Las órdenes con cantidades manuales (como la demo OP-2026-0001) siguen funcionando, pero una misma línea no mezcla cantidades manuales con requisiciones. Las compras se registran como entradas con factura y proveedor; no hay módulo de compras.
- **Clasificación de mermas:** normal, anormal o recuperable, con disposición autorizada. El valor recuperado (solo en mermas recuperables) reduce el costo de la merma. Política configurable: por defecto la merma anormal se incluye en el costo de la orden; si se activa, se reconoce como pérdida del período y se muestra aparte.
- **Explicación de desviaciones:** una por componente y versión de presupuesto aprobada; guarda la diferencia vigente al momento de explicarla. La causa es declarada: no demuestra causalidad. Se puede registrar con la orden cerrada.
- **CIF por actividad:** base opcional «Tasas diferenciadas por actividad» con cuatro actividades e inductores: ensamble (horas de MOD), ingeniería y automatización (sus horas), pruebas y puesta en marcha (sus horas) y manejo de materiales (% del costo de materiales directos). Cada actividad tiene tasa directa o predeterminada. Solo se usa desde los parámetros del período; no como cambio manual en una orden.
- **Rentabilidad por cliente:** sobre órdenes cerradas, filtradas por fecha de terminación; usa el costo congelado al cierre y el costo ajustado si el período está conciliado. Exportación CSV con separador «;» y coma decimal para Excel en español.
