# PROMPT — Desarrollo del Sistema de Costeo por Órdenes de Proyecto para tableros eléctricos

## 0. Tu rol y cómo debes trabajar

Actúa como un equipo de desarrollo de software senior (analista funcional, arquitecto, desarrollador full-stack y QA). Vas a construir una aplicación web interna para determinar el costo real de cada proyecto de tablero eléctrico en una microempresa colombiana de automatización industrial, usando el sistema de **costeo por órdenes de producción**.

Reglas de trabajo:

1. Antes de escribir código, entrega: (a) el modelo de datos propuesto (entidades, campos, relaciones), (b) la lista de pantallas y (c) cualquier duda o supuesto. Espera confirmación.
2. Implementa el **motor de cálculo** como funciones puras, independientes de la interfaz y de la base de datos, con pruebas unitarias. El caso de aceptación de la sección 13 debe pasar exactamente.
3. Trabaja por fases (sección 15). Al final de cada fase entrega: código, migraciones, datos de prueba, pruebas y una breve guía de uso.
4. Nunca uses tipos de punto flotante para dinero. Usa enteros (pesos) o decimal de precisión fija.
5. Toda la interfaz, mensajes, reportes y documentación van en **español (Colombia)**.
6. Si una regla de este documento es ambigua, no la inventes: márcala como pregunta abierta y usa el valor por defecto indicado aquí.

---

## 1. Contexto del negocio

La empresa fabrica tableros eléctricos a la medida y presta servicios de ingeniería y automatización industrial (diseño, programación de PLC/HMI, configuración, pruebas y puesta en marcha). Cada tablero o proyecto es único: no se produce por volumen, sino por pedido de un cliente.

Hoy los costos se estiman de forma empírica, con base en proyectos anteriores, lo que genera subvaloraciones o sobrevaloraciones del costo y afecta la fijación de precios.

La aplicación debe convertir **cada tablero o proyecto en una orden de costeo** y acumular en ella cinco elementos:

1. Materiales directos.
2. Mano de obra directa (fabricación/ensamble).
3. Ingeniería, automatización, pruebas y puesta en marcha.
4. Costos indirectos de fabricación (CIF) asignados.
5. Mermas o desperdicios de materiales.

Con eso determina el **costo total** y el **costo unitario** del proyecto, y lo compara con el **valor cotizado** al cliente para obtener el margen.

La empresa hoy calcula costos en Excel con la misma lógica de elementos del costo (materia prima directa, mano de obra directa, CIF como porcentaje de la MOD y otros costos de producción). La aplicación debe soportar esa misma lógica, adaptada a órdenes únicas.

## 2. Alcance

**Dentro del alcance:** órdenes de proyecto, catálogo de materiales, registro de consumo y mermas por orden, trabajadores y tarifas, registro de horas de fabricación e ingeniería, configuración y asignación de CIF, cotización y márgenes, alertas, reportes y exportación.

**Fuera del alcance (no construir):** contabilidad general, nómina, facturación electrónica DIAN, compras a proveedores, CRM. La aplicación no es un ERP; es un sistema de apoyo al costeo. El estado "Facturado" solo registra que la orden se facturó (número y fecha de factura), no genera facturas.

## 3. Usuarios, roles y permisos

| Rol | Puede |
|---|---|
| Administrador | Todo. Gestiona usuarios, roles, parámetros generales, catálogo y tarifas. Puede reabrir órdenes cerradas. |
| Contador | Configura CIF (bases, tasas, valores del período), revisa y cierra órdenes, ve todos los costos y márgenes, genera reportes. |
| Coordinador de proyectos | Crea y edita órdenes, registra materiales, MOD y mermas, cambia estados, ve costos y márgenes de sus órdenes. |
| Ingeniero / Técnico | Registra sus propias horas y actividades (fabricación o ingeniería) en las órdenes asignadas. No ve valor cotizado ni márgenes. |
| Gerencia (solo lectura) | Consulta órdenes, costos, márgenes y reportes. |

