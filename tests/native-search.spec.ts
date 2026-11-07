import { test, expect, type Page } from "@playwright/test";
test.setTimeout(90_000);

async function control(body: Record<string, unknown> = {}) {
  return (
    await (
      await fetch("http://127.0.0.1:4319/control", {
        method: "POST",
        body: JSON.stringify(body),
      })
    ).json()
  ).data;
}
async function login(page: Page) {
  await control({
    reset: true,
    latest: true,
    adminType: "regular",
    ridePages: true,
  });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#workspace-content")).toBeVisible({
    timeout: 30_000,
  });
}
function response(
  page: Page,
  path: string,
  param: string,
  value: string | null,
) {
  return page.waitForResponse((r) => {
    const url = new URL(r.url());
    return (
      url.pathname === `/api/proxy${path}` &&
      url.searchParams.get(param) === value &&
      r.status() === 200
    );
  });
}
test("directory sends email and formatted phone queries without losing plus signs", async ({
  page,
}) => {
  await login(page);
  for (const type of ["users", "riders"]) {
    await page.goto(`/${type}`);
    const search = page.getByLabel("Search name, email or phone");
    for (const query of ["someone+ops@gmail.com", "+234 (80) 123-45.678"]) {
      const pending = response(page, "/v1/admin/users", "q", query);
      await search.fill(query);
      const result = await pending;
      expect(result.url()).toContain("%2B");
      const request = (await control()).records
        .filter((r: any) => r.path === "/v1/admin/users" && r.query.q === query)
        .at(-1);
      expect(request).toMatchObject({
        account: "user",
        authorization: "Bearer pnd_a2_private",
        query: { q: query, type, limit: "100" },
      });
      expect(request.query.cursor).toBeUndefined();
    }
  }
});
for (const kind of ["ride", "shipment"]) {
  test(`${kind} order ID search preserves filters, resets cursors and clears to all orders`, async ({
    page,
  }) => {
    await login(page);
    const ride = kind === "ride";
    const path = ride ? "/v1/admin/rides" : "/v1/shipments";
    await page.goto(ride ? "/ride-hailing" : "/shipment-orders");
    await page.getByLabel("Origin city", { exact: true }).selectOption("lagos");
    await page
      .getByLabel("Status", { exact: true })
      .selectOption(ride ? "accepted" : "placed");
    if (!ride)
      await page
        .getByLabel("Shipment type", { exact: true })
        .selectOption("express");
    await page
      .getByRole("button", { name: "Apply filters", exact: true })
      .click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      page.getByText("Page 2 · 1 records on this page"),
    ).toBeVisible();
    const search = page.getByLabel(`Search ${kind} order ID`);
    const pending = response(page, path, "orderId", `${kind}-1`);
    await search.fill(`${kind}-1`);
    await pending;
    await expect(
      page.getByText("Page 1 · 1 records on this page"),
    ).toBeVisible();
    let request = (await control()).records
      .filter((r: any) => r.path === path && r.query.orderId === `${kind}-1`)
      .at(-1);
    expect(request).toMatchObject({
      account: "user",
      authorization: "Bearer pnd_a2_private",
      query: {
        city: "lagos",
        status: ride ? "accepted" : "placed",
        limit: "100",
        orderId: `${kind}-1`,
      },
    });
    if (!ride) expect(request.query.shipmentType).toBe("express");
    expect(request.query.cursor).toBeUndefined();
    const missing = response(page, path, "orderId", `${kind.toUpperCase()}-1`);
    await search.fill(`${kind.toUpperCase()}-1`);
    await missing;
    await expect(
      page.getByText("Page 1 · 0 records on this page"),
    ).toBeVisible();
    const cleared = response(page, path, "orderId", null);
    await search.clear();
    await cleared;
    await expect(
      page.getByText("Page 1 · 1 records on this page"),
    ).toBeVisible();
    request = (await control()).records
      .filter((r: any) => r.path === path)
      .at(-1);
    expect(request.query.orderId).toBeUndefined();
    expect(request.query.cursor).toBeUndefined();
    await page.screenshot({ path: `/tmp/pnd-${kind}-search-desktop.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(search).toBeVisible();
    await page.screenshot({ path: `/tmp/pnd-${kind}-search-mobile.png` });
    const box = await search.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  });
}
