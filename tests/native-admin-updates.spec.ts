import { test, expect, type Page } from "@playwright/test";
async function control(body: Record<string, unknown> = {}) {
  const response = await fetch("http://127.0.0.1:4319/control", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return (await response.json()).data;
}
async function login(page: Page, adminType = "regular") {
  await control({ latest: true, adminType });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#workspace-content")).toBeVisible({
    timeout: 15000,
  });
}
async function openAction(container: Page | any, title: string) {
  const details = container.locator("details").filter({ hasText: title });
  await details.locator("summary").click();
  return details;
}
const directoryResponse = (
  page: Page,
  q: string | null,
  type = "users",
  cursor: string | null = null,
) =>
  page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === "/api/proxy/v1/admin/users" &&
      url.searchParams.get("q") === q &&
      url.searchParams.get("type") === type &&
      url.searchParams.get("cursor") === cursor
    );
  });
test.beforeEach(() => control({ reset: true }));
test("directory name search debounces, encodes names, resets cursors and clears across account types", async ({
  page,
}) => {
  test.setTimeout(90000);
  await login(page);
  await page.goto("/users");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 · 1 records on this page")).toBeVisible();
  const search = page.getByLabel("Search name, email or phone");
  const response = directoryResponse(page, "David & Ana");
  await search.fill("D");
  await search.fill("Da");
  await search.fill("  David & Ana  ");
  const result = await response;
  expect(result.status()).toBe(200);
  expect(result.url()).toContain("q=David+%26+Ana");
  await expect(
    page.getByRole("cell", { name: "David & Ana Newest", exact: true }),
  ).toBeVisible();
  expect(
    (await control()).records.filter(
      (r: any) =>
        r.path === "/v1/admin/users" && ["D", "Da"].includes(r.query.q),
    ),
  ).toHaveLength(0);
  const next = directoryResponse(page, "David & Ana", "users", "name-next");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await next;
  await expect(
    page.getByRole("cell", { name: "David & Ana Older", exact: true }),
  ).toBeVisible();
  const cleared = directoryResponse(page, null);
  await search.clear();
  await cleared;
  await expect(page.getByText("Page 1 · 1 records on this page")).toBeVisible();
  await page.getByRole("link", { name: "Riders", exact: true }).click();
  await expect(page.getByLabel("Search name, email or phone")).toHaveValue("");
  await expect(
    page.getByRole("cell", { name: "Native Rider", exact: true }),
  ).toBeVisible();
  const rider = directoryResponse(page, "David", "riders");
  await page.getByLabel("Search name, email or phone").fill("David");
  await rider;
  await expect(
    page.getByRole("cell", { name: "David Newest", exact: true }),
  ).toBeVisible();
  const record = (await control()).records
    .filter((r: any) => r.path === "/v1/admin/users" && r.query.q === "David")
    .at(-1);
  expect(record).toMatchObject({
    account: "user",
    authorization: "Bearer pnd_a2_private",
    query: { type: "riders", limit: "100" },
  });
});
test("late directory responses never replace a newer search", async ({
  page,
}) => {
  await login(page);
  await page.goto("/users");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queries: string[] = [];
  await page.route("**/api/proxy/v1/admin/users?*", async (route) => {
    const q = new URL(route.request().url()).searchParams.get("q");
    if (!q) {
      await route.continue();
      return;
    }
    queries.push(q);
    if (q === "Old") await gate;
    await route
      .fulfill({
        json: {
          data: {
            items: [{ id: q, uid: q, username: q }],
            nextCursor: null,
            hasMore: false,
          },
        },
      })
      .catch(() => {});
  });
  await page.getByLabel("Search name, email or phone").fill("Old");
  await expect.poll(() => queries.includes("Old")).toBe(true);
  await page.getByLabel("Search name, email or phone").fill("New");
  await expect(
    page.getByRole("cell", { name: "New", exact: true }),
  ).toBeVisible();
  release();
  await expect(
    page.getByRole("cell", { name: "Old", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("cell", { name: "New", exact: true }),
  ).toBeVisible();
});
test("broadcasts validate byte limits, prevent pending duplicates and retry with the same key", async ({
  page,
}) => {
  await login(page);
  await page.goto("/general-notifications");
  const form = await openAction(page, "Queue broadcast");
  expect(
    await form
      .getByLabel("Audience")
      .locator("option")
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value),
      ),
  ).toEqual(["", "rider", "customer", "all"]);
  await form.getByLabel("Audience").selectOption("customer");
  await form.getByLabel("Title").fill("😀".repeat(41));
  await form.getByLabel("Message").fill("Service is available.");
  await form
    .getByRole("button", { name: "Queue broadcast", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText("160 UTF-8 bytes");
  expect(
    (await control()).records.filter(
      (r: any) => r.path === "/v1/admin/notifications/broadcasts",
    ),
  ).toHaveLength(0);
  await form.getByLabel("Title").fill("Service update");
  await control({ broadcastFailOnce: true, broadcastDelayMs: 700 });
  await form
    .getByRole("button", { name: "Queue broadcast", exact: true })
    .click();
  await expect(
    form.getByRole("button", { name: "Submitting…" }),
  ).toBeDisabled();
  await form.locator("form").dispatchEvent("submit");
  await expect(form.getByRole("alert")).toContainText("response was lost");
  await expect(form.getByRole("alert")).toContainText("native-request-test");
  const accepted = page.waitForResponse(
    (response) =>
      response.url().endsWith("/v1/admin/notifications/broadcasts") &&
      response.status() === 202,
  );
  await form
    .getByRole("button", { name: "Queue broadcast", exact: true })
    .click();
  await accepted;
  await expect(
    form.getByText("Notification queued", { exact: true }),
  ).toBeVisible();
  await expect(form).not.toContainText("Delivered to everyone");
  const records = (await control()).records.filter(
    (r: any) => r.path === "/v1/admin/notifications/broadcasts",
  );
  expect(records).toHaveLength(2);
  expect(records[0].key).toBe(records[1].key);
  expect(records[0].body).toEqual({
    audience: "customer",
    title: "Service update",
    body: "Service is available.",
  });
  expect((await control()).engagement.operations).toBe(1);
  await page.screenshot({
    path: "test-results/notification-queued.png",
    fullPage: true,
  });
});
test("promoter links honor pending retries, copy exact returned values and update by documentId", async ({
  page,
  context,
}) => {
  await login(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://localhost:4320",
  });
  await page.goto("/promoter-links");
  const form = await openAction(page, "Create or renew promoter link");
  await form.getByLabel("Promoter name").fill("LagosPromoter01");
  await control({ promoterPendingOnce: true });
  await form
    .getByRole("button", { name: "Create or renew promoter link", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText("creation is pending");
  await expect(
    form.getByRole("button", {
      name: "Create or renew promoter link",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    form.getByRole("button", {
      name: "Create or renew promoter link",
      exact: true,
    }),
  ).toBeEnabled();
  await form
    .getByRole("button", { name: "Create or renew promoter link", exact: true })
    .click();
  await expect(form.getByText("LaGoS01AbC", { exact: true })).toBeVisible();
  await form
    .getByRole("button", { name: "Copy returned promoter code" })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "LaGoS01AbC",
  );
  await form.getByRole("button", { name: "Copy promoter URL" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "https://example.test/r/LaGoS01AbC",
  );
  const creates = (await control()).records.filter(
    (r: any) => r.path === "/v1/admin/referrals/links" && r.method === "POST",
  );
  expect(creates).toHaveLength(2);
  expect(creates[0].key).toBe(creates[1].key);
  expect(creates[1].body).toEqual({ name: "LagosPromoter01" });
  const row = page.getByRole("row").filter({
    has: page.getByRole("cell", { name: "ExistingPromoter", exact: true }),
  });
  const expiry = await row.locator("time").getAttribute("datetime");
  const disable = await openAction(row, "Disable promoter link");
  await disable
    .getByRole("button", { name: "Disable promoter link", exact: true })
    .click();
  await expect(row.getByText("Disabled", { exact: true })).toBeVisible();
  await expect(row.getByRole("cell", { name: "7", exact: true })).toBeVisible();
  expect(await row.locator("time").getAttribute("datetime")).toBe(expiry);
  const status = (await control()).records.find(
    (r: any) => r.path === "/v1/admin/referrals/links/document-one/status",
  );
  expect(status.body).toEqual({ active: false });
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: "test-results/promoter-links-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
  await row
    .getByRole("cell", { name: "ExistingPromoter", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    row.getByRole("cell", { name: "ExistingPromoter", exact: true }),
  ).toBeInViewport();
  await page.locator('[data-slot="table-container"]').screenshot({
    path: "test-results/promoter-table-mobile.png",
  });
  await page.screenshot({
    path: "test-results/promoter-links-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect
    .poll(async () =>
      (await control()).records.some(
        (r: any) =>
          r.path === "/v1/admin/referrals/links" &&
          r.query.cursor === "promoter-next",
      ),
    )
    .toBe(true);
});
const totals = {
  total: 12,
  paid: 8,
  unpaid: 3,
  unknownPayment: 1,
  active: 3,
  completed: 7,
  cancelled: 2,
  totalRevenueMinor: 123456,
  completedRevenueMinor: 100000,
  currency: "NGN",
  calculatedAt: "2026-11-06T14:00:00Z",
  roundedPaidOrders: 3,
  roundingPolicy: "nearest_kobo_per_order",
};
for (const role of ["super", "regular", "customercare"])
  test(`${role} reads order totals and returned rounding counts for both report types`, async ({
    page,
  }) => {
    await login(page, role);
    const types: string[] = [];
    await page.route(
      "**/api/proxy/v1/admin/analytics/order-summary?*",
      async (route) => {
        const type = new URL(route.request().url()).searchParams.get("type")!;
        types.push(type);
        await route.fulfill({ json: { data: { ...totals, type } } });
      },
    );
    await page.goto("/reports");
    const region = page.getByRole("region", {
      name: "Order totals",
      exact: true,
    });
    await expect(region.getByText("₦1,234.56", { exact: true })).toBeVisible();
    await expect(region.getByText("₦1,000.00", { exact: true })).toBeVisible();
    await expect(region).toContainText(
      "Revenue includes 3 orders rounded to the nearest kobo for reporting.",
    );
    await page
      .getByRole("combobox", { name: /^Order summary/ })
      .selectOption("ride-courier");
    await expect.poll(() => types.at(-1)).toBe("ride-courier");
    expect([...new Set(types)]).toEqual(["shipment", "ride-courier"]);
    await expect(region.getByText("₦1,234.56", { exact: true })).toBeVisible();
    if (role === "regular") {
      await page.setViewportSize({ width: 390, height: 844 });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(390);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: "test-results/order-summary-mobile.png",
        fullPage: true,
      });
    }
    expect(
      (await control()).records.filter((r: any) =>
        r.path.endsWith("/backfills"),
      ),
    ).toHaveLength(0);
  });
test("order-summary errors distinguish readiness, reconciliation and retry while retaining request IDs", async ({
  page,
}) => {
  await login(page);
  let code = "analytics_not_ready";
  await page.route("**/api/proxy/v1/admin/analytics/order-summary?*", (route) =>
    route.fulfill(
      code
        ? {
            status: 503,
            json: {
              error: { code, message: "Order reporting needs attention." },
              requestId: `reference-${code}`,
            },
          }
        : { json: { data: { ...totals, roundedPaidOrders: 0 } } },
    ),
  );
  await page.route(
    "**/api/proxy/v1/admin/analytics/coverage?report=order_summary",
    (route) =>
      route.fulfill({
        json: {
          data: { report: "order_summary", coverage: { complete: true } },
        },
      }),
  );
  await page.goto("/reports");
  const region = page.getByRole("region", {
    name: "Order totals",
    exact: true,
  });
  await expect(
    region.getByRole("heading", { name: "Report preparation pending" }),
  ).toBeVisible();
  await expect(
    region.getByRole("link", { name: "Inspect report readiness" }),
  ).toHaveCount(0);
  await region
    .getByRole("button", { name: "Inspect order-summary coverage" })
    .click();
  await expect(region).toContainText("Complete");
  code = "analytics_data_invalid";
  await region.getByRole("button", { name: "Refresh order totals" }).click();
  await expect(
    region.getByRole("heading", { name: "Order data needs reconciliation" }),
  ).toBeVisible();
  await expect(region.getByRole("alert")).toContainText(
    "reference-analytics_data_invalid",
  );
  code = "temporarily_unavailable";
  await region.getByRole("button", { name: "Refresh order totals" }).click();
  await expect(region.getByRole("alert")).toContainText(
    "reference-temporarily_unavailable",
  );
  code = "";
  await region.getByRole("button", { name: "Try again" }).click();
  await expect(region.getByText("₦1,234.56", { exact: true })).toBeVisible();
  await expect(region).not.toContainText("rounded to the nearest kobo");
});
test("customer-care sessions cannot access broadcasts or promoter administration", async ({
  page,
}) => {
  await login(page, "customercare");
  for (const path of ["/general-notifications", "/promoter-links"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/support-tickets/);
  }
  expect(
    (
      await page.request.get("/api/proxy/v1/admin/referrals/links?limit=25")
    ).status(),
  ).toBe(403);
  const response = await page.request.post(
    "/api/proxy/v1/admin/notifications/broadcasts",
    {
      headers: {
        Origin: "http://localhost:4320",
        "Idempotency-Key": "denied-broadcast-test",
      },
      data: { audience: "all", title: "Test", body: "Test" },
    },
  );
  expect(response.status()).toBe(403);
});
