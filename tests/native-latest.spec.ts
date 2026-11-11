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
  await control({ latest: true, adminType });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#workspace-content")).toBeVisible();
}
async function form(page: Page, title: string) {
  const details = page
    .locator("details")
    .filter({ has: page.locator("summary").filter({ hasText: title }) })
    .last();
  if (!(await details.evaluate((element: HTMLDetailsElement) => element.open)))
    await details.locator("summary").click();
  return details;
}
async function writes(path: string) {
  return (await control()).records.filter(
    (row: any) => row.path === path && row.method !== "GET",
  );
}
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aA5sAAAAASUVORK5CYII=",
  "base64",
);
const shipment = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  shipmentType: "local",
  status: "placed",
  version: 3,
  customerId: "customer-1",
  assignedRider: null,
  createdAt: "2026-01-01T00:00:00Z",
  assessmentStatus: "not_required",
  payment: { status: "paid", method: "wallet" },
  pricing: { totalAmountMinor: 150000, currency: "NGN" },
  assets: {},
  nativeWriteEligible: true,
  pendingCommands: { assignment: false, assessment: false },
  allowedAdminActions: [],
  ...overrides,
});
test.beforeEach(() => control({ reset: true }));
test("tariff and fee amounts display naira, including decimal and string minor amounts", async ({
  page,
}) => {
  await login(page);
  await control({
    latestTariff: {
      id: "active-local",
      version: 1,
      status: "active",
      localType: "premium",
      zone: "los",
      volumetricDivisor: 0,
      rates: [
        { weightKg: 0.5, amountMinor: 845835 },
        { weightKg: 1, amountMinor: "855739" },
        { weightKg: 1.5, amountMinor: 0 },
        { weightKg: 2, amountMinor: 1 },
        { weightKg: 2.5, amountMinor: null },
      ],
    },
  });
  await page.goto("/delivery-zones/tariffs/active-local");
  const prices = page.getByRole("tabpanel", { name: "Prices", exact: true });
  await expect(
    prices.getByRole("columnheader", { name: "Amount (₦)", exact: true }),
  ).toBeVisible();
  for (const amount of ["₦8,458.35", "₦8,557.39", "₦0.00", "₦0.01", "—"])
    await expect(
      prices.getByRole("cell", { name: amount, exact: true }),
    ).toBeVisible();
  await expect(prices).not.toContainText("kobo");
  await page.goto("/fees/fee-1");
  const current = page.locator("#workspace-content");
  await expect(current).toContainText("₦1,500.00");
  await expect(current).toContainText("₦250.00");
  await expect(current).not.toContainText("Kobo");
});
test("local shipping types show their fields and tariff tabs use 100-row lists", async ({
  page,
}) => {
  await login(page);
  await page.goto("/delivery-zones");
  await expect(
    page.getByRole("tabpanel").getByLabel("Rows per page"),
  ).toHaveValue("100");
  await page
    .getByRole("tab", { name: "Local shipping types", exact: true })
    .click();
  const panel = page.getByRole("tabpanel");
  const table = panel.getByRole("table");
  await expect(
    table.getByRole("columnheader", { name: "Details", exact: true }),
  ).toBeVisible();
  const row = table
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "premium", exact: true }) });
  await expect(row).toContainText("Premium");
  await expect(row).toContainText("Old estimate");
  await expect(panel.getByLabel("Rows per page")).toHaveValue("100");
  await page.getByRole("tab", { name: "States & zones", exact: true }).click();
  await expect(
    page.getByRole("tabpanel").getByLabel("Rows per page"),
  ).toHaveValue("100");
  for (const path of [
    "/v1/admin/shipping/local-types",
    "/v1/admin/geography/tariffs",
    "/v1/admin/geography/states",
  ])
    await expect
      .poll(
        async () =>
          (await control()).records.find((record: any) => record.path === path)
            ?.query.limit,
      )
      .toBe("100");
});

test("rides filter by origin city while preserving status and clearing city", async ({
  page,
}) => {
  await login(page);
  await page.goto("/ride-hailing");
  await expect(
    page.getByRole("columnheader", { name: /^Origin city$/i }),
  ).toBeVisible();
  const city = page.getByLabel("Origin city", { exact: true });
  await expect(city.locator("option")).toHaveText([
    "All",
    "Lagos",
    "Ibadan",
    "Unknown",
  ]);
  await page.getByLabel("Status", { exact: true }).selectOption("accepted");
  for (const value of ["lagos", "ibadan", "unknown", ""]) {
    await city.selectOption(value);
    const response = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === "/api/proxy/v1/admin/rides" &&
        (url.searchParams.get("city") || "") === value &&
        url.searchParams.get("status") === "accepted"
      );
    });
    await page.getByRole("button", { name: /Apply filters/ }).click();
    expect((await response).status()).toBe(200);
    const label = value ? value[0].toUpperCase() + value.slice(1) : "Lagos";
    await expect(
      page.getByRole("cell", { name: label, exact: true }),
    ).toBeVisible();
  }
});

