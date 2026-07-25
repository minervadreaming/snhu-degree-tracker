(function () {
  "use strict";
  const tests = [], test = (name, fn) => tests.push({ name, fn });
  const eq = (actual, expected, message = "") => { if (actual !== expected) throw new Error(`${message} expected ${expected}, received ${actual}`); };
  const ok = (value, message) => { if (!value) throw new Error(message); };
  class MemoryStorage {
    constructor(values = {}) { this.values = { ...values }; }
    getItem(key) { return Object.prototype.hasOwnProperty.call(this.values, key) ? this.values[key] : null; }
    setItem(key, value) { this.values[key] = String(value); }
    removeItem(key) { delete this.values[key]; }
  }
  const blank = () => DegreeData.blank();
  const demo = () => DegreeData.demo();
  const completePlan = () => DegreeEngine.generatePlan(blank(), "conservative");

  test("New visitor defaults contain no user profile or completed history", () => {
    const s = blank(); eq(s.student.name, ""); eq(s.student.studentId, ""); eq(DegreeEngine.audit(s).completedCredits, 0); eq(s.meta.origin, "blank");
  });
  test("Fictional demo loads only through explicit demo factory", () => {
    eq(DegreeEngine.audit(blank()).completedCredits, 0); eq(DegreeEngine.audit(demo()).completedCredits, 30); eq(demo().meta.origin, "demo");
  });
  test("Existing version-2 local data survives migration", () => {
    const old = demo(); old.schemaVersion = 2; old.student.name = "Local User";
    const storage = new MemoryStorage({ [DegreePrivacy.KEYS.v2]: JSON.stringify(old) }), loaded = DegreePrivacy.load(storage);
    eq(loaded.state.student.name, "Local User"); eq(loaded.state.schemaVersion, 3); eq(loaded.state.meta.origin, "migrated-local");
  });
  test("Failed migration restores the exact prior browser records", () => {
    const broken = "{not valid json", storage = new MemoryStorage({ [DegreePrivacy.KEYS.v2]: broken });
    const loaded = DegreePrivacy.load(storage); ok(loaded.error, "migration error not shown"); eq(storage.getItem(DegreePrivacy.KEYS.v2), broken); eq(storage.getItem(DegreePrivacy.KEYS.current), null);
  });
  test("Blank initialization does not overwrite existing state", () => {
    const existing = demo(), raw = JSON.stringify(existing), storage = new MemoryStorage({ [DegreePrivacy.KEYS.current]: raw });
    const loaded = DegreePrivacy.load(storage); eq(loaded.firstRun, false); eq(storage.getItem(DegreePrivacy.KEYS.current), raw);
  });
  test("Imports parse and validate client-side without network access", () => {
    let calls = 0; const priorFetch = window.fetch; window.fetch = () => { calls++; throw new Error("network forbidden"); };
    try { const result = DegreePrivacy.importJson(JSON.stringify(demo())); eq(result.summary.completedCredits, 30); eq(calls, 0); } finally { window.fetch = priorFetch; }
  });
  test("Export serializes locally without a network request", () => {
    let calls = 0; const priorFetch = window.fetch; window.fetch = () => { calls++; };
    try { ok(DegreePrivacy.exportJson(blank()).includes('"schemaVersion": 3'), "export missing schema"); eq(calls, 0); } finally { window.fetch = priorFetch; }
  });
  test("Delete removes every known local plan key", () => {
    const storage = new MemoryStorage(Object.fromEntries(Object.values(DegreePrivacy.KEYS).map(k => [k, "data"])));
    DegreePrivacy.deleteAll(storage); Object.values(DegreePrivacy.KEYS).forEach(k => eq(storage.getItem(k), null));
  });
  test("Reset factory is blank and never demo data", () => { const s = blank(); eq(s.meta.origin, "blank"); eq(DegreeEngine.audit(s).selectedCredits, 0); });
  test("Student ID is optional and hidden by default", () => { const s = blank(); eq(s.student.studentId, ""); eq(s.ui.studentIdVisible, false); });
  test("Public production seed is blank while demo is obviously fictional", () => {
    const publicSeed = DegreeData.seed(); eq(publicSeed.meta.origin, "blank"); eq(publicSeed.student.name, ""); ok(/^Sample /.test(demo().student.name), "demo name is not clearly fictional");
  });
  test("No degree-plan operation invokes outbound requests", () => {
    let calls = 0; const priorFetch = window.fetch; window.fetch = () => { calls++; };
    try { DegreeEngine.audit(demo()); DegreeEngine.estimate(demo()); DegreeEngine.generatePlan(blank(), "balanced"); DegreePrivacy.exportJson(demo()); eq(calls, 0); } finally { window.fetch = priorFetch; }
  });
  test("Invalid imported data is rejected", () => { let rejected = false; try { DegreePrivacy.importJson('{"schemaVersion":3,"requirements":[]}'); } catch { rejected = true; } ok(rejected, "invalid import accepted"); });
  test("Production modules do not reference local private-development paths", () => {
    [...document.querySelectorAll("script[src]")].forEach(el => ok(!/private-data|private-seeds|local-backups/i.test(el.src), "private path imported"));
  });
  test("GitHub Pages assets use project-relative paths", () => {
    [...document.querySelectorAll("script[src],link[href]")].forEach(el => ok(!(el.getAttribute("src") || el.getAttribute("href")).startsWith("/"), "root-relative asset breaks project Pages"));
  });
  test("Fictional 30-credit demo produces 90 remaining credits", () => { const a = DegreeEngine.audit(demo()); eq(a.completedCredits, 30); eq(a.remainingToSelect, 90); });
  test("Planned, in-progress, and completed credits remain separate", () => {
    const s = blank(), rows = s.requirements.slice(0, 3); ["Planned","In Progress","Completed"].forEach((status, i) => { rows[i].selectedOptionId = rows[i].options[0].id; rows[i].status = status; });
    const a = DegreeEngine.audit(s); eq(a.plannedCredits, 3); eq(a.inProgressCredits, 3); eq(a.completedCredits, 3);
  });
  test("Generated plan reaches 120 and enforces both residency rules", () => {
    const a = DegreeEngine.audit(completePlan()); eq(a.selectedCredits, 120); ok(a.snhuSelected >= 30, "institutional residency failed"); ok(a.majorSnhu >= 12, "major residency failed");
  });
  test("Unverified equivalency makes a complete path provisional", () => {
    const s = completePlan(), r = s.requirements.find(x => x.status === "Planned"); DegreeEngine.optionFor(r).verification = "Unverified"; eq(DegreeEngine.audit(s).pathStatus, "Provisional");
  });
  test("Duplicate credential assignment is detected", () => {
    const s = completePlan(); ["free-5","free-6"].forEach(id => { const r = s.requirements.find(x => x.id === id), o = DegreeData.option(`${id}-credential`, "Credential", "DEMO", "Fictional credential", "Confirmed", { credentialId: "same-credential" }); r.options.push(o); r.selectedOptionId = o.id; }); eq(DegreeEngine.audit(s).duplicateAssignments.length, 1);
  });

  const results = document.querySelector("#results"); let passed = 0;
  tests.forEach(t => {
    const li = document.createElement("li");
    try { t.fn(); passed++; li.className = "pass"; li.textContent = `PASS — ${t.name}`; }
    catch (e) { li.className = "fail"; li.innerHTML = `FAIL — ${t.name}<pre>${e.stack || e.message}</pre>`; }
    results.appendChild(li);
  });
  document.querySelector("#summary").textContent = `${passed}/${tests.length} tests passed.`;
  document.title = passed === tests.length ? `PASS ${passed}/${tests.length}` : `FAIL ${passed}/${tests.length}`;
  window.TEST_RESULTS = { passed, total: tests.length };
})();