Los permisos deben ser configurables por el administrador. Cada usuario inicia sesión con correo y contraseña.

## 4. Conceptos y glosario

- **Orden de proyecto (orden de costeo):** unidad que acumula todos los costos de un tablero o proyecto. Tiene un código único.
- **Lista técnica (BOM):** materiales y cantidades que el diseño requiere.
- **Cantidad requerida:** lo que dice la lista técnica.
- **Cantidad entregada:** lo que salió de almacén hacia la orden.
- **Cantidad utilizada:** lo que quedó efectivamente incorporado en el tablero.
- **Cantidad devuelta:** lo que regresó a almacén sin usarse.
- **Merma:** material entregado que se dañó, desperdició o perdió y no se incorporó ni se devolvió.
- **MOD:** mano de obra directa de fabricación (ensamble, cableado, montaje).
- **Ingeniería y puesta en marcha:** horas de ingenieros, técnicos o auxiliares en etapas técnicas (ver sección 6.3).
- **CIF:** costos indirectos de fabricación (arriendo, servicios, depreciación de herramientas, supervisión, consumibles, etc.) que se reparten entre las órdenes.
- **Costo hora:** costo para la empresa de una hora del trabajador. Se recomienda que sea el costo "cargado" (salario + prestaciones sociales + seguridad social + parafiscales ÷ horas laborables). La aplicación solo usa el valor que se configure.

---

## 5. Modelo de datos (mínimo)

Propón el modelo definitivo, pero debe incluir al menos:

**Cliente:** id, nombre o razón social, NIT/cédula, contacto, teléfono, correo, ciudad, activo.

**OrdenProyecto:** id, código (único, autogenerado con formato configurable, por ejemplo `OP-2026-0001`, editable antes de activar), cliente, descripción del tablero o proyecto, cantidad de unidades (por defecto 1), fecha de creación, fecha estimada de entrega, fecha real de terminación, estado, responsable/coordinador, valor cotizado, margen esperado %, margen mínimo % (por defecto el global), número y fecha de factura, observaciones, totales calculados guardados al cierre (snapshot), usuario y fecha de creación y modificación.

**Material (catálogo):** id, código (único), descripción, unidad de medida, categoría (PLC, HMI, protecciones, cableado, gabinetes, borneras, etc.), costo unitario de referencia, activo.

**ConsumoMaterial (línea por orden):** id, orden, material, etapa asociada (opcional), cantidad requerida, cantidad entregada, cantidad utilizada, cantidad devuelta, cantidad de merma (calculada, ver 6.1), causa de la merma (opcional), costo unitario **aplicado** (se copia del catálogo al crear la línea y puede editarse; cambios posteriores en el catálogo no afectan la orden), costo total calculado.

**Trabajador:** id, nombre, documento, cargo (ensamblador, técnico, auxiliar, ingeniero electrónico, ingeniero de automatización, etc.), tipo (fabricación, ingeniería o ambos), activo.

**TarifaTrabajador:** trabajador, costo hora, vigente desde, vigente hasta. Se debe conservar el historial.

**RegistroMOD (fabricación):** id, orden, trabajador o cargo, actividad realizada, fecha, horas, tarifa por hora **aplicada** (se toma la tarifa vigente en la fecha y se guarda en el registro), costo total calculado.

**RegistroIngenieria:** id, orden, etapa (ver 6.3), responsable, fecha de inicio, fecha de finalización, horas dedicadas, costo hora **aplicado**, descripción de la actividad, observaciones técnicas, costo calculado.

**ServicioAdicionalEtapa:** id, orden, etapa, descripción (por ejemplo, alquiler de equipo, transporte al sitio, servicio de un tercero), valor. Los **materiales** usados en una etapa no van aquí: se registran como ConsumoMaterial con la etapa asociada.

**ParametroCIF (por período):** período (año-mes), base de asignación, tasa (o valores para calcularla), valor total de CIF del período, base total estimada del período, observaciones.

