import { test, expect, type Page } from "@playwright/test";

test.setTimeout(120000);

async function control(body: Record<string, unknown> = {}) {
  const response = await fetch("http://127.0.0.1:4319/control", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return (await response.json()).data;
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
async function open(page: Page) {
  await page.goto("/ride-hailing/ride-1");
  const form = page.locator("details").filter({ hasText: "Cancel ride" });
  await form.locator("summary").click();
  await form.getByLabel("Cancellation reason").fill(" Emergency cancellation ");
  return form;
}
test("cancels an in-progress ride with the latest version and authenticated headers", async ({
  page,
}, testInfo) => {
  await login(page);
  await control({ rideStatus: "onroute" });
  const form = await open(page);
  await expect(form).toContainText("customer is not automatically refunded");
  await page.screenshot({
    path: testInfo.outputPath("ride-cancel-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("ride-cancel-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  await expect(form).toContainText(
    "Dispute refunds remain a separate financial action",
  );
  await control({ rideVersion: 7 });
  await form.getByRole("button", { name: "Cancel ride", exact: true }).click();
  await expect(
    page.locator("details").filter({ hasText: "Cancel ride" }),
  ).toHaveCount(0);
  const calls = (await control()).records.filter((r: any) =>
    r.path.endsWith("/ride-1/cancel"),
  );
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({
    account: "user",
    authorization: "Bearer pnd_a2_private",
    body: { expectedVersion: 7, reason: "Emergency cancellation" },
  });
  expect(calls[0].key).toBeTruthy();
});
test("hides cancellation for completed and cancelled rides, including numeric statuses", async ({
  page,
}) => {
  await login(page);
  await page.goto("/ride-hailing/ride-1");
  await expect(
    page.getByRole("heading", { name: "Order information", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  for (const rideStatus of ["completed", "cancelled", 3, 4, "3", "4"]) {
    await control({ rideStatus });
    const refreshed = page.waitForResponse((response) =>
      response.url().endsWith("/api/proxy/v1/admin/rides/ride-1"),
    );
    await page.getByRole("button", { name: "Refresh order details" }).click();
    expect((await (await refreshed).json()).data.status).toBe(rideStatus);
    await expect(
      page.getByRole("heading", { name: "Order information", exact: true }),
    ).toBeVisible({ timeout: 30000 });
    await expect(
      page.locator("summary").filter({ hasText: "Cancel ride" }),
    ).toHaveCount(0);
  }
});
test("blocks a ride that completed after the page loaded", async ({ page }) => {
  await login(page);
  const form = await open(page);
  await control({ rideStatus: "completed", rideVersion: 5 });
  await form.getByRole("button", { name: "Cancel ride", exact: true }).click();
  await expect(form).toContainText("This ride can no longer be cancelled");
  expect(
    (await control()).records.filter((r: any) => r.path.endsWith("/cancel")),
  ).toHaveLength(0);
});
test("retries an uncertain cancellation with identical body and operation key", async ({
  page,
}) => {
  await login(page);
  await control({ rideCancelFailure: true });
  const form = await open(page);
  await form.getByRole("button", { name: "Cancel ride", exact: true }).click();
  await expect(form).toContainText(
    "Retry sends the same details and operation key",
  );
  await form.getByRole("button", { name: "Cancel ride", exact: true }).click();
  await expect(
    page.locator("summary").filter({ hasText: "Cancel ride" }),
  ).toHaveCount(0);
  const calls = (await control()).records.filter((r: any) =>
    r.path.endsWith("/ride-1/cancel"),
  );
  expect(calls).toHaveLength(2);
  expect(calls[1].key).toBe(calls[0].key);
  expect(calls[1].body).toEqual(calls[0].body);
});
test("regular admins cannot cancel through the screen or proxy", async ({
  page,
}) => {
  await login(page, "regular");
  await page.goto("/ride-hailing/ride-1");
  await expect(
    page.getByRole("heading", { name: "Order information", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("summary").filter({ hasText: "Cancel ride" }),
  ).toHaveCount(0);
  const response = await page.request.post(
    "/api/proxy/v1/admin/rides/ride-1/cancel",
    {
      headers: {
        "Idempotency-Key": "test-cancel-denied",
        Origin: "http://localhost:4320",
      },
      data: { expectedVersion: 4, reason: "Emergency cancellation" },
    },
  );
  expect(response.status()).toBe(403);
  expect(
    (await control()).records.filter((r: any) => r.path.endsWith("/cancel")),
  ).toHaveLength(0);
});
