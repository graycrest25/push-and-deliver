import { test, expect, type Page } from "@playwright/test";
async function control(body: Record<string, unknown> = {}) {
  return fetch("http://127.0.0.1:4319/control", {
    method: "POST",
    body: JSON.stringify(body),
  })
    .then((r) => r.json())
    .then((r) => r.data);
}
async function login(page: Page, role: string | null = "super") {
  await control({ adminType: role });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  if (role === null)
    await expect(
      page.getByRole("heading", { name: "Administrator access required" }),
    ).toBeVisible();
  else await expect(page.locator("#workspace-content")).toBeVisible();
}
async function openForm(page: Page, title: string) {
  await page.locator("summary").filter({ hasText: title }).click();
}
async function writes(path: string) {
  return (await control()).records.filter(
    (r: any) => r.path === path && r.method !== "GET",
  );
}
test.beforeEach(async () => {
  await control({ reset: true });
});
test("authoritative membership opens the workspace and denies non-admin access", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/users");
  await expect(
    page.getByRole("heading", { name: "Administrator access", exact: true }),
  ).toBeVisible();
  await control({ adminType: null });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Administrator access required" }),
  ).toBeVisible();
});
for (const role of ["regular", "customercare", "verifier"])
  test(`${role} cannot open super-only configuration or role management`, async ({
    page,
  }) => {
    await login(page, role);
    for (const route of ["/app-config", "/admin/users"]) {
      await page.goto(route);
      await expect(page).not.toHaveURL(new RegExp(`${route}$`));
      await expect(
        page.getByRole("heading", {
          name: "Administrator access",
          exact: true,
        }),
      ).toHaveCount(0);
    }
    if (role !== "regular") {
      await page.goto("/coupons");
      await expect(page).not.toHaveURL(/\/coupons$/);
    }
    const records = (await control()).records;
    expect(
      records.some(
        (r: any) =>
          r.path.includes("/config/signup-bonus") || r.path.endsWith("/role"),
      ),
    ).toBe(false);
  });
