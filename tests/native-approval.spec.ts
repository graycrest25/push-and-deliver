import { test, expect, type Page } from "@playwright/test";
async function control(body: Record<string, unknown> = {}) {
  return fetch("http://127.0.0.1:4319/control", {
    method: "POST",
    body: JSON.stringify(body),
  })
    .then((r) => r.json())
    .then((r) => r.data);
}
async function login(page: Page) {
  await control({ latest: true, adminType: "super" });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#workspace-content")).toBeVisible();
}
function application(emailVerified = true) {
  return {
    uid: "rider-1",
    applicationId: "rider-1",
    status: "pending",
    version: 7,
    verificationStatus: "0",
    submittedAt: "2026-11-03T10:00:00Z",
    allowedDecisions: ["approve", "reject"],
    approvalBlockers: emailVerified ? [] : ["Email address is verified"],
    documents: ["vehicle_photo", "plate_number"].map((kind) => ({
      kind,
      assetId: `evidence-${kind}`,
      available: true,
      contentType: "image/jpeg",
    })),
    applicant: {
      uid: "rider-1",
      accountType: "rider",
      username: "Verified applicant",
      emailVerified,
      identityExists: true,
      disabled: false,
      deleted: false,
      verificationStatus: 0,
      version: 7,
      phoneNumber: "+2348000000000",
      profile: {
        dateOfBirth: "1990-01-01",
        homeAddress: "Lagos address",
        stateOfOrigin: "Lagos",
        localGovernment: "Ikeja",
        nextOfKin: { name: "Contact", phoneNumber: "+2348000000001" },
      },
      vehicle: { type: "2", make: "Example" },
    },
  };
}
test.beforeEach(() => control({ reset: true }));
for (const response of [
  {
    name: "current",
    data: {
      onlineStatus: true,
      onlineStatusLabel: "Online",
      message: "Rider verified successfully. The rider is now online.",
    },
    expectedMessage: "Rider verified successfully. The rider is now online.",
  },
  {
    name: "saved legacy",
    data: {},
    expectedMessage: "Rider application updated",
  },
]) {
  test(`approval uses the ${response.name} response message and refreshes the applicant profile`, async ({
    page,
  }) => {
    await login(page);
    let reviewed = false;
    let refreshedProfile = false;
    let refreshedHistory = false;
    let submitted: unknown;
    let idempotencyKey: string | undefined;
    await page.route(
      "**/api/proxy/v1/admin/riders/rider-1/application",
      (route) => {
        const current = application();
        if (reviewed) refreshedProfile = true;
        return route.fulfill({
          json: {
            data: {
              ...current,
              version: reviewed ? 8 : 7,
              status: reviewed ? "approved" : "pending",
              allowedDecisions: reviewed ? [] : current.allowedDecisions,
              applicant: {
                ...current.applicant,
                onlineStatus: reviewed,
                onlineStatusLabel: reviewed ? "Online" : "Offline",
              },
            },
          },
        });
      },
    );
    await page.route(
      "**/api/proxy/v1/admin/riders/rider-1/application/reviews?*",
      (route) => {
        if (reviewed) refreshedHistory = true;
        return route.fulfill({ json: { data: { items: [] } } });
      },
    );
    await page.route(
      "**/api/proxy/v1/admin/riders/rider-1/application/review",
      (route) => {
        submitted = route.request().postDataJSON();
        idempotencyKey = route.request().headers()["idempotency-key"];
        reviewed = true;
        return route.fulfill({
          json: { data: { version: 8, ...response.data } },
        });
      },
    );
    await page.goto("/rider-applications/rider-1");
    const profile = page.getByRole("region", {
      name: "Applicant information",
      exact: true,
    });
    await expect(profile.getByText("Offline", { exact: true })).toBeVisible();
    const edit = page.locator("details").filter({
      has: page.locator("summary").filter({ hasText: "Approve rider" }),
    });
    await edit.locator("summary").click();
    await edit
      .getByLabel("Reason for change", { exact: false })
      .fill("Application and photos reviewed");
    await edit
      .getByRole("button", { name: "Approve rider", exact: true })
      .click();
    await expect(
      page.getByText(response.expectedMessage, { exact: true }),
    ).toBeVisible();
    await expect(profile.getByText("Online", { exact: true })).toBeVisible();
    await expect(profile.getByText("Offline", { exact: true })).toHaveCount(0);
    await expect.poll(() => refreshedProfile && refreshedHistory).toBeTruthy();
    expect(submitted).toEqual({
      decision: "approve",
      reason: "Application and photos reviewed",
      expectedVersion: 7,
    });
    expect(idempotencyKey).toBeTruthy();
    await expect(page.getByText(/rider remains offline/i)).toHaveCount(0);
  });
}
test("approval prerequisites and enum labels are clear without converting versions or IDs", async ({
  page,
}) => {
  await login(page);
  const data = application(false);
  data.documents[0].available = false;
  data.approvalBlockers.push("Vehicle photo is unavailable");
  await page.route(
    "**/api/proxy/v1/admin/riders/rider-1/application",
    (route) => route.fulfill({ json: { data, requestId: "approval-read" } }),
  );
  await page.goto("/rider-applications/rider-1");
  const information = page.getByRole("region", {
    name: "Application information",
    exact: true,
  });
  await expect(information.getByText("Pending", { exact: true })).toBeVisible();
  await expect(
    information.getByText("Unverified", { exact: true }),
  ).toBeVisible();
  await expect(information.getByText("7", { exact: true })).toBeVisible();
  await expect(information.getByText("rider-1", { exact: true })).toBeVisible();
  await expect(information.getByText("0", { exact: true })).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "Applicant information", exact: true })
      .getByText("Motorbike", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve rider", exact: true }),
  ).toBeDisabled();
  const checklist = page.getByRole("region", {
    name: "Approval requirements",
    exact: true,
  });
  await expect(
    checklist.getByText("Needs attention", { exact: true }),
  ).toHaveCount(2);
  expect(
    (await control()).records.some((row: any) =>
      row.path.endsWith("/application/review"),
    ),
  ).toBeFalsy();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/latest-approval-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/latest-approval-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
