import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function loadSource(path, context) {
  const source = fs
    .readFileSync(path, "utf8")
    .replace(/^import[\s\S]*?from ["'][^"']+["'];\n/gm, "");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  });
  vm.runInContext(outputText.replace(/export /g, ""), context);
}

// A collection with duplicate sort values tests snapshot cursor boundaries.
const documents = Array.from({ length: 63 }, (_, index) => ({
  id: String(index).padStart(3, "0"),
  value: Math.floor(index / 3),
}));
const reads = [];
let rejectRead = false;
let listener;
const context = vm.createContext({
  query: (base, ...constraints) => ({ base: base.base ?? base, constraints }),
  limit: (size) => ({ kind: "limit", size }),
  startAfter: (cursor) => ({ kind: "cursor", cursor }),
  getDocs: async (q) => {
    if (rejectRead) throw new Error("permission-denied");
    const cursor = q.constraints.find((c) => c.kind === "cursor")?.cursor;
    const size = q.constraints.find((c) => c.kind === "limit")?.size;
    const start = cursor
      ? documents.findIndex((d) => d.id === cursor.id) + 1
      : 0;
    const docs = documents.slice(start, start + size);
    reads.push({ docs, size, cursor });
    return { docs, size: docs.length };
  },
  getCountFromServer: async (base) => {
    assert.equal(
      base,
      "collection-query",
      "Counts must use the full base query, without the page cursor or limit",
    );
    return { data: () => ({ count: documents.length }) };
  },
  onSnapshot: (q, callback) => {
    listener = callback;
    return () => {};
  },
});
loadSource("src/lib/firestore-pagination.ts", context);

const slots = [];
let position = 0;
let dirty = false;
const equalDeps = (a, b) =>
  a?.length === b?.length &&
  a.every((value, index) => Object.is(value, b[index]));
Object.assign(context, {
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
  useRef: (value) => {
    const index = position++;
    slots[index] ??= { current: value };
    return slots[index];
  },
  useMemo: (factory, deps) => {
    const index = position++;
    if (!slots[index] || !equalDeps(slots[index].deps, deps))
      slots[index] = { value: factory(), deps };
    return slots[index].value;
  },
  useCallback: (callback, deps) => context.useMemo(() => callback, deps),
});
loadSource("src/hooks/use-firestore-pagination.ts", context);
function render(key = "users") {
  let result;
  let attempts = 0;
  do {
    assert.ok(
      ++attempts < 10,
      "Pagination should settle without a render loop",
    );
    dirty = false;
    position = 0;
    result = context.useFirestorePagination(key);
  } while (dirty);
  return result;
}
async function fetchPage(pagination) {
  return context.getPaginatedDocs("collection-query", pagination.options);
}

let pagination = render();
let page = await fetchPage(pagination);
assert.equal(page.docs.length, 10);
pagination = render();
assert.equal(pagination.total, 63);
assert.equal(pagination.totalPages, 7);
const ids = page.docs.map((doc) => doc.id);
for (let index = 1; index < 7; index++) {
  pagination.next();
  pagination = render();
  page = await fetchPage(pagination);
  pagination = render();
  ids.push(...page.docs.map((doc) => doc.id));
}
assert.equal(
  new Set(ids).size,
  63,
  "No duplicates or gaps across cursor boundaries",
);
assert.equal(page.docs.length, 3, "Last page may contain fewer rows");
pagination.next();
pagination = render();
assert.equal(pagination.pageIndex, 6, "Next is a no-op on the last page");
pagination.previous();
pagination = render();
page = await fetchPage(pagination);
pagination = render();
assert.equal(
  page.docs[0].id,
  "050",
  "Previous must query using the saved preceding cursor",
);

rejectRead = true;
pagination.next();
pagination = render();
await assert.rejects(fetchPage(pagination), /permission-denied/);
pagination = render();
assert.equal(
  pagination.pageIndex,
  5,
  "A failed next page restores the last successful page",
);
assert.equal(pagination.pending, false);
rejectRead = false;
for (const size of [25, 50]) {
  pagination.setPageSize(size);
  pagination = render();
  page = await fetchPage(pagination);
  pagination = render();
  assert.equal(pagination.pageIndex, 0);
  assert.equal(page.docs.length, size);
  assert.equal(pagination.totalPages, Math.ceil(63 / size));
}
const oldOptions = pagination.options;
pagination.next();
pagination = render();
await fetchPage(pagination);
pagination = render();
pagination = render("other-user");
assert.equal(pagination.pageIndex, 0);
assert.equal(
  pagination.options.cursor,
  null,
  "Changing a user/query resets the cursor",
);
oldOptions.onPage({ total: 999, lastDocument: documents[0] });
pagination = render("other-user");
assert.equal(
  pagination.total,
  0,
  "Stale query metadata must not replace the new list total",
);
await assert.rejects(
  context.getPaginatedDocs("collection-query", { pageSize: 20 }),
  /Page size/,
);
assert.ok(
  reads.every((read) => read.docs.length <= read.size),
  "All reads are bounded at the query layer",
);

let emitted = 0;
const unsubscribe = context.subscribePaginatedDocs(
  "collection-query",
  {},
  () => emitted++,
  assert.fail,
);
await listener({ docs: documents.slice(0, 10) });
assert.equal(emitted, 1);
unsubscribe();
await listener({ docs: documents.slice(0, 10) });
assert.equal(emitted, 1, "Unsubscribed listeners must not update state");

documents.length = 0;
pagination = render("empty-list");
page = await fetchPage(pagination);
pagination = render("empty-list");
assert.equal(page.docs.length, 0);
assert.equal(pagination.totalPages, 0);
pagination.next();
assert.equal(
  render("empty-list").pageIndex,
  0,
  "Empty collections cannot advance",
);

console.log(
  "Pagination tests passed: query limits, totals, duplicate sort values, last page, previous, failed next, size changes, query resets, stale metadata, and listener cleanup.",
);
