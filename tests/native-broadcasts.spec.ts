import { test, expect, type Page } from "@playwright/test";

const broadcast = {
  id: "broadcast-1",
  audience: "rider",
  title: "Office hours",
  body: "Please check the updated office hours.",
  status: "processing",
  createdAt: "2026-11-08T12:00:00Z",
  createdBy: "admin-1",
  expiresAt: "2026-11-09T12:00:00Z",
  resendOf: null,
  expansion: {
    total: 2,
    pending: 0,
    processing: 0,
    retryWait: 0,
    done: 2,
    failed: 0,
  },
  recipients: {
    total: 100,
    pending: 30,
    processing: 2,
    retryWait: 8,
    done: 58,
    failed: 2,
  },
  providerAcceptedPushes: 50,
  providerAcceptedRecipients: 48,
};
async function mount(page: Page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (route.request().resourceType() === "document")
      return route.fulfill({
        contentType: "text/html",
        body: '<html><body><div id="root"></div><script src="/__component.js"></script></body></html>',
      });
    if (url.pathname === "/__component.js")
      return route.fulfill({
        contentType: "text/javascript",
        path: "/private/tmp/pnd-native-component-tests/harness.js",
      });
    if (url.pathname.includes("/api/proxy/"))
      return route.fulfill({ json: { data: {} } });
    return route.abort();
  });
}

test("broadcast history follows cursors and create opens progress link", async ({
  page,
}) => {
  await mount(page);
  const reads: URL[] = [];
  await page.route(
    "**/api/proxy/v1/admin/notifications/broadcasts?*",
    (route) => {
      const url = new URL(route.request().url());
      reads.push(url);
      return route.fulfill({
        json: {
          data: {
            items: [{ ...broadcast, providerAcceptedRecipients: null }],
            nextCursor: url.searchParams.has("cursor")
              ? null
              : "next-broadcast",
            hasMore: !url.searchParams.has("cursor"),
          },
        },
      });
    },
  );
  await page.route("**/api/proxy/v1/admin/notifications/broadcasts", (route) =>
    route.fulfill({
      status: 202,
      json: { data: { id: "new-broadcast", status: "queued" } },
    }),
  );
  await page.goto("http://localhost:4320/general-notifications");
  await expect(
    page.getByRole("link", { name: "Office hours", exact: true }),
  ).toHaveAttribute("href", "/general-notifications/broadcast-1");
  await expect(
    page.getByRole("cell", { name: "Not available", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect
    .poll(() => reads.at(-1)?.searchParams.get("cursor"))
    .toBe("next-broadcast");
  expect(reads[0].searchParams.get("limit")).toBe("25");
  const form = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "Queue broadcast" }) });
  await form.locator("summary").click();
  await form.getByLabel("Audience", { exact: false }).selectOption("rider");
  await form.getByLabel("Title", { exact: false }).fill("New announcement");
  await form.getByLabel("Message", { exact: false }).fill("Updated hours");
  await form
    .getByRole("button", { name: "Queue broadcast", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "View broadcast progress" }),
  ).toHaveAttribute("href", "/general-notifications/new-broadcast");
});

test("details poll while active, preserve null counts, and stop after processing", async ({
  page,
}) => {
  await mount(page);
  await page.clock.install();
  let reads = 0;
  await page.route(
    "**/api/proxy/v1/admin/notifications/broadcasts/broadcast-1",
    (route) => {
      reads++;
      return route.fulfill({
        json: {
          data: {
            ...broadcast,
            status: reads === 1 ? "processing" : "processed",
            providerAcceptedRecipients: null,
            providerAcceptedPushes: null,
          },
        },
      });
    },
  );
  await page.goto("http://localhost:4320/general-notifications/broadcast-1");
  await expect(
    page.getByRole("heading", { name: "Office hours" }),
  ).toBeVisible();
  const provider = page.getByRole("region", {
    name: "Push-provider acceptance",
  });
  await expect(
    provider.getByText("Not available", { exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByRole("region", { name: "Recipients", exact: true }),
  ).toContainText("Processed");
  await page.clock.fastForward(7100);
  await expect.poll(() => reads).toBe(2);
  await expect(
    page.getByText("Progress refreshes every 7 seconds."),
  ).toHaveCount(0);
  await page.clock.fastForward(21000);
  expect(reads).toBe(2);
});

test("resend requires confirmation, reuses its key after failure, and opens the new broadcast", async ({
  page,
}) => {
  await mount(page);
  await page.route(
    "**/api/proxy/v1/admin/notifications/broadcasts/broadcast-1",
    (route) =>
      route.fulfill({ json: { data: { ...broadcast, status: "processed" } } }),
  );
  await page.route(
    "**/api/proxy/v1/admin/notifications/broadcasts/new-broadcast",
    (route) =>
      route.fulfill({
        json: {
          data: {
            ...broadcast,
            id: "new-broadcast",
            status: "processed",
            resendOf: "broadcast-1",
          },
        },
      }),
  );
  const writes: { body: string | null; key: string | undefined }[] = [];
  await page.route(
    "**/api/proxy/v1/admin/notifications/broadcasts/broadcast-1/resend",
    (route) => {
      writes.push({
        body: route.request().postData(),
        key: route.request().headers()["idempotency-key"],
      });
      return writes.length === 1
        ? route.fulfill({
            status: 504,
            json: { error: { message: "Response timed out" } },
          })
        : route.fulfill({
            status: 202,
            json: { data: { id: "new-broadcast", status: "queued" } },
          });
    },
  );
  await page.goto("http://localhost:4320/general-notifications/broadcast-1");
  const form = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "Confirm resend" }) });
  await form.locator("summary").click();
  await expect(form).toContainText("including previous recipients");
  expect(writes).toHaveLength(0);
  await form
    .getByRole("button", { name: "Confirm resend", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText("Response timed out");
  await form
    .getByRole("button", { name: "Confirm resend", exact: true })
    .click();
  await expect(page).toHaveURL(/\/general-notifications\/new-broadcast$/);
  expect(writes).toHaveLength(2);
  expect(writes[0].key).toBeTruthy();
  expect(writes[0].body).toBe("{}");
  expect(writes[1]).toEqual(writes[0]);
  await expect(
    page.getByRole("link", { name: "broadcast-1", exact: true }),
  ).toHaveAttribute("href", "/general-notifications/broadcast-1");
});

test("customer-care cannot open broadcast details", async ({ page }) => {
  await mount(page);
  await page.goto(
    "http://localhost:4320/general-notifications/broadcast-1?role=customercare",
  );
  await expect(
    page.getByText(
      "Broadcasts are available to super and regular administrators.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Confirm resend", { exact: true })).toHaveCount(
    0,
  );
});
