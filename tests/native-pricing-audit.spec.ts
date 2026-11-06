import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const rates = Array.from({ length: 352 }, (_, index) => ({
  zone: Math.floor(index / 44) + 1,
  weightGrams: ((index % 44) + 1) * 500,
  amountMinor: index ? 6000000 + index : 5337328,
}));
const countries = Array.from({ length: 233 }, (_, index) => ({
  code: `C${index}`,
  name: `Destination ${index}`,
  zone: (index % 8) + 1,
}));
const base = {
  id: "reviewed-tariff",
  name: "DHL export schedule",
  status: "draft",
  version: 596,
  rates,
  countries,
};
const updated = {
  ...base,
  version: 598,
  rates: [
    ...rates.map((rate, index) =>
      index ? rate : { ...rate, amountMinor: 5237328 },
    ),
  ].reverse(),
};
const entries = [
  {
    id: "audit-archive",
    action: "international.archive",
    resourceId: base.id,
    before: updated,
    after: { ...updated, version: 599, status: "retired" },
    reason: "Archive unused draft",
  },
  {
    id: "audit-rate",
    action: "international.rates",
    resourceId: base.id,
    before: base,
    after: updated,
    reason: "Review half-kilogram price",
  },
  {
    id: "audit-same",
    action: "international.rates",
    resourceId: base.id,
    before: base,
    after: { ...base, version: 597 },
    reason: "Confirm existing prices",
  },
  {
    id: "audit-clone",
    action: "international.clone",
    resourceId: base.id,
    before: { ...base, id: "active-tariff", status: "active" },
    after: base,
    reason: "Create a reviewed price draft",
    effects: { clonedFrom: "active-tariff" },
  },
  {
    id: "audit-catalogue",
    action: "catalogue.publish",
    resourceId: "catalogue-2026-11-06",
    before: { offices: [], countries },
    after: {
      applied: true,
      internationalRates: 352,
      destinations: 233,
      localRatesPerService: 450,
      officeIds: { lagos: "pnd-lagos", ibadan: "pnd-ibadan" },
    },
    reason: "Owner supplied DHL rates and Lagos/Ibadan offices",
    effects: {
      snapshot: {
        countries,
        states: Array(37).fill({ path: "States/example" }),
      },
      sourceDocumentSHA256: "source-sha256",
    },
  },
  {
    id: "audit-policy",
    action: "shipping.policy.restore",
    resourceId: "customer-shipping-policy",
    before: { itemTypes: [], eligibility: [] },
    after: {
      itemTypes: Array(13).fill({ id: "category" }),
      eligibility: Array(2951).fill({ allowed: true }),
    },
    reason: "Restore item categories and postal fields",
    effects: {
      legacyItemCategories: 13,
      localServicesUnchanged: true,
      countryAvailabilityUnchanged: true,
    },
  },
].map((row) => ({
  actorUid: "operator",
  createdAt: "2026-11-06T13:43:46.55666+00:00",
  effects: {},
  ...row,
}));

test("pricing audit presents compact changes, exact comparisons, effects and original records", async ({
  page,
}) => {
  test.setTimeout(120000);
  page.on("pageerror", (error) => console.error(error));
  await fetch("http://127.0.0.1:4319/control", {
    method: "POST",
    body: JSON.stringify({ reset: true, latest: true, adminType: "regular" }),
  });
  await page.route("**/api/proxy/v1/admin/pricing/audit?*", (route) =>
    route.fulfill({
      json: { data: { items: entries, nextCursor: null, hasMore: false } },
    }),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#workspace-content")).toBeVisible({
    timeout: 15000,
  });
  await page.goto("/pricing-audit");
  const rows = page.getByRole("table").getByRole("row");
  await expect(rows).toHaveCount(7);
  await expect(
    page.getByText("1 price tier changed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No price differences", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("352 international prices · 233 destinations", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("#workspace-content")).not.toContainText(
    "[object Object]",
  );
  expect(
    await rows
      .nth(2)
      .evaluate((element) => element.getBoundingClientRect().height),
  ).toBeLessThan(200);
  await page.screenshot({
    path: "test-results/pricing-audit-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.screenshot({
    path: "test-results/pricing-audit-desktop-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  const priceRow = rows.filter({ hasText: "Review half-kilogram price" });
  const trigger = priceRow.getByRole("button", { name: "View change" });
  await trigger.click();
  const panel = page.getByRole("dialog");
  const prices = panel.getByRole("table", {
    name: "Price changes",
    exact: true,
  });
  await expect(prices.getByRole("row")).toHaveCount(2);
  await expect(prices.getByRole("cell")).toHaveText([
    "1",
    "0.5",
    "Updated",
    "₦53,373.28",
    "₦52,373.28",
  ]);
  const download = page.waitForEvent("download");
  await panel
    .getByRole("button", { name: "Download original audit record" })
    .click();
  const file = await download;
  const original = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(original.before.rates).toHaveLength(352);
  expect(
    original.after.rates.find(
      (rate: any) => rate.zone === 1 && rate.weightGrams === 500,
    ).amountMinor,
  ).toBe(5237328);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await rows
    .filter({ hasText: "Owner supplied DHL rates and Lagos/Ibadan offices" })
    .getByRole("button", { name: "View change" })
    .click();
  await expect(
    panel.getByRole("table", { name: "Record changes" }),
  ).toContainText("450");
  await expect(
    panel.getByText("Original catalogue snapshot", { exact: true }),
  ).toBeVisible();
  await expect(panel).not.toContainText("[object Object]");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await rows
    .filter({ hasText: "Restore item categories and postal fields" })
    .getByRole("button", { name: "View change" })
    .click();
  await expect(
    panel.getByRole("table", { name: "Snapshot contents" }),
  ).toContainText("2,951");
  await expect(
    panel.getByText("Local Services Unchanged", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await panel.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished),
    );
  });
  const bounds = await panel.boundingBox();
  expect(Math.round(bounds!.width)).toBe(390);
  expect(Math.round(bounds!.x)).toBe(0);
  await panel.screenshot({
    path: "test-results/pricing-audit-mobile.png",
  });
});
