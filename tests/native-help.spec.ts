import { test, expect } from "@playwright/test";

test.setTimeout(90_000);

test("help shows all relevant text with one Close button and keeps draft edits", async ({
  page,
}, info) => {
  await fetch("http://127.0.0.1:4319/control", {
    method: "POST",
    body: JSON.stringify({ reset: true, latest: true, adminType: "super" }),
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#workspace-content")).toBeVisible();
  await page.goto("/delivery-zones/tariffs/draft-local?tab=workflow");
  await page.getByLabel("Weight (kg)").fill("1.25");
  const helpButton = page.getByRole("button", {
    name: "Help with Publish changes",
    exact: true,
  });
  await helpButton.click();
  const help = page.getByRole("dialog", {
    name: "Publish changes",
    exact: true,
  });
  await expect(help).toContainText("Check the Prices tab");
  await expect(help).toContainText("give a reason");
  await expect(help).toContainText(
    "accepted shipments and unexpired quotes keep their prices",
  );
  await expect(help.getByRole("button")).toHaveCount(1);
  await expect(
    help.getByRole("button", { name: "Close", exact: true }),
  ).toBeVisible();
  await expect(help.getByRole("progressbar")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.screenshot({
    path: info.outputPath("simple-feature-help-mobile.png"),
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await help.getByRole("button", { name: "Close", exact: true }).click();
  await expect(help).not.toBeVisible();
  await expect(helpButton).toBeFocused();
  await expect(page.getByLabel("Weight (kg)")).toHaveValue("1.25");

  await page
    .getByRole("button", { name: "Help with Delivery tariff", exact: true })
    .click();
  const pageHelp = page.getByRole("dialog", {
    name: "Delivery tariff",
    exact: true,
  });
  await expect(pageHelp).toContainText("0.5 to 70 kg");
  await expect(pageHelp).toContainText("Clone an active or retired tariff");
  await page.keyboard.press("Escape");
  await expect(pageHelp).not.toBeVisible();
});
