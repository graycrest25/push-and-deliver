import { test, expect, type Page } from "@playwright/test";
async function control(body: Record<string, unknown> = {}) {
  const r = await fetch("http://127.0.0.1:4319/control", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return (await r.json()).data;
}
async function open(page: Page, path: string) {
  await page.unrouteAll({ behavior: "wait" });
  await page.context().clearCookies();
  // Authenticate against the real Next proxy. Only component mounting is isolated:
  // the production membership gate remains covered by native-auth.spec.ts.
  // A synthetic public storage host avoids Chromium's loopback permission prompt.
  // The actual request still reaches our isolated storage fixture, with its signed headers.
  await page.route("https://uploads.example.test/**", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: `http://127.0.0.1:4319${url.pathname}`,
    });
    await route.fulfill({ response });
  });
  await page.goto("/sign-in");
  const css = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLLinkElement).href));
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Admin access cannot be verified yet" }),
  ).toBeVisible();
  await page.route("**/__component.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      path: "/private/tmp/pnd-native-component-tests/harness.js",
    }),
  );
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() === "document")
      return route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${css.map((url) => `<link rel="stylesheet" href="${url}">`).join("")}</head><body><div id="root"></div><script src="/__component.js"></script></body></html>`,
      });
    await route.fallback();
  });
  await page.goto(path);
}
test.beforeEach(async () => {
  await control({ reset: true });
});
test("native reports unwrap envelopes, format money and preserve unavailable states", async ({
  page,
}) => {
  await open(page, "/dashboard");
  await expect(page.getByText("42", { exact: true })).toBeVisible();
  await expect(page.getByText(/1,250\.00/)).toBeVisible();
  await page
    .getByRole("combobox", { name: /^Account summary/ })
    .selectOption("riders");
  await expect
    .poll(async () =>
      (await control()).records.some(
        (r: any) =>
          r.path.endsWith("account-summary") && r.query.type === "riders",
      ),
    )
    .toBeTruthy();
  await control({ featureUnavailable: true });
  await page
    .getByRole("combobox", { name: /^Order summary/ })
    .selectOption("ride-courier");
  await expect(page.getByRole("alert")).toContainText(
    "Reporting sources are not ready",
  );
  await page.goto("/reports?role=verifier");
  await expect(
    page.getByRole("combobox", { name: /^Account summary/ }),
  ).toHaveValue("riders");
  await expect(
    page.getByRole("combobox", { name: /^Order summary/ }),
  ).toHaveCount(0);
});
test("referrals use supported page sizes, scoped cursors and native CSV dates", async ({
  page,
}) => {
  await open(page, "/referrals");
  await expect(page.getByText("CODE123", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Rows per page")).toHaveValue("50");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("ref-2", { exact: true })).toBeVisible();
  await page.getByLabel("Referred user ID", { exact: true }).fill("user-1");
  await page.getByRole("button", { name: /Apply filters/ }).click();
  await expect(page.getByText("ref-1", { exact: true })).toBeVisible();
  await page.getByLabel("Start date", { exact: true }).fill("2026-10-01");
  await page.getByLabel("End date", { exact: true }).fill("2026-10-31");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download referral CSV" }).click();
  const saved = await download;
  expect(saved.suggestedFilename()).toBe("referrals-2026-10-01-2026-10-31.csv");
  const records = (await control()).records;
  expect(records.find((r: any) => r.path.endsWith("export.csv")).query).toEqual(
    { startDate: "2026-10-01", endDate: "2026-10-31" },
  );
  expect(
    records.some(
      (r: any) =>
        r.path === "/v1/admin/referrals" && r.query.cursor === "ref-next",
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "test-results/native-referrals-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/native-referrals-mobile.png",
    fullPage: true,
  });
});
test("shipments use native filters, detail and tracking without legacy query parameters", async ({
  page,
}) => {
  await open(page, "/shipment-orders");
  await expect(page.getByLabel("Rows per page")).toHaveValue("100");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect
    .poll(async () =>
      (await control()).records.some(
        (record: any) =>
          record.path === "/v1/shipments" &&
          record.query.limit === "100" &&
          record.query.cursor === "shipment-next",
      ),
    )
    .toBeTruthy();
  await expect(
    page.getByRole("columnheader", { name: "Shipment ID", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "shipment-1", exact: true }),
  ).toHaveAttribute("href", "/shipment-orders/shipment-1");
  const status = page.getByLabel("Status", { exact: true });
  await expect(status.locator("option")).toHaveText([
    "All",
    "Placed",
    "Accepted by rider",
    "Sent to HQ",
    "En route to destination",
    "Delivered to destination",
    "Cancelled",
    "En route to PND HQ",
  ]);
  await status.selectOption("onRouteToPndHQ");
  await page.getByLabel("Origin city", { exact: true }).selectOption("ibadan");
  await page
    .getByLabel("Shipment type", { exact: true })
    .selectOption("express");
  await page.getByRole("button", { name: /Apply filters/ }).click();
  await expect
    .poll(async () =>
      (await control()).records.some(
        (r: any) =>
          r.path === "/v1/shipments" &&
          r.query.shipmentType === "express" &&
          r.query.city === "ibadan" &&
          r.query.limit === "100" &&
          !r.query.cursor &&
          r.query.status === "onRouteToPndHQ",
      ),
    )
    .toBeTruthy();
  await expect(
    page.getByRole("cell", { name: "Ibadan", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/shipment-table-colors.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.goto("/shipment-orders/shipment-1");
  await expect(page.getByText(/350\.00/).first()).toBeVisible();
  await expect
    .poll(async () =>
      (await control()).records.some(
        (r: any) =>
          r.path.endsWith("/tracking") && Object.keys(r.query).length === 0,
      ),
    )
    .toBeTruthy();
  await page.getByRole("button", { name: "Download invoice" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Private document storage",
  );
});
test("manual withdrawal claim, protected destination and settlement retries", async ({
  page,
}) => {
  await open(page, "/withdrawals");
  await expect(page.getByText(/1,250\.00/)).toBeVisible();
  await page.goto("/withdrawals/withdrawal-1");
  await expect(
    page.getByRole("button", { name: "Show bank details for payment" }),
  ).toHaveCount(0);
  await page
    .locator("summary")
    .filter({ hasText: "Claim for payment" })
    .click();
  const claim = page.locator("details").filter({
    has: page.locator("summary").filter({ hasText: "Claim for payment" }),
  });
  await claim.getByLabel("Reason").fill("Reviewed and claiming payment");
  await claim
    .getByRole("button", { name: "Claim for payment", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Show bank details for payment" })
    .click();
  await expect(page.getByText("0123451234", { exact: true })).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "Record successful bank transfer" })
    .click();
  const settle = page.locator("details").filter({
    has: page
      .locator("summary")
      .filter({ hasText: "Record successful bank transfer" }),
  });
  await settle.getByLabel("Bank transfer reference").fill("bank-ref-123");
  await settle
    .getByLabel("Payment time (include timezone)")
    .fill(new Date().toISOString());
  await settle.getByLabel("Reason").fill("Bank statement confirms payment");
  await control({ paymentLostOnce: true });
  await settle
    .getByRole("button", {
      name: "Record successful bank transfer",
      exact: true,
    })
    .click();
  await expect(settle.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await expect(settle.getByLabel("Bank transfer reference")).toBeDisabled();
  await settle
    .getByRole("button", {
      name: "Record successful bank transfer",
      exact: true,
    })
    .click();
  await expect(page.getByText("Successful", { exact: true })).toBeVisible();
  await expect(page.getByText("0123451234", { exact: true })).toHaveCount(0);
  const calls = (await control()).records.filter((r: any) =>
    r.path.endsWith("/mark-successful"),
  );
  expect(calls).toHaveLength(2);
  expect(calls[0].body).toEqual(calls[1].body);
  expect(calls[0].key).toBe(calls[1].key);
  expect(calls[0].body.transferReference).toBe("BANK-REF-123");
});
test("another assignee and customer care cannot access settlement controls", async ({
  page,
}) => {
  await control({ assignedToOther: true });
  await open(page, "/withdrawals/withdrawal-1");
  await expect(page.getByText("admin-other", { exact: true })).toBeVisible();
  await expect(page.locator("details")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Show bank details for payment" }),
  ).toHaveCount(0);
  await control({ reset: true });
  await open(page, "/withdrawals/withdrawal-1?role=customercare");
  await expect(page.getByText("Requested", { exact: true })).toBeVisible();
  await expect(page.locator("details")).toHaveCount(0);
});
test("job history pagination and replay bind the reviewed generation", async ({
  page,
}) => {
  await open(page, "/jobs");
  await expect(page.getByText("job-1", { exact: true })).toBeVisible();
  await page.goto("/jobs/job-1");
  await page.getByRole("button", { name: "More attempts" }).click();
  await expect(
    page.getByRole("button", { name: "More attempts" }),
  ).toBeDisabled();
  await page.locator("summary").filter({ hasText: "Replay dead job" }).click();
  await page.getByLabel("Reason").fill("Reviewed and fixed storage failure");
  await page
    .getByRole("button", { name: "Replay dead job", exact: true })
    .click();
  await expect(page.getByText("Pending", { exact: true })).toBeVisible();
  const call = (await control()).records.find((r: any) =>
    r.path.endsWith("/replay"),
  );
  expect(call.body).toEqual({
    reason: "Reviewed and fixed storage failure",
    expectedGeneration: 2,
  });
  expect(call.key).toBeTruthy();
});
test("native asset intent, signed upload, processing and deletion use correct contracts", async ({
  page,
}) => {
  await open(page, "/files");
  await page.locator("input[type=file]").setInputFiles({
    name: "invoice.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nfixture"),
  });
  await expect(page.getByText("File ready", { exact: true })).toBeVisible();
  let records = (await control()).records;
  const intent = records.find(
    (r: any) => r.path === "/v1/assets/upload-intents",
  );
  expect(intent.body).toMatchObject({
    purpose: "invoice",
    contentType: "application/pdf",
    sizeBytes: 16,
  });
  expect(Buffer.from(intent.body.checksumSha256, "base64")).toHaveLength(32);
  const storage = records.find(
    (r: any) => r.method === "PUT" && r.path.startsWith("/storage/"),
  );
  expect(storage.authorization).toBeUndefined();
  expect(storage.checksum).toBe(intent.body.checksumSha256);
  const completions = records.filter((r: any) => r.path.endsWith("/complete"));
  expect(completions).toHaveLength(2);
  expect(completions[0].rawBody).toBe("");
  expect(completions[0].key).toBe(completions[1].key);
  await page.getByRole("button", { name: "Delete unattached file" }).click();
  await expect(page.getByText("invoice.pdf", { exact: true })).toHaveCount(0);
  records = (await control()).records;
  expect(
    records.some(
      (r: any) => r.method === "DELETE" && r.path === "/v1/assets/asset-1",
    ),
  ).toBeTruthy();
  expect(
    records.some((r: any) => r.path.startsWith("/v1/uploads/")),
  ).toBeFalsy();
});
test("failed asset processing never exposes a ready file or attachment", async ({
  page,
}) => {
  await control({ failAsset: true });
  await open(page, "/files");
  await page.locator("input[type=file]").setInputFiles({
    name: "invoice.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nfixture"),
  });
  await expect(page.getByRole("alert")).toContainText(
    "did not pass processing",
  );
  await expect(page.getByText("File ready", { exact: true })).toHaveCount(0);
});
test("proxy rejects confirmed unmounted APIs and keeps native calls authenticated", async ({
  page,
}) => {
  await open(page, "/jobs");
  await expect(page.getByText("job-1", { exact: true })).toBeVisible();
  for (const path of [
    "/v1/config",
    "/v1/payouts/withdrawals",
    "/v1/uploads/asset-1",
  ])
    expect((await page.request.get(`/api/proxy${path}`)).status()).toBe(404);
  const record = (await control()).records.find(
    (r: any) => r.path === "/v1/admin/jobs",
  );
  expect(record.authorization).toBe("Bearer pnd_a2_private");
  expect(record.account).toBe("user");
});
