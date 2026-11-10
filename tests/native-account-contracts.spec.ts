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
  await expect(page.locator("#workspace-content")).toBeVisible({
    timeout: 30000,
  });
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

test("returning to a coupon tab preserves its cursor sequence", async ({
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
  await page.getByRole("tab", { name: "Processing", exact: true }).click();
  const processing = page.getByRole("tabpanel", {
    name: "Processing",
    exact: true,
  });
  await expect(
    processing.getByText("Page 1 · 1 records on this page", { exact: true }),
  ).toBeVisible();
  await processing.getByRole("button", { name: "Next", exact: true }).click();
  await expect
    .poll(() => requests.at(-1)?.searchParams.get("cursor"))
    .toBe("job-cursor");
  await page.getByRole("tab", { name: "Signup coupons", exact: true }).click();
  await page.getByRole("tab", { name: "Processing", exact: true }).click();
  await expect
    .poll(() => requests.at(-1)?.searchParams.has("cursor"))
    .toBe(true);
  await expect(
    page.getByText("Page 2 · 1 records on this page", { exact: true }),
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
  await page
    .getByLabel("Referral code for export (optional)")
    .fill(" Oreo1uwa ");
  await page.getByRole("button", { name: "Download filtered CSV" }).click();
  await expect
    .poll(() => exported?.searchParams.get("referrerAccountType"))
    .toBe("rider");
  expect(exported?.searchParams.get("startDate")).toBe("2026-11-01");
  expect(exported?.searchParams.get("referralCodeUsed")).toBe("Oreo1uwa");
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
            referralCodeUsed: "Oreo1uwa",
            referralCode: "OwnSharingCode",
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
  await expect(page.locator("#personal-information")).toContainText(
    "Referred using code",
  );
  await expect(page.locator("#personal-information")).toContainText("Oreo1uwa");
  await expect(page.locator("#personal-information")).not.toContainText(
    "OwnSharingCode",
  );
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

test("dispatch radius saves the loaded version and retains its key on retry", async ({
  page,
}) => {
  await login(page);
  let version = 0;
  const writes: { body: unknown; key: string | undefined }[] = [];
  await page.route("**/api/proxy/v1/admin/config/dispatch", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        json: { data: { radiusKm: version ? 7.5 : 5, version } },
      });
    writes.push({
      body: route.request().postDataJSON(),
      key: route.request().headers()["idempotency-key"],
    });
    if (writes.length === 1)
      return route.fulfill({
        status: 504,
        json: { error: { message: "Timed out" } },
      });
    version = 1;
    return route.fulfill({ json: { data: { radiusKm: 7.5, version } } });
  });
  await page.goto("/app-config");
  const form = page.locator("details").filter({
    has: page.locator("summary", { hasText: "Save dispatch radius" }),
  });
  await form.locator("summary").click();
  const radius = form.getByLabel("Radius from pickup (km)");
  await expect(radius).toHaveValue("5");
  await form.screenshot({ path: "test-results/dispatch-radius-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await form.screenshot({ path: "test-results/dispatch-radius-mobile.png" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await radius.fill("20.1");
  await form
    .getByRole("button", { name: "Save dispatch radius", exact: true })
    .click();
  expect(writes).toHaveLength(0);
  await radius.fill("7.5");
  await form
    .getByRole("button", { name: "Save dispatch radius", exact: true })
    .click();
  await expect.poll(() => writes.length).toBe(1);
  await expect(form.getByRole("alert")).toContainText("Timed out");
  await form
    .getByRole("button", { name: "Save dispatch radius", exact: true })
    .click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[0].body).toEqual({ radiusKm: 7.5, expectedVersion: 0 });
  expect(writes[0].key).toBeTruthy();
  expect(writes[1]).toEqual(writes[0]);
});

test("configuration tabs preserve drafts and support links, history and keyboard navigation", async ({
  page,
}, testInfo) => {
  await login(page);
  await page.route("**/api/proxy/v1/admin/config/dispatch", (route) =>
    route.fulfill({ json: { data: { radiusKm: 5, version: 0 } } }),
  );
  await page.goto("/app-config");
  await expect(
    page.getByRole("tab", { name: "Dispatch", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  const form = page.locator("details").filter({
    has: page.locator("summary", { hasText: "Save dispatch radius" }),
  });
  await form.locator("summary").click();
  await form.getByLabel("Radius from pickup (km)").fill("7.5");
  await page.getByRole("tab", { name: "Mobile releases", exact: true }).click();
  await expect(page).toHaveURL(/tab=releases/);
  await expect(page.getByLabel("App", { exact: true })).toBeVisible();
  await expect(form).not.toBeVisible();
  await page.getByRole("tab", { name: "Signup bonuses", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Signup wallet bonus", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("tab", { name: "Mobile releases", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Dispatch", exact: true }).click();
  await expect(form.getByLabel("Radius from pickup (km)")).toHaveValue("7.5");
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await page.screenshot({
    path: testInfo.outputPath("configuration-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("configuration-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Dispatch", exact: true }).focus();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("tab", { name: "Game rules", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/tab=game/);
  await page.goto("/app-config?tab=signup");
  await expect(
    page.getByRole("tab", { name: "Signup bonuses", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});

for (const domestic of [false, true]) {
  test(`${domestic ? "delivery" : "shipping"} tariff tabs retain draft fields and browser history`, async ({
    page,
  }, info) => {
    await login(page);
    const path = domestic ? "/delivery-zones" : "/export-rates";
    await page.goto(path);
    await expect(
      page.getByRole("tab", { name: "Tariffs", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toHaveCount(1);
    if (!domestic)
      await page.getByLabel("Show drafts and retired tariffs").check();
    await page.getByRole("tab", { name: "Create tariff", exact: true }).click();
    const form = page.getByRole("tabpanel").locator("details");
    await expect(form).toHaveAttribute("open", "");
    const field = form.getByLabel(
      domestic ? "Delivery service" : "Tariff name",
    );
    if (domestic) await field.selectOption("premium");
    else await field.fill("Unfinished tariff");
    await page
      .getByRole("tab", {
        name: domestic ? "States & zones" : "Countries",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("tabpanel").getByRole("heading", {
        name: domestic ? "States & local zones" : "Shipping countries",
        exact: true,
      }),
    ).toBeVisible();
    await page.goBack();
    await expect(
      page.getByRole("tab", { name: "Create tariff", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(field).toHaveValue(domestic ? "premium" : "Unfinished tariff");
    await page.getByRole("tab", { name: "Tariffs", exact: true }).click();
    if (!domestic)
      await expect(
        page.getByLabel("Show drafts and retired tariffs"),
      ).toBeChecked();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: info.outputPath("tariffs-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: info.outputPath("tariffs-mobile.png"),
      fullPage: true,
    });
    await page.goto(`${path}?tab=${domestic ? "local-types" : "countries"}`);
    await expect(
      page.getByRole("tab", {
        name: domestic ? "Local shipping types" : "Countries",
        exact: true,
      }),
    ).toHaveAttribute("aria-selected", "true");
  });
}

for (const domestic of [false, true]) {
  test(`${domestic ? "delivery" : "shipping"} tariff detail tabs preserve edits and expose prices separately`, async ({
    page,
  }, info) => {
    await login(page);
    const path = domestic
      ? "/delivery-zones/tariffs/draft-local"
      : "/export-rates/tariffs/draft-export";
    await page.goto(path);
    await expect(
      page.getByRole("tab", { name: "Prices", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toHaveCount(1);
    await page
      .getByRole("tab", { name: "Edit & publish", exact: true })
      .click();
    const edit = page
      .getByRole("tabpanel")
      .locator("details")
      .filter({
        has: page.locator("summary", { hasText: /^Tariff details/ }),
      });
    await edit.locator("summary").click();
    const input = edit.getByLabel(domestic ? "Volumetric divisor" : "Name", {
      exact: false,
    });
    await input.fill(domestic ? "6000" : "Draft edit retained");
    await page
      .getByRole("tab", { name: "Tariff information", exact: true })
      .click();
    await expect(page.getByRole("tabpanel")).toContainText(
      domestic ? "draft-local" : "draft-export",
    );
    await page.goBack();
    await expect(input).toHaveValue(domestic ? "6000" : "Draft edit retained");
    await page.getByRole("tab", { name: "Prices", exact: true }).click();
    await expect(
      page.getByRole("tabpanel").getByRole("table").first(),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: info.outputPath("tariff-detail-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: info.outputPath("tariff-detail-mobile.png"),
      fullPage: true,
    });
    await page.goto(`${path}?tab=information`);
    await expect(
      page.getByRole("tab", { name: "Tariff information", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
  });
}

test("tariff skeletons follow the selected detail tab while the snapshot loads", async ({
  page,
}, info) => {
  await login(page);
  let release!: () => void;
  let gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    "**/api/proxy/v1/admin/shipping/tariffs/draft-export/snapshot",
    async (route) => {
      await gate;
      await route.continue();
    },
  );
  await page.goto("/export-rates/tariffs/draft-export?tab=information");
  await expect(
    page.getByRole("status", {
      name: "Loading tariff information…",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("tabpanel").getByRole("table")).toHaveCount(0);
  await page.getByRole("tab", { name: "Prices", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Loading tariff prices…", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("tabpanel").locator("table")).toHaveCount(1);
  await page.getByRole("tab", { name: "PDF upload", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Loading PDF upload…", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Edit & publish", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Loading tariff workflow…", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("tab-loading-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: info.outputPath("tab-loading-mobile.png"),
    fullPage: true,
  });
  release();
  await expect(
    page.getByRole("status", { name: "Loading tariff workflow…", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: "Edit & publish", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page
      .getByRole("tabpanel")
      .locator("summary")
      .filter({ hasText: /^Tariff details/ }),
  ).toBeVisible();
});

test("configuration loading shows only the selected feature's skeleton", async ({
  page,
}) => {
  await login(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/proxy/v1/admin/config/dispatch", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/app-config?tab=dispatch");
  await expect(
    page.getByRole("status", {
      name: "Loading dispatch settings…",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("tabpanel").locator("table")).toHaveCount(0);
  await page.getByRole("tab", { name: "Mobile releases", exact: true }).click();
  await expect(
    page.getByRole("status", {
      name: "Loading dispatch settings…",
      exact: true,
    }),
  ).not.toBeVisible();
  release();
  await page.getByRole("tab", { name: "Dispatch", exact: true }).click();
  await expect(
    page.locator("summary").filter({ hasText: /^Save dispatch radius$/ }),
  ).toBeVisible();
});

test("shipping country zones have their own searchable tab and link to destination prices", async ({
  page,
}, info) => {
  await login(page);
  await page.route("**/api/proxy/v1/admin/shipping/countries?*", (route) =>
    route.fulfill({
      json: {
        data: {
          items: [{ code: "GB", name: "United Kingdom", active: true }],
          nextCursor: null,
        },
      },
    }),
  );
  await page.goto("/export-rates/tariffs/draft-export?tab=country-zones");
  const panel = page.getByRole("tabpanel");
  await expect(
    page.getByRole("tab", { name: "Country zones", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    panel.getByRole("columnheader", { name: "Availability", exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("table", { name: "International tariff prices" }),
  ).toHaveCount(0);
  await panel.getByLabel("Find a country", { exact: true }).fill("GB");
  await expect(
    panel.getByRole("cell", { name: "United Kingdom", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("country-zones-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: info.outputPath("country-zones-mobile.png"),
    fullPage: true,
  });
  await panel
    .getByRole("button", { name: "View prices for GB", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Prices", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(panel.getByLabel("Destination country")).toHaveValue("GB");
  await expect(
    panel.getByRole("columnheader", { name: "Availability", exact: true }),
  ).toHaveCount(0);
  await page.goBack();
  await expect(panel.getByLabel("Find a country", { exact: true })).toHaveValue(
    "GB",
  );
});

for (const item of [
  {
    path: "/coupons",
    tab: "Generate code",
    id: "generate",
    other: "Campaigns",
    summary: "Generate customer coupon code",
    field: "Customer user ID",
    value: "customer-draft",
  },
  {
    path: "/promoter-links",
    tab: "Create or renew",
    id: "renew",
    other: "Promoter links",
    summary: "Create or renew promoter link",
    field: "Promoter name",
    value: "DraftPromoter",
  },
  {
    path: "/withdrawals",
    tab: "Export",
    id: "export",
    other: "Requests",
    summary: "",
    field: "Export status",
    value: "succeeded",
  },
])
  test(`${item.path} feature tabs preserve inputs and support direct links`, async ({
    page,
  }, info) => {
    await login(page);
    await page.goto(`${item.path}?tab=${item.id}`);
    await expect(
      page.getByRole("tab", { name: item.tab, exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    const panel = page.getByRole("tabpanel");
    if (item.summary)
      await panel.locator("summary").filter({ hasText: item.summary }).click();
    const input = panel.getByLabel(item.field, { exact: false });
    if (item.path === "/withdrawals") await input.selectOption(item.value);
    else await input.fill(item.value);
    await page.getByRole("tab", { name: item.other, exact: true }).click();
    await expect(panel.getByLabel(item.field, { exact: false })).toHaveCount(0);
    await page.goBack();
    await expect(input).toHaveValue(item.value);
    await page.screenshot({
      path: info.outputPath("feature-tabs-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: info.outputPath("feature-tabs-mobile.png"),
      fullPage: true,
    });
  });
