import { test, expect, type Page } from "@playwright/test";

test.setTimeout(90_000);
async function setup(page: Page, adminType = "super", status = "open") {
  await fetch("http://127.0.0.1:4319/control", {
    method: "POST",
    body: JSON.stringify({ reset: true, adminType }),
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#workspace-content")).toBeVisible();
  await page.route("**/api/proxy/v1/admin/support/tickets/ticket-1", (route) =>
    route.fulfill({
      json: {
        data: { id: "ticket-1", status, assignedSupportUid: null, version: 1 },
      },
    }),
  );
  await page.route(
    "**/api/proxy/v1/admin/support/tickets/ticket-1/messages?*",
    (route) =>
      route.fulfill({
        json: {
          data: {
            items: [
              {
                id: "image",
                message: "Delivery photo",
                attachment: {
                  assetId: "photo",
                  contentType: "image/png",
                  downloadUrl: null,
                },
                createdAt: "2026-11-08T12:00:00Z",
              },
              {
                id: "text",
                message: "Text only",
                attachment: null,
                createdAt: "2026-11-08T12:01:00Z",
              },
              {
                id: "missing",
                message: "Missing photo",
                attachmentUnavailable: true,
                attachment: { assetId: "missing", contentType: "image/png" },
                createdAt: "2026-11-08T12:02:00Z",
              },
            ],
            hasMore: false,
          },
        },
      }),
  );
}
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9WQAAAAASUVORK5CYII=",
  "base64",
);

test("super admin previews closed-ticket images, enlarges with keyboard, and refreshes expired URLs", async ({
  page,
}) => {
  await setup(page, "super", "closed");
  let resolutions = 0;
  await page.route("**/api/proxy/v1/assets/*/download", (route) => {
    expect(route.request().url()).toContain("/photo/download");
    resolutions++;
    return route.fulfill({
      json: {
        data: {
          downloadUrl: `https://attachments.example.test/photo-${resolutions}.png`,
          expiresAt: new Date(
            Date.now() + (resolutions === 1 ? 2500 : 60000),
          ).toISOString(),
        },
      },
    });
  });
  await page.route("https://attachments.example.test/**", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await page.goto("/support-tickets/ticket-1");
  const preview = page.getByRole("button", { name: "Enlarge attached image" });
  await expect(preview).toBeVisible();
  await expect(
    page.getByText("Attachment unavailable", { exact: true }),
  ).toHaveCount(1);
  const text = page.getByRole("article").filter({ hasText: "Text only" });
  await expect(text.getByRole("img")).toHaveCount(0);
  await expect(text).not.toContainText("attachment");
  await preview.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByAltText("Customer attachment enlarged")).toBeVisible();
  await expect.poll(() => resolutions).toBe(2);
  await expect(
    page.getByAltText("Customer attachment enlarged"),
  ).toHaveAttribute("src", /photo-2/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("unassigned support staff do not resolve attachments", async ({
  page,
}) => {
  await setup(page, "customercare");
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/assets/")) requests.push(request.url());
  });
  await page.goto("/support-tickets/ticket-1");
  await expect(page.getByText("Claim ticket to view attachment")).toBeVisible();
  expect(requests).toEqual([]);
});

test("broken images retry once and offer manual recovery", async ({ page }) => {
  await setup(page);
  let resolutions = 0;
  let imageRequests = 0;
  await page.route("**/api/proxy/v1/assets/photo/download", (route) =>
    route.fulfill({
      json: {
        data: {
          downloadUrl: `https://attachments.example.test/broken-${++resolutions}.png`,
          expiresAt: null,
        },
      },
    }),
  );
  await page.route("https://attachments.example.test/**", (route) => {
    imageRequests++;
    return route.fulfill({ status: 403 });
  });
  await page.goto("/support-tickets/ticket-1");
  await expect(
    page.getByRole("button", { name: "Retry attachment" }),
  ).toBeVisible();
  expect(imageRequests).toBe(2);
  const beforeRetry = resolutions;
  await page.route("https://attachments.example.test/**", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await page.getByRole("button", { name: "Retry attachment" }).click();
  await expect(
    page.getByRole("button", { name: "Enlarge attached image" }),
  ).toBeVisible();
  expect(resolutions).toBe(beforeRetry + 1);
});
