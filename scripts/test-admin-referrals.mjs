import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
let body;
let ok = true;
let contentType = "application/json";
const requests = [];
const downloads = [];
const user = { uid: "admin", getIdToken: async () => "token" };
class TestURL extends URL {
  static createObjectURL() {
    return "blob:csv";
  }
  static revokeObjectURL() {}
}
const context = vm.createContext({
  URL: TestURL,
  URLSearchParams,
  Date,
  Number,
  Set,
  Error,
  auth: { currentUser: user },
  endpoints: {
    listAdminReferrals: "https://example.com/list",
    getAdminReferralSummary: "https://example.com/summary",
    exportAdminReferralsCsv: "https://example.com/export",
  },
  fetch: async (url, options) => {
    requests.push({ url, options });
    return {
      ok,
      json: async () => body,
      headers: { get: () => contentType },
      blob: async () => ({ csv: true }),
    };
  },
  document: {
    body: { appendChild() {} },
    createElement: () => ({
      click() {
        downloads.push(this.download);
      },
      remove() {},
    }),
  },
  setTimeout: (callback) => callback(),
});
function compile(path, ctx) {
  const source = fs
    .readFileSync(path, "utf8")
    .replace(/^import[\s\S]*?from ["'][^"']+["'];\n/gm, "");
  vm.runInContext(
    ts
      .transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      })
      .outputText.replace(/export /g, ""),
    ctx,
  );
}
compile("src/services/admin-referrals.service.ts", context);
const service = vm.runInContext("adminReferralsService", context);
const item = {
  id: "referral-1",
  referredUid: "user /?&=",
  referrerUid: "sender",
  referreduserType: "rider",
  referralCodeUsed: "SAVE & WIN",
  riderType: null,
  createdAt: "2026-10-17T10:00:00Z",
};
body = { items: [item], limit: 10, hasMore: false, nextCursor: null };
const signal = new AbortController().signal;
await service.list(
  {
    referredUid: item.referredUid,
    referreduserType: "rider",
    referralCodeUsed: item.referralCodeUsed,
  },
  undefined,
  undefined,
  signal,
);
const url = new URL(requests.at(-1).url);
assert.equal(url.searchParams.get("limit"), "10");
assert.equal(url.searchParams.get("referredUid"), item.referredUid);
assert.equal(url.searchParams.get("referralCodeUsed"), item.referralCodeUsed);
assert.equal(requests.at(-1).options.signal, signal);
assert.equal(requests.at(-1).options.headers.Authorization, "Bearer token");
await assert.rejects(service.list({}, 25), /Limit must/);
for (const invalid of [
  { ...body, limit: 20 },
  { ...body, hasMore: true },
  { ...body, items: [item, item] },
  { ...body, items: [{ ...item, createdAt: "bad" }] },
  { ...body, nextCursor: "unexpected" },
  null,
]) {
  const before = body;
  body = invalid;
  await assert.rejects(service.list({}), /invalid referral page/);
  body = before;
}
body = {
  totalReferrals: 12,
  totalReferrers: 3,
  userReferrals: 8,
  riderReferrals: 3,
  unknownTypeReferrals: 1,
  avgReferralsPerReferrer: 4,
  calculatedAt: item.createdAt,
};
await service.summary(signal);
assert.equal(
  new URL(requests.at(-1).url).search,
  "",
  "Global summary must not carry list filters",
);
body = { ...body, unknownTypeReferrals: 9 };
await assert.rejects(service.summary(), /invalid referral summary/);
contentType = "text/csv; charset=utf-8";
await service.exportCsv("2026-10-01", "2026-10-17", "rider");
assert.equal(downloads[0], "referrals_2026-10-01_2026-10-17.csv");
const exported = new URL(requests.at(-1).url);
assert.deepEqual(
  [...exported.searchParams.keys()],
  ["startDate", "endDate", "referreduserType"],
);
await assert.rejects(
  service.exportCsv("2026-02-30", "2026-03-01"),
  /valid start and end/,
);
await assert.rejects(
  service.exportCsv("2026-10-18", "2026-10-17"),
  /valid start and end/,
);
contentType = "application/json";
await assert.rejects(
  service.exportCsv("2026-10-01", "2026-10-17"),
  /CSV export/,
);
ok = false;
body = { error: "Summary requires backfill" };
await assert.rejects(service.summary(), /Summary requires backfill/);
context.auth.currentUser = null;
await assert.rejects(service.list({}), /Sign in/);

