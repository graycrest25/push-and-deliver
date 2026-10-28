import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as jsxRuntime from "react/jsx-runtime";

let active;
let provided;
let pathname = "/riders";
let user = { id: "admin", adminType: "super" };
const same = (a, b) =>
  a?.length === b?.length &&
  a.every((value, index) => Object.is(value, b[index]));
const react = {
  createContext: () => ({ Provider: "Provider" }),
  useContext: () => provided,
  useState(initial) {
    const instance = active;
    const index = instance.position++;
    if (!(index in instance.slots))
      instance.slots[index] = {
        value: typeof initial === "function" ? initial() : initial,
      };
    const slot = instance.slots[index];
    slot.setter ??= (update) => {
      const next = typeof update === "function" ? update(slot.value) : update;
      if (!Object.is(next, slot.value)) {
        slot.value = next;
        instance.dirty = true;
      }
    };
    return [slot.value, slot.setter];
  },
  useRef(initial) {
    const index = active.position++;
    active.slots[index] ??= { current: initial };
    return active.slots[index];
  },
  useMemo(factory, deps) {
    const index = active.position++;
    if (!active.slots[index] || !same(active.slots[index].deps, deps))
      active.slots[index] = { value: factory(), deps };
    return active.slots[index].value;
  },
  useCallback(fn, deps) {
    return react.useMemo(() => fn, deps);
  },
  useEffect(fn, deps) {
    const instance = active;
    const index = instance.position++;
    const previous = instance.slots[index];
    if (!previous || !same(previous.deps, deps)) {
      instance.slots[index] = { deps, cleanup: previous?.cleanup };
      instance.effects.set(index, () => {
        instance.slots[index].cleanup?.();
        instance.slots[index].cleanup = fn();
      });
    }
  },
};
function harness(fn) {
  const instance = { slots: [], effects: new Map(), position: 0, dirty: false };
  return {
    render() {
      let result;
      let count = 0;
      do {
        assert.ok(++count < 20, "Hooks must settle");
        instance.position = 0;
        instance.dirty = false;
        active = instance;
        result = fn();
      } while (instance.dirty);
      for (const effect of instance.effects.values()) effect();
      instance.effects.clear();
      return result;
    },
    unmount() {
      for (const slot of instance.slots) slot.cleanup?.();
    },
  };
}
function load(file, imports) {
  const context = vm.createContext({
    exports: {},
    Map,
    JSON,
    require: (name) =>
      name === "react"
        ? react
        : name === "react/jsx-runtime"
          ? jsxRuntime
          : (imports[name] ?? {}),
  });
  vm.runInContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    context,
  );
  return context.exports;
}
const table = load("src/contexts/TableStateContext.tsx", {
  "react-router-dom": { useLocation: () => ({ pathname }) },
  "@/contexts/UserContext": { useCurrentUser: () => ({ user }) },
});
const { useFirestorePagination } = load(
  "src/hooks/use-firestore-pagination.ts",
  { "@/contexts/TableStateContext": table },
);
const provider = harness(() => table.TableStateProvider({ children: null }));
let section;
let sectionKey;
function route(path) {
  pathname = path;
  const element = provider.render();
  if (sectionKey !== element.key) {
    section?.unmount();
    sectionKey = element.key;
    section = harness(() => element.type({ ...element.props, pathname }));
  }
  provided = section.render().props.value;
}
const documents = Array.from({ length: 103 }, (_, index) => ({
  id: String(index),
}));
function list(scope = "") {
  return harness(() => {
    const [search, setSearch] = table.useTableState("filter:search", "");
    const [filter, setFilter] = table.useTableState("filter:status", "all");
    const pagination = useFirestorePagination(scope, {
      term: search,
      fields: ["id"],
    });
    return { search, setSearch, filter, setFilter, pagination };
  });
}
function fetchPage(instance) {
  const { pagination } = instance.render();
  const start = pagination.options.cursor
    ? Number(pagination.options.cursor.id) + 1
    : 0;
  const rows = documents.slice(start, start + pagination.pageSize);
  pagination.options.onPage({
    total: documents.length,
    lastDocument: rows.at(-1) ?? null,
  });
  return rows;
}
function goToFourth(instance) {
  fetchPage(instance);
  for (let page = 1; page < 4; page++) {
    instance.render().pagination.next();
    fetchPage(instance);
  }
  assert.equal(instance.render().pagination.pageIndex, 3);
}
for (const path of [
  "/riders",
  "/users",
  "/shipment-orders",
  "/product-orders",
  "/restaurant-orders",
  "/ride-hailing",
  "/vendors",
  "/ecommerce-merchants",
]) {
  route(path);
  let view = list();
  view.render().setSearch("matching");
  view.render().setFilter("verified");
  goToFourth(view);
  const oldOptions = view.render().pagination.options;
  view.unmount();
  assert.equal(
    oldOptions.isCurrent(),
    false,
    "Unmounted requests must be stale",
  );
  route(`${path}/selected`);
  const detail = list("selected");
  assert.equal(
    detail.render().pagination.pageIndex,
    0,
    "Detail tables have independent pagination",
  );
  detail.unmount();
  route(path);
  view = list();
  const restored = view.render();
  assert.equal(
    restored.pagination.pageIndex,
    3,
    `${path} restores page 4 for browser Back or in-app back navigation`,
  );
  assert.equal(restored.search, "matching");
  assert.equal(restored.filter, "verified");
  assert.equal(
    fetchPage(view)[0].id,
    "30",
    "Restore the actual page cursor, not just the page number",
  );
  view.render().pagination.previous();
  assert.equal(
    fetchPage(view)[0].id,
    "20",
    "Previous cursor history survives detail navigation",
  );
  view.render().pagination.setPageSize(25);
  fetchPage(view);
  view.render().pagination.next();
  fetchPage(view);
  view.unmount();
  route(`${path}/selected`);
  route(path);
  view = list();
  assert.equal(view.render().pagination.pageSize, 25);
  assert.equal(view.render().pagination.pageIndex, 1);
  assert.equal(fetchPage(view)[0].id, "25");
  view.render().setSearch("changed");
  assert.equal(
    view.render().pagination.pageIndex,
    0,
    "Changing search still resets pagination",
  );
  view.unmount();
  route("/dashboard");
  route(path);
  view = list();
  assert.equal(
    view.render().pagination.pageIndex,
    0,
    "Returning after switching sections starts at page 1",
  );
  assert.equal(view.render().pagination.pageSize, 10);
  assert.equal(view.render().search, "");
  view.unmount();
}
route("/riders");
let view = list();
goToFourth(view);
view.unmount();
user = { id: "another-admin", adminType: "super" };
route("/riders");
view = list();
assert.equal(
  view.render().pagination.pageIndex,
  0,
  "Sessions must not share table state",
);
view.unmount();
route("/ecommerce-merchants");
route("/ecommerce-merchants/merchant/products");
view = list("merchant");
goToFourth(view);
view.unmount();
route("/ecommerce-merchants/merchant/products/product");
route("/ecommerce-merchants/merchant/products");
view = list("merchant");
assert.equal(
  view.render().pagination.pageIndex,
  3,
  "Nested products retain page 4",
);
assert.equal(fetchPage(view)[0].id, "30");
console.log(
  "Table navigation checks passed: page 4 restoration across all main lists, exact rows/cursors, search and filters, page size, previous, nested products, section/session resets, and stale request guards.",
);
