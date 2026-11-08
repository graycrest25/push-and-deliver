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
        body: '<html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/__component.js"></script></body></html>',
      });
    if (url.pathname === "/__component.js")
      return route.fulfill({
        contentType: "text/javascript; charset=utf-8",
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

test("assessment prefills shipment amount and weight and submits edited naira as kobo", async ({
  page,
}) => {
  await mount(page);
  await page.route("**/api/proxy/v1/shipments/shipment-1", (route) =>
    route.fulfill({
      json: {
        data: {
          ...shipment,
          weightKg: 3,
          pricing: { totalAmountMinor: 1556768, currency: "NGN" },
          allowedAdminActions: ["assessment"],
        },
      },
    }),
  );
  const writes: any[] = [];
  await page.route(
    "**/api/proxy/v1/admin/shipments/shipment-1/assessment",
    (route) => {
      writes.push(route.request().postDataJSON());
      return route.fulfill({
        json: { data: { id: "shipment-1", version: 4 } },
      });
    },
  );
  await page.goto(
    "http://localhost:4320/shipment-orders/shipment-1?role=super",
  );
  const form = page.locator("details").filter({
    has: page.locator("summary", { hasText: "Assess shipment charge" }),
  });
  await form.locator("summary").click();
  const charge = form.getByLabel("Charge (₦)", { exact: false });
  await expect(charge).toHaveValue("15567.68");
  await expect(
    form.getByLabel("Corrected weight (kg)", { exact: false }),
  ).toHaveValue("3");
  await charge.fill("16000.29");
  await form.getByLabel("Corrected weight (kg)", { exact: false }).fill("3.5");
  await form
    .getByLabel("Reason for change", { exact: false })
    .fill("Updated charge after weighing parcel at HQ");
  await form
    .getByRole("button", { name: "Assess shipment charge", exact: true })
    .click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({
    expectedVersion: 3,
    reason: "Updated charge after weighing parcel at HQ",
    amountMinor: 1600029,
    currency: "NGN",
    assessmentType: "initial",
    newWeightKg: 3.5,
  });
});

test("shipment detail displays numeric pickupOtp from the API without separators", async ({
  page,
}) => {
  await mount(page);
  await page.route("**/api/proxy/v1/shipments/shipment-1", (route) =>
    route.fulfill({ json: { data: { ...shipment, pickupOtp: 5084 } } }),
  );
  await page.goto("http://localhost:4320/shipment-orders/shipment-1");
  const order = page.getByRole("region", {
    name: "Order information",
    exact: true,
  });
  await expect(order.getByText("5084", { exact: true })).toBeVisible();
  await expect(order.getByText("5,084", { exact: true })).toHaveCount(0);
});

test("new assessment keeps its returned checkout and uses gross naira price before discount", async ({
  page,
}) => {
  await mount(page);
  const bill = {
    id: "bill-1",
    status: "due",
    amountMinor: 90000,
    currency: "NGN",
    checkoutStatus: "ready",
    authorizationUrl: "https://checkout.paystack.com/example",
  };
  let assessed = false;
  const writes: any[] = [];
  await page.route("**/api/proxy/v1/shipments/shipment-1", (route) =>
    route.fulfill({
      json: {
        data: {
          ...shipment,
          version: assessed ? 5 : 4,
          pricing: {
            grossAmountMinor: 100000,
            totalAmountMinor: 90000,
            currency: "NGN",
          },
          allowedAdminActions: assessed
            ? ["request_payment_link"]
            : ["assessment"],
          assessments: assessed ? [bill] : [],
        },
      },
    }),
  );
  await page.route(
    "**/api/proxy/v1/admin/shipments/shipment-1/assessment",
    (route) => {
      writes.push(route.request().postDataJSON());
      assessed = true;
      return route.fulfill({
        json: {
          data: {
            ...bill,
            id: "shipment-1",
            assessmentId: "bill-1",
            totalAmountMinor: 90000,
            version: 5,
            paymentStatus: "unpaid",
          },
        },
      });
    },
  );
  await page.goto(
    "http://localhost:4320/shipment-orders/shipment-1?role=super",
  );
  const form = page.locator("details").filter({
    has: page.locator("summary", { hasText: "Assess shipment charge" }),
  });
  await form.locator("summary").click();
  await expect(form.getByLabel("Charge (₦)", { exact: false })).toHaveValue(
    "1000",
  );
  await form
    .getByLabel("Reason for change", { exact: false })
    .fill("Final charge after office weighing");
  await form
    .getByRole("button", { name: "Assess shipment charge", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Open payment link" }),
  ).toHaveAttribute("href", bill.authorizationUrl);
  await expect(
    page.getByRole("button", { name: "Copy payment link" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Customer shipment assessments" }),
  ).toContainText("₦900.00");
  expect(writes[0].amountMinor).toBe(100000);
  expect(writes[0].expectedVersion).toBe(4);
  expect(writes[0]).not.toHaveProperty("email");
});

test("existing initializing assessment requests checkout without creating a charge and allows customer cash", async ({
  page,
}) => {
  await mount(page);
  let ready = false;
  const writes: any[] = [];
  await page.route("**/api/proxy/v1/shipments/shipment-1", (route) =>
    route.fulfill({
      json: {
        data: {
          ...shipment,
          version: 5,
          allowedAdminActions: ["request_payment_link", "record_cash_receipt"],
          assessments: [
            {
              id: "bill-1",
              status: "due",
              amountMinor: 1556768,
              paymentState: "initializing",
              checkoutStatus: ready ? "ready" : "pending",
              authorizationUrl: ready
                ? "https://checkout.paystack.com/existing"
                : null,
            },
          ],
        },
      },
    }),
  );
  await page.route(
    "**/api/proxy/v1/admin/shipments/shipment-1/assessment/checkout",
    (route) => {
      writes.push(route.request().postDataJSON());
      ready = true;
      return route.fulfill({
        json: {
          data: {
            id: "shipment-1",
            assessmentId: "bill-1",
            checkoutStatus: "ready",
            authorizationUrl: "https://checkout.paystack.com/existing",
          },
        },
      });
    },
  );
  await page.goto(
    "http://localhost:4320/shipment-orders/shipment-1?role=super",
  );
  await expect(
    page.locator("summary", { hasText: "Record cash receipt" }),
  ).toBeVisible();
  await expect(
    page.getByText("Preparing payment link", { exact: true }),
  ).toBeVisible();
  const form = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "Get payment link" }) });
  await form.locator("summary").click();
  await form.getByRole("button", { name: /Get payment link/ }).click();
  await expect(
    page.getByRole("link", { name: "Open payment link" }),
  ).toHaveAttribute("href", "https://checkout.paystack.com/existing");
  expect(writes).toEqual([{ expectedVersion: 5, assessmentId: "bill-1" }]);
  await expect(
    page.locator("summary", { hasText: "Assess shipment charge" }),
  ).toHaveCount(0);
});

test("202 assessment remains pending after refresh without offering another assessment", async ({
  page,
}) => {
  await mount(page);
  await page.route("**/api/proxy/v1/shipments/shipment-1", (route) =>
    route.fulfill({
      json: {
        data: {
          ...shipment,
          allowedAdminActions: ["assessment"],
          assessments: [],
        },
      },
    }),
  );
  let writes = 0;
  await page.route(
    "**/api/proxy/v1/admin/shipments/shipment-1/assessment",
    (route) => {
      writes++;
      return route.fulfill({
        status: 202,
        json: {
          data: {
            id: "shipment-1",
            operationId: "pending-op",
            checkoutStatus: "pending",
          },
        },
      });
    },
  );
  await page.goto(
    "http://localhost:4320/shipment-orders/shipment-1?role=super",
  );
  const form = page.locator("details").filter({
    has: page.locator("summary", { hasText: "Assess shipment charge" }),
  });
  await form.locator("summary").click();
  await form
    .getByLabel("Reason for change", { exact: false })
    .fill("Final assessed charge");
  await form
    .getByRole("button", { name: "Assess shipment charge", exact: true })
    .click();
  await expect(
    page.getByText("Preparing payment link", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("summary", { hasText: "Assess shipment charge" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Open payment link" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Refresh payment status" }).click();
  await expect(
    page.getByText("Preparing payment link", { exact: true }),
  ).toBeVisible();
  expect(writes).toBe(1);
});

test("checkout review, settlement and superseded states never offer a stale payment link", async ({
  page,
}) => {
  await mount(page);
  let checkoutStatus = "review_required",
    paymentState = "initializing";
  await page.route("**/api/proxy/v1/shipments/shipment-1", (route) =>
    route.fulfill({
      json: {
        data: {
          ...shipment,
          allowedAdminActions: [],
          assessments: [
            {
              id: "bill-1",
              status: "due",
              checkoutStatus,
              paymentState,
              authorizationUrl: "https://checkout.paystack.com/old",
            },
          ],
        },
      },
    }),
  );
  await page.goto("http://localhost:4320/shipment-orders/shipment-1");
  for (const [status, state, message] of [
    ["review_required", "initializing", "Payment link requires review."],
    [
      "settled",
      "paid",
      "Payment confirmed. Refresh shipment details while the payment update finishes.",
    ],
    ["not_required", "pending", "No payable link is needed."],
    [
      "ready",
      "superseded",
      "This checkout has been superseded. Use the current payment information.",
    ],
    [
      "ready",
      "refunded",
      "Extra payment credited to the customer’s wallet. This is not a bank or card refund.",
    ],
  ]) {
    checkoutStatus = status;
    paymentState = state;
    await page.getByRole("button", { name: "Refresh payment status" }).click();
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open payment link" }),
    ).toHaveCount(0);
  }
});

test("checkout timeout reconciles detail then retries the identical operation", async ({
  page,
}) => {
  await mount(page);
  let reads = 0;
  const writes: { body: any; key: string; reads: number }[] = [];
  await page.route("**/api/proxy/v1/shipments/shipment-1", (route) => {
    reads++;
    return route.fulfill({
      json: {
        data: {
          ...shipment,
          version: 5,
          allowedAdminActions: ["request_payment_link"],
          assessments: [{ id: "bill-1", status: "due", amountMinor: 10000 }],
        },
      },
    });
  });
  await page.route(
    "**/api/proxy/v1/admin/shipments/shipment-1/assessment/checkout",
    (route) => {
      writes.push({
        body: route.request().postDataJSON(),
        key: route.request().headers()["idempotency-key"],
        reads,
      });
      return writes.length === 1
        ? route.fulfill({
            status: 504,
            json: { error: { message: "Response timed out" } },
          })
        : route.fulfill({
            json: {
              data: {
                id: "shipment-1",
                assessmentId: "bill-1",
                checkoutStatus: "pending",
              },
            },
          });
    },
  );
  await page.goto("http://localhost:4320/shipment-orders/shipment-1");
  const form = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "Get payment link" }) });
  await form.locator("summary").click();
  await form.getByRole("button", { name: /Get payment link/ }).click();
  await expect(form.getByRole("alert")).toContainText("Response timed out");
  await form.getByRole("button", { name: /Get payment link/ }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].body).toEqual(writes[0].body);
  expect(writes[1].key).toBe(writes[0].key);
  expect(writes[1].reads).toBeGreaterThan(writes[0].reads);
});

