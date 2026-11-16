import { test, expect, type Page } from "@playwright/test";

test.setTimeout(60_000);

async function control(body: Record<string, unknown> = {}) {
  return fetch("http://127.0.0.1:4319/control", {
    method: "POST",
    body: JSON.stringify(body),
  })
    .then((r) => r.json())
    .then((r) => r.data);
}
async function login(page: Page, adminType = "regular") {
  await control({ reset: true, latest: true, adminType, ridePages: true });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#workspace-content")).toBeVisible({
    timeout: 30_000,
  });
}
const listCard = (page: Page) =>
  page.locator('[data-slot="card"]').filter({
    has: page.getByLabel("Name", { exact: true }),
  });
async function lastRead(path: string) {
  return (await control()).records.filter((r: any) => r.path === path).at(-1);
}

for (const type of ["users", "riders"]) {
  test(`${type} names are debounced, combined with q, reset pagination and reach exports`, async ({
    page,
  }) => {
    await login(page);
    await page.goto(`/${type}`);
    const list = listCard(page);
    await expect(list.getByLabel("Name", { exact: true })).toHaveAttribute(
      "maxlength",
      "100",
    );
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect
      .poll(async () => (await lastRead("/v1/admin/users")).query.cursor)
      .toBe(`directory-${type}`);
    await list.getByLabel("Name", { exact: true }).fill("Pa");
    await list.getByLabel("Name", { exact: true }).fill("  Paul  ");
    await expect
      .poll(async () => (await lastRead("/v1/admin/users")).query.name)
      .toBe("Paul");
    let read = await lastRead("/v1/admin/users");
    expect(read).toMatchObject({
      account: "user",
      authorization: "Bearer pnd_a2_private",
      query: { type, name: "Paul" },
    });
    expect(read.query.cursor).toBeUndefined();
    expect(
      (await control()).records.filter(
        (r: any) => r.path === "/v1/admin/users" && r.query.name === "Pa",
      ),
    ).toHaveLength(0);
    await list
      .getByLabel("Search name, email or phone")
      .fill("paul+ops@gmail.com");
    await expect
      .poll(async () => (await lastRead("/v1/admin/users")).query.q)
      .toBe("paul+ops@gmail.com");
    read = await lastRead("/v1/admin/users");
    expect(read.query).toMatchObject({ name: "Paul", q: "paul+ops@gmail.com" });

    const exports: URL[] = [];
    await page.route(`**/api/proxy/v1/admin/reports/${type}?*`, (route) => {
      exports.push(new URL(route.request().url()));
      return route.fulfill({ contentType: "text/csv", body: "Name\nPaul\n" });
    });
    const panel = page.locator("details").filter({
      has: page.locator("summary").filter({ hasText: `Export ${type}` }),
    });
    await panel.locator("summary").click();
    await expect(panel.getByLabel("Name", { exact: true })).toHaveValue("Paul");
    await expect(panel.getByLabel("Name", { exact: true })).toHaveAttribute(
      "maxlength",
      "100",
    );
    const download = page.waitForEvent("download");
    await panel
      .getByRole("button", { name: "Download export", exact: true })
      .click();
    expect((await download).suggestedFilename()).toBe(`${type}.csv`);
    expect(Object.fromEntries(exports[0].searchParams)).toEqual({
      name: "Paul",
      q: "paul+ops@gmail.com",
      format: "csv",
    });

    await list.getByLabel("Name", { exact: true }).fill(" ");
    await list.getByLabel("Search name, email or phone").clear();
    await expect
      .poll(async () => (await lastRead("/v1/admin/users")).query)
      .toEqual({ type, limit: "100" });
  });
}