**AsignacionCIF (por orden):** orden, base de asignación usada, cantidad de la base, tasa aplicada, valor asignado, fecha, usuario.

**HistorialEstado:** orden, estado anterior, estado nuevo, fecha, usuario, comentario.

**Auditoria:** entidad, id, campo, valor anterior, valor nuevo, usuario, fecha.

**ParametrosGenerales:** nombre de la empresa, logo, margen mínimo global %, formato de código de orden, base de CIF por defecto, moneda (COP).

---

## 6. Reglas de cálculo (motor de costeo)

Todas las fórmulas se aplican por orden. Los resultados se recalculan en tiempo real mientras la orden esté abierta y se congelan al cerrarla.

### 6.1 Materiales directos y mermas

Por cada línea de material:

```
Cantidad de merma        = Cantidad entregada − Cantidad utilizada − Cantidad devuelta
Costo línea de material  = Cantidad utilizada × Costo unitario aplicado
Costo línea de merma     = Cantidad de merma × Costo unitario aplicado
Diferencia vs lista técnica (informativa) = (Cantidad utilizada + Cantidad de merma) − Cantidad requerida
```

Totales de la orden:

```
Costo de materiales directos = Σ (Cantidad utilizada × Costo unitario)
Costo de mermas              = Σ (Cantidad de merma × Costo unitario)
```

Reglas:
- Si no se ha registrado la cantidad entregada, se asume igual a la utilizada (merma = 0).
- La merma no puede ser negativa. Si da negativa, bloquear el guardado con el mensaje: "La cantidad utilizada más la devuelta supera la entregada".
- La merma **no** se suma dentro de los materiales directos; se muestra en su propia línea para no contarla dos veces.
- Mostrar la diferencia vs lista técnica (en cantidad y en valor) para detectar sobreconsumos (positiva) o ahorros (negativa).
- Mientras la orden esté en Borrador o Cotizado y aún no haya cantidad utilizada, mostrar un **costo estimado de materiales** = Σ (Cantidad requerida × Costo unitario).

> Nota: el planteamiento original de la clienta definía Costo de mermas = Σ (Cantidad requerida − Cantidad utilizada) × Costo unitario. Esa fórmula da valores negativos cuando se consume más de lo previsto y, cuando se consume menos, mide material no usado (que debería devolverse), no desperdicio. Por eso se usa la definición anterior. **Confirmar con la clienta** (ver sección 16).

### 6.2 Mano de obra directa (fabricación)

```
Costo de MOD = Σ (Horas trabajadas × Tarifa por hora aplicada)
Horas MOD    = Σ Horas trabajadas
```

### 6.3 Ingeniería, automatización, pruebas y puesta en marcha

Etapas (catálogo fijo, ampliable por el administrador):

| Etapa | Grupo para el informe |
|---|---|
| Ingeniería conceptual | Ingeniería y automatización |
| Ingeniería de detalle | Ingeniería y automatización |
| Programación (PLC/HMI) | Ingeniería y automatización |
| Configuración de equipos | Ingeniería y automatización |
| Pruebas | Pruebas y puesta en marcha |
| Puesta en marcha | Pruebas y puesta en marcha |
| Soporte | Pruebas y puesta en marcha |

```
Costo de la etapa e = Σ (Horas de la etapa × Costo hora aplicado) + Σ Servicios adicionales de la etapa
Costo de ingeniería y puesta en marcha = Σ Costo de todas las etapas
Horas de ingeniería = Σ Horas de todas las etapas
```

Validaciones: fecha de finalización ≥ fecha de inicio; horas > 0; advertir (sin bloquear) si las horas superan los días hábiles del rango × 10.

### 6.4 Costo directo

```
Costo directo total = Costo de materiales directos + Costo de MOD
```

### 6.5 Costos indirectos de fabricación (CIF)

El contador elige la base de asignación por período (y puede cambiarla en una orden específica, con justificación). Bases soportadas:

