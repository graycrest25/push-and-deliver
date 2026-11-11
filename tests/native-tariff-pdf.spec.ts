import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
const endpoint = "/v1/admin/shipping/tariffs/active-export/import-pdf";
const pdf = Buffer.from("%PDF-1.7\ntransport fixture\n%%EOF");
async function control(body: Record<string, unknown> = {}) {
  return fetch("http://127.0.0.1:4319/control", {
    method: "POST",
    body: JSON.stringify(body),
  })
    .then((r) => r.json())
    .then((r) => r.data);
}
async function login(page: Page) {
  await control({ reset: true, latest: true, adminType: "super" });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#workspace-content")).toBeVisible({
    timeout: 30000,
  });
  await page.goto("/export-rates/tariffs/active-export");
  await page.getByRole("tab", { name: "PDF upload", exact: true }).click();
  if (
    !(await upload(page).evaluate((node) => (node as HTMLDetailsElement).open))
  )
    await page.getByText("Upload price-list PDF", { exact: true }).click();
}
const upload = (page: Page) =>
  page.locator("details").filter({
    has: page.locator("summary", { hasText: /^Upload price-list PDF$/ }),
  });
const calls = async () =>
  (await control()).records.filter((row: any) => row.path === endpoint);
test.setTimeout(120000);