test("application name, q and registered email combine with existing restrictions", async ({
  page,
}) => {
  await login(page);
  const reads: URL[] = [];
  await page.route("**/api/proxy/v1/admin/riders/applications?*", (route) => {
    reads.push(new URL(route.request().url()));
    return route.fulfill({
      json: {
        data: {
          items: [{ uid: "paul", username: "Paul" }],
          nextCursor: "next-app",
        },
      },
    });
  });
  await page.goto("/rider-applications");
  await page.getByLabel("Vehicle type", { exact: true }).selectOption("bike");
  await page
    .getByLabel("Verification status", { exact: true })
    .selectOption("verified");
  await page
    .getByLabel("Exact email address", { exact: true })
    .fill("Paul+ops@gmail.com");
  await page.getByLabel("Start date", { exact: true }).fill("2026-11-01");
  await page.getByLabel("End date", { exact: true }).fill("2026-11-08");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect
    .poll(() => reads.at(-1)?.searchParams.get("email"))
    .toBe("Paul+ops@gmail.com");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect
    .poll(() => reads.at(-1)?.searchParams.get("cursor"))
    .toBe("next-app");
  await page.getByLabel("Name", { exact: true }).fill("Paul");
  await page.getByLabel("Search name or registered email").fill("Paul");
  await expect.poll(() => reads.at(-1)?.searchParams.get("q")).toBe("Paul");
  expect(Object.fromEntries(reads.at(-1)!.searchParams)).toEqual({
    status: "pending",
    vehicleType: "bike",
    verificationStatus: "verified",
    name: "Paul",
    q: "Paul",
    email: "Paul+ops@gmail.com",
    startDate: "2026-11-01",
    endDate: "2026-11-08",
    limit: "25",
  });
  expect(reads.at(-1)!.href).toContain("%2B");
  await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute(
    "maxlength",
    "100",
  );
});

test("administrator lookup sends name and q to the search route", async ({
  page,
}) => {
  await login(page, "super");
  await page.goto("/admin/users");
  await page.getByLabel("Name", { exact: true }).fill("Paul");
  await page.getByLabel("Search name, email or phone").fill("+234 800");
  await expect
    .poll(async () => (await lastRead("/v1/admin/users/search"))?.query)
    .toEqual({
      type: "users",
      name: "Paul",
      q: "+234 800",
      limit: "25",
    });
});

for (const ride of [true, false]) {
  test(`${ride ? "ride" : "shipment"} city options preserve filters, use user authentication and reset cursors`, async ({
    page,
  }) => {
    await login(page);
    const path = ride ? "/v1/admin/rides" : "/v1/shipments";
    await page.goto(ride ? "/ride-hailing" : "/shipment-orders");
    const city = page.getByLabel("Origin city", { exact: true });
    await expect(city.locator("option")).toHaveText([
      "All cities",
      "Lagos",
      "Ibadan",
      "Unknown",
    ]);
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
    for (const value of ["lagos", "ibadan", "unknown", ""]) {
      await expect(
        page.getByRole("button", { name: "Next", exact: true }),
      ).toBeEnabled();
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect
        .poll(async () => !!(await lastRead(path)).query.cursor)
        .toBe(true);
      await city.selectOption(value);
      await page
        .getByRole("button", { name: "Apply filters", exact: true })
        .click();
      await expect
        .poll(async () => (await lastRead(path)).query)
        .toEqual({
          ...(value ? { city: value } : {}),
          status: ride ? "accepted" : "placed",
          ...(!ride ? { shipmentType: "express" } : {}),
          limit: "100",
        });
      expect(await lastRead(path)).toMatchObject({
        account: "user",
        authorization: "Bearer pnd_a2_private",
      });
    }
    await expect(
      page.getByText(
        ride
          ? /Origin city is the ride pickup city/
          : /Origin city is the shipment sending-office city/,
      ),
    ).toBeVisible();
  });
}

test("an outdated name response cannot replace the current search results", async ({
  page,
}) => {
  await login(page);
  let releaseOld!: () => void;
  let oldFinished!: () => void;
  const oldCompleted = new Promise<void>((resolve) => {
    oldFinished = resolve;
  });
  const oldResponse = new Promise<void>((resolve) => {
    releaseOld = resolve;
  });
  const names: string[] = [];
  await page.route("**/api/proxy/v1/admin/users?*", async (route) => {
    const name =
      new URL(route.request().url()).searchParams.get("name") || "Initial";
    names.push(name);
    if (name === "Old") await oldResponse;
    await route
      .fulfill({
        json: {
          data: { items: [{ uid: name, username: name }], nextCursor: null },
        },
      })
      .catch(() => {});
    if (name === "Old") oldFinished();
  });
  await page.goto("/users");
  const name = listCard(page).getByLabel("Name", { exact: true });
  await name.fill("Old");
  await expect.poll(() => names.includes("Old")).toBe(true);
  await name.fill("Current");
  await expect(
    page.getByRole("cell", { name: "Current", exact: true }),
  ).toBeVisible();
  releaseOld();
  await oldCompleted;
  await expect(
    page.getByRole("cell", { name: "Current", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Old", exact: true }),
  ).toHaveCount(0);
});