| Base | Cantidad de la base en la orden | Unidad de la tasa | Fórmula |
|---|---|---|---|
| Horas de MOD | Horas MOD | $ por hora | CIF = Horas MOD × Tasa |
| Horas totales del proyecto | Horas MOD + Horas de ingeniería | $ por hora | CIF = Horas totales × Tasa |
| Costo de MOD (método del Excel actual) | Costo de MOD | % | CIF = Costo MOD × Tasa % |
| Costo directo | Costo directo total (6.4) | % | CIF = Costo directo × Tasa % |
| Número de proyectos | 1 | $ por proyecto | CIF = CIF del período ÷ N.º de proyectos del período |

La tasa se puede ingresar directamente o calcularse como **tasa predeterminada**:

```
Tasa = CIF presupuestado del período ÷ Base total estimada del período
```

Ejemplo de la empresa: CIF = 20 % sobre la MOD → con MOD de $80.000, CIF = $16.000.

Reglas:
- La tasa aplicada se guarda en la orden (snapshot). Si luego cambia el parámetro del período, la orden abierta muestra un aviso y un botón "Recalcular CIF". La orden cerrada no cambia.
- Para la base "Número de proyectos", N.º de proyectos del período = órdenes no anuladas cuya fecha de terminación cae en el período (o, si aún no termina, el valor estimado configurado). Confirmar este criterio.
- Opcional (fase 3): reporte de CIF real del período vs CIF aplicado (sub o sobreaplicación).

### 6.6 Costo total, costo unitario, margen y precio sugerido

```
Costo total del proyecto = Materiales directos + MOD + Ingeniería y puesta en marcha + CIF asignados + Mermas
Costo unitario           = Costo total del proyecto ÷ Cantidad de unidades de la orden
Margen bruto             = Valor cotizado − Costo total del proyecto
Margen %                 = Margen bruto ÷ Valor cotizado × 100
Precio de venta sugerido = Costo total ÷ (1 − Margen esperado % ÷ 100)
```

- El margen se calcula **sobre el precio de venta** (valor cotizado), igual que el planteamiento de la clienta. Por eso el precio sugerido divide por (1 − margen); no usar la multiplicación costo × (1 + margen), que da un margen distinto al esperado.
- Si el valor cotizado es 0 o está vacío, no calcular el margen % y mostrar "Sin cotización".
- El margen esperado debe ser menor que 100 %.

### 6.7 Alertas

| Condición | Nivel | Mensaje |
|---|---|---|
| Costo total > Valor cotizado | Crítica (rojo) | "El costo del proyecto supera el valor cotizado en $X" |
| Margen % < Margen mínimo % | Advertencia (amarillo) | "El margen (X %) está por debajo del mínimo definido (Y %)" |
| Costo acumulado ≥ 90 % del valor cotizado con la orden aún abierta | Advertencia | "El proyecto ya consumió el X % del valor cotizado" |
| Merma de un material > 10 % de lo entregado (umbral configurable) | Informativa | "Merma alta en [material]" |
| Fecha estimada de entrega vencida y orden no terminada | Informativa | "Orden vencida" |

Las alertas se muestran en el encabezado de la orden, en el informe de cierre y en el listado de órdenes (ícono). Las dos primeras también se muestran en el tablero principal.

### 6.8 Redondeo y formato

- Cálculos internos en decimal con al menos 4 decimales en tasas y cantidades; totales en pesos redondeados a 0 decimales.
- Formato de moneda colombiano: `$4.500.000` (punto de miles, sin decimales). Porcentajes con coma decimal y 2 decimales: `17,89%`. Fechas: `dd/mm/aaaa`. Zona horaria: America/Bogota.
- Las cantidades admiten decimales (metros de cable, por ejemplo).

---

## 7. Ciclo de vida y estados de la orden

```
Borrador → Cotizado → En ingeniería → En fabricación → En pruebas → En puesta en marcha → Terminado → Facturado
                                   (Anulado desde cualquier estado anterior a Terminado)
```

