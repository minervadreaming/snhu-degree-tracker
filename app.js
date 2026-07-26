(function () {
  "use strict";
  const q = (s, root = document) => root.querySelector(s);
  const qa = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = v => String(v ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const money = n => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
  const loaded = DegreePrivacy.load(localStorage);
  let state = loaded.state || DegreeData.blank();
  let initialized = !!loaded.state;
  let migrated = loaded.migrated;
  function save() {
    if (!initialized) return;
    const scenario = state.scenarios?.find(s => s.id === state.activeScenarioId);
    if (scenario) {
      scenario.selections = Object.fromEntries(state.requirements.filter(DegreeEngine.selected).map(r => [r.id, r.selectedOptionId]));
      scenario.statuses = Object.fromEntries(state.requirements.filter(DegreeEngine.selected).map(r => [r.id, r.status]));
    }
    state.meta.updatedAt = new Date().toISOString();
    DegreePrivacy.save(localStorage, state);
  }
  function commitAndRender() { save(); render(); }
  const activeScenario = () => state.scenarios.find(s => s.id === state.activeScenarioId) || state.scenarios[0];

  function setTab(tab) {
    state.ui.tab = tab; save();
    qa("[data-page]").forEach(x => x.classList.toggle("active", x.dataset.page === tab));
    qa("[data-tab]").forEach(x => x.classList.toggle("active", x.dataset.tab === tab));
  }

  function updateRequirement(id, field, value) {
    const r = state.requirements.find(x => x.id === id); if (!r) return;
    r[field] = value;
    if (field === "selectedOptionId") r.status = value ? (r.status === "Available" ? "Planned" : r.status) : "Available";
    if (field === "status" && !["Planned","In Progress","Completed"].includes(value)) r.selectedOptionId = "";
    if (field === "status" && ["Planned","In Progress","Completed"].includes(value) && !r.selectedOptionId) r.selectedOptionId = r.options[0]?.id || "";
    commitAndRender();
  }

  function renderOverview() {
    const a = DegreeEngine.audit(state), e = DegreeEngine.estimate(state);
    q("#programName").textContent = `${state.student.program} · Catalog ${state.student.catalog}`;
    q("#studentName").textContent = state.student.name || "Your degree plan";
    q("#selectedBig").textContent = a.selectedCredits; q("#earnedBig").textContent = `${a.completedCredits} earned`;
    q("#ring").style.setProperty("--p", Math.min(100, a.selectedCredits / 1.2));
    q("#degreeMessage").textContent = a.pathStatus === "Valid" ? "A valid 120-credit path is selected." : a.pathStatus === "Provisional" ? "A complete path is selected, pending verification." : `${a.remainingToSelect} credits remain to be selected.`;
    [["earnedMetric", a.completedCredits], ["plannedMetric", a.plannedCredits], ["progressMetric", a.inProgressCredits], ["selectedMetric", a.selectedCredits], ["snhuMetric", a.snhuSelected], ["majorMetric", a.majorSnhu]].forEach(([id, v]) => q(`#${id}`).textContent = v);
    const completedRequirements = state.requirements.filter(r => r.status === "Completed").length;
    q("#requirementsMetric").textContent = completedRequirements; q("#requirementsDetail").textContent = `of ${state.requirements.length} · ${Math.round(completedRequirements / state.requirements.length * 100)}%`;
    q("#transferCapacityMetric").textContent = Math.max(0, state.program.transferMaximum - a.outsideSelected);
    q("#freeMetric").textContent = a.category.free.completed;
    q("#costMetric").textContent = money(e.cost);
    const finish = new Date(); finish.setDate(finish.getDate() + e.expectedDays);
    q("#completionMetric").textContent = e.expectedDays ? finish.toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—";
    q("#advisorMetric").textContent = state.verificationQueue.filter(x => x.status !== "Resolved").length;
    q("#remainingMetric").textContent = `${a.remainingToSelect} credits still unselected`;
    q("#pathBadge").textContent = a.pathStatus; q("#pathBadge").className = `badge ${a.pathStatus.toLowerCase()}`;
    q("#categoryProgress").innerHTML = Object.entries(a.category).map(([id, x]) => `<article><span>${esc(DegreeData.categories[id])}</span><strong>${x.selected}/${x.required}</strong><small>${x.completed} earned</small><div class="track"><i style="width:${Math.min(100, x.selected / x.required * 100)}%"></i></div></article>`).join("");
    const colors = { SNHU: "#2466d1", Transfer: "#17846d", Credential: "#d58a17", Sophia: "#7661c9" };
    q("#sourceBars").innerHTML = Object.entries(a.byProvider).map(([p, x]) => `<div class="source-bar"><header><span>${esc(p)}</span><strong>${x.selected} selected</strong></header><small>${x.completed} earned · ${x.inProgress} in progress · ${x.planned} planned</small><div class="track"><i style="width:${Math.min(100, x.selected / 1.2)}%;background:${colors[p] || "#64748b"}"></i></div></div>`).join("") || "<p>No provider selections yet.</p>";
    const alerts = [...a.warnings];
    if (!alerts.length) alerts.push("No structural conflicts detected.");
    q("#alerts").innerHTML = alerts.map((x, i) => `<div class="alert ${i || a.warnings.length ? "" : "ok"}">${esc(x)}</div>`).join("");
    q("#baselineDetails").innerHTML = `<dt>Catalog</dt><dd>${esc(state.student.catalog)}</dd><dt>Applied credits</dt><dd>${a.completedCredits} of 120</dd><dt>Remaining</dt><dd>${120 - a.completedCredits}</dd><dt>SNHU earned</dt><dd>${a.snhuCompleted}</dd><dt>Outside selected</dt><dd>${a.outsideSelected} of 90 maximum</dd><dt>Projected remaining cost</dt><dd>${money(e.cost)}</dd>`;
    renderCredential();
    const seq = DegreeEngine.sequence(state).slice(0, 3);
    q("#nextActions").innerHTML = seq.length ? seq.map(x => {
      const r = state.requirements.find(y => y.id === x.requirementId), o = DegreeEngine.optionFor(r);
      return `<div class="action"><b>${x.rank}</b><span><strong>${esc(o.code)} · ${esc(r.name)}</strong><small>${esc(x.reason)}</small></span></div>`;
    }).join("") : "<p>Select or generate a plan to see recommended next actions.</p>";
  }

  function renderCredential() {
    const c = state.credentials[0], free = state.requirements.filter(r => r.category === "free" && r.status !== "Completed");
    q("#credentialCard").innerHTML = `<p><span class="badge review">${esc(c.verification)}</span></p>
      <label>Credential name<input id="credentialName" value="${esc(c.name)}" placeholder="e.g. professional certification"></label>
      <label>Issuer<input id="credentialIssuer" value="${esc(c.issuer)}" placeholder="Credential issuer"></label>
      <label>Candidate SNHU equivalents<input id="credentialCandidates" value="${esc(c.candidateEquivalencies.join(", "))}" placeholder="Comma-separated; confirm with advisor"></label>
      <label>Candidate equivalency<select id="credentialEquiv"><option value="">Not applied</option>${c.candidateEquivalencies.map(x => `<option ${c.equivalency === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></label>
      <label>Apply to requirement<select id="credentialReq"><option value="">Choose after confirmation</option>${free.map(r => `<option value="${r.id}" ${c.appliedRequirementId === r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></label>
      <label>Evidence / reference<input id="credentialEvidence" value="${esc(c.evidence)}" placeholder="Advisor email, evaluation ID…"></label>
      <p class="hint">The tracker will not double-count this credential. It remains provisional until SNHU confirms the equivalency and placement.</p>`;
    q("#credentialEquiv").onchange = applyCredential;
    q("#credentialReq").onchange = applyCredential;
    q("#credentialEvidence").onchange = e => { c.evidence = e.target.value; commitAndRender(); };
    q("#credentialName").onchange = e => {
      c.name = e.target.value;
      state.requirements.flatMap(r => r.options).filter(o => o.credentialId === c.id).forEach(o => { o.title = c.name || "Professional credential credit"; });
      commitAndRender();
    };
    q("#credentialIssuer").onchange = e => { c.issuer = e.target.value; commitAndRender(); };
    q("#credentialCandidates").onchange = e => { c.candidateEquivalencies = e.target.value.split(",").map(x => x.trim()).filter(Boolean); if (!c.candidateEquivalencies.includes(c.equivalency)) c.equivalency = ""; commitAndRender(); };
  }
  function applyCredential() {
    const c = state.credentials[0], old = c.appliedRequirementId;
    if (old) {
      const r = state.requirements.find(x => x.id === old);
      r.options = r.options.filter(o => o.credentialId !== c.id);
      if (r.selectedOptionId === `${r.id}-pmp`) { r.selectedOptionId = ""; r.status = "Available"; }
    }
    c.equivalency = q("#credentialEquiv").value; c.appliedRequirementId = q("#credentialReq").value;
    if (c.equivalency && c.appliedRequirementId) {
      const r = state.requirements.find(x => x.id === c.appliedRequirementId), id = `${r.id}-pmp`;
      r.options.push(DegreeData.option(id, "Credential", c.equivalency, c.name || "Professional credential credit", c.verification, { credentialId: c.id, credits: +c.credits }));
      r.selectedOptionId = id; r.status = "Planned";
    }
    commitAndRender();
  }

  function renderRequirements() {
    const category = q("#categoryFilter").value || state.ui.category, status = q("#statusFilter").value || state.ui.filter;
    state.ui.category = category; state.ui.filter = status;
    const groups = Object.keys(DegreeData.categories);
    q("#requirements").innerHTML = groups.map(cat => {
      const rs = state.requirements.filter(r => r.category === cat).filter(r => category === "all" || r.category === category).filter(r => {
        const o = DegreeEngine.optionFor(r);
        return status === "all" || status === "selected" && DegreeEngine.selected(r) || status === "unselected" && !DegreeEngine.selected(r) || status === "completed" && r.status === "Completed" || status === "review" && o && o.verification !== "Confirmed";
      });
      if (!rs.length) return "";
      return `<section class="degree-section"><header><div><p class="eyebrow ink">${esc(DegreeData.categories[cat])}</p><h2>${rs.length} requirements shown</h2></div></header><div class="requirement-list">${rs.map(requirementRow).join("")}</div></section>`;
    }).join("") || `<div class="empty">No requirements match these filters.</div>`;
    bindRequirementEvents();
  }

  function requirementRow(r) {
    const o = DegreeEngine.optionFor(r), scenario = activeScenario(), locked = scenario?.locks.includes(r.id);
    const cls = r.status === "Completed" ? "complete" : r.status === "In Progress" ? "progress" : r.status === "Planned" ? "planned" : "";
    return `<article class="requirement-row ${cls}" data-id="${r.id}">
      <div class="req-title"><span class="category-dot ${r.category}"></span><div><strong>${esc(r.code)} · ${esc(r.name)}</strong><small>${r.credits} credits${r.major ? " · major" : ""}</small></div></div>
      <label>Course / provider<select data-field="selectedOptionId"><option value="">Not selected</option>${r.options.map(x => `<option value="${x.id}" ${r.selectedOptionId === x.id ? "selected" : ""}>${esc(x.provider)} — ${esc(x.code)} · ${esc(x.title)}</option>`).join("")}</select></label>
      <label>Status<select data-field="status">${DegreeEngine.STATUSES.map(x => `<option ${r.status === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>
      <div class="verify"><span class="badge ${(o?.verification || "").toLowerCase().replaceAll(" ", "-")}">${esc(o?.verification || "No option")}</span><small>${o?.residencyEligible ? "SNHU residency eligible" : "Outside SNHU"}</small></div>
      <label>Term / order<input data-field="term" value="${esc(r.term)}" placeholder="e.g. 2026 T1"></label>
      <label>Notes<input data-field="notes" value="${esc(r.notes)}" placeholder="Decision or evidence…"></label>
      <label class="lock"><input data-lock type="checkbox" ${locked ? "checked" : ""}> Lock in optimizer</label>
      <details><summary>Equivalency details & assumptions</summary>${r.options.map(x => `<div class="option-detail" data-option="${x.id}">
        <label>Provider<select data-opt-field="provider">${["SNHU","Sophia","Study.com","Transfer","Credential","Other"].map(p => `<option ${x.provider === p ? "selected" : ""}>${p}</option>`).join("")}</select></label>
        <label>Course code<input data-opt-field="code" value="${esc(x.code)}"></label>
        <label>Course title<input data-opt-field="title" value="${esc(x.title)}"></label>
        <label>Credits<input data-opt-field="credits" type="number" min="0" max="12" value="${x.credits}"></label>
        <label>Estimated cost<input data-opt-field="cost" type="number" min="0" value="${x.cost ?? ""}" placeholder="Provider default"></label>
        <label>Baseline work hours<input data-opt-field="baselineHours" type="number" min="0" value="${x.baselineHours ?? ""}"></label>
        <label>Personal work hours<input data-opt-field="hours" type="number" min="0" value="${x.hours ?? ""}" placeholder="Auto-adjust"></label>
        <label>Minimum days<input data-opt-field="minimumDays" type="number" min="0" value="${x.minimumDays ?? ""}"></label>
        <label>Expected days<input data-opt-field="expectedDays" type="number" min="0" value="${x.expectedDays ?? ""}" placeholder="Provider default"></label>
        <label>Grading delay days<input data-opt-field="gradingDelayDays" type="number" min="0" value="${x.gradingDelayDays || 0}"></label>
        <label>Touchstones / projects<input data-opt-field="touchstones" type="number" min="0" value="${x.touchstones || 0}"></label>
        <label>Familiarity<select data-opt-field="familiarity">${["New material","Some familiarity","Strong familiarity","Mostly review"].map(v => `<option ${x.familiarity === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label>Verification<select data-opt-field="verification">${DegreeEngine.VERIFY.map(v => `<option ${x.verification === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label>Source URL<input data-opt-field="sourceUrl" type="url" value="${esc(x.sourceUrl)}"></label>
        <label>Effective date<input data-opt-field="effectiveDate" type="date" value="${esc(x.effectiveDate)}"></label>
        <label>Notes<input data-opt-field="notes" value="${esc(x.notes || "")}"></label>
        <label class="lock"><input data-exclude type="checkbox" ${scenario?.exclusions.includes(x.id) ? "checked" : ""}> Exclude from optimizer</label>
      </div>`).join("")}<button type="button" class="outline add-option">＋ Add provider/course option</button></details>
    </article>`;
  }
  function bindRequirementEvents() {
    qa(".requirement-row").forEach(row => {
      qa("[data-field]", row).forEach(el => el.onchange = e => updateRequirement(row.dataset.id, e.target.dataset.field, e.target.value));
      qa("[data-option]", row).forEach(optionRow => qa("[data-opt-field]", optionRow).forEach(el => el.onchange = e => {
        const r = state.requirements.find(x => x.id === row.dataset.id), o = r.options.find(x => x.id === optionRow.dataset.option);
        const field = e.target.dataset.optField;
        const nullableNumbers = ["cost", "baselineHours", "hours", "minimumDays", "expectedDays"];
        o[field] = e.target.type === "number"
          ? (e.target.value === "" && nullableNumbers.includes(field) ? null : Math.max(0, +e.target.value || 0))
          : e.target.value;
        o.residencyEligible = o.provider === "SNHU"; o.majorResidencyEligible = o.provider === "SNHU";
        commitAndRender();
      }));
      qa("[data-option]", row).forEach(optionRow => {
        q("[data-exclude]", optionRow).onchange = e => {
          const s = activeScenario(), id = optionRow.dataset.option;
          s.exclusions = e.target.checked ? [...new Set([...s.exclusions, id])] : s.exclusions.filter(x => x !== id);
          commitAndRender();
        };
      });
      q(".add-option", row).onclick = () => {
        const r = state.requirements.find(x => x.id === row.dataset.id), id = `${r.id}-custom-${Date.now()}`;
        r.options.push(DegreeData.option(id, "Transfer", r.category === "free" ? "ELECTIVE" : "COURSE", r.category === "free" ? "Editable free elective" : `Possible ${r.name} equivalent`, "Unverified"));
        r.selectedOptionId = id; if (r.status === "Available") r.status = "Planned"; commitAndRender();
      };
      q("[data-lock]", row).onchange = e => {
        const s = activeScenario(); s.locks = e.target.checked ? [...new Set([...s.locks, row.dataset.id])] : s.locks.filter(x => x !== row.dataset.id); commitAndRender();
      };
    });
  }

  function renderPlanner() {
    const e = DegreeEngine.estimate(state), a = DegreeEngine.audit(state), seq = DegreeEngine.sequence(state);
    q("#plannerMode").value = activeScenario()?.mode || "balanced";
    const counts = Object.fromEntries(Object.entries(a.byProvider).map(([name, x]) => [name, x.selected / 3]));
    const unresolved = state.requirements.filter(r => DegreeEngine.selected(r) && DegreeEngine.optionFor(r).verification !== "Confirmed").length;
    q("#estimate").innerHTML = `<div class="estimate-grid"><div><strong>${money(e.cost)}</strong><span>estimated cost</span></div><div><strong>${e.hours}</strong><span>study hours</span></div><div><strong>${e.touchstones}</strong><span>Touchstones / projects</span></div><div><strong>${e.aggressiveDays}</strong><span>aggressive days</span></div><div><strong>${e.expectedDays}</strong><span>expected days</span></div><div><strong>${e.conservativeDays}</strong><span>conservative days</span></div><div><strong>${counts.Sophia || 0}</strong><span>Sophia courses</span></div><div><strong>${counts.SNHU || 0}</strong><span>SNHU courses</span></div><div><strong>${Object.entries(counts).filter(([p]) => !["SNHU","Sophia","Transfer"].includes(p)).reduce((n,[,v]) => n+v,0)}</strong><span>other-provider courses</span></div><div><strong>${unresolved}</strong><span>unresolved selections</span></div></div><p class="hint">Zero cost means pricing has not been entered, not that a course is free.</p>`;
    q("#optimizerRules").innerHTML = `<ul><li>Exactly one selected option per requirement.</li><li>${a.outsideSelected}/90 outside-SNHU credits selected.</li><li>${a.snhuSelected}/30 SNHU residency credits selected.</li><li>${a.majorSnhu}/12 major residency credits selected.</li><li>Unverified selections make a complete plan provisional.</li></ul>`;
    q("#fullSequence").innerHTML = seq.length ? seq.map(x => {
      const r = state.requirements.find(y => y.id === x.requirementId), o = DegreeEngine.optionFor(r);
      return `<div class="sequence-row"><b>${x.rank}</b><span><strong>${esc(o.code)} · ${esc(r.name)}</strong><small>${esc(o.provider)} · ${esc(x.reason)}</small></span></div>`;
    }).join("") : "<p>Generate or select a plan first.</p>";
  }

  function renderScenarios() {
    snapshotScenario(activeScenario());
    q("#scenarioList").innerHTML = state.scenarios.map(s => {
      const scenarioState = stateForScenario(s), a = DegreeEngine.audit(scenarioState), e = DegreeEngine.estimate(scenarioState);
      const providerCounts = Object.fromEntries(Object.entries(a.byProvider).map(([name, x]) => [name, Math.round(x.selected / 3)]));
      const unresolved = scenarioState.requirements.filter(r => DegreeEngine.selected(r) && DegreeEngine.optionFor(r)?.verification !== "Confirmed").length;
      return `<article class="panel scenario ${s.id === state.activeScenarioId ? "active" : ""}">
        <span class="badge">${s.id === state.activeScenarioId ? "Active" : "Saved"}</span><span class="badge ${a.pathStatus.toLowerCase()}">${a.pathStatus}</span>
        <h2>${esc(s.name)}</h2><p>Mode: ${esc(s.mode)}</p>
        <div class="scenario-metrics"><span><strong>${a.selectedCredits}</strong> credits</span><span><strong>${money(e.cost)}</strong> cost</span><span><strong>${e.expectedDays}</strong> days</span><span><strong>${a.snhuSelected}</strong> SNHU cr</span><span><strong>${a.majorSnhu}</strong> major cr</span><span><strong>${unresolved}</strong> unresolved</span></div>
        <p class="provider-mix">${Object.entries(providerCounts).map(([name, count]) => `${esc(name)} ${count}`).join(" · ") || "No courses selected"}</p>
        <p>${s.locks.length} locks · ${s.exclusions.length} exclusions</p>
        <div class="row-actions"><button data-activate="${s.id}">Activate</button><button class="outline" data-rename="${s.id}">Rename</button><button class="outline" data-duplicate="${s.id}">Duplicate</button>${s.id !== "baseline" ? `<button class="outline danger" data-delete="${s.id}">Delete</button>` : ""}</div>
      </article>`;
    }).join("");
    qa("[data-activate]").forEach(b => b.onclick = () => activateScenario(b.dataset.activate));
    qa("[data-duplicate]").forEach(b => b.onclick = () => duplicateScenario(b.dataset.duplicate));
    qa("[data-rename]").forEach(b => b.onclick = () => { const s = state.scenarios.find(x => x.id === b.dataset.rename), name = prompt("Scenario name:", s.name); if (name?.trim()) { s.name = name.trim(); save(); renderScenarios(); } });
    qa("[data-delete]").forEach(b => b.onclick = () => { state.scenarios = state.scenarios.filter(s => s.id !== b.dataset.delete); if (state.activeScenarioId === b.dataset.delete) state.activeScenarioId = "baseline"; save(); render(); });
  }
  function snapshotScenario(s) {
    if (!s) return;
    s.selections = Object.fromEntries(state.requirements.filter(DegreeEngine.selected).map(r => [r.id, r.selectedOptionId]));
    s.statuses = Object.fromEntries(state.requirements.filter(DegreeEngine.selected).map(r => [r.id, r.status]));
  }
  function stateForScenario(s) {
    if (s.id === state.activeScenarioId) return DegreeEngine.clone(state);
    const copy = DegreeEngine.clone(state);
    copy.requirements.filter(r => r.status !== "Completed").forEach(r => {
      r.selectedOptionId = s.selections?.[r.id] || "";
      r.status = r.selectedOptionId ? (s.statuses?.[r.id] || "Planned") : "Available";
    });
    return copy;
  }
  function activateScenario(id) {
    snapshotScenario(activeScenario()); const s = state.scenarios.find(x => x.id === id); state.activeScenarioId = id;
    state.requirements.filter(r => r.status !== "Completed").forEach(r => { r.selectedOptionId = s.selections?.[r.id] || ""; r.status = r.selectedOptionId ? (s.statuses?.[r.id] || "Planned") : "Available"; });
    save(); render();
  }
  function duplicateScenario(id) {
    const source = state.scenarios.find(s => s.id === id), name = prompt("Scenario name:", `${source.name} copy`); if (!name) return;
    const copy = DegreeEngine.clone(source); copy.id = `scenario-${Date.now()}`; copy.name = name; copy.createdAt = new Date().toISOString(); state.scenarios.push(copy); save(); render();
  }
  function createPreset(mode) {
    snapshotScenario(activeScenario());
    const names = { "sophia-heavy": "Sophia-heavy plan", "study-heavy": "Study.com-heavy plan", "snhu-heavy": "SNHU-heavy plan", fastest: "Fastest plan", "lowest-cost": "Lowest-cost plan", conservative: "Confirmed-only plan" };
    const scenario = { id: `scenario-${Date.now()}`, name: names[mode] || mode, mode, selections: {}, statuses: {}, locks: [], exclusions: [], overrides: {}, createdAt: new Date().toISOString() };
    state.scenarios.push(scenario); state.activeScenarioId = scenario.id;
    state = DegreeEngine.generatePlan(state, mode); save(); render();
  }

  function renderQueue() {
    q("#queue").innerHTML = state.verificationQueue.map(item => `<article class="queue-item" data-id="${item.id}"><div><span class="badge ${item.status === "Resolved" ? "valid" : "review"}">${esc(item.status)}</span><h3>${esc(item.question)}</h3></div><label>Status<select data-q="status"><option ${item.status === "Open" ? "selected" : ""}>Open</option><option ${item.status === "Waiting" ? "selected" : ""}>Waiting</option><option ${item.status === "Resolved" ? "selected" : ""}>Resolved</option></select></label><label>Date answered<input data-q="dateAnswered" type="date" value="${esc(item.dateAnswered)}"></label><label>Advisor answer<textarea data-q="answer" rows="2">${esc(item.answer)}</textarea></label><label>Evidence / source<input data-q="evidence" value="${esc(item.evidence)}"></label><label>Resulting data changes<input data-q="resultingChanges" value="${esc(item.resultingChanges)}"></label><label>Affected requirement<select data-q="affectedRequirementId"><option value="">None linked</option>${state.requirements.map(r => `<option value="${r.id}" ${item.affectedRequirementId === r.id ? "selected" : ""}>${esc(r.code)} · ${esc(r.name)}</option>`).join("")}</select></label></article>`).join("");
    qa(".queue-item").forEach(row => qa("[data-q]", row).forEach(el => el.onchange = e => { const item = state.verificationQueue.find(x => x.id === row.dataset.id); item[e.target.dataset.q] = e.target.value; item.updatedAt = new Date().toISOString(); commitAndRender(); }));
  }

  function renderSettings() {
    q("#providerSettings").innerHTML = Object.entries(state.settings.providers).map(([name, p]) => `<article class="panel provider-setting" data-provider="${esc(name)}"><h2>${esc(name)}</h2><label>Pricing model<select data-setting="pricingModel"><option value="perCredit" ${p.pricingModel === "perCredit" ? "selected" : ""}>Per credit</option><option value="perCourse" ${p.pricingModel === "perCourse" ? "selected" : ""}>Per course</option><option value="subscription" ${p.pricingModel === "subscription" ? "selected" : ""}>Subscription period</option></select></label><label>Price ($)<input data-setting="price" type="number" min="0" step=".01" value="${p.price}"></label>${p.pricingModel === "subscription" ? `<label>Period days<input data-setting="periodDays" type="number" min="1" value="${p.periodDays || 30}"></label>` : ""}<label>Exam fee per course<input data-setting="examFee" type="number" min="0" value="${p.examFee || 0}"></label><label>Effective date<input data-setting="effectiveDate" type="date" value="${esc(p.effectiveDate)}"></label><label>Source URL<input data-setting="sourceUrl" type="url" value="${esc(p.sourceUrl)}"></label></article>`).join("");
    qa(".provider-setting").forEach(card => qa("[data-setting]", card).forEach(el => el.onchange = e => {
      const p = state.settings.providers[card.dataset.provider];
      p[e.target.dataset.setting] = e.target.type === "number" ? +e.target.value : e.target.value;
      commitAndRender();
    }));
    q("#defaultHours").value = state.settings.defaultCourseHours; q("#defaultDays").value = state.settings.defaultCourseDays; q("#concurrency").value = state.settings.concurrentCourses;
    q("#booksMaterials").value = state.settings.booksMaterials || 0; q("#transferFees").value = state.settings.transferEvaluationFees || 0; q("#miscCosts").value = state.settings.miscellaneousCosts || 0;
    q("#profileName").value = state.student.name || ""; q("#profileCatalog").value = state.student.catalog || "";
    q("#profileStudentId").value = state.student.studentId || ""; q("#profileStudentId").type = state.ui.studentIdVisible ? "text" : "password";
    q("#toggleStudentId").textContent = state.ui.studentIdVisible ? "Hide" : "Show";
    q("#schemaInfo").textContent = `Schema version ${state.schemaVersion} · last saved ${new Date(state.meta.updatedAt).toLocaleString()}`;
  }

  function render() {
    if (migrated) { q("#migrationNotice").classList.remove("hidden"); q("#migrationNotice").textContent = "Your earlier browser-only plan was migrated to schema version 4. The prior storage record remains available as a fallback."; migrated = false; }
    renderOverview(); renderRequirements(); renderPlanner(); renderScenarios(); renderQueue(); renderSettings(); setTab(state.ui.tab || "overview");
  }

  function csv() {
    const rows = [["Category", "Requirement", "Credits", "Status", "Provider", "Course", "Verification", "Term", "Notes"]];
    state.requirements.forEach(r => { const o = DegreeEngine.optionFor(r); rows.push([DegreeData.categories[r.category], `${r.code} ${r.name}`, r.credits, r.status, o?.provider || "", o?.code || "", o?.verification || "", r.term, r.notes]); });
    return rows.map(row => row.map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
  }
  function advisorSummary() {
    const a = DegreeEngine.audit(state);
    return `${state.student.name}\n${state.student.program}\nCatalog: ${state.student.catalog}\n\nDEGREE AUDIT\nEarned: ${a.completedCredits}/120\nSelected path: ${a.selectedCredits}/120\nSNHU residency selected: ${a.snhuSelected}/30\nMajor residency selected: ${a.majorSnhu}/12\nPath status: ${a.pathStatus}\n\nOPEN QUESTIONS\n${state.verificationQueue.filter(x => x.status !== "Resolved").map((x, i) => `${i + 1}. ${x.question}${x.answer ? `\n   Current note: ${x.answer}` : ""}`).join("\n")}\n\nPROVISIONAL SELECTIONS\n${state.requirements.filter(r => DegreeEngine.selected(r) && DegreeEngine.optionFor(r).verification !== "Confirmed").map(r => `- ${r.code}: ${DegreeEngine.optionFor(r).provider} ${DegreeEngine.optionFor(r).code} (${DegreeEngine.optionFor(r).verification})`).join("\n") || "None"}\n`;
  }
  function download(name, text, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
  function useState(next, origin) {
    state = next; state.meta.origin = origin || state.meta.origin || "local"; initialized = true; save(); render();
  }
  async function handleImport(input, firstRun = false) {
    const status = firstRun ? q("#firstRunError") : q("#importMessage");
    try {
      const text = await input.files[0].text(), imported = DegreePrivacy.importJson(text);
      const warning = imported.signals.length ? ` Privacy check found: ${imported.signals.join(", ")}. This is allowed because the file stays local.` : "";
      const message = `Import schema ${imported.summary.schemaVersion} with ${imported.summary.requirements} requirements, ${imported.summary.completedCredits} completed credits, and ${imported.summary.selectedCredits} selected credits?${warning}`;
      if (!confirm(message)) return;
      useState(imported.state, "import");
      if (q("#firstRunDialog").open) q("#firstRunDialog").close();
      if (q("#exportDialog").open) q("#exportDialog").close();
      status.textContent = "Backup restored locally.";
    } catch (err) {
      status.classList?.remove("hidden");
      status.textContent = `Import rejected: ${err.message}`;
    } finally { input.value = ""; }
  }
  function resetBlank() {
    if (!confirm("Reset to a blank plan in this browser? This cannot be undone without an exported backup.")) return;
    useState(DegreeData.blank(), "blank");
  }
  function loadDemo() {
    if (initialized && !confirm("Replace the current browser plan with fictional demo data? Export a backup first if needed.")) return;
    useState(DegreeData.demo(), "demo");
    if (q("#firstRunDialog").open) q("#firstRunDialog").close();
  }

  qa("[data-tab]").forEach(b => b.onclick = () => setTab(b.dataset.tab));
  q("#categoryFilter").onchange = event => {
    state.ui.category = event.target.value;
    save();
    renderRequirements();
  };
  q("#statusFilter").onchange = event => {
    state.ui.filter = event.target.value;
    save();
    renderRequirements();
  };
  q("#generateBtn").onclick = () => { state = DegreeEngine.generatePlan(state, q("#plannerMode").value); save(); render(); };
  q("#newScenarioBtn").onclick = () => { snapshotScenario(activeScenario()); duplicateScenario(state.activeScenarioId); };
  qa("[data-preset]").forEach(button => button.onclick = () => createPreset(button.dataset.preset));
  q("#exportBtn").onclick = () => q("#exportDialog").showModal();
  q("#privacyLink").onclick = () => setTab("privacy");
  q("#jsonBtn").onclick = () => download("degree-plan-local-backup.json", DegreePrivacy.exportJson(state), "application/json");
  q("#csvBtn").onclick = () => download("snhu-degree-plan.csv", csv(), "text/csv");
  q("#advisorBtn").onclick = () => download("snhu-advisor-summary.txt", advisorSummary(), "text/plain");
  q("#printBtn").onclick = () => { q("#exportDialog").close(); window.print(); };
  q("#importInput").onchange = e => handleImport(e.target);
  q("#firstRunImport").onchange = e => handleImport(e.target, true);
  q("#startBlankBtn").onclick = () => {
    if (loaded.error && !confirm("The existing saved record could not be migrated. Starting blank will create a new current plan, while the earlier fallback record remains. Continue?")) return;
    useState(DegreeData.blank(), "blank"); q("#firstRunDialog").close();
  };
  q("#loadDemoBtn").onclick = loadDemo;
  q("#blankBtn").onclick = resetBlank; q("#demoBtn").onclick = loadDemo;
  q("#deleteBtn").onclick = () => {
    if (!confirm("Delete all Degree Compass data from this browser only? This cannot be undone without an exported backup.")) return;
    DegreePrivacy.deleteAll(localStorage); initialized = false; state = DegreeData.blank(); render(); q("#firstRunDialog").showModal();
  };
  q("#profileName").onchange = e => { state.student.name = e.target.value; commitAndRender(); };
  q("#profileCatalog").onchange = e => { state.student.catalog = e.target.value; commitAndRender(); };
  q("#profileStudentId").onchange = e => { state.student.studentId = e.target.value; commitAndRender(); };
  q("#toggleStudentId").onclick = () => { state.ui.studentIdVisible = !state.ui.studentIdVisible; save(); renderSettings(); };
  [["defaultHours", "defaultCourseHours"], ["defaultDays", "defaultCourseDays"], ["concurrency", "concurrentCourses"]].forEach(([id, key]) => q(`#${id}`).onchange = e => { state.settings[key] = Math.max(1, +e.target.value || 1); save(); render(); });
  [["booksMaterials", "booksMaterials"], ["transferFees", "transferEvaluationFees"], ["miscCosts", "miscellaneousCosts"]].forEach(([id, key]) => q(`#${id}`).onchange = e => { state.settings[key] = Math.max(0, +e.target.value || 0); save(); render(); });
  render();
  if (!initialized || loaded.error) {
    if (loaded.error) { q("#firstRunError").classList.remove("hidden"); q("#firstRunError").textContent = loaded.error; }
    q("#firstRunDialog").showModal();
  }
})();
