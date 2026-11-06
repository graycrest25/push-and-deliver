import { test, expect, type Page } from "@playwright/test";
const origin = "http://localhost:4320";
async function control(body: Record<string, unknown> = {}) {
  return fetch("http://127.0.0.1:4319/control", {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.json());
}
async function login(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Welcome back, Operations Admin/ }),
  ).toBeVisible();
}
test.beforeEach(async () => {
  await control({ reset: true });
});
test("login uses private cookies, keeps tokens and upstream origin out of browser responses", async ({
  page,
  context,
}) => {
  const responses: string[] = [];
  page.on("response", (r) => {
    if (r.url().includes("/api/proxy/"))
      void r
        .text()
        .then((t) => responses.push(t))
        .catch(() => {});
  });
  await login(page);
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === "pnd-access")).toMatchObject({
    httpOnly: true,
    sameSite: "Strict",
  });
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "access-private",
  );
  expect(responses.join("")).not.toContain("access-private");
  expect(responses.join("")).not.toContain("refresh-private");
  expect(responses.join("")).not.toContain("127.0.0.1:4319");
  await expect(page.getByText("₦1,500.00", { exact: true })).toBeVisible();
});
test("proxy rejects unauthenticated, unknown, traversing and cross-origin requests", async ({
  request,
}) => {
  expect((await request.get("/api/proxy/v1/admin/users")).status()).toBe(401);
  expect((await request.get("/api/proxy/v1/not-a-route")).status()).toBe(404);
  expect(
    (
      await request.post("/api/proxy/v1/auth/login", {
        headers: { Origin: "https://other.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect((await request.get("/api/proxy/v1/admin/users/a%2Fb")).status()).toBe(
    400,
  );
  expect((await control()).records).toHaveLength(0);
});
test("proxy ignores caller Authorization and forwards only the cookie access token", async ({
  page,
  request,
}) => {
  await login(page);
  const response = await page.request.get("/api/proxy/v1/admin/users", {
    headers: { Authorization: "Bearer attacker" },
  });
  expect(response.ok()).toBeTruthy();
  const { records } = await control();
  expect(records.at(-1).authorization).toBe("Bearer access-private");
});
test("account search and pagination use after and reset cursor when filters change", async ({
  page,
}) => {
  await login(page);
  await page.goto("/users");
  await expect(page.getByText("Person 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Next person 1", { exact: true })).toBeVisible();
  await page.getByLabel("Name or email").fill("needle");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("Person 1", { exact: true })).toBeVisible();
  const { records } = await control();
  const lists = records.filter(
    (r: any) =>
      r.path === "/v1/admin/users" && r.query.search !== "admin@example.test",
  );
  expect(lists.some((r: any) => r.query.after === "user-25")).toBeTruthy();
  expect(lists.at(-1).query).toMatchObject({ search: "needle", limit: "25" });
  expect(lists.at(-1).query.after).toBeUndefined();
});
test("expired access rotates the refresh cookie once and retries the read", async ({
  page,
}) => {
  await login(page);
  await control({ expire: true });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByText("₦1,500.00", { exact: true })).toBeVisible();
  await expect.poll(async () => (await control()).refreshes).toBe(1);
  const { records } = await control();
  const refresh = records.find((r: any) => r.path === "/v1/auth/refresh");
  expect(refresh.body).toEqual({ refresh_token: "refresh-private" });
  expect(refresh.authorization).toBeUndefined();
});
test("a failed mutation retains its operation key and unchanged input on retry", async ({
  page,
}) => {
  await login(page);
  await page.goto("/generated");
  await page.getByText("Create referral link", { exact: true }).first().click();
  await page.getByLabel("Name *", { exact: true }).fill("New campaign");
  await page.getByLabel("Maximum claims *").fill("25");
  await control({ failOnce: true });
  await page
    .getByRole("button", { name: "Create referral link", exact: true })
    .click();
  await expect(
    page
      .locator("[role=alert]")
      .filter({ hasText: /Please retry|Access denied|permission-test/ }),
  ).toContainText("Please retry");
  await page
    .getByRole("button", { name: "Create referral link", exact: true })
    .click();
  await expect(page.getByText("Saved successfully.")).toBeVisible();
  const { records } = await control();
  const writes = records.filter(
    (r: any) => r.path === "/v1/admin/referrals/links" && r.method === "POST",
  );
  expect(writes).toHaveLength(2);
  expect(writes[0].key).toBe(writes[1].key);
  expect(writes[0].body).toEqual(writes[1].body);
  await expect(page.getByText("/r/L-example", { exact: true })).toBeVisible();
});
test("shipment actions use lifecycle commands and snake_case payloads", async ({
  page,
}) => {
  await login(page);
  await page.goto("/shipment-orders/shipment-1");
  await expect(
    page.getByText("₦1,500.00", { exact: true }).first(),
  ).toBeVisible();
  await page.getByText("Assign rider", { exact: true }).first().click();
  await page.getByLabel("Rider account ID *").fill("rider-1");
  await page.getByRole("button", { name: "Assign rider", exact: true }).click();
  await expect
    .poll(async () => {
      const { records } = await control();
      return records.find(
        (r: any) => r.path === "/v1/shipments/shipment-1/accept",
      )?.body;
    })
    .toEqual({ rider_id: "rider-1" });
  expect(
    await page.getByText("Dispatch shipment", { exact: true }).count(),
  ).toBe(0);
});
test("payment envelopes render rows and endpoint denials remain visible", async ({
  page,
}) => {
  await login(page);
  await page.goto("/payments");
  await expect(page.getByText("payment-1", { exact: true })).toBeVisible();
  await page.goto("/riders/user-1");
  await expect(
    page
      .locator("[role=alert]")
      .filter({ hasText: /Please retry|Access denied|permission-test/ }),
  ).toContainText("Access denied");
  await expect(
    page
      .locator("[role=alert]")
      .filter({ hasText: /Please retry|Access denied|permission-test/ }),
  ).toContainText("permission-test");
});
test("support renders nested latest message and posts replies", async ({
  page,
}) => {
  await login(page);
  await page.goto("/support-tickets");
  await expect(page.getByText("Please help", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Open ticket-1" }).click();
  await page.getByText("Send reply", { exact: true }).first().click();
  await page
    .getByLabel("Message", { exact: true })
    .fill("We are checking this order.");
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  await expect
    .poll(async () => {
      const { records } = await control();
      return records.find(
        (r: any) =>
          r.path === "/v1/support/tickets/ticket-1/messages" &&
          r.method === "POST",
      )?.body;
    })
    .toEqual({ body: "We are checking this order.", asset_id: "" });
});
test("CSV exports traverse the cursor header", async ({ page }) => {
  await login(page);
  await page.goto("/users");
  await page.getByText("Export accounts", { exact: true }).click();
  await page.getByRole("button", { name: "Download export" }).click();
  await expect(
    page.getByText("Downloaded 2 files. Each file is one export page."),
  ).toBeVisible();
  const { records } = await control();
  expect(
    records
      .filter((r: any) => r.path === "/v1/admin/reports/accounts")
      .map((r: any) => r.query.after),
  ).toEqual([undefined, "report-page-2"]);
});
test("sign out revokes server session and clears cookies", async ({
  page,
  context,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign In", exact: true }),
  ).toBeVisible();
  expect(
    (await context.cookies()).some((c) => c.name === "pnd-access"),
  ).toBeFalsy();
});
test("desktop and mobile retain the app design without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.goto("/users");
  await page.screenshot({
    path: "test-results/users-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/users-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.screenshot({
    path: "test-results/users-mobile-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await expect(
    page.getByRole("link", { name: "PushNDeliver home" }),
  ).toBeVisible();
});

test("oversized auth JSON is rejected before it reaches the backend", async ({
  request,
}) => {
  const response = await request.post("/api/proxy/v1/auth/login", {
    headers: { Origin: origin },
    data: { email: "a".repeat(17000), password: "example-password" },
  });
  expect(response.status()).toBe(413);
  expect((await control()).records).toHaveLength(0);
});
test("concurrent tabs rotate one refresh credential", async ({
  page,
  context,
}) => {
  await login(page);
  const second = await context.newPage();
  await second.goto("/users");
  await expect(second.getByText("Person 1", { exact: true })).toBeVisible();
  await control({ expire: true });
  await Promise.all([
    page.getByRole("button", { name: "Refresh", exact: true }).click(),
    second.getByRole("button", { name: "Refresh", exact: true }).click(),
  ]);
  await expect(page.getByText("₦1,500.00", { exact: true })).toBeVisible();
  await expect(second.getByText("Person 1", { exact: true })).toBeVisible();
  expect((await control()).refreshes).toBe(1);
});
test("verifier membership opens applications and hides financial actions", async ({
  page,
}) => {
  await control({ membership: "verifier" });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Rider applications" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Withdrawals", exact: true }),
  ).toHaveCount(0);
  await page.goto("/riders/user-1");
  await expect(
    page.getByText("Review application", { exact: true }).first(),
  ).toBeVisible();
  await page.goto("/payments");
  await expect(
    page.getByRole("heading", { name: "Rider applications" }),
  ).toBeVisible();
});
test("all replacement routes render without runtime errors", async ({
  page,
}) => {
  await login(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  test.setTimeout(90000);
  for (const path of [
    "/coupons",
    "/app-config",
    "/fees",
    "/delivery-zones",
    "/export-rates",
    "/head-offices",
    "/catalogue",
    "/audit",
    "/general-notifications",
    "/weekly-overview",
    "/weekly-concentration",
    "/user-activation",
    "/rider-weekly-deliveries",
    "/coupon-redemption-metrics",
    "/withdrawals",
    "/ride-hailing",
    "/product-orders",
    "/admin/users",
    "/settings",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("customer care gets support and reads without application or finance commands", async ({
  page,
}) => {
  await control({ membership: "customercare" });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Support tickets" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Riders", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Vendor applications", exact: true }),
  ).toHaveCount(0);
  await page.goto("/users");
  await expect(
    page.getByText("Change account status", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/users/user-1");
  await expect(
    page.getByRole("link", { name: "Rider application", exact: true }),
  ).toHaveCount(0);
  await page.goto("/shipment-orders/shipment-1");
  await expect(
    page.getByRole("heading", { name: "Shipment details" }),
  ).toBeVisible();
  await expect(page.getByText("Assign rider", { exact: true })).toHaveCount(0);
});
test("regular admins can operate but cannot reach roles, analytics or funding controls", async ({
  page,
}) => {
  await control({ membership: "regular" });
  await login(page);
  await page.goto("/users");
  await expect(
    page.getByText("Change account status", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Change account role", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/app-config");
  await expect(
    page.getByRole("heading", { name: "App configuration" }),
  ).toBeVisible();
  await expect(
    page.getByText("Set signup bonus budget", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Set signup cash bonus", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/weekly-overview");
  await expect(
    page.getByRole("heading", { name: /Welcome back, Operations Admin/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Admin accounts", exact: true }),
  ).toHaveCount(0);
});