- **Borrador:** se puede guardar incompleta. No aparece en reportes consolidados.
- **Orden activa:** cualquier estado entre Cotizado y En puesta en marcha. Para pasar de Borrador a Cotizado se exige: cliente, descripción, fecha estimada de entrega y valor cotizado.
- Se permite saltar etapas hacia adelante (por ejemplo, un proyecto sin ingeniería) y retroceder un estado, siempre con comentario. Todo cambio queda en HistorialEstado.
- **Cierre de la orden:** ocurre al pasar a **Terminado**. Antes de cerrar, el sistema verifica que exista al menos un material o un registro de horas, que el CIF esté asignado y que no haya líneas con merma negativa. Al cerrar: genera el informe de cierre, congela todos los valores (snapshot) y bloquea la edición.
- **Facturado:** solo pide número y fecha de factura; no cambia costos.
- **Reapertura:** solo el administrador, con justificación obligatoria; queda en auditoría y se regenera el informe al volver a cerrar.

---

## 8. Módulos funcionales

### 8.1 Módulo de órdenes de proyecto
Crear, editar, duplicar (para usar una orden anterior como plantilla), cambiar de estado, cerrar, anular y reabrir órdenes. Listado con búsqueda y filtros por código, cliente, estado, rango de fechas, responsable y alertas. Vista de detalle con pestañas: Datos generales · Materiales · Mano de obra · Ingeniería y puesta en marcha · CIF · Cotización y margen · Historial.

### 8.2 Módulo de materiales e inventario
Catálogo de materiales (crear, editar, desactivar, importar desde Excel/CSV con plantilla descargable). En la orden: agregar materiales desde el catálogo o crear uno nuevo desde la misma pantalla; registrar cantidades requerida, entregada, utilizada y devuelta; ver la merma y la diferencia vs lista técnica; importar la lista técnica desde Excel/CSV.
*Fase posterior (confirmar):* kárdex con entradas, salidas y devoluciones valorizadas por promedio ponderado.

### 8.3 Módulo de mano de obra
Registro de trabajadores, cargos y tarifas con vigencia. En la orden: registrar trabajador o cargo, actividad, fecha, horas y tarifa (prellenada con la vigente, editable por roles autorizados). Los técnicos pueden registrar sus propias horas desde el celular.

### 8.4 Módulo de ingeniería y puesta en marcha
Registro de horas por etapa técnica con los campos de la sección 5, servicios adicionales por etapa y resumen de costo y horas por etapa.

### 8.5 Módulo de costos indirectos
Configuración por período: base de asignación, tasa o porcentaje, CIF total del período y base estimada (para calcular la tasa predeterminada). Cálculo automático del CIF de cada orden, con opción de recalcular mientras la orden esté abierta.

### 8.6 Módulo de cotización y márgenes
Valor cotizado, margen esperado, margen mínimo, precio sugerido, margen bruto y margen %, alertas, y comparación costo estimado (al cotizar) vs costo real (al cerrar), por elemento del costo.

### 8.7 Módulo de reportes
Ver sección 11.

---

## 9. Casos de uso

### CU-01 — Crear una orden de proyecto y calcular el costo directo
**Actores:** Administrador, Contador, Coordinador de proyectos.
**Objetivo:** registrar un nuevo proyecto y obtener el costo directo (materiales + MOD).

Flujo principal:
1. El usuario elige "Nueva orden".
2. Ingresa los datos generales: código (autogenerado, editable), cliente (seleccionar o crear), descripción, cantidad de unidades, fecha de creación (hoy por defecto), fecha estimada de entrega y estado.
3. Agrega materiales: código, descripción, unidad, cantidad requerida, cantidad utilizada, costo unitario. El costo total de cada línea se calcula al instante.
4. Agrega la mano de obra directa: trabajador o cargo, actividad, horas y tarifa. El costo de cada línea se calcula al instante.
5. La pantalla muestra en todo momento el costo total de materiales, el costo total de MOD, el costo directo total y el detalle de cada material y actividad.
6. El usuario guarda como **Borrador** o como **Orden activa** (Cotizado).

