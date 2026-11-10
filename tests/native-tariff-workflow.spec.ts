import { test, expect, type Page } from "@playwright/test";

test.setTimeout(90_000);

async function login(page: Page) {
  await fetch("http://127.0.0.1:4319/control", {
    method: "POST",
    body: JSON.stringify({ reset: true, latest: true, adminType: "super" }),
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#workspace-content")).toBeVisible();
}

test("tariff workflows open the primary task and preserve fields through keyboard disclosure", async ({
  page,
}, info) => {
  await login(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/delivery-zones/tariffs/draft-local?tab=workflow");
  const edit = page.locator("details").filter({
    has: page.locator("summary", { hasText: /^Edit prices/ }),
  });
  await expect(edit).toHaveJSProperty("open", true);
  await expect(edit.getByLabel("Weight (kg)")).toHaveCount(1);
  await edit.getByLabel("Weight (kg)").fill("1.25");
  await edit.getByLabel("Amount (₦)").fill("200");
  await edit.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(edit).toHaveJSProperty("open", false);
  await page.keyboard.press("Enter");
  await expect(edit).toHaveJSProperty("open", true);
  await expect(edit.getByLabel("Weight (kg)")).toHaveValue("1.25");
  await expect(edit.getByLabel("Amount (₦)")).toHaveValue("200");
  const other = page.getByRole("region", { name: "Other tariff actions" });
  await expect(other).toBeVisible();
  await expect(other.locator("details[open]")).toHaveCount(0);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.screenshot({
    animations: "disabled",
    path: info.outputPath("tariff-workflow-desktop-dark.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: info.outputPath("tariff-workflow-mobile-dark.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.screenshot({
    animations: "disabled",
    path: info.outputPath("tariff-workflow-desktop-light.png"),
    fullPage: true,
  });

  await page.goto("/delivery-zones?tab=create");
  const create = page.getByRole("tabpanel");
  await expect(create.getByLabel("Delivery service")).toBeVisible();
  await expect(create.getByLabel("Delivery zone")).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: info.outputPath("tariff-create-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
  const createTab = page.getByRole("tab", {
    name: "Create tariff",
    exact: true,
  });
  await expect
    .poll(async () => {
      const bounds = await createTab.boundingBox();
      return !!bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390;
    })
    .toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: info.outputPath("tariff-create-mobile.png"),
    fullPage: true,
  });
});
