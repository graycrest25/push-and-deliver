import { test, expect, type Page } from "@playwright/test";

test.setTimeout(90_000);
async function login(page: Page) {
  await fetch("http://127.0.0.1:4319/control", {
    method: "POST",
    body: JSON.stringify({ reset: true, latest: true, adminType: "super" }),
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#workspace-content")).toBeVisible();
}

test("rider and application lists discard old cursors while keeping page-size preferences", async ({
  page,
}) => {
  await login(page);
  const requests: URL[] = [];
  for (const path of ["users", "riders/applications"]) {
    await page.route(`**/api/proxy/v1/admin/${path}?*`, (route) => {
      requests.push(new URL(route.request().url()));
      return route.fulfill({
        json: {
          data: {
            items: [{ uid: "cursor-rider", username: "Cursor Rider" }],
            nextCursor: "old-rider-cursor",
          },
        },
      });
    });
  }
  await page.route("**/api/proxy/v1/admin/users/cursor-rider?*", (route) =>
    route.fulfill({
      json: {
        data: { uid: "cursor-rider", username: "Cursor Rider", version: 1 },
      },
    }),
  );
  await page.route(
    "**/api/proxy/v1/admin/riders/cursor-rider/application",
    (route) =>
      route.fulfill({
        json: {
          data: {
            uid: "cursor-rider",
            version: 1,
            applicant: {},
            documents: [],
            allowedDecisions: [],
            approvalBlockers: [],
          },
        },
      }),
  );
  for (const section of ["riders", "rider-applications"]) {
    await page.goto(`/${section}`);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect
      .poll(() => requests.at(-1)?.searchParams.get("cursor"))
      .toBe("old-rider-cursor");
    await page.getByLabel("Rows per page").selectOption("50");
    await expect
      .poll(() => requests.at(-1)?.searchParams.get("limit"))
      .toBe("50");
    expect(requests.at(-1)?.searchParams.has("cursor")).toBe(false);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect
      .poll(() => requests.at(-1)?.searchParams.get("cursor"))
      .toBe("old-rider-cursor");
    await page
      .getByRole("link", { name: "Open Cursor Rider", exact: true })
      .click();
    await page
      .getByRole("link", {
        name: section === "riders" ? "Back to riders" : "Back to applications",
        exact: true,
      })
      .click();
    await expect
      .poll(() => requests.at(-1)?.searchParams.has("cursor"))
      .toBe(false);
    await expect(page.getByLabel("Rows per page")).toHaveValue("50");
    await expect(
      page.getByText("Page 1 · 1 records on this page", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("Page 1 · 1 records on this page", { exact: true }),
    ).toBeVisible();
    expect(requests.at(-1)?.searchParams.has("cursor")).toBe(false);
  }
});

test("returning to a conditionally mounted tab starts a new cursor sequence", async ({
  page,
}) => {
  await login(page);
  const requests: URL[] = [];
  await page.route("**/api/proxy/v1/admin/coupons/signup/jobs?*", (route) => {
    requests.push(new URL(route.request().url()));
    return route.fulfill({
      json: {
        data: {
          items: [{ id: "job-one", status: "pending" }],
          nextCursor: "job-cursor",
        },
      },
    });
  });
  await page.goto("/coupons");
  await page.getByRole("button", { name: "Processing", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect
    .poll(() => requests.at(-1)?.searchParams.get("cursor"))
    .toBe("job-cursor");
  await page
    .getByRole("button", { name: "Signup coupons", exact: true })
    .click();
  await page.getByRole("button", { name: "Processing", exact: true }).click();
  await expect
    .poll(() => requests.at(-1)?.searchParams.has("cursor"))
    .toBe(false);
  await expect(
    page.getByText("Page 1 · 1 records on this page", { exact: true }),
  ).toBeVisible();
});

test("referral tabs and paired dates control pagination and CSV, while totals remain global", async ({
  page,
}) => {
  await login(page);
  const requests: URL[] = [];
  await page.route("**/api/proxy/v1/admin/referrals?*", (route) => {
    requests.push(new URL(route.request().url()));
    return route.fulfill({
      json: {
        data: { items: [{ id: "referral-one" }], nextCursor: "next-page" },
      },
    });
  });
  let exported: URL | undefined;
  await page.route("**/api/proxy/v1/admin/referrals/export.csv?*", (route) => {
    exported = new URL(route.request().url());
    return route.fulfill({
      contentType: "text/csv",
      body: "id\nreferral-one\n",
    });
  });
  await page.goto("/referrals");
  await expect
    .poll(() => requests.at(-1)?.searchParams.get("referrerAccountType"))
    .toBe("user");
  expect(requests.at(-1)?.searchParams.get("limit")).toBe("20");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect
    .poll(() => requests.at(-1)?.searchParams.get("cursor"))
    .toBe("next-page");
  await page
    .getByRole("button", { name: "Rider Referrals", exact: true })
    .click();
  await expect
    .poll(() => requests.at(-1)?.searchParams.get("referrerAccountType"))
    .toBe("rider");
  expect(requests.at(-1)?.searchParams.has("cursor")).toBe(false);
  await page.getByLabel("Start date", { exact: true }).fill("2026-11-01");
  await page.getByRole("button", { name: "Apply dates" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Select both dates" }),
  ).toBeVisible();
  await page.getByLabel("End date", { exact: true }).fill("2026-11-08");
  await page.getByRole("button", { name: "Apply dates" }).click();
  await expect
    .poll(() => requests.at(-1)?.searchParams.get("endDate"))
    .toBe("2026-11-08");
  await page.getByRole("button", { name: "Download filtered CSV" }).click();
  await expect
    .poll(() => exported?.searchParams.get("referrerAccountType"))
    .toBe("rider");
  expect(exported?.searchParams.get("startDate")).toBe("2026-11-01");
  expect(
    requests.every((url) => !url.searchParams.has("referreduserType")),
  ).toBe(true);
  await expect(
    page.getByText("Global referral totals · all dates and referrers", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect
    .poll(() => requests.at(-1)?.searchParams.has("referrerAccountType"))
    .toBe(false);
});

test("rider filters clear pending for blocked and encode email searches", async ({
  page,
}) => {
  await login(page);
  const requests: URL[] = [];
  await page.route("**/api/proxy/v1/admin/riders/applications?*", (route) => {
    requests.push(new URL(route.request().url()));
    return route.fulfill({
      json: {
        data: {
          items: [
            {
              uid: "rider-one",
              email: "person+ops@gmail.com",
              verificationStatus: 2,
            },
          ],
          nextCursor: "next",
        },
      },
    });
  });
  await page.goto("/rider-applications");
  await expect(
    page.getByRole("cell", { name: "Blocked", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Verification status", { exact: true })
    .selectOption("blocked");
  await expect(
    page.getByLabel("Application status", { exact: true }),
  ).toHaveValue("");
  await page.getByLabel("Start date", { exact: true }).fill("2026-11-01");
  await page.getByLabel("End date", { exact: true }).fill("2026-11-08");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect
    .poll(() => requests.at(-1)?.searchParams.get("verificationStatus"))
    .toBe("blocked");
  expect(requests.at(-1)?.searchParams.has("status")).toBe(false);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect
    .poll(() => requests.at(-1)?.searchParams.get("cursor"))
    .toBe("next");
  await page
    .getByLabel("Search registered email", { exact: true })
    .fill("person+ops@gmail.com");
  await expect
    .poll(() => requests.at(-1)?.searchParams.get("q"))
    .toBe("person+ops@gmail.com");
  expect(requests.at(-1)?.href).toContain("%2B");
  expect(requests.at(-1)?.searchParams.has("cursor")).toBe(false);
});

test("administrator email lookup selects a UID and uses the current role version", async ({
  page,
}) => {
  await login(page);
  const requests: URL[] = [];
  await page.route(/\/api\/proxy\/v1\/admin\/users(?:\/search)?\?/, (route) => {
    requests.push(new URL(route.request().url()));
    return route.fulfill({
      json: {
        data: {
          items: [
            {
              uid: "selected-user",
              username: "Selected User",
              email: "person+ops@gmail.com",
              emailVerified: true,
            },
          ],
          nextCursor: null,
        },
      },
    });
  });
  let reads = 0;
  let submitted: any;
  await page.route(
    "**/api/proxy/v1/admin/users/selected-user/role",
    (route) => {
      if (route.request().method() === "GET") {
        reads++;
        return route.fulfill({
          json: {
            data: {
              uid: "selected-user",
              version: reads === 1 ? 11 : 19,
              adminType: null,
            },
          },
        });
      }
      submitted = route.request().postDataJSON();
      return route.fulfill({ json: { data: { version: 20 } } });
    },
  );
  await page.goto("/admin/users");
  await expect(page.getByLabel("User ID", { exact: true })).toHaveCount(0);
  await page
    .getByLabel("Email address", { exact: true })
    .fill("person+ops@gmail.com");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect
    .poll(() => requests.at(-1)?.searchParams.get("email"))
    .toBe("person+ops@gmail.com");
  expect(requests.at(-1)?.pathname).toBe("/api/proxy/v1/admin/users/search");
  expect(requests.at(-1)?.href).toContain("%2B");
  await page
    .getByRole("link", { name: "Open Selected User", exact: true })
    .click();
  const form = page.locator("details").filter({
    has: page
      .locator("summary")
      .filter({ hasText: "Update administrator role" }),
  });
  await form.locator("summary").click();
  await form
    .getByLabel("Administrator role (none removes access)")
    .selectOption("regular");
  await form
    .getByLabel("Reason for change")
    .fill("Access reviewed and approved");
  await form
    .getByRole("button", { name: "Update administrator role", exact: true })
    .click();
  await expect
    .poll(() => submitted)
    .toMatchObject({ expectedVersion: 19, adminType: "regular" });
  await page
    .getByRole("button", { name: "Administrators", exact: true })
    .click();
  await page
    .getByLabel("Email address", { exact: true })
    .fill("person+ops@gmail.com");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect
    .poll(() => requests.at(-1)?.searchParams.get("email"))
    .toBe("person+ops@gmail.com");
  expect(requests.at(-1)?.searchParams.get("membership")).toBe("admins");
});

test("rider totals include unknown status and unassigned vehicles", async ({
  page,
}) => {
  await login(page);
  await page.route(
    "**/api/proxy/v1/admin/analytics/account-summary?*",
    (route) =>
      route.fulfill({
        json: {
          data: {
            total: 999,
            verified: { total: 10 },
            pending: { total: 4 },
            blocked: { total: 2 },
            unknownStatus: { total: 3, byVehicle: { unknown: 3 } },
            byVehicle: { "0": 5, "1": 4, "2": 7, unknown: 3 },
          },
        },
      }),
  );
  await page.goto("/dashboard");
  await page
    .getByRole("combobox", { name: /^Account summary/ })
    .selectOption("riders");
  const card = page.getByRole("region", {
    name: "Account totals",
    exact: true,
  });
  await expect(
    card.locator("dl").getByText("19", { exact: true }),
  ).toBeVisible();
  await expect(card.getByRole("row", { name: /^Not assigned/ })).toContainText(
    "3",
  );
  await expect(
    card.locator("dl").getByText("Unknown status", { exact: true }),
  ).toBeVisible();
});

test("assigning a missing vehicle uses the current rider detail version and safely retries", async ({
  page,
}) => {
  await login(page);
  let version = 893;
  await page.route(
    "**/api/proxy/v1/admin/users/unassigned?type=riders",
    (route) =>
      route.fulfill({
        json: {
          data: {
            uid: "unassigned",
            username: "Unassigned Rider",
            version,
            vehicle: null,
          },
        },
      }),
  );
  const attempts: { body: unknown; key: string | undefined }[] = [];
  await page.route(
    "**/api/proxy/v1/admin/riders/unassigned/vehicle",
    (route) => {
      attempts.push({
        body: route.request().postDataJSON(),
        key: route.request().headers()["idempotency-key"],
      });
      return attempts.length === 1
        ? route.abort("failed")
        : route.fulfill({ json: { data: { version: 895 } } });
    },
  );
  await page.goto("/riders/unassigned");
  const form = page.locator("details").filter({
    has: page.locator("summary").filter({ hasText: "Assign vehicle type" }),
  });
  await form.locator("summary").click();
  await form.getByLabel("Vehicle type", { exact: false }).selectOption("2");
  await form
    .getByLabel("Reason for change", { exact: false })
    .fill("Vehicle type confirmed with rider");
  version = 894;
  await form
    .getByRole("button", { name: "Assign vehicle type", exact: true })
    .click();
  await expect(form.getByRole("alert")).toBeVisible();
  expect(attempts[0].body).toEqual({
    expectedVersion: 894,
    reason: "Vehicle type confirmed with rider",
    changes: { type: 2 },
  });
  version = 999;
  await form
    .getByRole("button", { name: "Assign vehicle type", exact: true })
    .click();
  await expect.poll(() => attempts.length).toBe(2);
  expect(attempts[1]).toEqual(attempts[0]);
  expect(attempts[0].key).toBeTruthy();
});

test("a corrected rejected rider can be reapproved and their photo loads without authorization", async ({
  page,
}) => {
  await login(page);
  const imageUrl =
    "https://app.pushndeliver.com/v1/media/photo/avatar?cap=test-cap";
  let imageHeaders: Record<string, string> | undefined;
  await page.route(imageUrl, (route) => {
    imageHeaders = route.request().headers();
    return route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="blue"/></svg>',
    });
  });
  let currentVersion = 893;
  await page.route(
    "**/api/proxy/v1/admin/riders/corrected/application",
    (route) =>
      route.fulfill({
        json: {
          data: {
            uid: "corrected",
            status: "rejected",
            version: currentVersion,
            applicant: { username: "Corrected Rider", imageUrl },
            documents: [],
            approvalBlockers: [],
            allowedDecisions: ["approve"],
          },
        },
      }),
  );
  await page.route(
    "**/api/proxy/v1/admin/riders/corrected/application/reviews?*",
    (route) =>
      route.fulfill({
        json: {
          data: {
            items: [
              {
                decision: "reject",
                reason: "Original rejection retained",
                version: 892,
              },
            ],
            nextCursor: null,
          },
        },
      }),
  );
  let submitted: any;
  await page.route(
    "**/api/proxy/v1/admin/riders/corrected/application/review",
    (route) => {
      submitted = route.request().postDataJSON();
      return route.fulfill({ json: { data: { version: 895 } } });
    },
  );
  await page.goto("/rider-applications/corrected");
  await expect(
    page.getByRole("img", { name: "Profile photo" }),
  ).toHaveAttribute("src", imageUrl);
  await page
    .getByRole("img", { name: "Profile photo" })
    .scrollIntoViewIfNeeded();
  await expect.poll(() => imageHeaders).toBeTruthy();
  expect(imageHeaders?.authorization).toBeUndefined();
  const form = page.locator("details").filter({
    has: page.locator("summary").filter({ hasText: "Approve rider" }),
  });
  await form.locator("summary").click();
  await form
    .getByLabel("Reason for change", { exact: false })
    .fill("Corrections reviewed and accepted");
  currentVersion = 894;
  await form
    .getByRole("button", { name: "Approve rider", exact: true })
    .click();
  await expect
    .poll(() => submitted)
    .toMatchObject({
      decision: "approve",
      expectedVersion: 894,
      reason: "Corrections reviewed and accepted",
    });
  await expect(
    page.getByText("Original rejection retained", { exact: true }),
  ).toBeVisible();
});