Flujos alternos: material no existe en catálogo → crearlo en un modal sin salir de la orden. Datos obligatorios faltantes para activar → mostrar qué falta y permitir guardar como borrador.

Criterios de aceptación:
- Con 2 materiales (10 u × $45.000 y 100 m × $3.000) y 30 h × $35.000 de MOD, el sistema muestra materiales $750.000, MOD $1.050.000 y costo directo $1.800.000.
- No se permiten cantidades, horas ni tarifas negativas.
- El código de orden no se puede repetir.

### CU-02 — Registrar ingeniería, automatización y puesta en marcha
**Actores:** Ingeniero electrónico, Ingeniero de automatización, Técnico, Administrador.
**Objetivo:** que el costo del tablero incluya diseño, programación, pruebas y puesta en marcha, no solo la fabricación física.

Flujo principal:
1. El usuario abre una orden activa y va a la pestaña "Ingeniería y puesta en marcha".
2. Registra: etapa, responsable, fecha de inicio y fin, horas, costo hora (prellenado con la tarifa vigente del responsable), descripción, observaciones técnicas.
3. Si aplica, registra servicios adicionales de la etapa o materiales asociados a la etapa (estos últimos se agregan a la lista de materiales con la etapa marcada).
4. La aplicación muestra el resumen por etapas: ingeniería conceptual, ingeniería de detalle, programación y configuración, pruebas, puesta en marcha (y soporte), con horas y costo de cada una, más el costo total acumulado del proyecto (costo directo + ingeniería y puesta en marcha).

Criterios de aceptación:
- Un técnico solo puede registrar y editar sus propias horas y solo en órdenes no cerradas.
- El resumen por etapas suma exactamente el total de ingeniería y puesta en marcha.

### CU-03 — Asignar CIF, registrar mermas y determinar el costo total
**Actores:** Contador, Administrador, Coordinador de proyectos.
**Objetivo:** obtener el costo final por orden y compararlo con el valor cotizado.

Flujo principal:
1. El contador verifica o configura los parámetros de CIF del período (base y tasa).
2. En la orden, el sistema calcula el CIF según la base y lo muestra con su detalle (base, cantidad, tasa, valor).
3. El coordinador registra la cantidad entregada y devuelta de cada material; el sistema calcula las mermas y la diferencia vs lista técnica.
4. Se registra o revisa el valor cotizado y el margen esperado; el sistema muestra el precio sugerido.
5. El sistema calcula el costo total, el costo unitario, el margen bruto y el margen %, y muestra alertas.
6. El usuario cierra la orden (pasa a Terminado) y el sistema genera el **informe de cierre** (sección 10.2).

Criterios de aceptación: los de la sección 13.

---

## 10. Pantallas clave

### 10.1 Encabezado de la orden (siempre visible)
Código, cliente, estado (con color), fecha de entrega, costo acumulado, valor cotizado, margen % y alertas activas.

### 10.2 Resumen de costos / informe de cierre
Debe verse como esta tabla (formato de la clienta):

| Concepto | Valor |
|---|---|
| Materiales directos | $4.500.000 |
| Mano de obra directa | $1.050.000 |
| Ingeniería y automatización | $720.000 |
| Pruebas y puesta en marcha | $480.000 |
| Costos indirectos asignados | $900.000 |
| Mermas | $150.000 |
| **Costo total del proyecto** | **$7.800.000** |
| Valor cotizado | $9.500.000 |
| Margen bruto | $1.700.000 |
| Margen porcentual | 17,89% |

Agregar debajo: cantidad de unidades y costo unitario; participación % de cada elemento en el costo total (y un gráfico de barras o de torta); detalle de ingeniería por etapa; detalle de materiales; detalle de MOD; detalle del cálculo del CIF; alertas; comparación estimado vs real; datos de cierre (fecha, usuario). Exportable a **PDF** (con logo de la empresa) y **Excel**.