// Test cursor history, failure retry, page-size/filter resets, and stale responses.
const slots = [];
const effects = new Map();
const pending = [];
let position = 0;
let dirty = false;
const hookContext = vm.createContext({
  Error,
  AbortController,
  JSON,
  adminReferralsService: {
    list: (filters, limit, cursor, signal) =>
      new Promise((resolve, reject) =>
        pending.push({ filters, limit, cursor, signal, resolve, reject }),
      ),
  },
  useState: (initial) => {
    const index = position++;
    slots[index] ??= { value: initial };
    return [
      slots[index].value,
      (value) => {
        const next =
          typeof value === "function" ? value(slots[index].value) : value;
        if (!Object.is(next, slots[index].value)) {
          slots[index].value = next;
          dirty = true;
        }
      },
    ];
  },
  useEffect: (callback, deps) => {
    const index = position++;
    if (
      !slots[index] ||
      deps.some((value, i) => !Object.is(value, slots[index].deps[i]))
    ) {
      slots[index] = { ...slots[index], deps };
      effects.set(index, () => {
        slots[index].cleanup?.();
        slots[index].cleanup = callback();
      });
    }
  },
});
hookContext.useTableState = (_key, initial) => hookContext.useState(initial);
compile("src/hooks/use-referral-list.ts", hookContext);
let filters = {};
let hook;
function render() {
  do {
    position = 0;
    dirty = false;
    hook = hookContext.useReferralList(filters);
  } while (dirty);
  for (const effect of effects.values()) effect();
  effects.clear();
}
const settle = async () => {
  await new Promise((resolve) => setImmediate(resolve));
  render();
};
render();
assert.equal(pending[0].limit, 10);
assert.equal(pending[0].cursor, undefined);
pending[0].resolve({
  items: Array(10).fill(item),
  limit: 10,
  hasMore: true,
  nextCursor: "NEXT",
});
await settle();
hook.next();
render();
assert.equal(pending[1].cursor, "NEXT");
pending[1].reject(new Error("Network down"));
await settle();
assert.match(hook.error, /Network down/);
assert.equal(hook.loading, false);
hook.retry();
render();
assert.equal(
  pending[2].cursor,
  "NEXT",
  "Retry must preserve the failed page cursor",
);
pending[2].resolve({
  items: [item],
  limit: 10,
  hasMore: false,
  nextCursor: null,
});
await settle();
hook.previous();
render();
assert.equal(pending[3].cursor, undefined);
pending[3].resolve({
  items: Array(10).fill(item),
  limit: 10,
  hasMore: true,
  nextCursor: "NEXT",
});
await settle();
hook.next();
render();
filters = { referredUid: "new-user" };
render();
assert.equal(hook.pageIndex, 0);
assert.equal(pending.at(-1).cursor, undefined);
assert.equal(pending.at(-1).filters.referredUid, "new-user");
assert.equal(pending[4].signal.aborted, true);
pending[4].resolve({
  items: [item],
  limit: 10,
  hasMore: false,
  nextCursor: null,
});
await settle();
assert.equal(
  hook.data,
  null,
  "Obsolete response must not populate a different query",
);
pending
  .at(-1)
  .resolve({ items: [], limit: 10, hasMore: false, nextCursor: null });
await settle();
hook.setLimit(30);
render();
assert.equal(hook.pageIndex, 0);
assert.equal(pending.at(-1).limit, 30);
assert.equal(pending.at(-1).cursor, undefined);
for (const slot of slots) slot?.cleanup?.();
assert.equal(pending.at(-1).signal.aborted, true);
const page = fs.readFileSync("src/pages/referrals/index.tsx", "utf8");
assert.match(page, /h-\[32rem\] overflow-auto/);
assert.match(page, /sticky top-0/);
assert.match(page, /<ReferralSummaryCards \/>/);
assert.ok(
  page.indexOf('aria-label="Referral pagination"') > page.indexOf("</Table>"),
);
assert.doesNotMatch(
  page,
  /getAllReferrals|usersService|exportToCSV|referrals.reduce/,
);
console.log(
  "Referral client tests passed: API requests/validation, full export scope, global summary, cursor history/retries/resets, cancellation, and fixed scroll table wiring.",
);