test("rider context has no customer checkout controls", async ({ page }) => {
  await mount(page);
  await page.route("**/api/proxy/v1/shipments/shipment-1", (route) =>
    route.fulfill({
      json: {
        data: {
          ...shipment,
          allowedAdminActions: ["request_payment_link"],
          assessments: [
            {
              id: "bill-1",
              status: "due",
              checkoutStatus: "ready",
              authorizationUrl: "https://checkout.paystack.com/example",
            },
          ],
        },
      },
    }),
  );
  await page.goto(
    "http://localhost:4320/shipment-orders/shipment-1?role=rider",
  );
  await expect(
    page.getByRole("heading", { name: "Shipment details", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open payment link" }),
  ).toHaveCount(0);
  await expect(
    page.locator("summary", { hasText: "Get payment link" }),
  ).toHaveCount(0);
});

test("replacement checkout uses fresh shipment version and payment ID and never restores the old URL", async ({
  page,
}) => {
  await mount(page);
  let reads = 0;
  const writes: any[] = [];
  await page.route("**/api/proxy/v1/shipments/shipment-1", (route) => {
    reads++;
    return route.fulfill({
      json: {
        data: {
          ...shipment,
          version: reads === 1 ? 5 : 6,
          allowedAdminActions: ["request_payment_link"],
          assessments: [
            {
              id: "bill-1",
              version: 2,
              status: "due",
              checkoutStatus: "ready",
              paymentId: reads === 1 ? "older-payment" : "current-payment",
              reference: "old-ref",
              authorizationUrl: "https://checkout.paystack.com/old",
            },
          ],
        },
      },
    });
  });
  await page.route(
    "**/api/proxy/v1/admin/shipments/shipment-1/assessment/checkout",
    (route) => {
      writes.push({
        body: route.request().postDataJSON(),
        key: route.request().headers()["idempotency-key"],
      });
      if (writes.length === 1)
        return route.fulfill({
          status: 503,
          json: { error: { message: "Temporarily unavailable" } },
        });
      return route.fulfill({
        json: {
          data: {
            id: "shipment-1",
            assessmentId: "bill-1",
            operationId: "replacement-op",
            checkoutStatus: "ready",
            paymentId: "new-payment",
            reference: "new-ref",
            authorizationUrl: "https://checkout.paystack.com/new",
          },
        },
      });
    },
  );
  await page.goto("http://localhost:4320/shipment-orders/shipment-1");
  const form = page.locator("details").filter({
    has: page.locator("summary", { hasText: "Generate new payment link" }),
  });
  await form.locator("summary").click();
  const submit = form.getByRole("button", {
    name: /Generate new payment link/,
  });
  await submit.click();
  await expect(form.getByRole("alert")).toContainText(
    "Temporarily unavailable",
  );
  await submit.click();
  await expect(
    page.getByRole("link", { name: "Open payment link" }),
  ).toHaveAttribute("href", "https://checkout.paystack.com/new");
  await expect(
    page.getByText("Payment ID: new-payment", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Payment reference: new-ref", { exact: true }),
  ).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(writes[0].body).toEqual({
    expectedVersion: 6,
    assessmentId: "bill-1",
    replacePaymentId: "current-payment",
  });
  expect(writes[0].key).toBeTruthy();
  expect(writes[1]).toEqual(writes[0]);
});

test("non-abandoned checkout returns clear replacement guidance and requires refreshed review", async ({
  page,
}) => {
  await mount(page);
  let reads = 0;
  await page.route("**/api/proxy/v1/shipments/shipment-1", (route) => {
    reads++;
    return route.fulfill({
      json: {
        data: {
          ...shipment,
          allowedAdminActions: ["request_payment_link"],
          assessments: [
            { id: "bill-1", status: "due", paymentId: "payment-1" },
          ],
        },
      },
    });
  });
  await page.route(
    "**/api/proxy/v1/admin/shipments/shipment-1/assessment/checkout",
    (route) =>
      route.fulfill({
        status: 409,
        json: {
          error: { code: "checkout_not_abandoned", message: "Not abandoned" },
        },
      }),
  );
  await page.goto("http://localhost:4320/shipment-orders/shipment-1");
  const form = page.locator("details").filter({
    has: page.locator("summary", { hasText: "Generate new payment link" }),
  });
  await form.locator("summary").click();
  const submit = form.getByRole("button", {
    name: /Generate new payment link/,
  });
  await submit.click();
  await expect(form.getByRole("alert")).toContainText(
    "This checkout cannot be replaced yet. Refresh its payment status before retrying.",
  );
  await expect(submit).toBeDisabled();
  expect(reads).toBeGreaterThanOrEqual(3);
});

test("pending replacement refreshes to ready without marking the customer paid", async ({
  page,
}) => {
  await mount(page);
  await page.clock.install();
  let reads = 0;
  await page.route("**/api/proxy/v1/shipments/shipment-1", (route) => {
    reads++;
    return route.fulfill({
      json: {
        data: {
          ...shipment,
          allowedAdminActions: ["request_payment_link"],
          assessments: [
            {
              id: "bill-1",
              status: "due",
              checkoutStatus: reads === 1 ? "pending" : "ready",
              paymentId: "new-payment",
              reference: "new-ref",
              authorizationUrl:
                reads === 1 ? null : "https://checkout.paystack.com/new",
            },
          ],
        },
      },
    });
  });
  await page.goto("http://localhost:4320/shipment-orders/shipment-1");
  await expect(
    page.getByText("Preparing payment link", { exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(7100);
  await expect(
    page.getByRole("link", { name: "Open payment link" }),
  ).toHaveAttribute("href", "https://checkout.paystack.com/new");
  await expect(
    page.getByRole("region", { name: "Payment information", exact: true }),
  ).toContainText("Unpaid");
  const completedReads = reads;
  await page.clock.fastForward(21000);
  expect(reads).toBe(completedReads);
});
