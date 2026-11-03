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
  await page.goto("/sign-in");
  await expect(
    page.getByRole("button", { name: /Forgot password/ }),
  ).toHaveCount(0);
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Admin access cannot be verified yet" }),
  ).toBeVisible();
}
test.beforeEach(async () => {
  await control({ reset: true });
});
test("native login keeps opaque tokens private and never infers administrator membership", async ({
  page,
  context,
}) => {
  const responses: string[] = [];
  page.on("response", (r) => {
    if (r.url().includes("/api/proxy/"))
      void r
        .text()
        .then((t) => responses.push(t))
        .catch(() => {});
  });
  await login(page);
  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name === "pnd-session-v2")!;
  expect(session).toMatchObject({ httpOnly: true, sameSite: "Strict" });
  expect(session.expires).toBeGreaterThan(Date.now() / 1000 + 86400);
  expect(cookies.some((c) => c.name === "pnd-access")).toBe(false);
  expect(await page.evaluate(() => document.cookie)).not.toContain("pnd_a2");
  expect(responses.join("")).not.toMatch(/pnd_a2_|pnd_r2_|127\.0\.0\.1:4319/);
  const records = (await control()).records;
  const request = records.find((r: any) => r.path === "/v2/auth/login");
  expect(request.body).toMatchObject({
    accountType: "user",
    email: "admin@example.test",
    password: "example-password",
    deviceName: "Admin dashboard",
  });
  expect(request.body.deviceId).toBeTruthy();
  expect(request.authorization).toBeUndefined();
  expect(request.key).toBeUndefined();
  for (const path of ["/v2/auth/session", "/v1/users/me"])
    expect(
      records.find((r: any) => r.path === path && r.authorization),
    ).toMatchObject({
      account: "user",
      authorization: "Bearer pnd_a2_private",
    });
  expect(
    records.some(
      (r: any) =>
        r.path.startsWith("/v1/admin/") || r.path.startsWith("/v1/auth/"),
    ),
  ).toBe(false);
  await page.screenshot({ path: "test-results/native-access-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/native-access-mobile.png" });
});
test("refresh retains device, rotates tokens, and is serialized across tabs", async ({
  page,
  context,
}) => {
  await login(page);
  const other = await context.newPage();
  await other.goto("/dashboard");
  await expect(
    other.getByRole("heading", { name: "Admin access cannot be verified yet" }),
  ).toBeVisible();
  await control({ expire: true });
  await Promise.all([
    page.getByRole("button", { name: "Retry access check" }).click(),
    other.getByRole("button", { name: "Retry access check" }).click(),
  ]);
  await expect.poll(async () => (await control()).rotations).toBe(1);
  const records = (await control()).records;
  const refresh = records.find((r: any) => r.path === "/v2/auth/refresh");
  expect(refresh.body.deviceId).toBe(
    records.find((r: any) => r.path === "/v2/auth/login").body.deviceId,
  );
  expect(refresh.body.refreshToken).toBe("pnd_r2_private");
  expect(refresh.key).toMatch(/^refresh:/);
  expect(refresh.authorization).toBeUndefined();
  const session = (await context.cookies()).find(
    (c) => c.name === "pnd-session-v2",
  )!;
  expect(session.value).toContain("rotated-1");
});
test("transient refresh failure preserves cookies and retry key; rejected refresh returns to sign in", async ({
  page,
  context,
}) => {
  await login(page);
  await control({ expire: true, failRefresh: true });
  await page.getByRole("button", { name: "Retry access check" }).click();
  await expect(
    page.locator('[role="alert"]:not(#__next-route-announcer__)'),
  ).toContainText("temporarily unavailable");
  expect(
    (await context.cookies()).some((c) => c.name === "pnd-session-v2"),
  ).toBe(true);
  await control({ failRefresh: false });
  await page.getByRole("button", { name: "Retry session" }).click();
  await expect(
    page.getByRole("heading", { name: "Admin access cannot be verified yet" }),
  ).toBeVisible();
  const refreshes = (await control()).records.filter(
    (r: any) => r.path === "/v2/auth/refresh" && r.body.refreshToken,
  );
  expect(refreshes).toHaveLength(2);
  expect(refreshes[0].key).toBe(refreshes[1].key);
  expect(refreshes[0].body).toEqual(refreshes[1].body);
  await control({ expire: true, denyRefresh: true });
  await page.getByRole("button", { name: "Retry access check" }).click();
  await expect(
    page.getByRole("button", { name: "Sign In", exact: true }),
  ).toBeVisible();
  expect(
    (await context.cookies()).some((c) => c.name === "pnd-session-v2"),
  ).toBe(false);
});
test("logout uses native boolean body and stable receipt key before clearing private cookies", async ({
  page,
  context,
}) => {
  await login(page);
  await control({ failLogout: true });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.locator('[role="alert"]:not(#__next-route-announcer__)'),
  ).toContainText("Retry signing out");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign In", exact: true }),
  ).toBeVisible();
  const writes = (await control()).records.filter(
    (r: any) => r.path === "/v2/auth/logout",
  );
  expect(writes[0].body).toEqual({ revokeAllSessions: false });
  expect(writes[0].key).toBe(writes[1].key);
  expect(
    (await context.cookies()).some((c) => c.name === "pnd-session-v2"),
  ).toBe(false);
  expect(
    (await context.cookies()).find((c) => c.name === "pnd-device")?.httpOnly,
  ).toBe(true);
});
test("password recovery uses the opaque reset token and native new-password rules", async ({
  page,
}) => {
  await page.goto("/forgot-password");
  await page
    .locator("summary")
    .filter({ hasText: /^Request reset instructions$/ })
    .click();
  await page.getByLabel("Email *", { exact: true }).fill("admin@example.test");
  await page
    .getByRole("button", { name: "Request reset instructions", exact: true })
    .click();
  await expect(page.getByText(/If this account is eligible/)).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: /^Reset password$/ })
    .click();
  await page.getByLabel("Reset token from email *").fill("pnd_reset2_private");
  await page.getByLabel("New password *").fill("ValidPass123");
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(
    page.getByText(/Password updated and sessions revoked/),
  ).toBeVisible();
  const write = (await control()).records.find(
    (r: any) => r.path === "/v2/auth/password-reset/confirm",
  );
  expect(write.body).toEqual({
    resetToken: "pnd_reset2_private",
    newPassword: "ValidPass123",
  });
});
test("password change is absent and its proxy endpoints are unavailable", async ({
  page,
}) => {
  await login(page);
  await page.getByText("Manage your own session", { exact: true }).click();
  await expect(
    page.getByLabel("Current password", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Change password/i }),
  ).toHaveCount(0);
  await expect(
    page.locator("summary").filter({ hasText: /^Sign out all sessions$/ }),
  ).toBeVisible();
  for (const path of ["/v2/auth/reauthenticate", "/v2/auth/password/change"]) {
    const response = await page.request.post(`/api/proxy${path}`, {
      headers: { Origin: "http://localhost:4320" },
      data: {},
    });
    expect(response.status()).toBe(404);
  }
  expect(
    (await control()).records.some((r: any) =>
      /reauthenticate|password\/change/.test(r.path),
    ),
  ).toBe(false);
});
test("proxy rejects retired auth, management secrets, unsupported writes and account-context spoofing", async ({
  page,
  request,
}) => {
  for (const path of ["/v1/auth/login", "/v1/admin/users/super-admin"])
    expect(
      (
        await request.post(`/api/proxy${path}`, {
          headers: { Origin: "http://localhost:4320" },
          data: {},
        })
      ).status(),
    ).toBe(404);
  await login(page);
  expect(
    (
      await page.request.put("/api/proxy/v1/admin/config/mobile/user/android", {
        headers: { Origin: "http://localhost:4320" },
        data: {},
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.post("/api/proxy/v1/admin/users/target/role", {
        headers: { Origin: "http://localhost:4320" },
        data: {},
      })
    ).status(),
  ).toBe(400);
  const result = await page.request.get("/api/proxy/v2/auth/session", {
    headers: { Authorization: "Bearer attacker", "X-Account-Type": "rider" },
  });
  expect(result.status()).toBe(200);
  expect((await control()).records.at(-1)).toMatchObject({
    authorization: "Bearer pnd_a2_private",
    account: "user",
  });
  expect(
    (
      await request.post("/api/proxy/v2/auth/login", {
        headers: { Origin: "http://localhost:4320" },
        data: { email: "x", password: "x", accountType: "admin" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/proxy/v2/auth/login?x=1", {
        headers: { Origin: "http://localhost:4320" },
        data: {},
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/proxy/v2/auth/login", {
        headers: { Origin: "https://other.test" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/proxy/v2/auth/login", {
        headers: { Origin: "http://localhost:4320" },
        data: { password: "x".repeat(9000) },
      })
    ).status(),
  ).toBe(413);
});
test("incorrect credentials and non-user token responses never establish a dashboard session", async ({
  page,
  context,
}) => {
  await control({ invalidLogin: true });
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.locator('[role="alert"]:not(#__next-route-announcer__)'),
  ).toContainText("Incorrect email or password");
  await control({ invalidLogin: false, badContext: true });
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.locator('[role="alert"]:not(#__next-route-announcer__)'),
  ).toContainText("invalid session");
  expect(
    (await context.cookies()).some((c) => c.name === "pnd-session-v2"),
  ).toBe(false);
});

test("refresh does not replay beyond the recovery window and all-session logout uses the native flag", async ({
  page,
}) => {
  await login(page);
  await page.getByText("Manage your own session", { exact: true }).click();
  await page
    .locator("summary")
    .filter({ hasText: /^Sign out all sessions$/ })
    .click();
  await page
    .getByRole("button", { name: "Sign out all sessions", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign In", exact: true }),
  ).toBeVisible();
  expect(
    (await control()).records.find((r: any) => r.path === "/v2/auth/logout")
      .body,
  ).toEqual({ revokeAllSessions: true });
  await login(page);
  await control({ expire: true });
  await page.evaluate(() =>
    localStorage.setItem("pnd-refresh-started", String(Date.now() - 130000)),
  );
  const before = (await control()).records.filter(
    (r: any) => r.path === "/v2/auth/refresh",
  ).length;
  await page.getByRole("button", { name: "Retry access check" }).click();
  await expect(
    page.getByRole("button", { name: "Sign In", exact: true }),
  ).toBeVisible();
  expect(
    (await control()).records.filter((r: any) => r.path === "/v2/auth/refresh"),
  ).toHaveLength(before);
});