test("approval 409 reloads prerequisites and retains the reason and diagnostic reference", async ({
  page,
}) => {
  await login(page);
  let verified = true,
    attempts = 0;
  await page.route(
    "**/api/proxy/v1/admin/riders/rider-1/application",
    (route) =>
      route.fulfill({
        json: { data: application(verified), requestId: "current-read" },
      }),
  );
  await page.route(
    "**/api/proxy/v1/admin/riders/rider-1/application/review",
    (route) => {
      attempts++;
      verified = false;
      return route.fulfill({
        status: 409,
        json: {
          error: {
            code: "conflict",
            details: {},
            message:
              "State changed or the idempotency key was reused; reload before retrying",
          },
          requestId: "3fd558da3cb5d3402c7e591b0863fd3f",
        },
      });
    },
  );
  await page.goto("/rider-applications/rider-1");
  const edit = page
    .locator("details")
    .filter({
      has: page.locator("summary").filter({ hasText: "Approve rider" }),
    })
    .last();
  await edit.locator("summary").click();
  await edit
    .getByLabel("Reason for change", { exact: false })
    .fill("Application and documents reviewed");
  await edit
    .getByRole("button", { name: "Approve rider", exact: true })
    .click();
  await expect(edit).toContainText("3fd558da3cb5d3402c7e591b0863fd3f");
  await expect(
    edit
      .getByRole("region", { name: "Current approval requirements" })
      .getByText("Needs attention", { exact: true }),
  ).toHaveCount(1);
  await edit
    .getByRole("button", { name: "Use refreshed version and review draft" })
    .click();
  await expect(edit.getByRole("alert")).toContainText(
    "Email address is verified",
  );
  await expect(
    edit.getByLabel("Reason for change", { exact: false }),
  ).toHaveValue("Application and documents reviewed");
  await expect(
    edit.getByRole("button", { name: "Approve rider", exact: true }),
  ).toBeDisabled();
  await expect(edit).toContainText("3fd558da3cb5d3402c7e591b0863fd3f");
  expect(attempts).toBe(1);
});
test("approval uses current server eligibility and version with only two photos", async ({
  page,
}) => {
  await login(page);
  let currentVersion = 7;
  await page.route(
    "**/api/proxy/v1/admin/riders/rider-1/application",
    (route) => {
      const data = {
        ...application(),
        version: currentVersion,
        applicant: {},
      };
      return route.fulfill({ json: { data } });
    },
  );
  let submitted: any;
  await page.route(
    "**/api/proxy/v1/admin/riders/rider-1/application/review",
    (route) => {
      submitted = route.request().postDataJSON();
      return route.fulfill({ json: { data: { version: 43 } } });
    },
  );
  await page.goto("/rider-applications/rider-1");
  const edit = page.locator("details").filter({
    has: page.locator("summary").filter({ hasText: "Approve rider" }),
  });
  await edit.locator("summary").click();
  await edit
    .getByLabel("Reason for change", { exact: false })
    .fill("Both photos checked");
  currentVersion = 42;
  await edit
    .getByRole("button", { name: "Approve rider", exact: true })
    .click();
  await expect
    .poll(() => submitted)
    .toMatchObject({ expectedVersion: 42, decision: "approve" });
});
test("approval rechecks server blockers before sending a decision", async ({
  page,
}) => {
  await login(page);
  let blocked = false;
  await page.route(
    "**/api/proxy/v1/admin/riders/rider-1/application",
    (route) => {
      const data = application();
      if (blocked)
        data.approvalBlockers = ["Document processing is incomplete"];
      return route.fulfill({ json: { data } });
    },
  );
  await page.goto("/rider-applications/rider-1");
  const edit = page.locator("details").filter({
    has: page.locator("summary").filter({ hasText: "Approve rider" }),
  });
  await edit.locator("summary").click();
  await edit
    .getByLabel("Reason for change", { exact: false })
    .fill("Photos reviewed");
  blocked = true;
  await edit
    .getByRole("button", { name: "Approve rider", exact: true })
    .click();
  await expect(edit.getByRole("alert")).toContainText(
    "Document processing is incomplete",
  );
  expect(
    (await control()).records.some((row: any) =>
      row.path.endsWith("/application/review"),
    ),
  ).toBeFalsy();
});
test("an uncertain review retry keeps its body and idempotency key", async ({
  page,
}) => {
  await login(page);
  let currentVersion = 7;
  let reads = 0;
  await page.route(
    "**/api/proxy/v1/admin/riders/rider-1/application",
    (route) => {
      reads++;
      return route.fulfill({
        json: { data: { ...application(), version: currentVersion } },
      });
    },
  );
  const attempts: { body: unknown; key: string | undefined }[] = [];
  await page.route(
    "**/api/proxy/v1/admin/riders/rider-1/application/review",
    (route) => {
      attempts.push({
        body: route.request().postDataJSON(),
        key: route.request().headers()["idempotency-key"],
      });
      return attempts.length === 1
        ? route.fulfill({
            status: 503,
            json: { error: { message: "Temporarily unavailable" } },
          })
        : route.fulfill({ json: { data: { version: 43 } } });
    },
  );
  await page.goto("/rider-applications/rider-1");
  const edit = page.locator("details").filter({
    has: page.locator("summary").filter({ hasText: "Approve rider" }),
  });
  await edit.locator("summary").click();
  await edit
    .getByLabel("Reason for change", { exact: false })
    .fill("Photos checked");
  const submit = edit.getByRole("button", {
    name: "Approve rider",
    exact: true,
  });
  currentVersion = 42;
  const initialReads = reads;
  await submit.click();
  await expect(edit.getByRole("alert")).toContainText(
    "Temporarily unavailable",
  );
  expect(reads).toBe(initialReads + 1);
  currentVersion = 43;
  await submit.click();
  await expect.poll(() => attempts.length).toBe(2);
  expect(attempts[1]).toEqual(attempts[0]);
  expect(attempts[0].key).toBeTruthy();
  expect(attempts[0].body).toMatchObject({ expectedVersion: 42 });
});
test("ride details use shipment-style sections and formatted ordinals while hiding coordinates", async ({
  page,
}) => {
  await login(page);
  const data = {
    id: "ride-readable",
    service: "courier",
    rideType: 4,
    status: 5,
    vehicleType: 2,
    customerId: "user-1",
    assignedRider: null,
    pickup: { address: "Pickup address", latitude: 6.576, longitude: 3.39 },
    dropoff: { address: "Drop-off address", latitude: 6.636, longitude: 3.341 },
    pricing: {
      grossAmountMinor: 201708,
      totalAmountMinor: 201708,
      discountAmountMinor: 0,
      currency: "NGN",
    },
    payment: { status: "paid", method: "wallet" },
    createdAt: "2026-03-08T00:39:00Z",
    readOnly: true,
  };
  await page.route("**/api/proxy/v1/admin/rides/ride-readable", (route) =>
    route.fulfill({ json: { data, requestId: "ride-read" } }),
  );
  await page.goto("/ride-hailing/ride-readable");
  for (const title of [
    "Order information",
    "Customer and receiver",
    "Rider and vehicle",
    "Locations",
    "Payment information",
    "Dates",
  ])
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  const order = page.getByRole("region", {
    name: "Order information",
    exact: true,
  });
  await expect(order.getByText("Expired", { exact: true })).toBeVisible();
  await expect(order.getByText("Motorbike", { exact: true })).toBeVisible();
  await expect(order.getByText("Courier", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Latitude", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Longitude", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Locations", exact: true }),
  ).toContainText("Pickup address");
  await expect(
    page.getByRole("region", { name: "Payment information", exact: true }),
  ).toContainText("₦0.00");
  await expect(page.getByText("Paid", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "user-1", exact: true }),
  ).toHaveAttribute("href", "/users/user-1");
  await page.screenshot({
    path: "test-results/latest-ride-details-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/latest-ride-details-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
