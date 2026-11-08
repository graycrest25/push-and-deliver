import { test, expect, type Page } from "@playwright/test";
const shipment = {
  id: "shipment-1",
  version: 3,
  status: "sentToHq",
  shipmentType: "express",
  nativeWriteEligible: true,
  canCancel: false,
  allowedAdminActions: ["issue_office_handoff_code"],
  pricing: { totalAmountMinor: 500000, currency: "NGN" },
  payment: { status: "unpaid", method: "cash" },
  riderAmountMinor: 140000,
  riderTaskStatus: "awaiting_hq_payment",
  riderPayment: {
    amountMinor: 140000,
    currency: "NGN",
    method: "hq_cash",
    status: "awaiting_receipt",
    confirmedAt: null,
    walletCredited: false,
  },
  canConfirmHQPayment: true,
};
async function mount(page: Page) {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (route.request().resourceType() === "document")
      return route.fulfill({
        contentType: "text/html",
        body: '<html><body><div id="root"></div><script src="/__component.js"></script></body></html>',
      });
    if (url.pathname === "/__component.js")
      return route.fulfill({
        contentType: "text/javascript",
        path: "/private/tmp/pnd-native-component-tests/harness.js",
      });
    if (url.pathname.includes("/api/proxy/"))
      return route.fulfill({ json: { data: { items: [], hasMore: false } } });
    return route.abort();
  });
}
for (const role of ["regular", "super"]) {
  test(`${role} admin issues, retries and replaces an HQ code without changing version`, async ({
    page,
  }) => {
    await mount(page);
    const issuedAt = Date.now();
    await page.clock.install({ time: issuedAt });
    await page.route("**/api/proxy/v1/shipments/shipment-1", (route) =>
      route.fulfill({ json: { data: shipment } }),
    );
    const writes: { body: any; key: string }[] = [];
    await page.route(
      "**/api/proxy/v1/admin/shipments/shipment-1/office-handoff-code",
      (route) => {
        writes.push({
          body: route.request().postDataJSON(),
          key: route.request().headers()["idempotency-key"],
        });
        if (writes.length === 1)
          return route.fulfill({
            status: 504,
            json: { error: { message: "Response timed out" } },
          });
        return route.fulfill({
          json: {
            data: {
              id: "shipment-1",
              version: 3,
              officeHandoffCode: writes.length === 2 ? "024591" : "824591",
              expiresAt: new Date(
                issuedAt + (writes.length === 2 ? 600000 : 1200000),
              ).toISOString(),
              radiusMeters: 20,
            },
          },
        });
      },
    );
    await page.goto(
      `http://localhost:4320/shipment-orders/shipment-1?role=${role}`,
    );
    const form = page.locator("details").filter({
      has: page.locator("summary", { hasText: "Generate HQ handoff code" }),
    });
    await form.locator("summary").click();
    const generate = form.getByRole("button", {
      name: "Generate HQ handoff code",
      exact: true,
    });
    await generate.click();
    await expect(form.getByRole("alert")).toContainText("Response timed out");
    await generate.click();
    await expect(
      form.getByLabel("HQ handoff code: 024591", { exact: true }),
    ).toBeVisible();
    expect(writes[0]).toEqual(writes[1]);
    expect(writes[0].body).toEqual({ expectedVersion: 3 });
    expect(writes[0].key).toBeTruthy();
    await page.clock.fastForward(601000);
    await expect(form.getByText(/Handoff code expired/)).toBeVisible();
    await expect(
      form.getByLabel("HQ handoff code: 024591", { exact: true }),
    ).toHaveCount(0);
    await form
      .getByRole("button", { name: "Generate replacement code" })
      .click();
    await generate.click();
    await expect(
      form.getByLabel("HQ handoff code: 824591", { exact: true }),
    ).toBeVisible();
    expect(writes[2].key).not.toBe(writes[1].key);
    expect(writes[2].body).toEqual({ expectedVersion: 3 });
  });
}
for (const shipmentType of ["local", "express"]) {
  test(`${shipmentType} onward delivery uses admin alias and refreshes detail and timeline`, async ({
    page,
  }) => {
    await mount(page);
    let current = {
      ...shipment,
      shipmentType,
      version: 4,
      allowedAdminActions: ["dispatch"],
    };
    let reads = 0,
      timeline = 0;
    const writes: any[] = [];
    await page.route("**/api/proxy/v1/shipments/shipment-1", (route) => {
      reads++;
      return route.fulfill({ json: { data: current } });
    });
    await page.route(
      "**/api/proxy/v1/admin/shipments/shipment-1/timeline?*",
      (route) => {
        timeline++;
        return route.fulfill({ json: { data: { items: [], hasMore: false } } });
      },
    );
    await page.route(
      "**/api/proxy/v1/admin/shipments/shipment-1/transitions",
      (route) => {
        const body = route.request().postDataJSON();
        writes.push(body);
        current = {
          ...current,
          version: current.version + 1,
          status: body.targetStatus,
          allowedAdminActions:
            body.targetStatus === "onrouteToDestination"
              ? ["complete_delivery"]
              : [],
        };
        return route.fulfill({ json: { data: current } });
      },
    );
    await page.goto("http://localhost:4320/shipment-orders/shipment-1");
    for (const name of [
      "Out for final delivery",
      "Delivered to final destination",
    ]) {
      const form = page
        .locator("details")
        .filter({ has: page.locator("summary", { hasText: name }) });
      await form.locator("summary").click();
      await form.getByRole("button", { name, exact: true }).click();
    }
    await expect.poll(() => timeline).toBeGreaterThanOrEqual(3);
    expect(reads).toBeGreaterThanOrEqual(3);
    expect(writes).toEqual([
      { expectedVersion: 4, targetStatus: "onrouteToDestination" },
      { expectedVersion: 5, targetStatus: "deliveredToDestination" },
    ]);
  });
}
test("rider earnings and blockers remain separate from customer payment", async ({
  page,
}) => {
  await mount(page);
  await page.route("**/api/proxy/v1/shipments/shipment-1", (route) =>
    route.fulfill({
      json: {
        data: {
          ...shipment,
          allowedAdminActions: [],
          onwardDeliveryBlockers: [
            "customer_payment_required",
            "assessment_payment_required",
          ],
        },
      },
    }),
  );
  await page.goto("http://localhost:4320/shipment-orders/shipment-1");
  await expect(
    page.getByText(
      "Customer payment must be completed before onward delivery.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("An outstanding shipment assessment must be paid."),
  ).toBeVisible();
  const rider = page.getByRole("region", {
    name: "Rider pickup earnings and payment",
  });
  await expect(rider).toContainText("₦1,400.00");
  await expect(rider).toContainText("HQ cash");
  await expect(rider).toContainText("Awaiting receipt");
  await expect(
    page.getByRole("region", { name: "Payment information", exact: true }),
  ).toContainText("Unpaid");
  await expect(
    page.getByText("Generate HQ handoff code", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /confirm.*HQ.*payment/i }),
  ).toHaveCount(0);
});
test("shipment table shows earnings, wallet payment and unavailable values", async ({
  page,
}) => {
  await mount(page);
  await page.route("**/api/proxy/v1/shipments?*", (route) =>
    route.fulfill({
      json: {
        data: {
          items: [
            {
              ...shipment,
              riderPayment: {
                ...shipment.riderPayment,
                method: "wallet",
                status: "paid",
                confirmedAt: "2026-11-08T12:00:00Z",
              },
            },
            {
              ...shipment,
              id: "missing",
              riderAmountMinor: null,
              riderPayment: null,
              riderTaskStatus: null,
            },
          ],
          hasMore: false,
        },
      },
    }),
  );
  await page.goto("http://localhost:4320/shipment-orders");
  const row = page.getByRole("row").filter({ hasText: "shipment-1" });
  await expect(row).toContainText("₦1,400.00");
  await expect(row).toContainText("Wallet");
  await expect(row).toContainText("Paid");
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "missing" })
      .getByText("Unavailable", { exact: true }),
  ).toHaveCount(5);
});
test("imported read-only shipment uses a fresh string source version and only returned statuses", async ({
  page,
}) => {
  await mount(page);
  let sourceVersion = "9007199254740993999";
  const writes: any[] = [];
  await page.route("**/api/proxy/v1/shipments/shipment-1", (route) =>
    route.fulfill({
      json: {
        data: {
          ...shipment,
          version: 1,
          readOnly: true,
          nativeWriteEligible: false,
          historicalStatusEditable: true,
          sourceVersion,
          allowedAdminActions: ["historical_status"],
          allowedHistoricalStatuses: ["deliveredToDestination", "cancelled"],
        },
      },
    }),
  );
  await page.route(
    "**/api/proxy/v1/admin/shipments/shipment-1/historical-status",
    (route) => {
      writes.push(route.request().postDataJSON());
      return route.fulfill({ json: { data: { id: "shipment-1" } } });
    },
  );
  await page.goto(
    "http://localhost:4320/shipment-orders/shipment-1?role=super",
  );
  const form = page.locator("details").filter({
    has: page.locator("summary", { hasText: "Change historical status" }),
  });
  await form.locator("summary").click();
  await expect(
    form.getByLabel("Historical status", { exact: false }).locator("option"),
  ).toHaveCount(2);
  await form
    .getByLabel("Historical status", { exact: false })
    .selectOption("deliveredToDestination");
  await form
    .getByLabel("Reason for change", { exact: false })
    .fill("Office confirmed delivery to the final destination");
  sourceVersion = "9007199254740994001";
  await form
    .getByRole("button", { name: "Change historical status", exact: true })
    .click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({
    expectedVersion: 1,
    expectedSourceVersion: sourceVersion,
    targetStatus: "deliveredToDestination",
    reason: "Office confirmed delivery to the final destination",
  });
});
test("customer-care cannot issue HQ codes", async ({ page }) => {
  await mount(page);
  await page.route("**/api/proxy/v1/shipments/shipment-1", (route) =>
    route.fulfill({ json: { data: shipment } }),
  );
  await page.goto(
    "http://localhost:4320/shipment-orders/shipment-1?role=customercare",
  );
  await expect(
    page.getByRole("heading", { name: "Shipment details", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Generate HQ handoff code", { exact: true }),
  ).toHaveCount(0);
});
