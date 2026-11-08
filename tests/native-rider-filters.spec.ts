import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
test.setTimeout(90_000);
async function login(page: Page) {
  await fetch("http://127.0.0.1:4319/control", {
    method: "POST",
    body: JSON.stringify({ reset: true, latest: true, adminType: "regular" }),
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#workspace-content")).toBeVisible();
}
test("rider filters and online labels apply to the directory and paginated JSON exports", async ({
  page,
}) => {
  await login(page);
  const reads: URL[] = [],
    exports: URL[] = [];
  await page.route("**/api/proxy/v1/admin/users?*", (route) => {
    reads.push(new URL(route.request().url()));
    return route.fulfill({
      json: {
        data: {
          items: [
            { uid: "one", username: "Online Rider", onlineStatus: true },
            { uid: "two", username: "Offline Rider", onlineStatus: false },
            { uid: "three", username: "Unknown Rider", onlineStatus: null },
          ],
          nextCursor: "next-rider",
        },
      },
    });
  });
  await page.route("**/api/proxy/v1/admin/reports/riders?*", (route) => {
    const url = new URL(route.request().url());
    exports.push(url);
    if (url.searchParams.get("format") === "csv")
      return route.fulfill({
        contentType: "text/csv",
        headers: {
          "X-Next-Cursor": url.searchParams.has("cursor") ? "" : "csv-next",
        },
        body: 'Full name,Phone number,Wallet balance\nOnline Rider,"+2348000000000",Unavailable\n',
      });
    return route.fulfill({
      json: {
        data: {
          items: [
            {
              fullName: "Online Rider",
              createdAt: "2026-11-01T00:00:00Z",
              email: "person+ops@gmail.com",
              onlineStatusLabel: "Online",
              verificationStatusLabel: "Verified",
              vehicleTypeLabel: "Motorbike",
              phoneNumber: "+2348000000000",
              walletBalanceMinor: null,
              currency: "NGN",
              completedRides: 2,
              cancelledRides: 1,
              ongoingOrders: 0,
            },
          ],
          nextCursor: url.searchParams.has("cursor") ? null : "export-next",
        },
      },
    });
  });
  await page.goto("/riders");
  const list = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByLabel("Search name, email or phone") });
  await expect(
    page.getByRole("row").filter({ hasText: "Online Rider" }),
  ).toContainText("Online");
  await expect(
    page.getByRole("row").filter({ hasText: "Offline Rider" }),
  ).toContainText("Offline");
  await expect(
    page.getByRole("row").filter({ hasText: "Unknown Rider" }),
  ).toContainText("Unknown");
  await list.getByLabel("Vehicle type", { exact: true }).selectOption("bike");
  expect(
    await list
      .getByLabel("Vehicle type", { exact: true })
      .locator("option")
      .allTextContents(),
  ).toEqual(["All", "Motorbike", "Not assigned"]);
  await list
    .getByLabel("Verification status", { exact: true })
    .selectOption("verified");
  await list.getByLabel("Start date", { exact: true }).fill("2026-11-01");
  await list.getByLabel("End date", { exact: true }).fill("2026-11-08");
  await list
    .getByLabel("Exact email address", { exact: true })
    .fill("person+ops@gmail.com");
  await list
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect
    .poll(() => reads.at(-1)?.searchParams.get("vehicleType"))
    .toBe("bike");
  expect(reads.at(-1)?.searchParams.get("limit")).toBe("100");
  expect(reads.at(-1)?.href).toContain("%2B");
  const panel = page.locator("details").filter({
    has: page.locator("summary").filter({ hasText: "Export riders" }),
  });
  await panel.locator("summary").click();
  await expect(
    panel.getByRole("combobox", { name: "Vehicle type", exact: true }),
  ).toHaveValue("bike");
  await expect(panel.getByLabel("Start date", { exact: true })).toHaveValue(
    "2026-11-01",
  );
  await panel
    .getByRole("combobox", { name: "Export format", exact: true })
    .selectOption("json");
  const download = page.waitForEvent("download");
  await panel
    .getByRole("button", { name: "Download export", exact: true })
    .click();
  const saved = await download;
  const exported = JSON.parse(await readFile((await saved.path())!, "utf8"));
  expect(exported.items[0]).toMatchObject({
    phoneNumber: "+2348000000000",
    walletBalanceMinor: null,
    completedRides: 2,
    cancelledRides: 1,
    ongoingOrders: 0,
  });
  await expect(
    panel.getByText("More records are available.", { exact: false }),
  ).toBeVisible();
  await expect(
    panel.getByRole("combobox", { name: "Vehicle type", exact: true }),
  ).toBeDisabled();
  await panel.getByRole("button", { name: "Download next page" }).click();
  await expect.poll(() => exports.length).toBe(2);
  const first = Object.fromEntries(exports[0].searchParams),
    second = Object.fromEntries(exports[1].searchParams);
  expect(first).toMatchObject({
    vehicleType: "bike",
    verificationStatus: "verified",
    email: "person+ops@gmail.com",
    startDate: "2026-11-01",
    endDate: "2026-11-08",
    format: "json",
    limit: "2000",
  });
  expect(second).toEqual({ ...first, cursor: "export-next" });
  await expect(
    panel.getByText("Export complete.", { exact: false }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Start new export" }).click();
  await panel
    .getByRole("combobox", { name: "Export format", exact: true })
    .selectOption("csv");
  const csvDownload = page.waitForEvent("download");
  await panel
    .getByRole("button", { name: "Download export", exact: true })
    .click();
  const csv = await csvDownload;
  expect(await readFile((await csv.path())!, "utf8")).toContain(
    '"+2348000000000",Unavailable',
  );
  await panel.getByRole("button", { name: "Download next page" }).click();
  await expect.poll(() => exports.length).toBe(4);
  expect(Object.fromEntries(exports[3].searchParams)).toEqual({
    ...first,
    format: "csv",
    cursor: "csv-next",
  });
});

test("application vehicle filters use bike and unassigned with saved online status", async ({
  page,
}) => {
  await login(page);
  const reads: URL[] = [];
  await page.route("**/api/proxy/v1/admin/riders/applications?*", (route) => {
    reads.push(new URL(route.request().url()));
    return route.fulfill({
      json: {
        data: {
          items: [{ uid: "rider-one", username: "Unassigned Rider" }],
          nextCursor: null,
        },
      },
    });
  });
  await page.route(
    "**/api/proxy/v1/admin/riders/rider-one/application",
    (route) =>
      route.fulfill({
        json: {
          data: {
            uid: "rider-one",
            version: 1,
            applicant: {
              imageUrl: null,
              onlineStatus: false,
              onlineStatusLabel: "Offline",
            },
            documents: [],
            approvalBlockers: [],
            allowedDecisions: [],
          },
        },
      }),
  );
  await page.goto("/rider-applications");
  await page
    .getByLabel("Vehicle type", { exact: true })
    .selectOption("unassigned");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect
    .poll(() => reads.at(-1)?.searchParams.get("vehicleType"))
    .toBe("unassigned");
  await page
    .getByRole("link", { name: "Open Unassigned Rider", exact: true })
    .click();
  const applicant = page.getByRole("region", {
    name: "Applicant information",
    exact: true,
  });
  await expect(applicant.getByText("Offline", { exact: true })).toBeVisible();
  await expect(applicant.getByText("No photo", { exact: true })).toBeVisible();
});
