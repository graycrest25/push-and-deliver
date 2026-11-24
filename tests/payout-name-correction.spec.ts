import { expect, test } from "@playwright/test";

test("reviewers correct a payout name through conflicts, a lost response and Bachs status updates", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const control = "http://127.0.0.1:4319/control";
  const endpoint =
    "/v1/admin/riders/correction-rider/payout-identity/correction";
  const initial = {
    profileName: "John Doe",
    approvedPayoutName: "John Doe",
    canRequestCorrection: false,
    status: null,
    version: 331,
  };
  const saved = {
    ...initial,
    profileName: "John Paul Doe",
    canRequestCorrection: true,
    version: 332,
  };
  const fixture = (data: object, outcome = {}) =>
    request.post(control, {
      data: { payoutCorrectionFixture: { data, ...outcome } },
    });

  await request.post(control, { data: { reset: true, adminType: "super" } });
  await fixture(initial);
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#workspace-content")).toBeVisible({
    timeout: 30_000,
  });

  let profile = {
    uid: "correction-rider",
    username: initial.profileName,
    email: "rider@example.test",
    phoneNumber: "+2348000000000",
    version: 51,
  };
  await page.route(
    "**/api/proxy/v1/admin/users/correction-rider?type=riders",
    (route) => route.fulfill({ json: { data: profile } }),
  );
  await page.route(
    "**/api/proxy/v1/admin/users/correction-rider/profile?type=riders",
    async (route) => {
      expect(route.request().postDataJSON().changes).toEqual({
        username: saved.profileName,
      });
      profile = { ...profile, username: saved.profileName, version: 52 };
      await fixture(saved, { conflict: "payout_work_in_progress" });
      await route.fulfill({ json: { data: {} } });
    },
  );

  await page.goto("/riders/correction-rider");
  const section = page.getByRole("region", { name: "Payout name" });
  const action = section.getByRole("button", { name: "Correct payout name" });
  await expect(section.getByText("No correction on record")).toBeVisible();
  await expect(action).toBeDisabled();

  await page.getByRole("button", { name: "Edit rider information" }).click();
  const editor = page.getByRole("dialog", {
    name: "Edit personal information",
  });
  await editor
    .locator("summary", { hasText: "Save personal information" })
    .click();
  await editor.getByLabel("Full name").fill(saved.profileName);
  await editor
    .getByLabel("Reason for change")
    .fill("Saved the full name from verified documents.");
  const refreshed = page.waitForResponse(
    (response) =>
      response.url().endsWith(endpoint) &&
      response.request().method() === "GET" &&
      response.ok() &&
      response.request().resourceType() === "fetch" &&
      // Confirm the GET read the saved name, even if an earlier poll was in flight.
      response
        .json()
        .then((result) => result.data.profileName === saved.profileName),
  );
  await editor
    .getByRole("button", { name: "Save personal information", exact: true })
    .click();
  await refreshed;
  await expect(section.getByText(saved.profileName)).toBeVisible();
  await expect(
    section.getByText(saved.approvedPayoutName, { exact: true }),
  ).toBeVisible();

  await action.click();
  const dialog = page.getByRole("dialog", { name: "Correct payout name" });
  const submit = dialog.getByRole("button", { name: "Request correction" });
  const check = dialog.getByRole("checkbox");
  const reason = "Verified the full legal name against the rider's documents";
  await dialog.getByLabel("First name").fill("John Paul");
  await dialog.getByLabel("Last name").fill("Doe");
  await dialog.getByLabel("Reason for correction").fill("Too short");
  await check.check();
  await expect(submit).toBeDisabled();
  await dialog.getByLabel("Reason for correction").fill("x".repeat(501));
  await expect(submit).toBeDisabled();
  await dialog.getByLabel("Reason for correction").fill(reason);
  await check.uncheck();
  await expect(submit).toBeDisabled();
  await check.check();

  // The API can reject a correction if payout work starts after the latest GET.
  await fixture(
    { ...saved, canRequestCorrection: false },
    { conflict: "payout_work_in_progress" },
  );
  await submit.click();
  await expect(
    dialog.getByText(/A payout operation is in progress/),
  ).toBeVisible();
  await expect(submit).toBeDisabled();
  await fixture(saved, {
    conflict: "version_conflict",
    next: { data: { ...saved, version: 333 }, failure: 504 },
  });
  await expect(check).toBeEnabled({ timeout: 10_000 });
  await check.check();
  await submit.click();
  await expect(dialog.getByText(/The payout record changed/)).toBeVisible();
  await expect(submit).toBeDisabled();
  await expect(check).toBeEnabled();
  await check.check();
  await submit.click();

  await expect(section.getByText("Queued", { exact: true })).toBeVisible();
  const result = await request.post(control, { data: {} });
  const commands = (await result.json()).data.records.filter(
    (row: { path: string; method: string }) =>
      row.path === endpoint && row.method === "POST",
  );
  expect(commands).toHaveLength(4);
  expect(
    commands.map(
      (command: { body: { expectedVersion: number } }) =>
        command.body.expectedVersion,
    ),
  ).toEqual([332, 332, 333, 333]);
  for (const command of commands) {
    expect(command.authorization).toBe("Bearer pnd_a2_private");
    expect(command.account).toBe("user");
    expect(command.contentType).toBe("application/json");
    expect(command.key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(command.body).toMatchObject({
      firstName: "John Paul",
      lastName: "Doe",
      documentsVerified: true,
      reason,
    });
  }
  expect(
    new Set(commands.map((command: { key: string }) => command.key)).size,
  ).toBe(3);
  expect(commands[3]).toEqual(commands[2]);

  for (const [status, label] of [
    ["awaiting_provider", "Waiting for Bachs"],
    ["review_required", "Needs review"],
    ["completed", "Confirmed"],
  ]) {
    await fixture({
      ...saved,
      version: 334,
      status,
      canRequestCorrection: false,
    });
    await expect(section.getByText(label, { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  }
});
