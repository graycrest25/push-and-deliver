import { test, expect, type Page } from "@playwright/test";
const root = "/v1/admin/geography/tariffs";
const endpoint = `${root}/import-pdf`;
const pdf = {
  name: "domestic.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.7\nDomestic transport fixture\n%%EOF"),
};
const zones = ["abv", "iba", "kad", "los", "phc", "qrw"];
async function control(body: Record<string, unknown> = {}) {
  return fetch("http://127.0.0.1:4319/control", {
    method: "POST",
    body: JSON.stringify(body),
  })
    .then((r) => r.json())
    .then((r) => r.data);
}
const calls = async () =>
  (await control()).records.filter((r: any) => r.path === endpoint);
async function login(page: Page) {
  await control({
    reset: true,
    latest: true,
    domesticPdf: true,
    adminType: "super",
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#workspace-content")).toBeVisible({
    timeout: 30000,
  });
  await page.goto("/delivery-zones");
  await expect(
    page
      .getByRole("heading", { name: "Local shipment tariffs", exact: true })
      .first(),
  ).toBeVisible();
  await page.getByText("Upload domestic rate PDF", { exact: true }).click();
}
async function preview(page: Page) {
  await page
    .getByLabel("Domestic rate PDF", { exact: true })
    .setInputFiles(pdf);
  await page
    .getByRole("button", { name: "Preview prices", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Domestic PDF preview", exact: true }),
  ).toBeVisible();
}
test.setTimeout(120000);

test("domestic preview follows pagination and publishes all zones with an identical retry", async ({
  page,
}, info) => {
  await login(page);
  await preview(page);
  const review = page.getByRole("region", {
    name: "Domestic PDF preview",
    exact: true,
  });
  await expect(review).toContainText("288 prices");
  await expect(review).toContainText("70 kg");
  await expect(
    review
      .getByRole("table", { name: "Old and new domestic prices" })
      .getByRole("row"),
  ).toHaveCount(289);
  await expect(
    review.getByRole("table", { name: "Zone changes" }).getByRole("row"),
  ).toHaveCount(7);
  await expect(review).toContainText("₦20,135.36");
  await expect(review).toContainText("₦10,000.00");
  await expect(review).toContainText("New weight band");
  await expect(
    page.getByRole("button", { name: "Publish prices", exact: true }),
  ).toBeDisabled();
  const first = (await calls())[0];
  expect(first.key).toBeUndefined();
  expect(first.account).toBe("user");
  expect(first.authorization).toMatch(/^Bearer /);
  expect(first.body.metadata).toEqual({
    localType: "premium",
    reason: "Updated domestic shipping prices",
    preview: true,
    expectedTariffs: zones.map((zone, i) => ({
      zone,
      tariffId: `domestic-${zone}-7`,
      expectedVersion: 7 + i,
    })),
  });
  await page.screenshot({
    path: info.outputPath("domestic-preview-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: info.outputPath("domestic-preview-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await control({ domesticFailure: 503 });
  await page
    .getByRole("checkbox", { name: /I have reviewed these prices/ })
    .check();
  await page
    .getByRole("button", { name: "Publish prices", exact: true })
    .click();
  await expect(
    page.locator("#workspace-content").getByRole("alert"),
  ).toContainText("Publication response interrupted");
  await expect(
    page.getByRole("combobox", { name: "Delivery service", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByLabel("Domestic rate PDF", { exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Retry publication" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Prices published." }),
  ).toContainText("All six zones are active");
  const writes = await calls();
  expect(writes).toHaveLength(3);
  expect(writes[1].key).toMatch(/^[0-9a-f-]{36}$/);
  expect(writes[2].key).toBe(writes[1].key);
  expect(writes[2].body).toEqual(writes[1].body);
  expect(writes[1].body.metadata).toEqual({
    ...first.body.metadata,
    preview: false,
  });
  expect(writes[1].body.fileHash).toBe(first.body.fileHash);
  await expect
    .poll(
      async () =>
        (await control()).records.filter(
          (r: any) => r.path.startsWith(root) && r.path.endsWith("/snapshot"),
        ).length,
    )
    .toBe(6);
  expect(
    (await control()).records.some(
      (r: any) => r.path === root && r.query.cursor === "remaining-zones",
    ),
  ).toBe(true);
  expect(
    (await control()).records.some((r: any) => r.path.endsWith("/publish")),
  ).toBe(false);
});

test("changed inputs and changed base tariffs require a fresh preview", async ({
  page,
}) => {
  await login(page);
  await preview(page);
  await page
    .getByLabel("Reason for price update", { exact: true })
    .fill("Revised prices");
  await expect(
    page.getByRole("button", { name: "Publish prices", exact: true }),
  ).toHaveCount(0);
  await preview(page);
  await page
    .getByRole("combobox", { name: "Delivery service", exact: true })
    .selectOption("economy");
  await expect(
    page.getByRole("button", { name: "Publish prices", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Preview prices", exact: true })
    .click();
  await expect(
    page.locator("#workspace-content").getByRole("alert"),
  ).toContainText("Exactly one active IBA tariff");
  await page
    .getByRole("combobox", { name: "Delivery service", exact: true })
    .selectOption("premium");
  await preview(page);
  await control({ domesticVersion: 20 });
  await page
    .getByRole("checkbox", { name: /I have reviewed these prices/ })
    .check();
  await page
    .getByRole("button", { name: "Publish prices", exact: true })
    .click();
  await expect(
    page.locator("#workspace-content").getByRole("alert"),
  ).toContainText("base tariffs changed");
  expect((await calls()).every((r: any) => r.body.metadata.preview)).toBe(true);
  await preview(page);
  expect(
    (await calls()).at(-1).body.metadata.expectedTariffs[0].expectedVersion,
  ).toBe(20);
});

test("409 invalidates review and reloads tariffs; validation and permission errors remain actionable", async ({
  page,
}) => {
  await login(page);
  await preview(page);
  await control({ domesticFailure: 409 });
  await page
    .getByRole("checkbox", { name: /I have reviewed these prices/ })
    .check();
  await page
    .getByRole("button", { name: "Publish prices", exact: true })
    .click();
  await expect(
    page.locator("#workspace-content").getByRole("alert"),
  ).toContainText("Preview all six zones again");
  await expect(
    page.getByRole("button", { name: "Publish prices", exact: true }),
  ).toHaveCount(0);
  for (const [status, message] of [
    [400, "Unsupported domestic PDF layout"],
    [403, "does not have permission"],
  ] as const) {
    await control({ domesticFailure: status });
    await page
      .getByRole("button", { name: "Preview prices", exact: true })
      .click();
    await expect(
      page.locator("#workspace-content").getByRole("alert"),
    ).toContainText(message);
    await expect(
      page.getByLabel("Domestic rate PDF", { exact: true }),
    ).toBeEnabled();
  }
  await control({ domesticMalformed: true });
  await page
    .getByRole("button", { name: "Preview prices", exact: true })
    .click();
  await expect(
    page.locator("#workspace-content").getByRole("alert"),
  ).toContainText("preview is incomplete");
});

test("domestic proxy enforces multipart limits and explicit preview without requiring a preview key", async ({
  page,
}) => {
  await login(page);
  const metadata = {
    localType: "premium",
    reason: "Transport boundary",
    preview: true,
    expectedTariffs: zones.map((zone, i) => ({
      zone,
      tariffId: `domestic-${zone}-7`,
      expectedVersion: 7 + i,
    })),
  };
  const post = (size: number, data: any = metadata, extra = {}) =>
    page.request.post(`/api/proxy${endpoint}`, {
      headers: { Origin: "http://localhost:4320" },
      multipart: {
        file: { ...pdf, buffer: Buffer.alloc(size, 32) },
        metadata: JSON.stringify(data),
        ...extra,
      },
    });
  expect((await post(2097152)).status()).toBe(200);
  expect((await post(2097153)).status()).toBe(413);
  expect(
    (await post(50, { ...metadata, reason: "é".repeat(2100) })).status(),
  ).toBe(400);
  expect((await post(50, { ...metadata, preview: undefined })).status()).toBe(
    400,
  );
  expect((await post(50, { ...metadata, preview: false })).status()).toBe(400);
  expect((await post(50, metadata, { unexpected: "extra" })).status()).toBe(
    400,
  );
  expect(
    (
      await post(50, {
        ...metadata,
        expectedTariffs: metadata.expectedTariffs.slice(1),
      })
    ).status(),
  ).toBe(400);
  expect(await calls()).toHaveLength(1);
});

test("a lost network response retries the same already-applied publication", async ({
  page,
}) => {
  await login(page);
  await preview(page);
  await page.route(`**/api/proxy${endpoint}`, async (route) => {
    await route.fetch();
    await route.abort("connectionreset");
    await page.unroute(`**/api/proxy${endpoint}`);
  });
  await page
    .getByRole("checkbox", { name: /I have reviewed these prices/ })
    .check();
  await page
    .getByRole("button", { name: "Publish prices", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry publication" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("region", { name: "Domestic PDF preview", exact: true }),
  ).not.toContainText("No prices have changed");
  await page.getByRole("button", { name: "Retry publication" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Prices published." }),
  ).toContainText("All six zones are active");
  const writes = (await calls()).filter((r: any) => !r.body.metadata.preview);
  expect(writes).toHaveLength(2);
  expect(writes[1].key).toBe(writes[0].key);
  expect(writes[1].body).toEqual(writes[0].body);
});
