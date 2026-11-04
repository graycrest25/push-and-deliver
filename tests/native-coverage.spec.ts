import { test, expect, type Page } from "@playwright/test";
async function control(body: Record<string, unknown>) {
  return (
    await (
      await fetch("http://127.0.0.1:4319/control", {
        method: "POST",
        body: JSON.stringify(body),
      })
    ).json()
  ).data;
}
async function login(page: Page, role = "super") {
  await control({ reset: true, latest: true, adminType: role });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#workspace-content")).toBeVisible();
}
const coverage = (
  report = "account_summary",
  ready = true,
  queueStatus: string | null = "completed",
) => ({
  report,
  coverage: {
    complete: ready,
    basis: "active_postgres_records",
    timezone: "Africa/Lagos",
    updatedAt: "2026-11-04T00:57:00Z",
  },
  diagnostics: {
    successfulBackfill: ready,
    authoritativeRecords: 44,
    capturedRecords: 44,
    capturePending: 0,
    projectionPending: ready ? 0 : 2,
  },
  lastBackfill: queueStatus
    ? {
        status: ready
          ? "succeeded"
          : queueStatus === "dead"
            ? "failed"
            : "pending",
        queueStatus,
        processed: ready ? 381 : 40,
        attempts: 1,
        completedAt: ready ? "2026-11-04T08:25:00Z" : null,
      }
    : null,
});
test("report coverage presents readable readiness, diagnostics and backfill groups", async ({
  page,
}) => {
  await login(page);
  await page.route("**/api/proxy/v1/admin/analytics/coverage?*", (route) =>
    route.fulfill({ json: { data: coverage() } }),
  );
  await page.goto("/analytics-coverage");
  const readiness = page.getByRole("region", { name: "Source readiness" });
  await expect(readiness).toContainText("Complete");
  await expect(readiness.getByText("Ready", { exact: true })).toHaveCount(3);
  await expect(readiness).toContainText("Current PostgreSQL records");
  const diagnostics = page.getByRole("region", {
    name: "Processing diagnostics",
  });
  await expect(diagnostics).toContainText("Authoritative records");
  await expect(
    page.getByRole("region", { name: "Latest backfill" }),
  ).toContainText("Completed");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/report-coverage-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.screenshot({
    path: "test-results/report-coverage-desktop-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 2142, height: 1200 });
  await page.screenshot({
    path: "test-results/report-coverage-user-2142.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/report-coverage-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(
    (await control({})).records.filter(
      (row: any) => row.path === "/v1/admin/analytics/backfills",
    ),
  ).toHaveLength(0);
});
test("an explicit shared order rebuild retries unchanged, polls readiness and refreshes both totals", async ({
  page,
}) => {
  await login(page);
  let mode = "blocked",
    reads = 0;
  const posts: { key: string | undefined; body: any }[] = [],
    types: string[] = [];
  await page.route("**/api/proxy/v1/admin/analytics/coverage?*", (route) => {
    reads++;
    return route.fulfill({
      json: {
        data: coverage(
          "order_summary",
          mode === "complete",
          mode === "blocked"
            ? null
            : mode === "complete"
              ? "completed"
              : "running",
        ),
      },
    });
  });
  await page.route("**/api/proxy/v1/admin/analytics/backfills", (route) => {
    posts.push({
      key: route.request().headers()["idempotency-key"],
      body: route.request().postDataJSON(),
    });
    if (posts.length === 1)
      return route.fulfill({
        status: 503,
        json: { error: { message: "Rebuild response unavailable" } },
      });
    mode = "running";
    return route.continue();
  });
  await page.route(
    "**/api/proxy/v1/admin/analytics/order-summary?*",
    (route) => {
      const type = new URL(route.request().url()).searchParams.get("type")!;
      types.push(type);
      return route.fulfill({
        json: { data: { type, total: type === "shipment" ? 31 : 9 } },
      });
    },
  );
  await page.goto("/analytics-coverage?report=order_summary");
  await expect(page.getByLabel("Report", { exact: true })).toHaveValue(
    "order_summary",
  );
  await expect(
    page.getByText(/not ready for complete business totals/),
  ).toBeVisible();
  expect(posts).toHaveLength(0);
  const form = page.locator("details").filter({
    has: page.locator("summary").filter({ hasText: "Rebuild order reports" }),
  });
  await form.locator("summary").click();
  const rebuild = form.getByRole("button", {
    name: "Rebuild order reports",
    exact: true,
  });
  await rebuild.click();
  await expect(form.getByRole("alert")).toContainText(
    "Rebuild response unavailable",
  );
  expect(posts).toHaveLength(1);
  await rebuild.click();
  await expect(
    page.getByText(/Checking readiness every 10 seconds/),
  ).toBeVisible();
  expect(posts).toHaveLength(2);
  expect(posts[1]).toEqual(posts[0]);
  expect(posts[0].body).toEqual({ report: "order_summary", resume: false });
  const previous = reads;
  mode = "complete";
  await expect.poll(() => reads, { timeout: 20000 }).toBeGreaterThan(previous);
  await expect(
    page.getByRole("region", { name: "Order totals", exact: true }),
  ).toContainText("31");
  await expect(
    page.getByRole("region", { name: "Order totals", exact: true }),
  ).toContainText("9");
  expect(new Set(types)).toEqual(new Set(["shipment", "ride-courier"]));
  const calls = (await control({})).records.filter(
    (row: any) => row.path === "/v1/admin/analytics/backfills",
  );
  expect(calls).toHaveLength(1);
  expect(calls[0].authorization).toBe("Bearer pnd_a2_private");
  expect(calls[0].account).toBe("user");
  expect(calls[0].body).toEqual(posts[0].body);
});
test("a new order rebuild gets a new key after an uncertain earlier job completes", async ({
  page,
}) => {
  await login(page);
  let mode = "blocked";
  let completedAt = "2026-11-03T08:25:00Z";
  const posts: { key: string | undefined; body: any }[] = [];
  await page.route("**/api/proxy/v1/admin/analytics/coverage?*", (route) => {
    const data = coverage(
      "order_summary",
      mode === "complete",
      mode === "running" ? "running" : "completed",
    );
    data.lastBackfill!.completedAt = mode === "running" ? null : completedAt;
    return route.fulfill({ json: { data } });
  });
  await page.route("**/api/proxy/v1/admin/analytics/order-summary?*", (route) =>
    route.fulfill({ json: { data: { total: 12 } } }),
  );
  await page.route("**/api/proxy/v1/admin/analytics/backfills", (route) => {
    posts.push({
      key: route.request().headers()["idempotency-key"],
      body: route.request().postDataJSON(),
    });
    mode = "running";
    return route.fulfill(
      posts.length === 1
        ? { status: 503, json: { error: { message: "Rebuild response lost" } } }
        : { status: 202, json: { data: { jobId: "next-rebuild" } } },
    );
  });
  await page.goto("/analytics-coverage?report=order_summary");
  const submit = async () => {
    const form = page
      .locator("details")
      .filter({
        has: page
          .locator("summary")
          .filter({ hasText: "Rebuild order reports" }),
      });
    await form.locator("summary").click();
    await form
      .getByRole("button", { name: "Rebuild order reports", exact: true })
      .click();
  };
  await submit();
  await expect(
    page.locator("#workspace-content").getByRole("alert"),
  ).toContainText("Rebuild response lost");
  await page.reload();
  await expect(
    page.getByText(/Checking readiness every 10 seconds/),
  ).toBeVisible();
  mode = "complete";
  completedAt = "2026-11-04T08:25:00Z";
  await page
    .getByRole("button", { name: "Refresh coverage", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Source readiness" }),
  ).toContainText("Complete");
  mode = "blocked";
  await page
    .getByRole("button", { name: "Refresh coverage", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Source readiness" }),
  ).toContainText("Not ready");
  await submit();
  await expect.poll(() => posts.length).toBe(2);
  expect(posts[1].body).toEqual(posts[0].body);
  expect(posts[1].key).not.toBe(posts[0].key);
});

test("pending order jobs poll within a bound, stop on dead jobs and never enqueue automatically", async ({
  page,
}) => {
  await login(page);
  let dead = false,
    reads = 0;
  await page.route("**/api/proxy/v1/admin/analytics/coverage?*", (route) => {
    reads++;
    return route.fulfill({
      json: {
        data: coverage("order_summary", false, dead ? "dead" : "pending"),
      },
    });
  });
  await page.goto("/analytics-coverage?report=order_summary");
  await expect(
    page.getByText(/Checking readiness every 10 seconds/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Rebuild order reports", exact: true }),
  ).toHaveCount(0);
  const before = reads;
  await expect.poll(() => reads, { timeout: 20000 }).toBeGreaterThan(before);
  // Advance the deadline without replacing timers that already exist.
  await page.evaluate(() => {
    const now = Date.now;
    Date.now = () => now() + 121000;
  });
  await expect(
    page.getByText(/Automatic checks stopped after 2 minutes/),
  ).toBeVisible();
  const stopped = reads;
  await page.waitForTimeout(11000);
  expect(reads).toBe(stopped);
  dead = true;
  await page
    .getByRole("button", { name: "Continue checking readiness" })
    .click();
  await expect(
    page.locator("#workspace-content").getByRole("alert"),
  ).toContainText("analytics worker job failed");
  await expect(
    page.getByRole("button", { name: "Rebuild order reports", exact: true }),
  ).toHaveCount(0);
  const failed = reads;
  await page.waitForTimeout(11000);
  expect(reads).toBe(failed);
  expect(
    (await control({})).records.filter(
      (row: any) => row.path === "/v1/admin/analytics/backfills",
    ),
  ).toHaveLength(0);
  await expect(
    page.getByRole("region", { name: "Order totals", exact: true }),
  ).toHaveCount(0);
});
test("coverage and rebuild requests stay super-only and unavailable totals stay unavailable", async ({
  page,
}) => {
  await login(page, "regular");
  const statuses = await page.evaluate(async () =>
    Promise.all(
      [
        fetch("/api/proxy/v1/admin/analytics/coverage?report=order_summary"),
        fetch("/api/proxy/v1/admin/analytics/backfills", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({ report: "order_summary", resume: false }),
        }),
      ].map(async (request) => (await request).status),
    ),
  );
  expect(statuses).toEqual([403, 403]);
  await page.route("**/api/proxy/v1/admin/analytics/order-summary?*", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { message: "Reporting sources are not ready" } },
    }),
  );
  await page.goto("/dashboard");
  const orders = page.getByRole("region", {
    name: "Order totals",
    exact: true,
  });
  await expect(orders.getByRole("alert")).toContainText(
    "Reporting sources are not ready",
  );
  expect(
    (await control({})).records.some(
      (row: any) => row.path === "/v1/admin/analytics/backfills",
    ),
  ).toBeFalsy();
});