### 10.3 Tablero principal (inicio)
Órdenes activas por estado, órdenes con alertas, órdenes vencidas, margen promedio del período y costo acumulado del mes.

---

## 11. Reportes

Todos con filtros por período, cliente, estado y responsable; exportables a Excel y PDF.

1. **Costo por orden:** una fila por orden con cada elemento del costo, costo total, costo unitario, cotizado, margen y margen %.
2. **Costo por etapa:** horas y costo por etapa técnica, por orden y consolidado.
3. **Costo por material:** cantidades requeridas, utilizadas, mermas y valor por material, por orden y consolidado; top de materiales con más merma.
4. **Consumo de horas:** horas por trabajador, por tipo (MOD / ingeniería), por etapa y por orden; horas estimadas vs reales si se registraron.
5. **Consolidado por período:** total de órdenes cerradas, costo total, ingresos cotizados, margen total y promedio, CIF aplicado (y real, si se registra).
6. **Rentabilidad por cliente:** costo, cotizado y margen por cliente.
7. **Estimado vs real:** diferencia por elemento del costo entre la estimación al cotizar y el costo real al cerrar.

---

## 12. Requisitos no funcionales

- Aplicación web responsive (escritorio y celular), para uso interno, con arquitectura cliente-servidor y base de datos relacional.
- Hasta ~20 usuarios concurrentes; las pantallas de una orden deben cargar en menos de 2 segundos.
- Autenticación con contraseña cifrada (hash), sesiones con expiración y control de permisos por rol en el backend (no solo ocultando botones).
- Auditoría de cambios en costos, tarifas, cantidades, estados y parámetros de CIF.
- Borrado lógico (no físico) de registros con historial.
- Copias de seguridad diarias automáticas de la base de datos.
- Tratamiento de datos personales conforme a la Ley 1581 de 2012 (datos de trabajadores y clientes).
- Código con pruebas unitarias del motor de cálculo (cobertura ≥ 90 % en ese módulo) y pruebas de integración de los tres casos de uso.

**Stack sugerido** (cámbialo si el equipo lo define distinto): frontend en React + TypeScript; backend con API REST en Node.js (NestJS) o Python (Django/FastAPI); base de datos PostgreSQL; ORM con migraciones; despliegue con Docker. Generación de PDF y Excel en el servidor.

---

## 13. Datos de prueba y caso de aceptación (debe reproducir la tabla de la sección 10.2)

**Orden:** OP-2026-0001 · Cliente "Industrias Ejemplo S.A.S." · Tablero de control con PLC y HMI · 1 unidad · Valor cotizado $9.500.000 · Margen mínimo 15 %.

**Materiales:**

| Código | Descripción | Und | Requerida | Entregada | Utilizada | Devuelta | Costo unit. | Costo |
|---|---|---|---|---|---|---|---|---|
| PLC-01 | PLC | und | 1 | 1 | 1 | 0 | $1.800.000 | $1.800.000 |
| HMI-01 | Pantalla HMI | und | 1 | 1 | 1 | 0 | $1.200.000 | $1.200.000 |
| GAB-01 | Gabinete metálico | und | 1 | 1 | 1 | 0 | $650.000 | $650.000 |
| BRK-01 | Breaker | und | 10 | 10 | 10 | 0 | $45.000 | $450.000 |
| CAB-01 | Cable de control | m | 120 | 150 | 100 | 0 | $3.000 | $300.000 |
| BOR-01 | Bornera | und | 100 | 100 | 100 | 0 | $1.000 | $100.000 |

Esperado: materiales directos **$4.500.000**; merma de cable = 150 − 100 − 0 = 50 m → mermas **$150.000**; diferencia vs lista técnica del cable = (100 + 50) − 120 = +30 m.

**MOD:** 30 h × $35.000 = **$1.050.000** (horas MOD = 30).

