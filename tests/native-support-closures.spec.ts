import { test, expect, type Page } from "@playwright/test";
test.setTimeout(90_000);
async function control(body: Record<string, unknown> = {}) {
  return fetch("http://127.0.0.1:4319/control", {
    method: "POST",
    body: JSON.stringify(body),
  })
    .then((r) => r.json())
    .then((r) => r.data);
}
async function login(page: Page, adminType = "super") {
  await control({ reset: true, adminType });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#workspace-content")).toBeVisible();
}
async function closeForm(page: Page) {
  await page.goto("/support-tickets/ticket-1");
  await page.getByRole("button", { name: "Claim ticket", exact: true }).click();
  await expect(page.getByLabel("Message to customer")).toBeVisible();
  await page.getByRole("button", { name: "Close ticket", exact: true }).click();
  return page.getByRole("dialog");
}

test("closure requires a trimmed summary and non-super retries avoid restricted detail reads", async ({
  page,
}) => {
  await login(page, "customercare");
  const form = await closeForm(page);
  const summary = form.getByLabel(
    "Briefly describe the issue and how you handled it.",
  );
  const confirm = form.getByRole("button", {
    name: "Confirm closure",
    exact: true,
  });
  await summary.fill("   ");
  await expect(confirm).toBeDisabled();
  await summary.fill("x".repeat(1001));
  await expect(confirm).toBeDisabled();
  await summary.fill(
    "  Customer reported a delay. Confirmed delivery with the rider.  ",
  );
  let attempts = 0;
  await page.route(
    "**/api/proxy/v1/admin/support/tickets/ticket-1/status",
    async (route) => {
      if (++attempts === 1) await control({ failWrite: true });
      await route.continue();
    },
  );
  await confirm.click();
  await expect(form.getByRole("alert")).toContainText("Response lost");
  await expect(summary).toHaveValue(
    "  Customer reported a delay. Confirmed delivery with the rider.  ",
  );
  await expect(summary).toBeDisabled();
  const before = (await control()).records.length;
  await form.getByRole("button", { name: "Retry closing ticket" }).click();
  await expect(page).toHaveURL(/\/support-tickets$/);
  await expect(
    page.getByText("No records found.", { exact: true }),
  ).toBeVisible();
  const records = (await control()).records;
  const writes = records.filter(
    (r: any) => r.path.endsWith("/ticket-1/status") && r.method === "PUT",
  );
  expect(writes).toHaveLength(2);
  expect(writes[0].body).toEqual({
    status: "closed",
    expectedVersion: 4,
    summary: "Customer reported a delay. Confirmed delivery with the rider.",
  });
  expect(writes[1].body).toEqual(writes[0].body);
  expect(writes[1].key).toBe(writes[0].key);
  expect(
    records
      .slice(before)
      .filter(
        (r: any) =>
          r.method === "GET" && r.path === "/v1/admin/support/tickets/ticket-1",
      ),
  ).toHaveLength(0);
  expect(
    (
      await page.request.get("/api/proxy/v1/admin/support/closures?limit=25")
    ).status(),
  ).toBe(403);
});

