import { test, expect, type Page } from "@playwright/test";
async function control(body: Record<string, unknown> = {}) {
  return (
    await (
      await fetch("http://127.0.0.1:4319/control", {
        method: "POST",
        body: JSON.stringify(body),
      })
    ).json()
  ).data;
}
async function login(page: Page, adminType = "regular") {
  await control({ reset: true, latest: true, adminType });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#workspace-content")).toBeVisible();
}
test("local types create inactive, edit GET version, and retry with the same key", async ({
  page,
}) => {
  await login(page);
  await page.goto("/delivery-zones?tab=local-types");
  await expect(
    page.locator('td[data-column="name"]').filter({ hasText: /^Premium$/ }),
  ).toBeVisible();
  const list = (await control()).records.find(
    (r: any) => r.path === "/v1/admin/shipping/local-types",
  );
  expect(list.query).toMatchObject({ includeInactive: "true", limit: "100" });
  const create = page
    .locator("details")
    .filter({ hasText: "Create local shipping type" });
  await create.locator("summary").click();
  await create.getByLabel("Type ID").fill("express");
  await create.getByLabel("Name").fill("Express");
  await create.getByLabel("Delivery details").fill("Deliveries in 1–2 days");
  await create
    .getByLabel("Reason for change")
    .fill("Introduce express service");
  await create
    .getByRole("button", { name: "Create local shipping type", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Express", exact: true }),
  ).toBeVisible();
  const post = (await control()).records.find(
    (r: any) => r.method === "POST" && r.path.endsWith("/local-types"),
  );
  expect(post.body).toEqual({
    id: "express",
    name: "Express",
    details: "Deliveries in 1–2 days",
    active: false,
    reason: "Introduce express service",
  });
  expect(post.account).toBe("user");
  expect(post.key).toBeTruthy();
  await page.goto("/delivery-zones/local-types/premium");
  const edit = page
    .locator("details")
    .filter({ hasText: "Save local shipping type" });
  await edit.locator("summary").click();
  await edit
    .getByLabel("Delivery details")
    .fill("Deliveries in 2–3 working days");
  await edit.getByLabel("Reason for change").fill("Update delivery estimate");
  await control({ localTypeFailure: true });
  await edit
    .getByRole("button", { name: "Save local shipping type", exact: true })
    .click();
  await expect(edit.getByText("Retry save.", { exact: true })).toBeVisible();
  await edit
    .getByRole("button", { name: "Save local shipping type", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save local shipping type", exact: true }),
  ).not.toBeVisible();
  const patches = (await control()).records.filter(
    (r: any) => r.method === "PATCH" && r.path.endsWith("/local-types/premium"),
  );
  expect(patches).toHaveLength(2);
  expect(patches[0].body).toEqual({
    details: "Deliveries in 2–3 working days",
    expectedVersion: 7,
    reason: "Update delivery estimate",
  });
  expect(patches[1].key).toBe(patches[0].key);
  expect(patches[1].rawBody).toBe(patches[0].rawBody);
});
test("local type proxy rejects non-operational admins", async ({ page }) => {
  await login(page, "customercare");
  const status = await page.evaluate(
    async () =>
      (
        await fetch(
          "/api/proxy/v1/admin/shipping/local-types?includeInactive=true&limit=100",
        )
      ).status,
  );
  expect(status).toBe(403);
  expect(
    (await control()).records.filter((r: any) =>
      r.path.includes("/local-types"),
    ),
  ).toHaveLength(0);
});
