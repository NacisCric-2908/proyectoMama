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
