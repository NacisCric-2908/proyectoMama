/**
 * Prueba de humo de extremo a extremo (requiere la semilla con datos demo y `npm run build`).
 * Crea una orden nueva, registra materiales, MOD y horas de técnico, la activa y la cierra.
 */
import { expect, test, type Page } from "@playwright/test";

const CONTRASENA = "Costeo2026*";
let urlOrden = "";
const descripcion = `Tablero E2E ${Date.now()}`;

async function ingresar(page: Page, correo: string) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Contraseña").fill(CONTRASENA);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

test.describe.serial("flujo principal", () => {
  test("coordinador crea la orden y registra materiales y MOD", async ({ page }) => {
    await ingresar(page, "coordinador@empresa.com");
    await page.goto("/ordenes/nueva");
    await page.getByLabel("Cliente", { exact: true }).selectOption({ label: "Industrias Ejemplo S.A.S." });
    await page.getByLabel("Descripción del tablero o proyecto").fill(descripcion);
    await page.getByLabel("Fecha estimada de entrega").fill("2026-12-20");
    await page.getByLabel("Valor cotizado (antes de IVA)").fill("5000000");
    await page.getByLabel("Andrés Rojas").check();
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await page.waitForURL(/\/ordenes\/(?!nueva)[a-z0-9]+$/);
    urlOrden = new URL(page.url()).pathname;
    await expect(page.getByText("Borrador").first()).toBeVisible();

    // Materiales: cálculo en vivo y bloqueo de merma negativa
    await page.goto(`${urlOrden}?tab=materiales`);
    const agregar = page.locator("section", { hasText: "Agregar material" });
    await agregar.getByLabel("Material").selectOption({ label: "PLC-01 · PLC (und)" });
    await agregar.getByLabel("Requerida").fill("1");
    await agregar.getByLabel("Entregada").fill("1");
    await agregar.getByLabel("Utilizada").fill("1");
    await agregar.getByLabel("Devuelta").fill("1");
    await expect(agregar.getByText("La cantidad utilizada más la devuelta supera la entregada")).toBeVisible();
    await expect(agregar.getByRole("button", { name: "Agregar" })).toBeDisabled();
    await agregar.getByLabel("Devuelta").fill("0");
    await expect(agregar.getByText("$1.800.000").first()).toBeVisible();
    await agregar.getByRole("button", { name: "Agregar" }).click();
    await expect(agregar.getByText("Cambios guardados")).toBeVisible();
    await expect(page.getByRole("cell", { name: "PLC-01", exact: true })).toBeVisible();

    // Requisición de almacén (kárdex) y devolución total: la línea queda sin merma
    const req = page.locator("section", { hasText: "Requisición de almacén" });
    await req.getByLabel("Material").selectOption({ label: "CAB-01 · Cable de control (m)" });
    await req.getByLabel("Cantidad").fill("10");
    await req.getByLabel("Solicitante").fill("Carlos Pérez");
    await req.getByRole("button", { name: "Registrar salida" }).click();
    await expect(req.getByText(/Requisición registrada: salida valorada a \$3\.000/)).toBeVisible();
    const filaCable = page.getByRole("row", { name: /CAB-01/ });
    await expect(filaCable.getByText("Entregado por kárdex")).toBeVisible();
    await filaCable.getByText("Devolver al almacén").click();
    await filaCable.getByLabel(/Cantidad/).fill("10");
    await filaCable.getByRole("button", { name: "Registrar devolución" }).click();
    await expect(page.getByText("Devolución al almacén registrada")).toBeVisible();

    // Mano de obra: tarifa vigente prellenada ($35.000) → 10 h = $350.000
    await page.goto(`${urlOrden}?tab=mano-obra`);
    const mod = page.locator("section", { hasText: "Registrar mano de obra" });
    await mod.getByLabel("Trabajador").selectOption({ label: "Carlos Pérez (Ensamblador)" });
    await mod.getByLabel("Actividad realizada").fill("Ensamble");
    await mod.getByLabel("Fecha").fill("2026-10-05");
    await mod.getByLabel("Horas").fill("10");
    await expect(mod.getByText("$350.000")).toBeVisible();
    await mod.getByRole("button", { name: "Agregar" }).click();
    await expect(mod.getByText("Cambios guardados")).toBeVisible();
    await expect(page.getByText("Costo directo total:")).toContainText("$2.150.000");

    // Presupuesto original (versión 1)
    await page.goto(`${urlOrden}?tab=presupuesto`);
    const pres = page.locator("section", { hasText: "Registrar presupuesto original" });
    await pres.getByLabel("Materiales directos").fill("1800000");
    await pres.getByLabel("Mano de obra directa").fill("280000");
    await pres.getByLabel("Pruebas y puesta en marcha").fill("160000");
    await pres.getByLabel("Costos indirectos asignados").fill("240000");
    await pres.getByLabel("Horas de ensamble estimadas").fill("8");
    await pres.getByLabel("Horas de ingeniería estimadas").fill("4");
    await expect(pres.getByText("$2.480.000")).toBeVisible();
    await pres.getByRole("button", { name: "Registrar versión" }).click();
    await expect(page.getByText(/Versión 1 del presupuesto registrada/)).toBeVisible();
    await expect(page.getByText("Pendiente de aprobación")).toBeVisible();

    // Activar
    await page.getByText(/Cambiar estado \(actual/).click();
    await page.getByLabel("Nuevo estado").selectOption("COTIZADO");
    await page.getByRole("button", { name: "Cambiar estado" }).click();
    await expect(page.getByText("Estado actualizado")).toBeVisible();
  });

  test("el técnico registra sus horas sin ver costos", async ({ page }) => {
    await ingresar(page, "tecnico@empresa.com");
    await expect(page).toHaveURL(/mis-horas/);
    await page.getByRole("link", { name: new RegExp(descripcion) }).click();
    const ing = page.locator("section", { hasText: "Registrar horas de ingeniería" });
    await ing.getByLabel("Etapa").selectOption({ label: "Pruebas" });
    await ing.getByLabel("Fecha de inicio").fill("2026-10-06");
    await ing.getByLabel("Fecha de finalización").fill("2026-10-06");
    await ing.getByLabel("Horas dedicadas").fill("5");
    await ing.getByLabel("Descripción de la actividad").fill("Pruebas FAT");
    await ing.getByRole("button", { name: "Registrar" }).click();
    await expect(ing.getByText("Cambios guardados")).toBeVisible();
    await expect(page.locator("main")).not.toContainText("$");
  });

  test("la contadora ve el CIF, cierra la orden y descarga el informe", async ({ page }) => {
    await ingresar(page, "contador@empresa.com");
    await page.goto(`${urlOrden}?tab=cif`);
    await expect(page.getByText("CIF asignado").locator("..")).toContainText("$300.000");
    // Costo total: 1.800.000 + 350.000 + 5 h × 40.000 + 300.000 = 2.650.000
    await expect(page.getByText("Costo acumulado").locator("..")).toContainText("$2.650.000");

    // Aprobar el presupuesto
    await page.goto(`${urlOrden}?tab=presupuesto`);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Aprobar" }).click();
    await expect(page.getByText("Versión 1 aprobada")).toBeVisible();

    await page.getByText(/Cambiar estado \(actual/).click();
    await page.getByLabel("Nuevo estado").selectOption("TERMINADO");
    await page.getByLabel(/Comentario/).fill("Proyecto entregado");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Cerrar orden" }).click();
    await expect(page.getByText("Estado actualizado")).toBeVisible();
    await page.goto(`${urlOrden}/informe`);
    await expect(page.getByRole("heading", { name: /Informe de cierre/ })).toBeVisible();
    await expect(page.getByText("Margen porcentual").locator("..")).toContainText("47,00%");
    // Presupuesto 2.480.000 vs acumulado 2.650.000 → sobrecosto 170.000
    const comparacion = page.locator("section", { hasText: "Presupuesto vs costo acumulado" });
    await expect(comparacion.getByRole("columnheader", { name: "Presupuesto original (v1)" })).toBeVisible();
    await expect(comparacion.getByRole("row", { name: /Costo total/ })).toContainText("$170.000");
    const descarga = await page.request.get(`/api${urlOrden}/pdf`);
    expect(descarga.headers()["content-type"]).toBe("application/pdf");

    // Explicación documentada de la desviación total (posible con la orden cerrada)
    await page.goto(`${urlOrden}?tab=cotizacion`);
    const total = page.locator("section", { hasText: "Presupuesto vs costo acumulado" }).getByRole("row", { name: /Costo total/ });
    await total.getByText("Explicar").click();
    await total.getByLabel(/Causa declarada/).selectOption("HORAS");
    await total.getByLabel("Explicación").fill("Las pruebas en taller tomaron más horas de lo previsto");
    await total.getByRole("button", { name: "Guardar explicación" }).click();
    await expect(page.getByText("Explicación registrada")).toBeVisible();
    await expect(total).toContainText("Horas de trabajo");

    // Rentabilidad por cliente y exportación
    await page.goto("/reportes/rentabilidad");
    await expect(page.getByRole("heading", { name: "Rentabilidad por cliente y por proyecto" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Industrias Ejemplo S.A.S." }).first()).toBeVisible();
    const csv = await page.request.get("/api/reportes/rentabilidad");
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(await csv.text()).toContain("Rentabilidad por cliente");
  });

  test("el kárdex muestra los movimientos de la orden", async ({ page }) => {
    await ingresar(page, "coordinador@empresa.com");
    await page.goto("/inventario");
    await page.getByRole("link", { name: "CAB-01" }).click();
    await expect(page.getByRole("heading", { name: /Kárdex · CAB-01/ })).toBeVisible();
    await expect(page.getByText("Salida a orden (requisición)").first()).toBeVisible();
    await expect(page.getByText("Devolución de orden").first()).toBeVisible();
  });

  test("la contadora ve el CIF real y la vista previa de conciliación de marzo de 2026", async ({ page }) => {
    await ingresar(page, "contador@empresa.com");
    await page.goto("/cif");
    await page.getByRole("link", { name: "2026-03" }).click();
    await expect(page.getByRole("heading", { name: /CIF real y conciliación · 2026-03/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /CIF real total/ })).toContainText("$1.000.000");
    // OP-2026-0001 sigue abierta en la demo: la conciliación queda bloqueada
    await expect(page.getByText(/todas las órdenes del período deben estar cerradas/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Conciliar período" })).toBeDisabled();
  });
});