test("super administrators see closure receipts and history survives reopening", async ({
  page,
}) => {
  await login(page);
  const form = await closeForm(page);
  await form
    .getByLabel("Briefly describe the issue and how you handled it.")
    .fill("  Delivery confirmed with the customer.  ");
  await form
    .getByRole("button", { name: "Confirm closure", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Saved closure" }),
  ).toContainText("Delivery confirmed with the customer.");
  await page
    .getByRole("button", { name: "Reopen ticket", exact: true })
    .click();
  await expect(page.getByText("Open", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "View closure history", exact: true })
    .click();
  await expect(
    page.getByRole("cell", {
      name: "Delivery confirmed with the customer.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: /Support Person/ }),
  ).toContainText("admin@example.test");
  const records = (await control()).records;
  expect(
    records.filter((r: any) => r.path === "/v1/admin/support/closures").at(-1)
      .query,
  ).toMatchObject({ limit: "25", ticketId: "ticket-1" });
  const reopen = records
    .filter(
      (r: any) => r.path.endsWith("/ticket-1/status") && r.method === "PUT",
    )
    .at(-1);
  expect(reopen.body).toEqual({ status: "open", expectedVersion: 5 });
});

test("history pages and filters use cursors, with staff UID and missing-summary fallbacks", async ({
  page,
}) => {
  await login(page);
  const urls: URL[] = [];
  await page.route("**/api/proxy/v1/admin/support/closures?*", (route) => {
    urls.push(new URL(route.request().url()));
    return route.fulfill({
      json: {
        data: {
          items: [
            {
              id: "old-closure",
              ticketId: "ticket-1",
              summary: null,
              closedBy: { uid: "staff-old", name: null, email: null },
              closedAt: "2026-11-08T12:00:00Z",
            },
          ],
          nextCursor: "next-closure",
        },
      },
    });
  });
  await page.goto("/support-closures");
  await expect(
    page.getByRole("cell", { name: "No summary recorded", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "staff-old", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Rows per page")).toHaveValue("25");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect
    .poll(() => urls.at(-1)?.searchParams.get("cursor"))
    .toBe("next-closure");
  await page
    .getByLabel("Closed by staff UID", { exact: true })
    .fill("staff-old");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect
    .poll(() => urls.at(-1)?.searchParams.get("closedByUid"))
    .toBe("staff-old");
  expect(urls.at(-1)?.searchParams.has("cursor")).toBe(false);
  expect(
    await page.getByLabel("Rows per page").locator("option").allTextContents(),
  ).toEqual(["10", "25", "50", "100"]);
});

test("a close version conflict retains the summary and requires review before a fresh key", async ({
  page,
}) => {
  await login(page);
  const form = await closeForm(page);
  const attempts: { body: any; key: string | undefined }[] = [];
  await page.route(
    "**/api/proxy/v1/admin/support/tickets/ticket-1/status",
    (route) => {
      attempts.push({
        body: route.request().postDataJSON(),
        key: route.request().headers()["idempotency-key"],
      });
      return attempts.length === 1
        ? route.fulfill({
            status: 409,
            json: {
              error: { message: "Ticket changed. Review before retrying." },
            },
          })
        : route.continue();
    },
  );
  const summary = form.getByLabel(
    "Briefly describe the issue and how you handled it.",
  );
  await summary.fill("Customer contacted and the delivery issue resolved.");
  await form
    .getByRole("button", { name: "Confirm closure", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText("Ticket changed");
  await expect(summary).toHaveValue(
    "Customer contacted and the delivery issue resolved.",
  );
  await expect(
    form.getByRole("button", { name: "Confirm closure", exact: true }),
  ).toBeDisabled();
  await form
    .getByRole("button", { name: "I reviewed the refreshed ticket" })
    .click();
  await form
    .getByRole("button", { name: "Confirm closure", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Saved closure" }),
  ).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[1].key).not.toBe(attempts[0].key);
  expect(attempts[1].body.summary).toBe(attempts[0].body.summary);
});

test("server rejects missing summaries and non-super reopening, and nullable customers remain usable", async ({
  page,
}) => {
  await login(page, "regular");
  const response = await page.request.put(
    "/api/proxy/v1/admin/support/tickets/ticket-1/status",
    {
      headers: {
        Origin: "http://localhost:4320",
        "Idempotency-Key": "missing-summary-test",
      },
      data: { status: "closed", expectedVersion: 2 },
    },
  );
  expect(response.status()).toBe(400);
  const reopen = await page.request.put(
    "/api/proxy/v1/admin/support/tickets/ticket-1/status",
    {
      headers: {
        Origin: "http://localhost:4320",
        "Idempotency-Key": "reopen-denied-test",
      },
      data: { status: "open", expectedVersion: 2 },
    },
  );
  expect(reopen.status()).toBe(403);
  await page.goto("/support-tickets");
  await expect(
    page.getByRole("cell", { name: "Customer Name", exact: true }),
  ).toBeVisible();
  await page.route("**/api/proxy/v1/admin/support/tickets/ticket-1", (route) =>
    route.fulfill({
      json: {
        data: {
          id: "ticket-1",
          status: "open",
          version: 2,
          customerUid: "customer-1",
          customer: null,
        },
      },
    }),
  );
  await page.goto("/support-tickets/ticket-1");
  await expect(
    page.getByRole("heading", { name: "Support conversation" }),
  ).toBeVisible();
  await expect(page.getByText(/Customer details unavailable ·/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View closure history" }),
  ).toHaveCount(0);
});