test("release editing reads the selected rider platform and submits its version and native fields", async ({
  page,
}) => {
  await login(page);
  await page.goto("/app-config");
  await page.getByLabel("App", { exact: true }).selectOption("rider");
  await page.getByLabel("Platform", { exact: true }).selectOption("ios");
  await openForm(page, "Publish release settings");
  await expect(page.getByLabel("Latest version")).toHaveValue("2.0.0");
  await page.getByLabel("Latest version").fill("3.0.0");
  await page
    .getByRole("button", { name: "Publish release settings", exact: true })
    .click();
  await expect
    .poll(
      async () => (await writes("/v1/admin/config/mobile/rider/ios")).length,
    )
    .toBe(1);
  const call = (await writes("/v1/admin/config/mobile/rider/ios"))[0];
  expect(call.body).toMatchObject({
    expectedVersion: 2,
    latestVersion: "3.0.0",
    maintenance: { enabled: false, message: null },
  });
  expect(Object.keys(call.body.features)).toHaveLength(8);
  expect(call.key).toBeTruthy();
  expect(call.account).toBe("user");
  await expect(page.getByText("3.0.0", { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/native-config-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/native-config-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("role removal uses the read version and forces refresh after a conflict", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/users");
  await page.getByLabel("User ID", { exact: true }).fill("target-1");
  await page.getByRole("button", { name: "Find account" }).click();
  await openForm(page, "Update administrator role");
  await page
    .getByLabel("Administrator role (none removes access)")
    .selectOption("none");
  await page.getByLabel("Reason for change").fill("Access no longer required");
  await control({ conflict: true });
  await page
    .getByRole("button", { name: "Update administrator role", exact: true })
    .click();
  await expect(
    page.locator("#workspace-content").getByRole("alert"),
  ).toContainText("Record changed");
  await expect(
    page.getByRole("button", {
      name: "Update administrator role",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Refresh account role" }).click();
  await openForm(page, "Update administrator role");
  await page
    .getByLabel("Administrator role (none removes access)")
    .selectOption("none");
  await page.getByLabel("Reason for change").fill("Access no longer required");
  await page
    .getByRole("button", { name: "Update administrator role", exact: true })
    .click();
  await expect
    .poll(async () => (await writes("/v1/admin/users/target-1/role")).length)
    .toBe(2);
  const calls = await writes("/v1/admin/users/target-1/role");
  expect(calls[1].body).toEqual({
    adminType: null,
    reason: "Access no longer required",
    expectedVersion: 2,
  });
  expect(calls[1].key).not.toBe(calls[0].key);
});
test("campaign creation, status and coupon generation use native contracts and safe grant retries", async ({
  page,
}) => {
  await login(page, "regular");
  await page.goto("/coupons");
  await openForm(page, "Create campaign");
  await page.getByLabel("Campaign title").fill("Delivery welcome");
  await page.getByLabel("Discount (%)").fill("15");
  await page.getByLabel("Courier", { exact: true }).check();
  await page
    .getByRole("button", { name: "Create campaign", exact: true })
    .click();
  await expect
    .poll(async () => (await writes("/v1/admin/coupons/campaigns")).length)
    .toBe(1);
  expect((await writes("/v1/admin/coupons/campaigns"))[0].body).toMatchObject({
    validForHours: 24,
    percentageDiscount: 15,
    eligibleServices: ["courier"],
  });
  await openForm(page, "Disable campaign");
  await page
    .getByRole("button", { name: "Disable campaign", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await writes("/v1/admin/coupons/campaigns/campaign-1/status")).length,
    )
    .toBe(1);
  expect(
    (await writes("/v1/admin/coupons/campaigns/campaign-1/status"))[0].body,
  ).toEqual({ enabled: false, expectedVersion: 2 });
  await openForm(page, "Generate customer coupon code");
  await page.getByLabel("Customer user ID").fill("customer-1");
  await page.getByLabel("Campaign ID").fill("campaign-1");
  await control({ failWrite: true });
  await page
    .getByRole("button", { name: "Generate customer coupon code", exact: true })
    .click();
  await expect(
    page.locator("#workspace-content").getByRole("alert"),
  ).toContainText("Response lost");
  await expect(page.getByLabel("Customer user ID")).toBeDisabled();
  await page
    .getByRole("button", { name: "Generate customer coupon code", exact: true })
    .click();
  await expect(page.getByText("WELCOME-UNIQUE")).toBeVisible();
  const calls = await writes("/v1/admin/coupons/grants");
  expect(calls).toHaveLength(2);
  expect(calls[0].body).toEqual(calls[1].body);
  expect(calls[0].key).toBe(calls[1].key);
});
test("signup selection, job recovery and total wallet allowance retain native versions", async ({
  page,
}) => {
  await login(page);
  await page.goto("/coupons");
  await page
    .getByRole("button", { name: "Signup coupons", exact: true })
    .click();
  await openForm(page, "Save signup coupon settings");
  await page
    .getByRole("button", { name: "Save signup coupon settings", exact: true })
    .click();
  await expect
    .poll(
      async () => (await writes("/v1/admin/coupons/signup/settings")).length,
    )
    .toBe(1);
  expect((await writes("/v1/admin/coupons/signup/settings"))[0].body).toEqual({
    enabled: true,
    campaignIds: ["campaign-1"],
    expectedVersion: 3,
  });
  await page.getByRole("button", { name: "Processing", exact: true }).click();
  await openForm(page, "Requeue job");
  await page.getByLabel("Reason").fill("Provider issue resolved");
  await page.getByRole("button", { name: "Requeue job", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await writes("/v1/admin/coupons/signup/jobs/customer-1/requeue"))
          .length,
    )
    .toBe(1);
  expect(
    (await writes("/v1/admin/coupons/signup/jobs/customer-1/requeue"))[0].body,
  ).toEqual({
    jobId: "signup-job-1",
    expectedGeneration: 3,
    reason: "Provider issue resolved",
  });
  await page.goto("/app-config");
  await openForm(page, "Save signup bonus and budget");
  await page.getByLabel("Total promotional budget (kobo)").fill("2000000");
  await page
    .getByRole("button", { name: "Save signup bonus and budget", exact: true })
    .click();
  await expect
    .poll(async () => (await writes("/v1/admin/config/signup-bonus")).length)
    .toBe(1);
  expect((await writes("/v1/admin/config/signup-bonus"))[0].body).toEqual({
    enabled: true,
    amountMinor: 50000,
    budgetMinor: 2000000,
    expectedVersion: 4,
  });
});
test("support claims scope attachments; replies retry unchanged and status uses the fresh version", async ({
  page,
}) => {
  await login(page, "customercare");
  await page.goto("/support-tickets/ticket-1");
  await expect(page.getByText("Claim ticket to download")).toBeVisible();
  expect(await page.content()).not.toContain("private.example.test");
  await page.getByRole("button", { name: "Claim ticket", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Download attachment" }),
  ).toHaveAttribute("href", "/api/proxy/v1/media/asset-private/content");
  await page
    .getByLabel("Message to customer")
    .fill("We are checking your delivery.");
  await control({ failWrite: true });
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  await expect(
    page.locator("#workspace-content").getByRole("alert"),
  ).toContainText("Response lost");
  await page.getByRole("button", { name: "Retry reply", exact: true }).click();
  await expect(
    page.getByText("We are checking your delivery.", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        (await writes("/v1/admin/support/tickets/ticket-1/messages")).length,
    )
    .toBe(2);
  const replies = await writes("/v1/admin/support/tickets/ticket-1/messages");
  expect(replies[0].body).toEqual(replies[1].body);
  expect(replies[0].key).toBe(replies[1].key);
  expect(Object.keys(replies[0].body).sort()).toEqual([
    "clientMessageId",
    "message",
  ]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(
    page.getByRole("log", { name: "Conversation messages" }),
  ).toContainText("Help with delivery");
  await page
    .getByLabel("Message to customer")
    .fill("Your courier will contact you shortly.");
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  await expect(
    page.getByText("Your courier will contact you shortly.", { exact: true }),
  ).toBeVisible();
  const fresh = await writes("/v1/admin/support/tickets/ticket-1/messages");
  expect(fresh[2].body.clientMessageId).not.toBe(fresh[0].body.clientMessageId);
  expect(fresh[2].key).not.toBe(fresh[0].key);
  await page.screenshot({
    path: "test-results/support-chat-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.screenshot({
    path: "test-results/support-chat-desktop-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/support-chat-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Close ticket", exact: true }).click();
  await expect(
    page.locator("#workspace-content").getByRole("alert"),
  ).toContainText("Only a super administrator");
  const call = (await writes("/v1/admin/support/tickets/ticket-1/status"))[0];
  expect(call.method).toBe("PUT");
  expect(call.body).toEqual({ status: "closed", expectedVersion: 6 });
  const records = (await control()).records;
  const notice = records.find(
    (row: any) =>
      row.path === "/v1/admin/support/tickets/ticket-1/messages" &&
      row.body.message ===
        "This ticket is now closed, I hope all your issues have been resolved. If you have any other issues, please open a new ticket.",
  );
  expect(notice).toBeTruthy();
  const closing = records.findIndex(
    (row: any) =>
      row.path === "/v1/admin/support/tickets/ticket-1/status" &&
      row.method === "PUT",
  );
  expect(records.indexOf(notice)).toBeLessThan(closing);
  expect(
    records
      .slice(records.indexOf(notice) + 1, closing)
      .some(
        (row: any) =>
          row.method === "GET" &&
          row.path === "/v1/admin/support/tickets/ticket-1",
      ),
  ).toBeTruthy();
});
test("closing waits for its message and retries both steps without duplicate notices", async ({
  page,
}) => {
  await login(page);
  await page.goto("/support-tickets/ticket-1");
  await page.getByRole("button", { name: "Claim ticket", exact: true }).click();
  await expect(page.getByLabel("Message to customer")).toBeVisible();
  const statusRequests: { key: string | undefined; body: any }[] = [];
  await page.route(
    "**/api/proxy/v1/admin/support/tickets/ticket-1/status",
    (route) => {
      statusRequests.push({
        key: route.request().headers()["idempotency-key"],
        body: route.request().postDataJSON(),
      });
      return statusRequests.length === 1
        ? route.fulfill({
            status: 503,
            json: { error: { message: "Closing response unavailable" } },
          })
        : route.continue();
    },
  );
  await control({ failWrite: true });
  const close = page.getByRole("button", { name: "Close ticket", exact: true });
  await close.click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Response lost" }),
  ).toBeVisible();
  expect(statusRequests).toHaveLength(0);
  await close.click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Closing response unavailable" }),
  ).toBeVisible();
  const notices = await writes("/v1/admin/support/tickets/ticket-1/messages");
  expect(notices).toHaveLength(2);
  expect(notices[0].body.message).toBe(
    "This ticket is now closed, I hope all your issues have been resolved. If you have any other issues, please open a new ticket.",
  );
  expect(notices[1].body).toEqual(notices[0].body);
  expect(notices[1].key).toBe(notices[0].key);
  await close.click();
  await expect(page.getByText("Closed", { exact: true })).toBeVisible();
  expect(statusRequests).toHaveLength(2);
  expect(statusRequests[1]).toEqual(statusRequests[0]);
  expect(statusRequests[0].body).toEqual({
    status: "closed",
    expectedVersion: 4,
  });
  expect(
    await writes("/v1/admin/support/tickets/ticket-1/messages"),
  ).toHaveLength(2);
  await expect(
    page.getByRole("log").getByText(notices[0].body.message, { exact: true }),
  ).toHaveCount(1);
});
test("Google challenge login keeps nonce/device binding and opaque credentials behind the proxy", async ({
  page,
}) => {
  await control({ adminType: "super" });
  await page.route("**/api/auth/options", (route) =>
    route.fulfill({
      json: { googleClientId: "fixture.apps.googleusercontent.com" },
    }),
  );
  await page.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.google = {accounts:{id:{initialize(o){window.googleOptions=o},renderButton(el){el.innerHTML='<button>Google fixture login</button>';el.firstChild.onclick=()=>window.googleOptions.callback({credential:'google-id-token'})},cancel(){}}}};`,
    }),
  );
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(
    page.getByRole("button", { name: "Google fixture login" }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).googleOptions.nonce)).toBe(
    "google-nonce",
  );
  await page.getByRole("button", { name: "Google fixture login" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const challenge = (await writes("/v2/auth/social/challenges"))[0],
    call = (await writes("/v2/auth/admin/google"))[0];
  expect(call.body.deviceId).toBe(challenge.body.deviceId);
  expect(call.body.deviceName).toBe("Admin dashboard");
  expect(call.key).toBeTruthy();
  expect(call.authorization).toBeUndefined();
  expect(await page.evaluate(() => document.cookie)).not.toContain("pnd_a2");
});
test("dashboard proxy rejects oversized and keyless writes before forwarding", async ({
  page,
}) => {
  await login(page);
  for (const [body, key, status] of [
    [{ title: "x" }, "", 400],
    [{ title: "x".repeat(33000) }, "operation-test", 413],
  ] as const) {
    const response = await page.request.post(
      "/api/proxy/v1/admin/coupons/campaigns",
      {
        headers: {
          Origin: "http://localhost:4320",
          ...(key ? { "Idempotency-Key": key } : {}),
        },
        data: body,
      },
    );
    expect(response.status()).toBe(status);
  }
  expect(await writes("/v1/admin/coupons/campaigns")).toHaveLength(0);
});

test("Google button retains the previous login styling and explains missing configuration", async ({
  page,
}) => {
  await page.route("**/api/auth/options", (route) =>
    route.fulfill({ json: { googleClientId: null } }),
  );
  await page.goto("/sign-in");
  const google = page.getByRole("button", {
    name: "Continue with Google",
    exact: true,
  });
  await expect(google).toBeVisible();
  await expect(google.locator("svg")).toHaveCount(1);
  await expect(page.getByText("or", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/google-login-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/google-login-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await google.click();
  await expect(
    page.getByText(
      "Google sign-in is not configured yet. Contact your administrator or sign in with email.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign In", exact: true }),
  ).toBeEnabled();
  expect(await writes("/v2/auth/social/challenges")).toHaveLength(0);
});

test("native rider report renders all returned rows, weekly totals and cursor pages", async ({
  page,
}) => {
  await login(page);
  await page.goto("/rider-weekly-deliveries");
  await expect(
    page.getByRole("status").filter({ hasText: "16 records on this page" }),
  ).toBeVisible();
  const rider = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "rider-1", exact: true }) });
  await expect(
    rider.getByRole("cell", { name: "3", exact: true }),
  ).toBeVisible();
  await rider.locator("summary").click();
  await expect(rider.getByText("2026-10-19", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/rider-response-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/rider-response-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("combobox", { name: "Rows per page" })
    .selectOption("10");
  await expect(
    page.getByRole("status").filter({ hasText: "10 records on this page" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "rider-11", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "6 records on this page" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Through date").fill("2026-11-01");
  await page.getByRole("button", { name: "Apply report options" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "16 records on this page" }),
  ).toBeVisible();
  const calls = (await control()).records.filter((r: any) =>
    r.path.endsWith("rider-weekly-deliveries"),
  );
  expect(calls.some((r: any) => r.query.cursor === "opaque-report-next")).toBe(
    true,
  );
  expect(calls.some((r: any) => r.query.endDate === "2026-11-01")).toBe(true);
  expect(
    calls.some((r: any) => "after" in r.query || "end_date" in r.query),
  ).toBe(false);
});

test("native activation report renders users and embedded summary without the obsolete summary request", async ({
  page,
}) => {
  await login(page);
  await page.goto("/user-activation");
  await expect(
    page.getByRole("status").filter({ hasText: "25 records on this page" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "user-1", exact: true }),
  ).toBeVisible();
  const summary = page.getByRole("region", { name: "Activation summary" });
  await expect(summary.getByText("50%", { exact: true })).toBeVisible();
  await expect(summary.getByText("26", { exact: true })).toHaveCount(2);
  await page.screenshot({
    path: "test-results/activation-response-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/activation-response-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "user-26", exact: true }) });
  await expect(row).toBeVisible();
  await expect(row.getByRole("cell", { name: "—", exact: true })).toHaveCount(
    2,
  );
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "user-1", exact: true }),
  ).toBeVisible();
  const calls = (await control()).records.filter((r: any) =>
    r.path.endsWith("time-to-first-order"),
  );
  expect(calls.some((r: any) => r.query.cursor === "opaque-report-next")).toBe(
    true,
  );
  expect(
    calls.some(
      (r: any) =>
        "summary_only" in r.query ||
        "summaryOnly" in r.query ||
        "after" in r.query,
    ),
  ).toBe(false);
});

test("native directories show returned profiles with correct type, UID details and cursor exports", async ({
  page,
}) => {
  await login(page, "regular");
  await page.goto("/users");
  await expect(
    page.getByRole("cell", { name: "Native User", exact: true }),
  ).toBeVisible();
  const date = page.locator("tbody time").first();
  await expect(date.locator("span").first()).toHaveText("3 Nov 2026");
  await expect(date.locator("span").last()).toHaveText("08:00 WAT");
  await date.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/created-at-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await date.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/created-at-mobile.png",
    fullPage: true,
  });
  expect(
    await date
      .locator("span")
      .first()
      .evaluate((e) => e.getBoundingClientRect().height),
  ).toBeLessThan(30);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Second account", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.getByRole("link", { name: /Open Native User/ }).click();
  await expect(page).toHaveURL(/\/users\/user-1$/);
  await expect(
    page.getByRole("heading", { name: "User profile", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("profile@example.test", { exact: true }),
  ).toBeVisible();
  await page.goto("/riders");
  await expect(
    page.getByRole("cell", { name: "Native Rider", exact: true }),
  ).toBeVisible();
  await openForm(page, "Export riders");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download export", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("riders-1.csv");
  await expect(
    page.getByText("More records are available.", { exact: false }),
  ).toBeVisible();
  const second = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download next page" }).click();
  await second;
  await expect(
    page.getByText("Export complete.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start new export" }).click();
  await page.getByLabel("Export format").selectOption("json");
  const jsonDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download export", exact: true })
    .click();
  expect((await jsonDownload).suggestedFilename()).toBe("riders-1.json");
  const calls = (await control()).records;
  expect(
    calls.some(
      (r: any) => r.path === "/v1/admin/users" && r.query.type === "riders",
    ),
  ).toBe(true);
  expect(
    calls.some(
      (r: any) =>
        r.path === "/v1/admin/users/user-1" && r.query.type === "users",
    ),
  ).toBe(true);
  expect(
    calls.some(
      (r: any) =>
        r.path === "/v1/admin/reports/riders" &&
        r.query.cursor === "export-riders",
    ),
  ).toBe(true);
  expect(
    calls
      .filter(
        (r: any) =>
          r.path.startsWith("/v1/admin/users") ||
          r.path.startsWith("/v1/admin/reports"),
      )
      .some((r: any) =>
        ["search", "role", "status", "after", "from", "to"].some(
          (key) => key in r.query,
        ),
      ),
  ).toBe(false);
});

test("native rides, fares and catalogues use admin reads and preserve monetary units", async ({
  page,
}) => {
  await login(page, "regular");
  await page.goto("/ride-hailing");
  await expect(
    page.getByRole("cell", { name: "ride-1", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Open ride-1/ }).click();
  await expect(page.getByText(/2,500\.00/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Cancel ride/ })).toHaveCount(
    0,
  );
  await page.goto("/fees");
  await expect(page.getByRole("cell", { name: /25\.50/ })).toBeVisible();
  await page.getByLabel("Fee catalogue").selectOption("shipping");
  await expect(
    page.getByRole("cell", { name: "Distance fee", exact: true }),
  ).toBeVisible();
  await page.goto("/head-offices");
  await expect(
    page.getByRole("cell", { name: "Lagos office", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Open Lagos office/ }).click();
  await expect(
    page.getByText("Example address", { exact: true }),
  ).toBeVisible();
  await page.goto("/export-rates");
  await expect(
    page.getByRole("cell", { name: "International tariff", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Open International tariff/ }).click();
  await expect(
    page.getByRole("cell", { name: "150,000", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("NG", { exact: true })).toBeVisible();
  await page.goto("/export-rates/countries/NG");
  await expect(page.getByText("Nigeria", { exact: true })).toBeVisible();
  await page.goto("/delivery-zones");
  await expect(
    page.getByRole("cell", { name: "Within state", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Lagos", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Open local-1/ }).click();
  await expect(
    page.getByRole("cell", { name: "150,000", exact: true }),
  ).toBeVisible();
  const calls = (await control()).records;
  expect(
    calls.some(
      (r: any) =>
        r.path === "/v1/admin/shipping/offices" &&
        r.query.includeInactive === "true",
    ),
  ).toBe(true);
  expect(
    calls.some(
      (r: any) => r.path === "/v1/admin/geography/tariffs/local-1/snapshot",
    ),
  ).toBe(true);
  expect(
    calls.some(
      (r: any) =>
        r.path === "/v1/rides/fares" ||
        r.path.startsWith("/v1/rides/trips") ||
        "include_inactive" in r.query,
    ),
  ).toBe(false);
});

test("audit handles role events and coverage rebuild acceptance stays separate from readiness", async ({
  page,
}) => {
  await login(page);
  await page.goto("/audit");
  await expect(
    page.getByRole("cell", { name: "dashboard:admin-1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "target-1", exact: true }),
  ).toBeVisible();
  await page.goto("/analytics-coverage");
  await expect(
    page.getByText(/not ready for complete business totals/),
  ).toBeVisible();
  await openForm(page, "Queue report rebuild");
  await page
    .getByRole("button", { name: "Queue report rebuild", exact: true })
    .click();
  await expect(page.getByText("rebuild-1", { exact: true })).toBeVisible();
  const call = (await writes("/v1/admin/analytics/backfills"))[0];
  expect(call.body).toEqual({ report: "account_summary", resume: true });
  expect(call.key).toBeTruthy();
  await expect(
    page.getByText(/not ready for complete business totals/),
  ).toBeVisible();
  await page.getByLabel("Report", { exact: true }).selectOption("order_facts");
  await expect
    .poll(async () =>
      (await control()).records.some(
        (r: any) =>
          r.path === "/v1/admin/analytics/coverage" &&
          r.query.report === "order_facts",
      ),
    )
    .toBe(true);
});

test("missing release editor creates a reviewed configuration with expectedVersion zero", async ({
  page,
}) => {
  await control({ missingRelease: true });
  await login(page);
  await page.goto("/app-config");
  await expect(
    page.getByText(/Release settings have not been created/),
  ).toBeVisible();
  await openForm(page, "Publish release settings");
  await page.getByLabel("Latest version").fill("1.0.0");
  await page.getByLabel("Minimum supported version").fill("1.0.0");
  await page
    .getByLabel("App store URL")
    .fill("https://play.google.com/store/apps/details?id=example.user");
  await page
    .getByRole("button", { name: "Publish release settings", exact: true })
    .click();
  await expect
    .poll(
      async () => (await writes("/v1/admin/config/mobile/user/android")).length,
    )
    .toBe(1);
  expect(
    (await writes("/v1/admin/config/mobile/user/android"))[0].body
      .expectedVersion,
  ).toBe(0);
  await expect(page.getByText("1.0.0", { exact: true })).toHaveCount(2);
  expect(
    (await control()).records.some(
      (r: any) =>
        r.path === "/v1/admin/config/mobile/user/android" && r.method === "GET",
    ),
  ).toBe(true);
});

test("historical support attachments show an unavailable placeholder without breaking conversation", async ({
  page,
}) => {
  await login(page, "customercare");
  await page.route(
    "**/api/proxy/v1/admin/support/tickets/ticket-1/messages?*",
    (route) =>
      route.fulfill({
        json: {
          data: {
            items: [
              {
                id: "late-legacy",
                senderRole: "user",
                message: "Old attachment",
                createdAt: "2026-11-03T23:30:00Z",
                attachmentUnavailable: true,
              },
              {
                id: "early-message",
                senderRole: "user",
                message: "An early update",
                createdAt: "2026-11-04T00:05:00Z",
              },
            ],
            hasMore: false,
            nextCursor: null,
          },
        },
      }),
  );
  await page.goto("/support-tickets/ticket-1");
  await expect(
    page.getByText("Attachment unavailable", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Old attachment", { exact: true })).toBeVisible();
  await expect(page.getByText("4 Nov 2026", { exact: true })).toHaveCount(1);
  await expect(page.getByText("3 Nov 2026", { exact: true })).toHaveCount(0);
});

test("native directory, audit and coverage screens follow the updated subtype restrictions", async ({
  page,
}) => {
  await login(page, "customercare");
  for (const route of [
    "/users",
    "/riders",
    "/ride-hailing",
    "/audit",
    "/analytics-coverage",
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/support-tickets$/);
  }
  expect(
    (await control()).records.some(
      (r: any) =>
        r.path === "/v1/admin/users" ||
        r.path === "/v1/admin/rides" ||
        r.path === "/v1/admin/audit" ||
        r.path === "/v1/admin/analytics/coverage",
    ),
  ).toBe(false);
});

test("profile sections display full native details and target finances", async ({
  page,
}) => {
  await login(page);
  await control({ latest: true });
  await page.goto("/riders/rider-1");
  await expect(page.locator("#personal-information")).toContainText(
    "Native Rider",
  );
  await expect(page.locator("#wallet")).toContainText("₦1,250.00");
  await expect(page.locator("#transactions")).toContainText("Delivery");
  await expect(
    page.getByRole("link", { name: "Inspect application and review history" }),
  ).toHaveAttribute("href", "/rider-applications/rider-1");
});

test("directory pagination survives details and back but resets after leaving the section", async ({
  page,
}) => {
  await login(page);
  await page.goto("/users");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 · 1 records on this page")).toBeVisible();
  await page.getByRole("link", { name: "Open Second account" }).click();
  await expect(page).toHaveURL(/\/users\/user-2$/);
  await page.getByRole("link", { name: "Back to users", exact: true }).click();
  await expect(page.getByText("Page 2 · 1 records on this page")).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Second account", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open Second account" }).click();
  await page.goBack();
  await expect(page.getByText("Page 2 · 1 records on this page")).toBeVisible();
  await page.getByRole("button", { name: "Riders", exact: true }).click();
  await page.getByRole("link", { name: "All riders", exact: true }).click();
  await expect(page).toHaveURL(/\/riders$/);
  await page.getByRole("link", { name: "All users", exact: true }).click();
  await expect(page.getByText("Page 1 · 1 records on this page")).toBeVisible();
});

test("account selection opens authoritative roles and administrators remain distinct from all users", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/users");
  await expect(
    page.getByText("Select an account", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "user-1", exact: true }),
  ).toHaveAttribute("href", "/users/user-1");
  await page.getByRole("link", { name: "Open Native User" }).click();
  await expect(
    page.getByRole("heading", { name: "Account role", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("target@example.test", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Administrators", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Administrator subtype" }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      (await control()).records.some(
        (r: any) =>
          r.path === "/v1/admin/users" && r.query.membership === "admins",
      ),
    )
    .toBeTruthy();
  await expect(
    page.getByText("Select an account", { exact: true }),
  ).toHaveCount(0);
});

test("record identifiers link to the correct user, rider and order details", async ({
  page,
}) => {
  await login(page);
  await page.goto("/ride-hailing");
  await expect(
    page.getByRole("link", { name: "customer-1", exact: true }),
  ).toHaveAttribute("href", "/users/customer-1");
  await expect(
    page.getByRole("link", { name: "ride-1", exact: true }),
  ).toHaveAttribute("href", "/ride-hailing/ride-1");
  await page.getByRole("link", { name: "customer-1", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "User profile", exact: true }),
  ).toBeVisible();
  await page.goto("/rider-weekly-deliveries");
  await expect(
    page.getByRole("link", { name: "rider-1", exact: true }),
  ).toHaveAttribute("href", "/riders/rider-1");
});

for (const role of ["regular", "customercare"])
  test(`${role} cannot read or reopen closed support tickets through the UI or proxy`, async ({
    page,
  }) => {
    await login(page, role);
    await control({ ticketStatus: "closed" });
    await page.goto("/support-tickets");
    await expect(
      page.getByText("No records found.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Status", { exact: true })).toHaveCount(0);
    await page.goto("/support-tickets/ticket-1");
    await expect(
      page.locator("#workspace-content").getByRole("alert"),
    ).toContainText("Only a super administrator");
    await expect(
      page.getByText("Help with delivery", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Reopen ticket", exact: true }),
    ).toHaveCount(0);
    const responses = await page.evaluate(async () => {
      const root = "/api/proxy/v1/admin/support/tickets";
      return Promise.all(
        [
          fetch(root + "?status=closed"),
          fetch(root + "/ticket-1/messages"),
          fetch(root + "/ticket-1/status", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": "test-reopen-closed",
            },
            body: JSON.stringify({ status: "open", expectedVersion: 2 }),
          }),
          fetch(root + "/ticket-1/claim", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": "test-claim-closed",
            },
            body: JSON.stringify({ expectedVersion: 2 }),
          }),
        ].map(async (r) => (await r).status),
      );
    });
    expect(responses).toEqual([403, 403, 403, 403]);
    const calls = (await control()).records;
    expect(calls.some((r: any) => r.path.endsWith("/ticket-1/messages"))).toBe(
      false,
    );
    expect(
      calls.some(
        (r: any) => r.path.endsWith("/ticket-1/status") && r.method === "PUT",
      ),
    ).toBe(false);
  });

test("super administrators can inspect and reopen closed tickets", async ({
  page,
}) => {
  await login(page);
  await control({ ticketStatus: "closed" });
  await page.goto("/support-tickets/ticket-1");
  await expect(page.getByText("Old attachment", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Reopen ticket", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Close ticket", exact: true }),
  ).toBeVisible();
  const call = (await writes("/v1/admin/support/tickets/ticket-1/status"))[0];
  expect(call.body).toEqual({ status: "open", expectedVersion: 2 });
});

test("claiming from ticket details opens a dedicated chat and preserves the queue", async ({
  page,
}) => {
  await login(page);
  await page.goto("/support-tickets");
  await page.getByLabel("Rows per page", { exact: true }).selectOption("10");
  await page.getByRole("link", { name: "Open ticket-1", exact: true }).click();
  await expect(page).toHaveURL(/\/support-tickets\?ticket=ticket-1$/);
  const panel = page.getByRole("complementary", { name: "Ticket details" });
  await expect(panel).toContainText("Help with delivery");
  await expect(
    page.getByRole("heading", { name: "Ticket details", exact: true }),
  ).toBeFocused();
  await expect(page.getByRole("table")).toBeVisible();
  await page.screenshot({
    path: "test-results/support-side-panel-desktop.png",
    fullPage: true,
  });
  await panel
    .getByRole("button", { name: "Claim ticket", exact: true })
    .click();
  await expect(page).toHaveURL(/\/support-tickets\/ticket-1$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByLabel("Message to customer")).toBeVisible();
  await expect(
    page.getByText("Assigned to you", { exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to support tickets" }).click();
  await expect(page.getByLabel("Rows per page", { exact: true })).toHaveValue(
    "10",
  );
  await page.getByRole("link", { name: "Open ticket-1", exact: true }).click();
  await panel
    .getByRole("button", { name: "Close details", exact: true })
    .click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByLabel("Rows per page", { exact: true })).toHaveValue(
    "10",
  );
  await expect(
    page.getByRole("link", { name: "Open ticket-1", exact: true }),
  ).toBeFocused();
  await page.goBack();
  await expect(panel).toContainText("Help with delivery");
});

test("loading placeholders retain table and detail layouts and clear after success or failure", async ({
  page,
}) => {
  await login(page);
  let release = () => {};
  let gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/proxy/v1/shipments?*", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/shipment-orders");
  const pendingTable = page.getByRole("status", {
    name: "Loading records…",
    exact: true,
  });
  await expect(pendingTable).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Refresh", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("No records found.", { exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/shipment-loading-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/shipment-loading-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.screenshot({
    path: "test-results/shipment-loading-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await pendingTable
      .locator('[data-slot="skeleton"]')
      .first()
      .evaluate((el) => getComputedStyle(el, "::after").animationName),
  ).toBe("none");
  release();
  await expect(
    page.getByRole("link", { name: "shipment-1", exact: true }),
  ).toBeVisible();
  await expect(pendingTable).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await page.setViewportSize({ width: 1280, height: 900 });
  gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    "**/api/proxy/v1/admin/shipping/offices/office-1",
    async (route) => {
      await gate;
      await route.continue();
    },
  );
  await page.goto("/head-offices/office-1");
  await expect(
    page.getByRole("status", { name: "Loading shipping office…", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/office-loading-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  release();
  await expect(page.getByText("Lagos office", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/office-refresh-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/office-refresh-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.route("**/api/proxy/v1/admin/shipping/offices/office-1", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: { code: "unavailable", message: "Office service unavailable" },
      },
    }),
  );
  await page
    .getByRole("button", { name: "Refresh shipping office", exact: true })
    .click();
  await expect(
    page.locator("#workspace-content").getByRole("alert"),
  ).toContainText("Office service unavailable");
  await expect(
    page.getByRole("status", { name: "Loading shipping office…", exact: true }),
  ).toHaveCount(0);
});

test("report information uses separate titled sections with linked accounts and retained pagination", async ({
  page,
}) => {
  test.setTimeout(60000);
  await login(page);
  await page.route(
    "**/api/proxy/v1/admin/analytics/weekly-concentration*",
    (route) =>
      route.fulfill({
        json: {
          data: {
            weekStart: "2026-10-26",
            weekEnd: "2026-11-01",
            top: 10,
            totalUsers: 15,
            totalOrders: 50,
            items: [
              {
                rank: 1,
                userId: "user-1",
                totalOrders: 20,
                services: { ridehailing: 15, courier: 5 },
                share: 0.4,
              },
            ],
            coverage: { complete: true },
          },
          requestId: "report-layout-fixture",
        },
      }),
  );
  await page.goto("/weekly-concentration");
  for (const title of [
    "Report options",
    "Report information",
    "User order concentration",
    "Report coverage",
  ])
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "user-1", exact: true }),
  ).toHaveAttribute("href", "/users/user-1");
  await expect(
    page.locator('[data-slot="card"] [data-slot="card"]'),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/report-sections-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/report-sections-mobile.png",
    fullPage: true,
  });
  await page.goto("/user-activation");
  await expect(
    page.getByRole("heading", { name: "Activation summary", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Report coverage", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('[data-slot="card"] [data-slot="card"]'),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "user-1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "user-26", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "user-26", exact: true }).click();
  await expect(page).toHaveURL(/\/users\/user-26$/);
  await page.goBack();
  await expect(
    page.getByRole("link", { name: "user-26", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/activation-sections-mobile.png",
    fullPage: true,
  });
});

test("super shipment commands follow native versions and lifecycle across shipment types", async ({
  page,
}) => {
  test.setTimeout(60000);
  await login(page);
  for (const type of ["local", "express", "customs_clearance"]) {
    await control({
      shipment: {
        shipmentType: type,
        status: "placed",
        version: 3,
        assignedRider: null,
        assessmentStatus: "not_required",
        payment: { status: "paid", method: "wallet" },
      },
    });
    await page.goto("/shipment-orders/shipment-1");
    await expect(
      page.getByText("Order information", { exact: true }),
    ).toBeVisible();
    if (type === "local") {
      await page.screenshot({
        path: "test-results/shipment-details-desktop.png",
        fullPage: true,
        animations: "disabled",
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: "test-results/shipment-details-mobile.png",
        fullPage: true,
        animations: "disabled",
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await page.setViewportSize({ width: 1280, height: 900 });
    }
    await expect(page.getByText("Latitude", { exact: true })).toHaveCount(0);
    await expect(
      page.getByText("Shipment number", { exact: true }),
    ).toHaveCount(0);
    if (type === "customs_clearance")
      await expect(page.getByText("Locations", { exact: true })).toHaveCount(0);
    await openForm(page, "Accept at office");
    await page
      .getByRole("button", { name: "Accept at office", exact: true })
      .click();
    await expect(
      page.locator("summary").filter({ hasText: "Dispatch to destination" }),
    ).toBeVisible();
    await openForm(page, "Dispatch to destination");
    await page
      .getByRole("button", { name: "Dispatch to destination", exact: true })
      .click();
    await expect(
      page
        .locator("summary")
        .filter({ hasText: "Mark delivered to destination" }),
    ).toBeVisible();
    await openForm(page, "Mark delivered to destination");
    await page
      .getByRole("button", {
        name: "Mark delivered to destination",
        exact: true,
      })
      .click();
    await expect(
      page.getByText(
        "This shipment is complete. No further status changes are available.",
      ),
    ).toBeVisible();
  }
  const accept = await writes("/v1/shipments/shipment-1/accept");
  expect(accept).toHaveLength(3);
  expect(
    accept.every(
      (call: any) =>
        call.key &&
        call.body.expectedVersion === 3 &&
        Object.keys(call.body).length === 1,
    ),
  ).toBeTruthy();
  const transitions = await writes("/v1/shipments/shipment-1/transitions");
  expect(transitions).toHaveLength(6);
  expect(transitions[0].body).toEqual({
    expectedVersion: 4,
    targetStatus: "onrouteToDestination",
  });
  expect(transitions[1].body).toEqual({
    expectedVersion: 5,
    targetStatus: "deliveredToDestination",
  });
});

test("shipment actions block unpaid dispatch, stale updates and non-super access", async ({
  page,
}) => {
  await login(page);
  await control({
    shipment: {
      status: "sentToHq",
      payment: { status: "unpaid", method: "cash" },
    },
  });
  await page.goto("/shipment-orders/shipment-1");
  await expect(
    page.getByText(
      "Payment must be confirmed and outstanding assessments settled before dispatch or delivery.",
    ),
  ).toBeVisible();
  await expect(
    page.locator("summary").filter({ hasText: "Dispatch to destination" }),
  ).toHaveCount(0);
  await control({
    shipment: { status: "acceptedByRider" },
    shipmentConflict: true,
  });
  await page.reload();
  await openForm(page, "Cancel shipment");
  await page
    .getByLabel("Cancellation reason")
    .fill("Customer requested cancellation");
  await page
    .getByRole("button", { name: "Cancel shipment", exact: true })
    .click();
  await expect(
    page.locator("#workspace-content").getByRole("alert"),
  ).toContainText("Shipment changed");
  await page
    .getByRole("button", { name: "Refresh", exact: true })
    .first()
    .click();
  await openForm(page, "Cancel shipment");
  await page
    .getByLabel("Cancellation reason")
    .fill("Customer requested cancellation");
  await page
    .getByRole("button", { name: "Cancel shipment", exact: true })
    .click();
  await expect(
    page.getByText(
      "This shipment is complete. No further status changes are available.",
    ),
  ).toBeVisible();
  const calls = await writes("/v1/shipments/shipment-1/cancel");
  expect(calls[1].body.expectedVersion).toBe(calls[0].body.expectedVersion + 1);
  for (const role of ["regular", "customercare"]) {
    await control({
      adminType: role,
      shipment: { status: "placed", version: 10 },
    });
    await page.reload();
    await expect(
      page.locator("summary").filter({ hasText: "Accept at office" }),
    ).toHaveCount(0);
    const response = await page.evaluate(() =>
      fetch("/api/proxy/v1/shipments/shipment-1/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "denied-shipment-command",
        },
        body: JSON.stringify({ expectedVersion: 10 }),
      }).then((r) => r.status),
    );
    expect(response).toBe(403);
  }
});
