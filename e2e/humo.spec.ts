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

    await page.getByText(/Cambiar estado \(actual/).click();
    await page.getByLabel("Nuevo estado").selectOption("TERMINADO");
    await page.getByLabel(/Comentario/).fill("Proyecto entregado");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Cerrar orden" }).click();
    await expect(page.getByText("Estado actualizado")).toBeVisible();
    await page.goto(`${urlOrden}/informe`);
    await expect(page.getByRole("heading", { name: /Informe de cierre/ })).toBeVisible();
    await expect(page.getByText("Margen porcentual").locator("..")).toContainText("47,00%");
    const descarga = await page.request.get(`/api${urlOrden}/pdf`);
    expect(descarga.headers()["content-type"]).toBe("application/pdf");
  });
});