test("latest profiles show target finances and submit only changed fields", async ({
  page,
}) => {
  await login(page);
  await page.goto("/riders/rider-1");
  await expect(page.locator("#wallet")).toContainText("₦1,250.00");
  await expect(
    page.locator("#transactions").getByRole("link", { name: "shipment-1" }),
  ).toHaveAttribute("href", "/shipment-orders/shipment-1");
  await expect(page.getByText("******1234", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Edit rider information", exact: true })
    .click();
  const edit = await form(page, "Save personal information");
  await edit
    .getByLabel("Phone number", { exact: false })
    .first()
    .fill("+2348000000099");
  await edit.getByLabel("Home address", { exact: false }).fill("");
  await edit
    .getByLabel("Reason for change", { exact: false })
    .fill("Customer confirmed contact correction");
  await edit
    .getByRole("button", { name: "Save personal information", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const call = (await writes("/v1/admin/users/rider-1/profile"))[0];
  expect(call.body).toEqual({
    expectedVersion: 7,
    reason: "Customer confirmed contact correction",
    changes: { phoneNumber: "+2348000000099", homeAddress: null },
  });
  expect(call.account).toBe("user");
  expect(call.query.type).toBe("riders");
  await page
    .getByRole("button", { name: "Edit vehicle information", exact: true })
    .click();
  const vehicle = await form(page, "Save vehicle information");
  await vehicle.getByLabel("Vehicle type", { exact: false }).selectOption("1");
  await vehicle
    .getByLabel("Reason for change", { exact: false })
    .fill("Corrected vehicle type");
  await vehicle
    .getByRole("button", { name: "Save vehicle information", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    (await writes("/v1/admin/riders/rider-1/vehicle"))[0].body,
  ).toMatchObject({ expectedVersion: 17, changes: { type: 1 } });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/latest-profile-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/latest-profile-mobile.png",
    fullPage: true,
  });
});
test("latest verifier replaces rider-owned evidence before application review", async ({
  page,
}) => {
  await login(page, "verifier");
  await control({ latestVehicle: { type: 1 } });
  await page.goto("/rider-applications");
  await expect(
    page.getByLabel("Application status", { exact: true }),
  ).toHaveValue("pending");
  await page
    .getByRole("link", { name: "Open Native Rider", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Rider application", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Photo is missing or unavailable", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("summary").filter({ hasText: /^Replace / }),
  ).toHaveCount(2);
  await expect(
    page.getByRole("img", { name: "Vehicle photo", exact: true }),
  ).toBeVisible();
  const replace = await form(page, "Replace plate number");
  await replace
    .locator('input[type="file"]')
    .setInputFiles({ name: "licence.png", mimeType: "image/png", buffer: png });
  await expect(replace.getByText("File ready", { exact: true })).toBeVisible();
  await replace
    .getByLabel("Reason for change", { exact: false })
    .fill("Replace unreadable image");
  await replace
    .getByRole("button", { name: "Replace plate number", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (
          await writes(
            "/v1/admin/riders/rider-1/application/documents/plate_number",
          )
        ).length,
    )
    .toBe(1);
  const review = await form(page, "Approve rider");
  await review
    .getByLabel("Reason for change", { exact: false })
    .fill("Reviewed profile and ready evidence");
  await review
    .getByRole("button", { name: "Approve rider", exact: true })
    .click();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
  const calls = (await control()).records;
  expect(
    calls.filter((row: any) =>
      row.path.endsWith("/application/assets/delegated-asset/complete"),
    ),
  ).toHaveLength(2);
  const attachment = calls.find((row: any) =>
    row.path.endsWith("/documents/plate_number"),
  );
  expect(attachment.body.expectedVersion).toBe(17);
  expect(calls[calls.indexOf(attachment) - 1]).toMatchObject({
    method: "GET",
    path: "/v1/admin/riders/rider-1/application",
  });
  expect(
    calls.some((row: any) => row.path.startsWith("/v1/operations/")),
  ).toBeFalsy();
  expect(
    calls.filter((row: any) =>
      row.path.endsWith("/application/upload-intents"),
    )[0].body.purpose,
  ).toBe("plate_number");
  expect(
    calls
      .filter((row: any) =>
        row.path.endsWith("/application/assets/delegated-asset/complete"),
      )
      .map((row: any) => row.key)[0],
  ).not.toBe(
    calls
      .filter((row: any) =>
        row.path.endsWith("/application/assets/delegated-asset/complete"),
      )
      .map((row: any) => row.key)[1],
  );
  const media = calls.find(
    (row: any) => row.path === "/v1/media/rider-evidence/content",
  );
  expect(media.authorization).toBe("Bearer pnd_a2_private");
  expect(media.account).toBe("user");
  const complete = calls.find((row: any) =>
    row.path.endsWith("/application/assets/delegated-asset/complete"),
  );
  expect(complete.rawBody).toBe("{}");
  expect(
    calls.find(
      (row: any) => row.path === "/storage/delegated" && row.method === "PUT",
    ).authorization,
  ).toBeUndefined();
  expect(
    (await writes("/v1/admin/riders/rider-1/application/review"))[0].body
      .expectedVersion,
  ).toBe(18);
});
test("latest fee editor retains conflict drafts and resubmits a reviewed version", async ({
  page,
}) => {
  await login(page, "regular");
  await page.goto("/fees/fee-1");
  const edit = await form(page, "Save fee changes");
  await edit.getByLabel("per Km (₦)", { exact: false }).fill("300.29");
  await edit
    .getByLabel("Reason for change", { exact: false })
    .fill("Reviewed courier rate");
  await control({ latestConflict: true });
  await edit
    .getByRole("button", { name: "Save fee changes", exact: true })
    .click();
  await expect(edit.getByRole("alert")).toContainText("record changed");
  await expect(edit.getByLabel("per Km (₦)", { exact: false })).toHaveValue(
    "300.29",
  );
  await edit
    .getByRole("button", { name: "Use refreshed version and review draft" })
    .click();
  await edit
    .getByRole("button", { name: "Save fee changes", exact: true })
    .click();
  await expect
    .poll(async () => (await writes("/v1/admin/fees/fee-1")).length)
    .toBe(2);
  const calls = await writes("/v1/admin/fees/fee-1");
  expect(calls[0].body.changes).toEqual({ perKmMinor: 30029 });
  expect(calls[1].body.expectedVersion).toBe(4);
  expect(calls[1].key).not.toBe(calls[0].key);
});
test("international prices join paged countries, show kg and naira, and edit a cloned draft", async ({
  page,
}) => {
  await login(page, "regular");
  const id = "dhl-2026-11-06-non-document";
  await control({
    latestTariff: {
      id,
      name: "DHL international · Non-document",
      status: "active",
      version: 7,
      carrier: "dhl",
      cargo: "non_document",
      direction: "export",
      volumetricDivisor: 5000,
      countries: [
        { code: "GB", zone: 1 },
        { code: "NG", zone: 2 },
        { code: "XX", zone: 3 },
      ],
      rates: [
        { zone: 1, weightGrams: 500, amountMinor: 150000 },
        { zone: 1, weightGrams: 1000, amountMinor: 9000000 },
        { zone: 2, weightGrams: 1500, amountMinor: 2500501 },
      ],
    },
  });
  const countryQueries: URLSearchParams[] = [];
  await page.route(
    "**/api/proxy/v1/admin/shipping/countries?*",
    async (route) => {
      const query = new URL(route.request().url()).searchParams;
      countryQueries.push(query);
      await route.fulfill({
        json: {
          data: query.has("cursor")
            ? {
                items: [{ code: "NG", name: "Nigeria", active: false }],
                nextCursor: null,
              }
            : {
                items: [{ code: "GB", name: "United Kingdom", active: true }],
                nextCursor: "country-next",
              },
        },
      });
    },
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/export-rates/tariffs/${id}`);
  const destination = page.getByLabel("Destination country");
  await expect(destination.locator('option[value="NG"]')).toContainText(
    "Nigeria (NG) · Disabled",
  );
  expect(
    countryQueries.every(
      (query) =>
        query.get("limit") === "100" && query.get("includeInactive") === "true",
    ),
  ).toBe(true);
  expect(
    countryQueries.some((query) => query.get("cursor") === "country-next"),
  ).toBe(true);
  const prices = page.getByRole("table", {
    name: "International tariff prices",
  });
  await destination.selectOption("GB");
  await expect(prices.getByRole("row")).toHaveCount(3);
  await expect(
    prices.getByRole("cell", { name: "0.5", exact: true }),
  ).toBeVisible();
  await expect(prices.getByRole("cell", { name: /₦1,500\.00/ })).toBeVisible();
  await expect(
    prices.getByRole("button", { name: "Edit price", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Find a country").fill("Nigeria");
  await destination.selectOption("NG");
  await expect(prices.getByRole("row")).toHaveCount(2);
  await expect(prices.getByRole("cell", { name: /₦25,005\.01/ })).toBeVisible();
  await expect(
    page.getByText("This country is disabled.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Find a country").clear();
  await destination.selectOption("XX");
  await expect(
    page.getByText("Availability unknown", { exact: true }),
  ).toBeVisible();
  await expect(
    prices.getByText("No prices for this selection.", { exact: false }),
  ).toBeVisible();
  await destination.selectOption("GB");
  await expect(prices.getByRole("row")).toHaveCount(3);
  await page.screenshot({
    path: "test-results/international-prices-desktop.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Edit & publish", exact: true }).click();
  const clone = await form(page, "Clone as a new draft");
  await clone
    .getByLabel("Reason for change")
    .fill("Review international destination prices");
  await clone
    .getByRole("button", { name: "Clone as a new draft", exact: true })
    .click();
  await expect(page).toHaveURL(/cloned-draft\?tab=workflow$/);
  await expect(page.getByText("Draft", { exact: true }).first()).toBeVisible();
  await page.getByRole("tab", { name: "Prices", exact: true }).click();
  await page.getByLabel("Destination country").selectOption("GB");
  const row = page
    .getByRole("table", { name: "International tariff prices" })
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "0.5", exact: true }) });
  const attemptedUpdates: { body: unknown; key: string | undefined }[] = [];
  await page.route(
    "**/api/proxy/v1/admin/shipping/tariffs/cloned-draft/rates",
    (route) => {
      attemptedUpdates.push({
        body: route.request().postDataJSON(),
        key: route.request().headers()["idempotency-key"],
      });
      return attemptedUpdates.length === 1
        ? route.fulfill({
            status: 503,
            json: {
              error: { message: "Price update response was interrupted." },
            },
          })
        : route.continue();
    },
  );
  await row.getByRole("button", { name: "Edit price", exact: true }).click();
  const editor = page.getByRole("region", {
    name: "Edit zone 1 price at 0.5 kg",
    exact: true,
  });
  await expect(editor.getByLabel("Price (NGN)")).toBeFocused();
  await editor.getByLabel("Price (NGN)").fill("1234.56");
  await editor
    .getByLabel("Reason for change")
    .fill("Review half-kilogram price");
  await page.screenshot({
    path: "test-results/international-price-editor-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/international-price-editor-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await editor.getByRole("button", { name: "Edit price", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText("interrupted");
  await expect(
    prices.getByRole("button", { name: "Edit price", exact: true }).last(),
  ).toBeDisabled();
  await page.getByLabel("Destination country").selectOption("NG");
  await editor
    .getByRole("button", { name: "Hide editor", exact: true })
    .click();
  await expect(page.getByLabel("Destination country")).toBeFocused();
  await expect(
    prices.getByRole("button", { name: "Edit price", exact: true }).last(),
  ).toBeDisabled();
  await page.getByLabel("Destination country").selectOption("GB");
  await expect(
    prices.getByRole("button", { name: "Edit price", exact: true }).last(),
  ).toBeDisabled();
  await row.getByRole("button", { name: "Edit price", exact: true }).click();
  await expect(editor.getByLabel("Price (NGN)")).toHaveValue("1234.56");
  await expect(editor.getByLabel("Price (NGN)")).toBeDisabled();
  await editor.getByRole("button", { name: "Edit price", exact: true }).click();
  await expect(row.getByRole("cell", { name: /₦1,234\.56/ })).toBeVisible();
  await expect(
    prices.getByRole("button", { name: "Edit price", exact: true }).last(),
  ).toBeEnabled();
  expect(attemptedUpdates).toHaveLength(2);
  expect(attemptedUpdates[1]).toEqual(attemptedUpdates[0]);
  await expect(page.getByLabel("Destination country")).toHaveValue("GB");
  const updates = await writes("/v1/admin/shipping/tariffs/cloned-draft/rates");
  expect(updates[0].body).toEqual({
    expectedVersion: 1,
    reason: "Review half-kilogram price",
    rates: [{ zone: 1, weightGrams: 500, amountMinor: 123456 }],
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const priceBounds = await row
    .getByRole("cell", { name: /₦1,234\.56/ })
    .boundingBox();
  expect(priceBounds!.x + priceBounds!.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: "test-results/international-prices-mobile.png",
    fullPage: true,
  });
});

for (const domestic of [true, false]) {
  test(`${domestic ? "delivery" : "shipping"} tariff creation opens price editing and preserves create/edit API fields`, async ({
    page,
  }) => {
    await login(page);
    const serviceReads: URL[] = [];
    let refreshedServices = false;
    if (domestic) {
      await page.route(
        "**/api/proxy/v1/admin/shipping/local-types?*",
        (route) => {
          const url = new URL(route.request().url());
          serviceReads.push(url);
          return route.fulfill({
            json: {
              data: url.searchParams.has("cursor")
                ? {
                    items: [
                      { id: "economy-id", name: "Economy", active: false },
                      ...(refreshedServices
                        ? [
                            {
                              id: "new-service",
                              name: "New service",
                              active: false,
                            },
                          ]
                        : []),
                    ],
                    nextCursor: null,
                  }
                : {
                    items: [{ id: "premium", name: "Premium", active: true }],
                    nextCursor: "more-services",
                  },
            },
          });
        },
      );
    }
    const section = domestic ? "/delivery-zones" : "/export-rates";
    const apiRoot = domestic
      ? "/v1/admin/geography/tariffs"
      : "/v1/admin/shipping/tariffs";
    await page.goto(`${section}?tab=create`);
    const title = domestic
      ? "Create local draft"
      : "Create international draft";
    const create = await form(page, title);
    if (domestic) {
      const service = create.getByLabel("Delivery service", { exact: false });
      await expect(service.locator('option[value="economy-id"]')).toHaveText(
        "Economy (inactive)",
      );
      await service.selectOption("premium");
      await create
        .getByLabel("Delivery zone", { exact: false })
        .selectOption("los");
      expect(
        new Set(serviceReads.map((url) => url.searchParams.get("cursor"))),
      ).toEqual(new Set([null, "more-services"]));
      for (const url of serviceReads) {
        expect(url.searchParams.get("limit")).toBe("100");
        expect(url.searchParams.get("includeInactive")).toBe("true");
      }
      await create
        .getByLabel("Reason for change")
        .fill("Prepare reviewed prices");
      refreshedServices = true;
      await page
        .getByRole("button", { name: "Refresh services", exact: true })
        .click();
      await expect(service.locator('option[value="new-service"]')).toHaveText(
        "New service (inactive)",
      );
      await expect(service).toHaveValue("premium");
      await expect(create.getByLabel("Delivery zone")).toHaveValue("los");
      await expect(create.getByLabel("Reason for change")).toHaveValue(
        "Prepare reviewed prices",
      );
    } else {
      await create
        .getByLabel("Tariff name", { exact: false })
        .fill("Reviewed DHL export");
      await create
        .getByLabel("Cargo", { exact: false })
        .selectOption("non_document");
    }
    await create
      .getByLabel("Reason for change", { exact: false })
      .fill("Prepare reviewed prices");
    await create.getByRole("button", { name: title, exact: true }).click();
    await expect(page).toHaveURL(`${section}/tariffs/new-draft?tab=workflow`);
    const [post] = await writes(apiRoot);
    expect(post.method).toBe("POST");
    expect(post.key).toBeTruthy();
    expect(post.body).toEqual({
      ...(domestic
        ? { localType: "premium", zone: "los" }
        : {
            name: "Reviewed DHL export",
            carrier: "dhl",
            direction: "export",
            cargo: "non_document",
          }),
      volumetricDivisor: 0,
      reason: "Prepare reviewed prices",
    });
    const prices = await form(page, "Edit prices");
    await expect(
      prices.getByLabel(domestic ? "Weight (kg)" : "Weight (grams)", {
        exact: false,
      }),
    ).toHaveCount(1);
    const details = await form(page, "Tariff details");
    if (domestic) {
      await details
        .getByLabel("Delivery service", { exact: false })
        .selectOption("economy-id");
      await details
        .getByLabel("Delivery zone", { exact: false })
        .selectOption("abv");
    } else {
      await details
        .getByLabel("Name", { exact: false })
        .fill("Updated DHL tariff");
    }
    await details
      .getByLabel("Reason for change", { exact: false })
      .fill("Update draft details");
    await details
      .getByRole("button", { name: "Save draft information", exact: true })
      .click();
    await expect
      .poll(async () => (await writes(`${apiRoot}/new-draft`)).length)
      .toBe(1);
    const [patch] = await writes(`${apiRoot}/new-draft`);
    expect(patch.method).toBe("PATCH");
    expect(patch.key).toBeTruthy();
    expect(patch.body).toEqual({
      expectedVersion: 1,
      reason: "Update draft details",
      changes: domestic
        ? { localType: "economy-id", zone: "abv" }
        : { name: "Updated DHL tariff" },
    });
  });
}

test("latest tariff drafts preserve omitted rates, delete explicit keys and publish reviewed snapshots", async ({
  page,
}) => {
  await login(page);
  await page.goto("/delivery-zones/tariffs/draft-local?tab=workflow");
  const rates = await form(page, "Edit prices");
  const weight = rates.getByLabel("Weight (kg)", { exact: false });
  await expect(weight).toHaveAttribute("min", "0.5");
  await expect(weight).toHaveAttribute("max", "70");
  await expect(weight).toHaveAttribute("step", "0.001");
  await weight.fill("1.251");
  await rates.getByLabel("Amount (₦)", { exact: false }).fill("2500");
  await rates
    .getByLabel("Reason for change", { exact: false })
    .fill("Add reviewed weight band");
  await rates.getByRole("button", { name: "Save prices", exact: true }).click();
  await page.getByRole("tab", { name: "Prices", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "1.251", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Weight (kg)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "0.5", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "70", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Edit & publish", exact: true }).click();
  const remove = await form(page, "Delete weight bands");
  await remove
    .getByRole("button", { name: "Add weight band", exact: true })
    .click();
  await remove.getByLabel("Weight (kg)", { exact: false }).fill("1.251");
  await remove
    .getByLabel("Reason for change", { exact: false })
    .fill("Remove unused draft band");
  await remove
    .getByRole("button", { name: "Delete weight bands", exact: true })
    .click();
  await page.getByRole("tab", { name: "Prices", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "1.251", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Edit & publish", exact: true }).click();
  const calls = await writes("/v1/admin/geography/tariffs/draft-local/rates");
  expect(calls).toHaveLength(2);
  expect(calls[0].method).toBe("PUT");
  expect(calls[0].body).toEqual({
    expectedVersion: 1,
    reason: "Add reviewed weight band",
    rates: [{ weightKg: 1.251, amountMinor: 250000 }],
  });
  expect(calls[0].key).toBeTruthy();
  expect(calls[1].method).toBe("DELETE");
  expect(calls[1].body).toEqual({
    expectedVersion: 2,
    reason: "Remove unused draft band",
    rates: [{ weightKg: 1.251 }],
  });
  expect(calls[1].key).toBeTruthy();
  const publish = await form(page, "Publish reviewed tariff");
  await publish
    .getByLabel("Reason for change", { exact: false })
    .fill("Approve complete rates");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/latest-tariff-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/latest-tariff-mobile.png",
    fullPage: true,
  });
  await publish
    .getByRole("button", { name: "Publish reviewed tariff", exact: true })
    .click();
  await expect(
    page.locator("summary").filter({ hasText: "Tariff details" }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Edit & publish", exact: true }).click();
  await expect(
    page.locator("summary").filter({ hasText: "Edit prices" }),
  ).toHaveCount(0);
  await expect(
    page.locator("summary").filter({ hasText: "Delete weight bands" }),
  ).toHaveCount(0);
  const clone = await form(page, "Clone as a new draft");
  await clone
    .getByLabel("Reason for change", { exact: false })
    .fill("Prepare replacement prices");
  await clone
    .getByRole("button", { name: "Clone as a new draft", exact: true })
    .click();
  await expect(page).toHaveURL(/cloned-draft\?tab=workflow$/);
});
test("domestic tariffs validate kilogram bounds, precision and duplicate bands", async ({
  page,
}) => {
  await login(page);
  await page.goto("/delivery-zones/tariffs/draft-local?tab=workflow");
  const rates = await form(page, "Edit prices");
  const add = rates.getByRole("button", {
    name: "Add weight band",
    exact: true,
  });
  const save = rates.getByRole("button", {
    name: "Save prices",
    exact: true,
  });
  const weights = rates.getByLabel("Weight (kg)", { exact: false });
  await rates.getByLabel("Amount (₦)", { exact: false }).fill("200");
  await rates
    .getByLabel("Reason for change", { exact: false })
    .fill("Review minimum and maximum bands");
  for (const invalid of ["0.499", "70.001", "1.2501"]) {
    await weights.first().fill(invalid);
    await save.click();
    expect(
      await weights
        .first()
        .evaluate((input: HTMLInputElement) => input.checkValidity()),
    ).toBe(false);
    expect(
      await writes("/v1/admin/geography/tariffs/draft-local/rates"),
    ).toHaveLength(0);
  }
  await weights.first().fill("0.5");
  await add.click();
  await weights.nth(1).fill("0.500");
  await rates.getByLabel("Amount (₦)", { exact: false }).nth(1).fill("200");
  await save.click();
  await expect(
    rates.getByText("Each weight and zone may appear only once."),
  ).toBeVisible();
  expect(
    await writes("/v1/admin/geography/tariffs/draft-local/rates"),
  ).toHaveLength(0);
  await weights.nth(1).fill("0.501");
  await add.click();
  await weights.nth(2).fill("70");
  await rates.getByLabel("Amount (₦)", { exact: false }).nth(2).fill("300");
  await save.click();
  await expect
    .poll(
      async () =>
        (await writes("/v1/admin/geography/tariffs/draft-local/rates")).length,
    )
    .toBe(1);
  const [call] = await writes("/v1/admin/geography/tariffs/draft-local/rates");
  expect(call.body).toEqual({
    expectedVersion: 1,
    reason: "Review minimum and maximum bands",
    rates: [
      { weightKg: 0.5, amountMinor: 20000 },
      { weightKg: 0.501, amountMinor: 20000 },
      { weightKg: 70, amountMinor: 30000 },
    ],
  });
  await page.getByRole("tab", { name: "Prices", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "0.501", exact: true }),
  ).toBeVisible();
});
test("latest international country batches keep deletion JSON and version scope", async ({
  page,
}) => {
  await login(page);
  await page.goto("/export-rates/tariffs/draft-export?tab=workflow");
  const add = await form(page, "Add or update country mappings");
  await add
    .getByRole("button", { name: "Add country mapping", exact: true })
    .click();
  await add.getByLabel("Country", { exact: false }).selectOption("NG");
  await add.getByLabel("Zone", { exact: false }).fill("1");
  await add
    .getByLabel("Reason for change", { exact: false })
    .fill("Map destination");
  await add
    .getByRole("button", {
      name: "Add or update country mappings",
      exact: true,
    })
    .click();
  await page.getByRole("tab", { name: "Prices", exact: true }).click();
  await expect(
    page.getByLabel("Destination country").locator('option[value="NG"]'),
  ).toHaveCount(1);
  await page.getByRole("tab", { name: "Edit & publish", exact: true }).click();
  const remove = await form(page, "Delete country mappings");
  await remove
    .getByRole("button", { name: "Add country mapping", exact: true })
    .click();
  await remove.getByLabel("Country", { exact: false }).selectOption("NG");
  await remove
    .getByLabel("Reason for change", { exact: false })
    .fill("Remove draft destination");
  await remove
    .getByRole("button", { name: "Delete country mappings", exact: true })
    .click();
  await expect(
    page.getByLabel("Destination country").locator('option[value="NG"]'),
  ).toHaveCount(0);
  expect(
    (await writes("/v1/admin/shipping/tariffs/draft-export/countries"))[1].body,
  ).toEqual({
    expectedVersion: 2,
    reason: "Remove draft destination",
    countries: [{ code: "NG" }],
  });
});
test("latest shipment actions follow metadata, record exact cash dues and complete customs distinctly", async ({
  page,
}) => {
  await login(page);
  await page.route("https://uploads.example.test/**", (route) =>
    route.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await control({
    latestShipment: shipment("customs-1", {
      shipmentType: "customs_clearance",
      allowedAdminActions: ["record_cash_receipt"],
      assessments: [{ id: "charge-1", amountMinor: 150000, status: "due" }],
      payment: { status: "unpaid", method: "cash" },
    }),
  });
  await page.goto("/shipment-orders/customs-1");
  await expect(
    page.locator("summary").filter({ hasText: "Accept at office" }),
  ).toHaveCount(0);
  const cash = await form(page, "Record cash receipt · charge-1");
  await cash
    .getByLabel("Cash receipt reference", { exact: false })
    .fill("CASH-001");
  await cash
    .getByLabel("Received at", { exact: false })
    .fill("2026-11-03T10:00");
  await cash
    .locator('input[type="file"]')
    .setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: png });
  await expect(cash.getByText("File ready", { exact: true })).toBeVisible();
  await cash
    .getByLabel("Reason for change", { exact: false })
    .fill("Cash received at office");
  await cash
    .getByRole("button", {
      name: "Record cash receipt · charge-1",
      exact: true,
    })
    .click();
  await expect
    .poll(
      async () =>
        (await writes("/v1/admin/shipments/customs-1/cash-receipts")).length,
    )
    .toBe(1);
  expect(
    (await writes("/v1/admin/shipments/customs-1/cash-receipts"))[0].body,
  ).toMatchObject({
    assessmentId: "charge-1",
    amountMinor: 150000,
    currency: "NGN",
    reference: "CASH-001",
    expectedVersion: 3,
  });
  await control({
    latestShipment: shipment("customs-1", {
      shipmentType: "customs_clearance",
      allowedAdminActions: ["complete_clearance"],
    }),
  });
  await page.reload();
  const complete = await form(page, "Complete clearance with evidence");
  await complete.locator('input[type="file"]').setInputFiles({
    name: "clearance.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(complete.getByText("File ready", { exact: true })).toBeVisible();
  await complete
    .getByLabel("Completed at", { exact: false })
    .fill("2026-11-03T10:00");
  await complete
    .getByLabel("Reason for change", { exact: false })
    .fill("Completed and evidenced");
  await complete
    .getByRole("button", {
      name: "Complete clearance with evidence",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Clearance completed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Delivered to destination", { exact: true }),
  ).toHaveCount(0);
  const calls = (await control()).records;
  expect(
    calls
      .filter((r: any) => /^\/v1\/assets\/[^/]+\/complete$/.test(r.path))
      .every((r: any) => r.rawBody === ""),
  ).toBeTruthy();
});
test("latest exports retain filters across continuation and unsupported marketplace is blocked", async ({
  page,
}) => {
  await login(page);
  await page.goto("/withdrawals?tab=export");
  await page
    .getByLabel("Export status", { exact: true })
    .selectOption("succeeded");
  let download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download withdrawal report", exact: true })
    .click();
  await download;
  download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download next withdrawal page", exact: true })
    .click();
  await download;
  await expect(
    page.getByText(/2 file\(s\) downloaded · Export complete/),
  ).toBeVisible();
  const calls = (await control()).records.filter(
    (r: any) => r.path === "/v1/admin/reports/withdrawals",
  );
  expect(calls.map((r: any) => r.query)).toEqual([
    { format: "csv", status: "succeeded", limit: "1000" },
    {
      format: "csv",
      status: "succeeded",
      limit: "1000",
      cursor: "export-next",
    },
  ]);
  const blocked = await page.request.get("/api/proxy/v1/marketplace/items");
  expect(blocked.status()).toBe(404);
  await expect(
    page.getByRole("link", { name: "Marketplace orders", exact: true }),
  ).toHaveCount(0);
});
test("latest customer care cannot reach pricing or application writes", async ({
  page,
}) => {
  await login(page, "customercare");
  for (const route of ["/fees/fee-1", "/rider-applications/rider-1"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/support-tickets/);
  }
  await page.goto("/withdrawals");
  await expect(
    page.getByRole("button", {
      name: "Download withdrawal report",
      exact: true,
    }),
  ).toHaveCount(0);
  const response = await page.evaluate(async () => {
    const r = await fetch("/api/proxy/v1/admin/shipments/test/assignment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "guard-new-command",
      },
      body: JSON.stringify({
        expectedVersion: 1,
        riderId: "rider-1",
        reason: "Test",
      }),
    });
    return r.status;
  });
  expect(response).toBe(403);
});

test("latest ride and account tables retain readable ID columns and compact rows", async ({
  page,
}) => {
  await login(page);
  const rideId = "0asRZHV3touC76pqc-" + "a".repeat(48),
    customerId = "SodiwREk2rcCaXacZAc6e4H8oUP2";
  await page.route("**/api/proxy/v1/admin/rides?*", (route) =>
    route.fulfill({
      json: {
        data: {
          items: [
            {
              id: rideId,
              service: "courier",
              rideType: "courier",
              status: "expired",
              customerId,
              vehicleType: "bike",
              createdAt: "2026-03-08T00:39:00Z",
              readOnly: true,
              dataQuality: "incomplete",
              unavailableFields: ["detail"],
            },
          ],
          nextCursor: null,
          hasMore: false,
        },
        requestId: "long-ids",
      },
    }),
  );
  await page.goto("/ride-hailing");
  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name: rideId, exact: true }) });
  await expect(row).toBeVisible();
  const dimensions = await row.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    idWidth: element.querySelector("td")!.getBoundingClientRect().width,
  }));
  expect(dimensions.idWidth).toBeGreaterThanOrEqual(220);
  expect(dimensions.height).toBeLessThan(150);
  await expect(
    page.getByRole("link", { name: rideId, exact: true }),
  ).toHaveAttribute("href", `/ride-hailing/${rideId}`);
  await page.screenshot({
    path: "test-results/latest-rides-table-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  const table = page.locator('[data-slot="table-container"]').first();
  expect(
    await table.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/latest-rides-table-mobile.png",
    fullPage: true,
  });
  await page.goto("/users");
  await expect(
    page.getByRole("cell", { name: "Native User", exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator("tbody tr")
      .first()
      .evaluate((row) => row.getBoundingClientRect().height),
  ).toBeLessThan(150);
});
test("latest shipment assignment selects a native rider and local dispatch uses its own command", async ({
  page,
}) => {
  await login(page);
  await control({
    latestShipment: shipment("local-1", {
      allowedAdminActions: ["assign_rider"],
    }),
  });
  await page.goto("/shipment-orders/local-1");
  const assign = await form(page, "Assign rider");
  await assign
    .getByLabel("Selected rider", { exact: false })
    .selectOption("rider-1");
  await assign
    .getByLabel("Reason for change", { exact: false })
    .fill("Assign eligible rider");
  await assign
    .getByRole("button", { name: "Assign rider", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await writes("/v1/admin/shipments/local-1/assignment")).length,
    )
    .toBe(1);
  expect(
    (await writes("/v1/admin/shipments/local-1/assignment"))[0].body,
  ).toEqual({
    expectedVersion: 3,
    reason: "Assign eligible rider",
    riderId: "rider-1",
  });
  await control({
    latestShipment: shipment("local-1", {
      version: 4,
      status: "onRouteToPndHQ",
      assignedRider: { id: "rider-1", name: "Chosen rider" },
      allowedAdminActions: ["dispatch_local_direct"],
    }),
  });
  await page.reload();
  const direct = await form(page, "Dispatch direct local delivery");
  await direct
    .getByLabel("Reason for change", { exact: false })
    .fill("Direct delivery after verified pickup");
  await direct
    .getByRole("button", {
      name: "Dispatch direct local delivery",
      exact: true,
    })
    .click();
  await expect
    .poll(
      async () =>
        (await writes("/v1/admin/shipments/local-1/local-dispatch")).length,
    )
    .toBe(1);
  expect(
    (await writes("/v1/admin/shipments/local-1/local-dispatch"))[0].body
      .expectedVersion,
  ).toBe(4);
});
test("latest office state and country editors submit resource versions and exact pricing units", async ({
  page,
}) => {
  await login(page, "regular");
  await page.goto("/head-offices/office-1");
  const office = await form(page, "Update pickup prices");
  await office.getByLabel("Base pickup (₦)", { exact: false }).fill("1250");
  await office
    .getByLabel("Reason for change", { exact: false })
    .fill("Review pickup pricing");
  await office
    .getByRole("button", { name: "Update pickup prices", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await writes("/v1/admin/shipping/offices/office-1/pricing")).length,
    )
    .toBe(1);
  expect(
    (await writes("/v1/admin/shipping/offices/office-1/pricing"))[0].body,
  ).toEqual({
    expectedVersion: 2,
    basePickupMinor: 125000,
    perKmMinor: 25000,
    currency: "NGN",
    reason: "Review pickup pricing",
  });
  await page.goto("/delivery-zones/states/lagos");
  const mapping = await form(page, "Save state zone");
  await mapping.getByLabel("Local zone", { exact: false }).selectOption("abv");
  await mapping
    .getByLabel("Reason for change", { exact: false })
    .fill("Reviewed zone coverage");
  await mapping
    .getByRole("button", { name: "Save state zone", exact: true })
    .click();
  await expect
    .poll(async () => (await writes("/v1/admin/geography/states/lagos")).length)
    .toBe(1);
  expect(
    (await writes("/v1/admin/geography/states/lagos"))[0].body,
  ).toMatchObject({ expectedVersion: 2, localZone: "abv" });
  await page.goto("/export-rates/countries/GB");
  const country = await form(page, "Save country policy");
  await country.getByLabel("Postal code required", { exact: false }).uncheck();
  await country
    .getByLabel("Reason for change", { exact: false })
    .fill("Reviewed postal policy");
  await country
    .getByRole("button", { name: "Save country policy", exact: true })
    .click();
  await expect
    .poll(async () => (await writes("/v1/admin/shipping/countries/GB")).length)
    .toBe(1);
  expect(
    (await writes("/v1/admin/shipping/countries/GB"))[0].body,
  ).toMatchObject({
    expectedVersion: 2,
    postalCodeRequired: false,
    active: true,
  });
});
