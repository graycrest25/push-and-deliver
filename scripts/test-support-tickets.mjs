import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file, context = {}) {
  const source = fs
    .readFileSync(file, "utf8")
    .replace(/^import[\s\S]*?from ["'][^"']+["'];\n/gm, "");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const sandbox = vm.createContext({ exports: {}, ...context });
  vm.runInContext(outputText, sandbox);
  return sandbox.exports;
}
const { canViewTicket, filterTickets } = load("src/lib/support-tickets.ts");
for (const role of [
  "super",
  "regular",
  "customercare",
  "verifier",
  undefined,
]) {
  assert.equal(canViewTicket({ status: "open" }, role), true);
  assert.equal(canViewTicket({ status: "closed" }, role), role === "super");
}
const tickets = [
  {
    id: "closed-id",
    status: "closed",
    userName: "Aisha Bello",
    platform: "Food",
    tags: ["refund"],
  },
  {
    id: "open-id",
    status: "open",
    userId: "rider-id",
    platform: "Ride Hailing",
    lastMessage: "Driver not found",
  },
  { id: "legacy-id" },
];
assert.equal(filterTickets(tickets, "", "all", "all").length, 3);
assert.equal(
  filterTickets(tickets, " AISHA ", "closed", "Food")[0].id,
  "closed-id",
);
assert.equal(filterTickets(tickets, "refund", "all", "all")[0].id, "closed-id");
assert.equal(
  filterTickets(tickets, "driver", "open", "Ride Hailing")[0].id,
  "open-id",
);
assert.equal(filterTickets(tickets, "driver", "closed", "all").length, 0);

let ticket = { status: "open" };
let exists = true;
let failCommit = false;
const committed = [];
let pending = [];
const { supportService } = load("src/services/support.service.ts", {
  db: {},
  console: { error() {} },
  Timestamp: { fromDate: (date) => date },
  doc: (...parts) => parts.join("/"),
  collection: (...parts) => parts.join("/"),
  runTransaction: async (_db, callback) => {
    pending = [];
    await callback({
      get: async () => ({ exists: () => exists, data: () => ticket }),
      set: (path, data) => pending.push({ type: "set", path, data }),
      update: (path, data) => pending.push({ type: "update", path, data }),
    });
    if (failCommit) throw new Error("write failed");
    committed.push(...pending);
  },
});
await supportService.sendSupportMessage("ticket-id", "admin-id", "Hello");
assert.equal(committed.length, 2);
assert.equal(committed[0].data.message, "Hello");
assert.equal(committed[1].data.lastMessage, "Hello");
committed.length = 0;
await supportService.closeTicket("ticket-id", "admin-id", "Resolved");
assert.equal(committed.length, 2);
assert.match(committed[0].path, /SupportTickets\/ticket-id\/Messages/);
assert.equal(committed[0].data.message, "Resolved");
assert.equal(committed[1].data.status, "closed");
assert.equal(committed[1].data.lastMessage, "Resolved");
committed.length = 0;
ticket.status = "closed";
await assert.rejects(
  supportService.sendSupportMessage("ticket-id", "admin-id", "Reply"),
  /read-only/,
);
await assert.rejects(
  supportService.closeTicket("ticket-id", "admin-id", "Again"),
  /already closed/,
);
assert.equal(committed.length, 0);
ticket.status = "open";
failCommit = true;
await assert.rejects(
  supportService.closeTicket("ticket-id", "admin-id", "Resolved"),
  /write failed/,
);
assert.equal(committed.length, 0);
failCommit = false;
exists = false;
await assert.rejects(
  supportService.closeTicket("missing-id", "admin-id", "Resolved"),
  /not found/,
);
assert.equal(committed.length, 0);
console.log(
  "Support ticket tests passed: role access, search, filters, atomic replies/closure, retained history, closed reply protection, and failed writes.",
);
