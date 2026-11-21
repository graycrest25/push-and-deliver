import { expect, test, type Page } from "@playwright/test";

test.setTimeout(90_000);

async function login(page: Page) {
  await fetch("http://127.0.0.1:4319/control", {
    method: "POST",
    body: JSON.stringify({ reset: true, adminType: "super" }),
  });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#workspace-content")).toBeVisible({
    timeout: 30_000,
  });
}

test("Bachs rider payout displays monitoring fields and never exposes manual controls", async ({
  page,
}) => {
  await login(page);
  await page.route("**/api/proxy/v1/admin/withdrawals/automated", (route) =>
    route.fulfill({
      json: {
        data: {
          id: "automated",
          payoutMethod: "bachs",
          status: "approved",
          assignedToMe: true,
          amountMinor: 500000,
          withdrawalFeeMinor: 20000,
          totalDebitMinor: 520000,
          accountNumberMasked: "******1234",
          reviewRequired: true,
        },
      },
    }),
  );
  await page.goto("/withdrawals/automated");
  await expect(
    page.getByText("Bachs processes this payout automatically.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByText("₦5,200.00")).toBeVisible();
  await expect(
    page.locator("summary", { hasText: /Claim|Reject|Record successful/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Show bank details for payment" }),
  ).toHaveCount(0);
});

test("company payout recovers a lost response across reload with the same body and key", async ({
  page,
}) => {
  await login(page);
  const root = "**/api/proxy/v1/admin/payments/company";
  await page.route(root + "/balance", (route) =>
    route.fulfill({
      json: {
        data: {
          currency: "NGN",
          availableMinor: 10000000,
          nativeLiabilitiesMinor: 7000000,
          earnedCompanyFundsMinor: 2000000,
          withdrawableMinor: 1000000,
        },
      },
    }),
  );
  await page.route(root + "/banks", async (route) => {
    const { bankCode, accountNumber } = route.request().postDataJSON();
    expect(bankCode).toBe("058");
    if (accountNumber === "0123456789") {
      await route.fulfill({
        status: 409,
        json: { error: { code: "company_bank_name_mismatch" } },
      });
    } else {
      expect(accountNumber).toBe("0123456788");
      await route.fulfill({
        json: { data: { bankAccountId: "verified-bank" } },
      });
    }
  });
  await page.route(root + "/withdrawal-quotes", async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      bankAccountId: "verified-bank",
      amountMinor: 100000,
      currency: "NGN",
    });
    await route.fulfill({
      json: {
        data: {
          quoteId: "company-quote",
          amountMinor: 100000,
          providerFeeReserveMinor: 10000,
          reservedDebitMinor: 110000,
          currency: "NGN",
          expiresAt: new Date(Date.now() + 120000).toISOString(),
        },
      },
    });
  });
  const commands: Array<{ key: string; body: unknown }> = [];
  await page.route(root + "/withdrawals", async (route) => {
    commands.push({
      key: route.request().headers()["idempotency-key"],
      body: route.request().postDataJSON(),
    });
    if (commands.length === 1) await route.abort();
    else
      await route.fulfill({
        json: {
          data: {
            statusUrl: "/v1/admin/payments/company/withdrawals/payout-1",
          },
        },
      });
  });
  let statusReads = 0;
  await page.route(root + "/withdrawals/payout-1", (route) => {
    statusReads++;
    return route.fulfill({
      json: {
        data: {
          id: "payout-1",
          status: "completed",
          providerFeeMinor: 8000,
        },
      },
    });
  });
  await page.goto("/company-funds");
  await expect(page.getByText("₦10,000.00", { exact: true })).toBeVisible();
  await page.locator("summary", { hasText: "Register company bank" }).click();
  await page.getByLabel("Bank code").fill("058");
  await page.getByLabel("Account number").fill("0123456789");
  const register = page.getByRole("button", {
    name: "Register company bank",
    exact: true,
  });
  await register.click();
  await expect(
    page.getByRole("region", { name: "Company bank" }).getByRole("alert"),
  ).toContainText("Use a bank account in the company’s legal name.");
  await page.getByLabel("Account number").fill("0123456788");
  await register.click();
  await expect(
    page.getByText("Saved successfully.", { exact: true }),
  ).toBeVisible();
  await page.locator("summary", { hasText: "Request quote" }).click();
  await expect(page.getByLabel("Verified company bank ID")).toHaveValue(
    "verified-bank",
  );
  await page.getByLabel("Withdrawal amount").fill("1000");
  await page
    .getByRole("button", { name: "Request quote", exact: true })
    .click();
  await expect(page.getByText("₦1,100.00", { exact: true })).toBeVisible();
  const reason = "Transfer approved company earnings";
  await page.getByLabel("Withdrawal reason").fill(reason);
  await page.getByRole("button", { name: "Submit company withdrawal" }).click();
  await expect(
    page.getByRole("button", { name: "Retry same withdrawal" }),
  ).toBeEnabled();
  await page.reload();
  await page.getByLabel("Withdrawal reason").fill(reason);
  await page.getByRole("button", { name: "Retry same withdrawal" }).click();
  await expect(page.getByText("₦80.00", { exact: true })).toBeVisible();
  expect(commands).toHaveLength(2);
  expect(commands[0].key).toBeTruthy();
  expect(commands[0]).toEqual(commands[1]);
  expect(statusReads).toBe(1);
});

test("rider identity backfill confirms document review and sends only the current profile version and reason", async ({
  page,
}) => {
  await login(page);
  let approved = false;
  const profile = "**/api/proxy/v1/admin/users/rider-identity?type=riders";
  await page.route(profile, (route) =>
    route.fulfill({
      json: {
        data: {
          uid: "rider-identity",
          username: "Approved Rider",
          verificationStatus: "verified",
          version: approved ? 8 : 7,
          payoutIdentity: approved ? { name: "Approved Rider" } : null,
        },
      },
    }),
  );
  await page.route(
    "**/api/proxy/v1/admin/riders/rider-identity/payout-identity",
    (route) => {
      expect(route.request().postDataJSON()).toEqual({
        expectedVersion: 7,
        reason: "Identity checked against approved rider documents",
      });
      expect(route.request().headers()["idempotency-key"]).toBeTruthy();
      approved = true;
      return route.fulfill({ json: { data: { version: 8 } } });
    },
  );
  await page.goto("/riders/rider-identity");
  await page.locator("summary", { hasText: "Approve payout identity" }).click();
  await page
    .getByLabel("I checked the approved rider documents")
    .selectOption("Yes");
  const form = page.locator("details", {
    has: page.locator("summary", { hasText: "Approve payout identity" }),
  });
  await form
    .getByLabel("Reason for change")
    .fill("Identity checked against approved rider documents");
  await form.getByRole("button", { name: "Approve payout identity" }).click();
  await expect(page.getByText("Payout identity approved.")).toBeVisible();
  await expect(form).toHaveCount(0);
});