**Ingeniería y puesta en marcha:**

| Etapa | Horas | Costo hora | Costo |
|---|---|---|---|
| Ingeniería conceptual | 4 | $45.000 | $180.000 |
| Ingeniería de detalle | 6 | $45.000 | $270.000 |
| Programación | 4 | $45.000 | $180.000 |
| Configuración | 2 | $45.000 | $90.000 |
| Pruebas | 4 | $40.000 | $160.000 |
| Puesta en marcha | 8 | $40.000 | $320.000 |

Esperado: Ingeniería y automatización **$720.000**; Pruebas y puesta en marcha **$480.000**.

**CIF:** base Horas de MOD, tasa $30.000 por hora → 30 × $30.000 = **$900.000**.

**Resultado esperado:** costo total **$7.800.000**; costo unitario $7.800.000; margen bruto **$1.700.000**; margen **17,89%**; sin alertas críticas.

**Pruebas adicionales:**
- Con margen mínimo 20 % → alerta de advertencia "margen por debajo del mínimo".
- Con valor cotizado $7.500.000 → alerta crítica "el costo supera el valor cotizado en $300.000" y margen −4,00%.
- Con margen esperado 25 % → precio sugerido $10.400.000.
- Con cantidad de unidades 2 → costo unitario $3.900.000.
- Base "Costo de MOD" con tasa 20 % y MOD $80.000 → CIF $16.000 (método del Excel actual).
- Utilizada 100 + devuelta 60 con entregada 150 → error de validación (merma negativa).

---

## 14. Entregables

1. Código fuente en repositorio con README (instalación, configuración, ejecución, pruebas).
2. Migraciones de base de datos y datos semilla (roles, etapas, parámetros, la orden del caso de aceptación).
3. Pruebas automatizadas.
4. Manual de usuario breve por rol (en español).
5. Documento técnico: modelo de datos, endpoints de la API y fórmulas implementadas.

## 15. Fases sugeridas

- **Fase 1 (MVP):** autenticación y roles, clientes, catálogo de materiales, órdenes, materiales y mermas, MOD, ingeniería por etapas, CIF, resumen de costos con alertas, cierre e informe PDF. Debe pasar el caso de la sección 13.
- **Fase 2:** reportes 1 a 7, exportación a Excel, importación de listas técnicas y catálogo, tablero principal, duplicar órdenes, registro de horas desde el celular.
- **Fase 3 (a confirmar):** kárdex con promedio ponderado, CIF real vs aplicado, horas estimadas por etapa y estimado vs real detallado.

## 16. Preguntas abiertas para confirmar con la clienta (usar el valor por defecto mientras tanto)

1. **Mermas:** ¿se aceptan como entregado − utilizado − devuelto (por defecto) en lugar de requerido − utilizado?
2. **Costo directo como base de CIF:** ¿incluye solo materiales + MOD (por defecto) o también ingeniería?
3. **CIF por número de proyectos:** ¿qué proyectos cuentan en el período (por defecto, los terminados en el mes)?
4. **"Otros costos de producción"** (columna del Excel actual): ¿se manejan dentro de los CIF (por defecto) o como un elemento separado en la orden?
5. **Servicios adicionales de una etapa:** ¿suman al costo de la etapa (por defecto) o van a otra línea?
6. **Inventario:** ¿basta con el catálogo y costo de referencia (por defecto) o se necesita kárdex completo desde la fase 1?
7. **Visibilidad:** ¿los técnicos e ingenieros deben ver costos de materiales y tarifas de otros trabajadores (por defecto, no)?
8. **Tarifa hora:** ¿la empresa ya tiene calculado el costo hora cargado por trabajador, o necesita una calculadora en la aplicación?
9. **Margen mínimo:** valor global por defecto (propuesta: 15 %).
10. ¿Se requiere manejar IVA en el valor cotizado? (Por defecto, el valor cotizado se registra **antes de IVA**).
