import { test, expect, type Page } from "@playwright/test";

async function control(body: Record<string, unknown> = {}) {
  return fetch("http://127.0.0.1:4319/control", {
    method: "POST",
    body: JSON.stringify(body),
  })
    .then((r) => r.json())
    .then((r) => r.data);
}
async function login(page: Page, adminType = "super") {
  await control({ reset: true, latest: true, adminType });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#workspace-content")).toBeVisible({
    timeout: 30000,
  });
}
const historical = {
  readOnly: true,
  historicalStatusEditable: true,
  allowedHistoricalStatuses: ["completed", "cancelled"],
  sourceVersion: "9007199254740993999",
};
const shipment = {
  id: "historical-shipment",
  shipmentType: "local",
  status: "placed",
  version: 5,
  nativeWriteEligible: false,
  ...historical,
  allowedAdminActions: ["review_price"],
};
test("historical ride uses fresh string source version and never native cancellation", async ({
  page,
}, testInfo) => {
  await login(page);
  const id = "ZpmeaZPTkc66e6B9MKOI";
  await control({ ...historical, rideId: id });
  await page.goto(`/ride-hailing/${id}`);
  await expect(page.getByText("Cancel ride", { exact: true })).toHaveCount(0);
  const form = page
    .locator("details")
    .filter({ hasText: "Change historical status" });
  await form.locator("summary").click();
  await expect(form).toContainText(
    "do not pay the rider, charge the customer or issue refunds",
  );
  await form.getByLabel("Historical status").selectOption("cancelled");
  await form.getByLabel("Reason for change").fill("Correct retained order");
  await page.screenshot({
    path: testInfo.outputPath("historical-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("historical-mobile.png"),
    fullPage: true,
  });
  await control({ rideVersion: 8, sourceVersion: "9007199254740994001" });
  await form
    .getByRole("button", { name: "Change historical status", exact: true })
    .click();
  await expect
    .poll(async () =>
      (await control()).records.filter((r: any) =>
        r.path.endsWith("/historical-status"),
      ),
    )
    .toHaveLength(1);
  const calls = (await control()).records.filter(
    (r: any) => r.method === "POST" && r.path.includes(`/rides/${id}`),
  );
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({
    path: `/v1/admin/rides/${id}/historical-status`,
    body: {
      expectedVersion: 8,
      expectedSourceVersion: "9007199254740994001",
      targetStatus: "cancelled",
      reason: "Correct retained order",
    },
  });
});
test("historical shipment updates and refreshes timeline without unlocking repricing", async ({
  page,
}) => {
  await login(page);
  await control({ latestShipment: shipment });
  await page.goto(`/shipment-orders/${shipment.id}`);
  await expect(
    page.getByText("Review shipment price", { exact: true }),
  ).toHaveCount(0);
  const form = page
    .locator("details")
    .filter({ hasText: "Change historical status" });
  await form.locator("summary").click();
  await form.getByLabel("Historical status").selectOption("cancelled");
  await form.getByLabel("Reason for change").fill("Historical correction");
  await control({
    latestShipment: {
      ...shipment,
      version: 7,
      sourceVersion: "opaque-source-v7",
    },
  });
  const timelineReads = (await control()).records.filter((r: any) =>
    r.path.endsWith(`/${shipment.id}/timeline`),
  ).length;
  await form
    .getByRole("button", { name: "Change historical status", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await control()).records.filter((r: any) =>
          r.path.endsWith(`/${shipment.id}/historical-status`),
        ).length,
    )
    .toBe(1);
  await expect
    .poll(
      async () =>
        (await control()).records.filter((r: any) =>
          r.path.endsWith(`/${shipment.id}/timeline`),
        ).length,
    )
    .toBeGreaterThan(timelineReads);
  const call = (await control()).records.find((r: any) =>
    r.path.endsWith(`/${shipment.id}/historical-status`),
  );
  expect(call.body).toEqual({
    expectedVersion: 7,
    expectedSourceVersion: "opaque-source-v7",
    targetStatus: "cancelled",
    reason: "Historical correction",
  });
});
test("shipment review sends full gross price with fresh version and retains payment outcome", async ({
  page,
}, testInfo) => {
  await login(page);
  const data = {
    ...shipment,
    id: "native-review",
    readOnly: false,
    historicalStatusEditable: false,
    nativeWriteEligible: true,
    weightKg: 3,
    pricing: {
      grossAmountMinor: 400000,
      totalAmountMinor: 350000,
      currency: "NGN",
    },
  };
  await control({ latestShipment: data });
  await page.goto(`/shipment-orders/${data.id}`);
  const form = page
    .locator("details")
    .filter({ hasText: "Review shipment price" });
  await form.locator("summary").click();
  await expect(form.getByLabel("Full revised price (₦)")).toHaveValue("4000");
  await form.getByLabel("Reweighed weight (kg)").fill("3.2");
  await form.getByLabel("Full revised price (₦)").fill("4500");
  await expect(form.getByLabel("Price comparison")).toContainText("₦4,500.00");
  await expect(form.getByLabel("Price comparison")).toContainText(
    "₦500.00 increase",
  );
  await form.getByLabel("Reason for change").fill("Office reweighing");
  await page.screenshot({
    path: testInfo.outputPath("price-review-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("price-review-mobile.png"),
    fullPage: true,
  });
  await control({ latestShipment: { ...data, version: 6 } });
  await form
    .getByRole("button", { name: "Save revised price", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Price review outcome" }),
  ).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Price review outcome" }),
  ).toContainText("₦3,000.00");
  await page.getByText("Review details", { exact: true }).click();
  await expect(
    page.getByText("assessment-review", { exact: true }),
  ).toBeVisible();
  const call = (await control()).records.find((r: any) =>
    r.path.endsWith("/price-reviews"),
  );
  expect(call.body).toEqual({
    expectedVersion: 6,
    newWeightKg: 3.2,
    revisedGrossAmountMinor: 450000,
    currency: "NGN",
    reason: "Office reweighing",
  });
});
test("fresh historical permissions and source version are required", async ({
  page,
}) => {
  await login(page);
  await control(historical);
  await page.goto("/ride-hailing/ride-1");
  const form = page
    .locator("details")
    .filter({ hasText: "Change historical status" });
  await form.locator("summary").click();
  await form.getByLabel("Reason for change").fill("Correction");
  await control({ sourceVersion: 123 });
  await form
    .getByRole("button", { name: "Change historical status", exact: true })
    .click();
  await expect(form).toContainText("A current source version is required");
  await control({ historicalStatusEditable: false });
  await form
    .getByRole("button", { name: "Change historical status", exact: true })
    .click();
  await expect(form).toContainText("no longer available");
  expect(
    (await control()).records.filter((r: any) =>
      r.path.endsWith("/historical-status"),
    ),
  ).toHaveLength(0);
});
test("regular admin cannot call historical or price-review endpoints", async ({
  page,
}) => {
  await login(page, "regular");
  for (const path of [
    "rides/ride-1/historical-status",
    "shipments/shipment-1/historical-status",
    "shipments/shipment-1/price-reviews",
  ]) {
    const response = await page.request.post(`/api/proxy/v1/admin/${path}`, {
      headers: {
        Origin: "http://localhost:4320",
        "Idempotency-Key": "denied-test",
      },
      data: { expectedVersion: 1, reason: "Test" },
    });
    expect(response.status()).toBe(403);
  }
});

test("shipment billing keeps payment actions with their charge across themes and screen sizes", async ({
  page,
}, testInfo) => {
  await login(page);
  await control({
    latestShipment: {
      ...shipment,
      id: "billing-layout",
      readOnly: false,
      historicalStatusEditable: false,
      nativeWriteEligible: true,
      status: "sentToHq",
      weightKg: 3,
      pricing: {
        grossAmountMinor: 1573678,
        totalAmountMinor: 1573678,
        currency: "NGN",
      },
      payment: { status: "unpaid", method: "cash" },
      onwardDeliveryBlockers: [
        "customer_payment_required",
        "assessment_payment_required",
      ],
      allowedAdminActions: [
        "review_price",
        "record_cash_receipt",
        "request_payment_link",
      ],
      assessments: [
        {
          id: "assessment-12345678",
          kind: "initial",
          status: "due",
          amountMinor: 1573678,
          checkoutStatus: "ready",
          paymentId: "payment-12345678",
          reference: "pnd-payment-12345678",
          authorizationUrl: "https://checkout.paystack.com/example",
        },
      ],
    },
  });
  await page.goto("/shipment-orders/billing-layout");
  const billing = page.locator("#shipment-billing");
  await billing
    .locator("summary", { hasText: "Review shipment price" })
    .click();
  await billing.getByLabel("Full revised price (₦)").fill("18000");
  await expect(billing.getByLabel("Price comparison")).toContainText(
    "₦2,263.22 increase",
  );
  await expect(
    page
      .getByRole("region", { name: "Update shipment status", exact: true })
      .getByRole("button", { name: /Record cash/ }),
  ).toHaveCount(0);
  await expect(
    billing.getByRole("link", { name: "Open payment link" }),
  ).toHaveAttribute("href", "https://checkout.paystack.com/example");
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate((dark) => {
        document.documentElement.classList.toggle("dark", dark);
        document.documentElement.style.colorScheme = dark ? "dark" : "light";
      }, theme === "dark");
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
      await billing.screenshot({
        path: testInfo.outputPath(`billing-${width}-${theme}.png`),
      });
    }
  }
});
