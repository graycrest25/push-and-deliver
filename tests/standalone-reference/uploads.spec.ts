import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
const control = (body: Record<string, unknown> = {}) =>
  fetch("http://127.0.0.1:4319/control", {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.json());
const pdf = (size = 128) => ({
  name: "receipt.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.concat([
    Buffer.from("%PDF-1.7\n"),
    Buffer.alloc(size - 9, 32),
  ]),
});
const png = {
  name: "category.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
    "base64",
  ),
};
async function login(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Welcome back/ }),
  ).toBeVisible();
}
async function support(page: Page) {
  await page.goto("/support-tickets/ticket-1");
  await page
    .locator("summary")
    .filter({ hasText: /^Send reply$/ })
    .click();
  return page.locator("details").filter({
    has: page.locator("summary").filter({ hasText: /^Send reply$/ }),
  });
}
test.beforeEach(async () => {
  await control({ reset: true });
});
test("support waits for validation, sends only ready ID and keeps API credentials off storage", async ({
  page,
}) => {
  await login(page);
  const form = await support(page);
  await control({ uploadMode: "hold" });
  const file = pdf(6 * 1024 * 1024);
  await form
    .getByLabel("Attachment", { exact: true })
    .and(page.locator('input[type="file"]'))
    .setInputFiles(file);
  await expect(form.getByText("Validating file…")).toBeVisible();
  await expect(
    form.getByRole("button", { name: "Send reply", exact: true }),
  ).toBeDisabled();
  const before = (await control()).records;
  const create = before.find((r: any) => r.path === "/v1/uploads/multipart");
  expect(create.body).toEqual({
    mime_type: "application/pdf",
    size_bytes: file.buffer.length,
    upload_size_bytes: file.buffer.length,
    sha256: createHash("sha256").update(file.buffer).digest("hex"),
  });
  const parts = before.filter((r: any) => r.path.startsWith("/s3/"));
  expect(parts.map((r: any) => r.size)).toEqual([5242880, 1048576]);
  for (const part of parts) {
    expect(part.authorization).toBeUndefined();
    expect(part.cookie).toBeUndefined();
    expect(part.checksum).toHaveLength(44);
  }
  const stored = await page.evaluate(() => JSON.stringify(sessionStorage));
  expect(stored).not.toContain("private-test-signature");
  expect(stored).not.toContain("access-private");
  await control({ uploadMode: "ready" });
  await expect(
    form.getByText("Ready to attach", { exact: true }),
  ).toBeVisible();
  await form.getByRole("button", { name: "Send reply", exact: true }).click();
  await expect(form.getByText("Saved successfully.")).toBeVisible();
  expect(
    (await control()).records.find(
      (r: any) =>
        r.path === "/v1/support/tickets/ticket-1/messages" &&
        r.method === "POST",
    ).body,
  ).toEqual({ body: "", asset_id: "asset-1" });
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((k) => k.startsWith("pnd-upload:")),
    ),
  ).toEqual([]);
  await expect(
    form.getByRole("button", { name: "Delete unattached file" }),
  ).toHaveCount(0);
});
test("reload resumes only matching missing parts without creating another session", async ({
  page,
}) => {
  await login(page);
  let form = await support(page);
  await control({ blockedPart: 2 });
  const file = pdf(6 * 1024 * 1024);
  await form
    .getByLabel("Attachment", { exact: true })
    .and(page.locator('input[type="file"]'))
    .setInputFiles(file);
  await expect(form.getByRole("alert")).toContainText("File transfer paused", {
    timeout: 15000,
  });
  await page.reload();
  await page
    .locator("summary")
    .filter({ hasText: /^Send reply$/ })
    .click();
  form = page.locator("details").filter({
    has: page.locator("summary").filter({ hasText: /^Send reply$/ }),
  });
  await expect(form.getByText("receipt.pdf", { exact: true })).toBeVisible();
  await form
    .getByLabel("Select original file to resume")
    .setInputFiles(pdf(128));
  await expect(form.getByRole("alert")).toContainText(
    "differs from the original",
  );
  await control({ blockedPart: 0 });
  await form.getByLabel("Select original file to resume").setInputFiles(file);
  await expect(
    form.getByText("Ready to attach", { exact: true }),
  ).toBeVisible();
  const records = (await control()).records;
  expect(
    records.filter((r: any) => r.path === "/v1/uploads/multipart"),
  ).toHaveLength(1);
  expect(records.filter((r: any) => r.path === "/s3/asset-1/1")).toHaveLength(
    1,
  );
  expect(
    records.filter((r: any) => r.path === "/v1/uploads/asset-1/parts/2"),
  ).toHaveLength(4);
});
test("unfinished uploads abort and ready unattached uploads delete with idempotency keys", async ({
  page,
}) => {
  await login(page);
  const form = await support(page);
  await control({ blockedPart: 1 });
  await form
    .getByLabel("Attachment", { exact: true })
    .and(page.locator('input[type="file"]'))
    .setInputFiles(pdf());
  await expect(form.getByRole("alert")).toContainText("File transfer paused", {
    timeout: 15000,
  });
  await form
    .getByRole("button", { name: "Discard upload", exact: true })
    .click();
  await expect(form.getByText("receipt.pdf", { exact: true })).toHaveCount(0);
  await control({ blockedPart: 0 });
  await form
    .getByLabel("Attachment", { exact: true })
    .and(page.locator('input[type="file"]'))
    .setInputFiles(pdf());
  await expect(
    form.getByText("Ready to attach", { exact: true }),
  ).toBeVisible();
  await form.getByRole("button", { name: "Delete unattached file" }).click();
  await expect(form.getByText("receipt.pdf", { exact: true })).toHaveCount(0);
  const records = (await control()).records;
  expect(
    records.find((r: any) => r.path === "/v1/uploads/asset-1/abort").key,
  ).toMatch(/:abort$/);
  expect(
    records.find(
      (r: any) => r.path === "/v1/uploads/asset-2" && r.method === "DELETE",
    ).key,
  ).toMatch(/:delete$/);
});
test("category images upload, vendor catalogue uploads respect ownership, and invalid files never start", async ({
  page,
}) => {
  await login(page);
  await page.goto("/catalogue");
  await page
    .locator("summary")
    .filter({ hasText: /^Create category$/ })
    .click();
  const form = page.locator("details").filter({
    has: page.locator("summary").filter({ hasText: /^Create category$/ }),
  });
  await form
    .getByLabel("Category image", { exact: true })
    .and(page.locator('input[type="file"]'))
    .setInputFiles(pdf());
  await expect(form.getByRole("alert")).toContainText("Choose a JPEG");
  expect(
    (await control()).records.some(
      (r: any) => r.path === "/v1/uploads/multipart",
    ),
  ).toBe(false);
  await form
    .getByLabel("Category image", { exact: true })
    .and(page.locator('input[type="file"]'))
    .setInputFiles(png);
  await expect(
    form.getByText("Ready to attach", { exact: true }),
  ).toBeVisible();
  await form.getByLabel("Name *", { exact: true }).fill("Groceries");
  await form.getByLabel("Slug *", { exact: true }).fill("groceries");
  await form
    .getByRole("button", { name: "Create category", exact: true })
    .click();
  await expect(form.getByText("Saved successfully.")).toBeVisible();
  expect(
    (await control()).records.find(
      (r: any) =>
        r.path === "/v1/marketplace/categories" && r.method === "POST",
    ).body.image_asset_id,
  ).toBe("asset-1");
  await page
    .locator("summary")
    .filter({ hasText: /^Create catalogue item$/ })
    .click();
  const item = page.locator("details").filter({
    has: page.locator("summary").filter({ hasText: /^Create catalogue item$/ }),
  });
  await item.getByLabel("Vendor account ID *").fill("vendor-1");
  await expect(item.locator('input[type="file"]')).toHaveCount(0);
  await item.getByText("Use an existing file ID", { exact: true }).click();
  await item.getByLabel("Existing file ID", { exact: true }).fill("asset-1");
  await item.getByRole("button", { name: "Attach file", exact: true }).click();
  await expect(item.getByRole("alert")).toContainText(
    "owned by the selected vendor",
  );
});
test("failed processing blocks submission; size validation and proxy part bounds are enforced", async ({
  page,
}) => {
  await login(page);
  const form = await support(page);
  await form
    .getByLabel("Attachment", { exact: true })
    .and(page.locator('input[type="file"]'))
    .setInputFiles(pdf(10 * 1024 * 1024 + 1));
  await expect(form.getByRole("alert")).toContainText("no larger than 10 MiB");
  await control({ uploadMode: "fail" });
  await form
    .getByLabel("Attachment", { exact: true })
    .and(page.locator('input[type="file"]'))
    .setInputFiles(pdf());
  await expect(form.getByRole("alert")).toContainText(
    "did not pass validation",
  );
  await expect(
    form.getByRole("button", { name: "Send reply", exact: true }),
  ).toBeDisabled();
  const response = await page.request.post(
    "/api/proxy/v1/uploads/asset-1/parts/3",
    {
      headers: { Origin: "http://localhost:4320" },
      data: { checksum_sha256: "abc" },
    },
  );
  expect(response.status()).toBe(404);
  await form
    .getByRole("button", { name: "Discard upload", exact: true })
    .click();
  await expect(
    form.getByRole("button", { name: "Send reply", exact: true }),
  ).toBeEnabled();
});
test("shipment evidence uses the same ready-file flow and fits desktop and mobile", async ({
  page,
}) => {
  await login(page);
  await page.goto("/shipment-orders/shipment-1");
  await page
    .locator("summary")
    .filter({ hasText: /^Record evidenced cash receipt$/ })
    .click();
  const form = page.locator("details").filter({
    has: page
      .locator("summary")
      .filter({ hasText: /^Record evidenced cash receipt$/ }),
  });
  await form
    .getByLabel("Evidence file *", { exact: true })
    .and(page.locator('input[type="file"]'))
    .setInputFiles(pdf());
  await expect(
    form.getByText("Ready to attach", { exact: true }),
  ).toBeVisible();
  await form.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/upload-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await form.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/upload-mobile.png",
    fullPage: true,
  });
});