test("PDF preview and publication forward multipart with stable retry keys", async ({
  page,
}, info) => {
  await login(page);
  const form = upload(page);
  await form.getByLabel("Price-list PDF", { exact: true }).setInputFiles({
    name: "prices.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await form.getByLabel("Price-list name").fill("Retry prices");
  await form
    .getByLabel("Reason for price update")
    .fill("Updated DHL partner prices");
  await expect(
    form.getByRole("button", { name: "Publish prices", exact: true }),
  ).toHaveCount(0);
  await form.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(form.getByRole("region", { name: "PDF preview" })).toContainText(
    "240",
  );
  await expect(form.getByRole("region", { name: "PDF preview" })).toContainText(
    "52",
  );
  const review = form.getByRole("region", { name: "PDF preview" });
  await expect(review).toContainText("No prices have changed");
  await expect(review).toContainText("72");
  await expect(review).toContainText("181");
  await expect(review).toContainText("25 kg");
  const prices = review.getByRole("region", {
    name: "Imported prices",
    exact: true,
  });
  await expect(
    prices.getByRole("columnheader", { name: "Weight (kg)" }),
  ).toBeVisible();
  await expect(prices.getByRole("row")).toHaveCount(31);
  await expect(prices.getByRole("row").nth(1)).toContainText("0.5");
  await expect(prices.getByRole("row").nth(1)).toContainText("₦74,074.72");
  await expect(prices.getByRole("row").nth(1)).toContainText("₦78,217.68");
  await expect(
    review
      .getByRole("region", { name: "Country-zone changes", exact: true })
      .getByRole("row")
      .nth(1),
  ).toHaveText("DE54");
  await page.getByRole("tab", { name: "Prices", exact: true }).click();
  await expect(form).not.toBeVisible();
  await page.getByRole("tab", { name: "PDF upload", exact: true }).click();
  await expect(review).toContainText("No prices have changed");
  const first = (await calls())[0];
  expect(first.body.metadata).toEqual({
    name: "Retry prices",
    reason: "Updated DHL partner prices",
    expectedVersion: 1,
    preview: true,
  });
  expect(first.body.fileHash).toBe(
    createHash("sha256").update(pdf).digest("hex"),
  );
  expect(first.authorization).toMatch(/^Bearer /);
  expect(first.account).toBe("user");
  await page.screenshot({
    fullPage: true,
    path: info.outputPath("pdf-preview-desktop.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    fullPage: true,
    path: info.outputPath("pdf-preview-mobile.png"),
  });
  await form
    .getByRole("button", { name: "Publish prices", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText(
    "Publication response timed out",
  );
  await expect(form.getByLabel("Price-list name")).toBeDisabled();
  await form.getByRole("button", { name: "Retry publication" }).click();
  await expect(form.getByRole("status")).toContainText("Prices published");
  await expect(
    form.getByRole("link", { name: "Open published tariff", exact: true }),
  ).toHaveAttribute("href", "/export-rates/tariffs/replacement-export");
  const writes = await calls();
  expect(writes).toHaveLength(3);
  expect(writes[1].key).not.toBe(writes[0].key);
  expect(writes[2].key).toBe(writes[1].key);
  expect(writes[2].body).toEqual(writes[1].body);
  expect(writes[1].body.metadata.preview).toBe(false);
  expect(writes[1].body.metadata.expectedVersion).toBe(1);
  expect(writes[1].body.fileHash).toBe(first.body.fileHash);
});

test("PDF upload rejects oversize files, invalid previews and stale versions", async ({
  page,
}) => {
  await login(page);
  const form = upload(page);
  await form.getByLabel("Price-list PDF", { exact: true }).setInputFiles({
    name: "huge.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(2097153),
  });
  await expect(form.getByRole("alert")).toContainText("2 MiB");
  await expect(
    form.getByRole("button", { name: "Preview", exact: true }),
  ).toBeDisabled();
  expect(await calls()).toHaveLength(0);
  await form.getByLabel("Price-list PDF", { exact: true }).setInputFiles({
    name: "scanned.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await form.getByLabel("Price-list name").fill("New prices");
  await form.getByLabel("Reason for price update").fill("Partner update");
  await form.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(form.getByRole("alert")).toContainText(
    "Live prices are unchanged",
  );
  await expect(
    form.getByRole("button", { name: "Publish prices", exact: true }),
  ).toHaveCount(0);
  await form.getByLabel("Price-list PDF", { exact: true }).setInputFiles({
    name: "prices.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await form.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    form.getByRole("button", { name: "Publish prices", exact: true }),
  ).toBeVisible();
  await form.getByLabel("Price-list name").fill("Revised name");
  await expect(
    form.getByRole("button", { name: "Publish prices", exact: true }),
  ).toHaveCount(0);
  await form.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    form.getByRole("button", { name: "Publish prices", exact: true }),
  ).toBeVisible();
  await page.route(
    "**/api/proxy/v1/admin/shipping/tariffs/active-export/snapshot",
    (route) =>
      route.fulfill({ json: { data: { version: 2, status: "active" } } }),
  );
  await form
    .getByRole("button", { name: "Publish prices", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText("tariff changed");
  expect(
    (await calls()).every((row: any) => row.body.metadata.preview === true),
  ).toBe(true);
});

test("PDF proxy accepts exactly 2 MiB and rejects a larger file before forwarding", async ({
  page,
}) => {
  await login(page);
  const metadata = JSON.stringify({
    name: "Boundary prices",
    reason: "Transport boundary test",
    expectedVersion: 1,
    preview: true,
  });
  const post = (size: number) =>
    page.request.post(`/api/proxy${endpoint}`, {
      headers: {
        Origin: "http://localhost:4320",
        "Idempotency-Key": `pdf-boundary-${size}`,
      },
      multipart: {
        metadata,
        file: {
          name: "boundary.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.alloc(size, 65),
        },
      },
    });
  expect((await post(2097152)).status()).toBe(200);
  expect((await calls())[0].body.fileSize).toBe(2097152);
  expect((await post(2097153)).status()).toBe(413);
  expect(await calls()).toHaveLength(1);
});

test("PDF preview must match the requested base tariff and version", async ({
  page,
}) => {
  await login(page);
  const form = upload(page);
  await form.getByLabel("Price-list PDF", { exact: true }).setInputFiles({
    name: "prices.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await form.getByLabel("Price-list name").fill("New prices");
  await form.getByLabel("Reason for price update").fill("Partner update");
  for (const changes of [
    { baseTariffId: "wrong-tariff" },
    { baseVersion: 999 },
    { applied: true },
  ]) {
    await page.route(`**/api/proxy${endpoint}`, async (route) => {
      const response = await route.fetch();
      const result = await response.json();
      await route.fulfill({
        json: { ...result, data: { ...result.data, ...changes } },
      });
    });
    await form.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("does not match");
    await expect(
      form.getByRole("button", { name: "Publish prices", exact: true }),
    ).toHaveCount(0);
    await page.unroute(`**/api/proxy${endpoint}`);
  }
});

test("a rejected PDF explains the file error and preserves its request reference", async ({
  page,
}) => {
  await login(page);
  const form = upload(page);
  await form.getByLabel("Price-list PDF", { exact: true }).setInputFiles({
    name: "prices.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await form.getByLabel("Price-list name").fill("PND APP prices");
  await form.getByLabel("Reason for price update").fill("Partner update");
  await page.route(`**/api/proxy${endpoint}`, (route) =>
    route.fulfill({
      status: 400,
      json: {
        error: {
          code: "invalid_request",
          message: "Invalid request field",
          details: { fields: { file: "invalid" } },
        },
        requestId: "c86e0e36b599701215541c388fc9867b",
      },
    }),
  );
  await form.getByRole("button", { name: "Preview", exact: true }).click();
  const alert = form.getByRole("alert");
  await expect(alert).toContainText("The price-list PDF was rejected");
  await expect(alert).toContainText("include every page");
  await expect(alert).toContainText("Live prices are unchanged");
  await expect(alert).toContainText("c86e0e36b599701215541c388fc9867b");
  await expect(
    form.getByRole("button", { name: "Publish prices" }),
  ).toHaveCount(0);
  await expect(form.getByLabel("Price-list name")).toHaveValue(
    "PND APP prices",
  );
});

test("PND APP previews display all 312 prices through 70 kg", async ({
  page,
}) => {
  await login(page);
  const form = upload(page);
  await form.getByLabel("Price-list PDF", { exact: true }).setInputFiles({
    name: "app-prices.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await form.getByLabel("Price-list name").fill("PND APP prices");
  await form.getByLabel("Reason for price update").fill("Partner update");
  // This response checks the display contract; actual PDF extraction is covered
  // by the backend tests against both original uploaded files.
  await page.route(`**/api/proxy${endpoint}`, async (route) => {
    const response = await route.fetch();
    const result = await response.json();
    const weights = [
      ...Array.from({ length: 10 }, (_, i) => (i + 1) * 500),
      ...Array.from({ length: 25 }, (_, i) => (i + 6) * 1000),
      40000,
      50000,
      60000,
      70000,
    ];
    await route.fulfill({
      json: {
        ...result,
        data: {
          ...result.data,
          importedRates: 312,
          preservedHigherWeightRates: 0,
          maxImportedWeightGrams: 70000,
          rates: weights.flatMap((weightGrams) =>
            Array.from({ length: 8 }, (_, i) => ({
              zone: i + 1,
              weightGrams,
              amountMinor: weightGrams === 70000 ? 405749790 : 7263314,
            })),
          ),
        },
      },
    });
  });
  await form.getByRole("button", { name: "Preview", exact: true }).click();
  const review = form.getByRole("region", { name: "PDF preview", exact: true });
  await expect(review).toContainText("312");
  await expect(review).toContainText("70 kg");
  const rows = review
    .getByRole("region", { name: "Imported prices", exact: true })
    .getByRole("row");
  await expect(rows).toHaveCount(40);
  await expect(rows.last()).toContainText("70");
  await expect(rows.last()).toContainText("₦4,057,497.90");
  await expect(
    form.getByRole("button", { name: "Publish prices", exact: true }),
  ).toBeVisible();
});
