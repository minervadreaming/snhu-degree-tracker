(function () {
  "use strict";
  const STATUSES = ["Available", "Planned", "In Progress", "Completed", "Blocked", "Needs verification", "Advisor confirmation required", "Not applicable"];
  const VERIFY = ["Confirmed", "Likely", "Unverified", "Not eligible", "Advisor confirmation required"];
  const clone = value => JSON.parse(JSON.stringify(value));
  const selected = r => ["Planned", "In Progress", "Completed"].includes(r.status) && !!r.selectedOptionId;
  const opt = r => r.options.find(o => o.id === r.selectedOptionId);
  const outside = o => o && o.provider !== "SNHU";

  function validate(state) {
    const errors = [], warnings = [];
    if (!state || typeof state !== "object") return { valid: false, errors: ["Backup is not an object."], warnings };
    if (state.schemaVersion !== 3) errors.push(`Unsupported schema version: ${state.schemaVersion ?? "missing"}.`);
    if (!Array.isArray(state.requirements)) errors.push("Requirements must be an array.");
    if (!state.student || typeof state.student !== "object") errors.push("Student profile is missing.");
    if (!state.program || +state.program.totalCredits !== 120) errors.push("Program definition is missing or unsupported.");
    if (!state.settings || typeof state.settings !== "object") errors.push("Planner settings are missing.");
    if (!Array.isArray(state.credentials) || !Array.isArray(state.scenarios)) errors.push("Credential or scenario records are missing.");
    if (Array.isArray(state.requirements) && !state.requirements.length) errors.push("The plan contains no requirements.");
    if (!errors.length) {
      const ids = new Set();
      state.requirements.forEach((r, i) => {
        if (!r.id || ids.has(r.id)) errors.push(`Requirement ${i + 1} has a missing or duplicate id.`);
        ids.add(r.id);
        if (!STATUSES.includes(r.status)) errors.push(`${r.id} has an invalid status.`);
        if (!Number.isFinite(+r.credits) || +r.credits < 0) errors.push(`${r.id} has invalid credits.`);
        if (!Array.isArray(r.options)) errors.push(`${r.id} options must be an array.`);
        if (r.selectedOptionId && !r.options?.some(o => o.id === r.selectedOptionId)) errors.push(`${r.id} selects an option that does not exist.`);
      });
    }
    return { valid: !errors.length, errors, warnings };
  }

  function migrate(old) {
    if (old?.schemaVersion === 3) return clone(old);
    if (old?.schemaVersion === 2) {
      const next = clone(old);
      next.schemaVersion = 3;
      next.meta ||= {};
      next.meta.migratedFrom = "degreeOptimizerV2";
      next.meta.origin = "migrated-local";
      next.meta.updatedAt = new Date().toISOString();
      next.student ||= {};
      next.student.studentId ??= "";
      next.ui ||= {};
      next.ui.studentIdVisible = false;
      next.requirements?.forEach(r => {
        if (r.status === "Not selected") r.status = "Available";
        r.options?.forEach(o => {
          if (o.verification === "Needs advisor review") o.verification = "Advisor confirmation required";
          if (o.verification === "Rejected") o.verification = "Not eligible";
        });
      });
      const defaults = window.DegreeData.blank().settings;
      next.settings = { ...defaults, ...(next.settings || {}), providers: { ...defaults.providers, ...(next.settings?.providers || {}) } };
      return next;
    }
    const next = window.DegreeData.blank();
    if (!old || !old.courses) return next;
    const legacyMap = {
      gen2: "gen-eng130", gen3: "gen-eng190", core1: "core-acc201", core2: "core-acc202",
      core3: "core-bus206", core4: "core-bus210", core5: "core-bus225", core6: "core-bus400",
      core7: "core-fin320", core8: "core-int220", core9: "core-mkt205", core10: "core-qso321",
      mis1: "mis-db", mis2: "mis-sad", mis3: "mis-client", mis4: "mis-bi", mis5: "mis-enterprise"
    };
    Object.entries(old.courses).forEach(([legacyId, d]) => {
      const targetId = legacyMap[legacyId] || (/^free\d+$/.test(legacyId) ? `free-${legacyId.replace("free", "")}` : "");
      const r = next.requirements.find(x => x.id === targetId);
      if (!r || !d.selected) return;
      const id = `${r.id}-legacy`;
      r.options.push(window.DegreeData.option(id, d.source === "Certificate" ? "Credential" : d.source || "Transfer", d.code || r.code, d.name || r.name, "Advisor confirmation required", { credits: +d.credits || 3, notes: d.note || "" }));
      r.selectedOptionId = id;
      r.status = d.status === "In progress" ? "In Progress" : d.status || "Planned";
      r.notes = d.note || "";
    });
    (old.custom || []).forEach((d, i) => {
      const r = next.requirements.find(x => x.category === (d.section || "free") && !x.selectedOptionId);
      if (!r) return;
      const id = `${r.id}-legacy-custom-${i}`;
      r.options.push(window.DegreeData.option(id, d.source === "Certificate" ? "Credential" : d.source || "Transfer", d.code || "COURSE", d.name || "Migrated course", "Advisor confirmation required", { credits: +d.credits || 3, notes: d.note || "" }));
      r.selectedOptionId = id; r.status = d.status === "In progress" ? "In Progress" : d.status || "Planned";
    });
    next.meta.migratedFrom = "degreeCompass-v1";
    next.meta.origin = "migrated-local";
    return next;
  }

  function audit(state) {
    const completed = state.requirements.filter(r => r.status === "Completed" && opt(r));
    const planned = state.requirements.filter(r => r.status === "Planned" && opt(r));
    const progress = state.requirements.filter(r => r.status === "In Progress" && opt(r));
    const path = state.requirements.filter(selected);
    const credits = rs => rs.reduce((n, r) => n + (+opt(r)?.credits || +r.credits || 0), 0);
    const byProvider = {};
    path.forEach(r => {
      const o = opt(r), p = o.provider;
      byProvider[p] ||= { selected: 0, completed: 0, inProgress: 0, planned: 0 };
      byProvider[p].selected += +o.credits || 0;
      if (r.status === "Completed") byProvider[p].completed += +o.credits || 0;
      if (r.status === "In Progress") byProvider[p].inProgress += +o.credits || 0;
      if (r.status === "Planned") byProvider[p].planned += +o.credits || 0;
    });
    const selectedCredits = credits(path), completedCredits = credits(completed);
    const snhuSelected = path.filter(r => opt(r).provider === "SNHU").reduce((n, r) => n + +opt(r).credits, 0);
    const snhuCompleted = completed.filter(r => opt(r).provider === "SNHU").reduce((n, r) => n + +opt(r).credits, 0);
    const majorSnhu = path.filter(r => r.major && opt(r).provider === "SNHU" && opt(r).majorResidencyEligible).reduce((n, r) => n + +opt(r).credits, 0);
    const outsideSelected = path.filter(r => outside(opt(r))).reduce((n, r) => n + +opt(r).credits, 0);
    const category = {};
    Object.keys(state.program.categoryCredits).forEach(key => {
      const rs = state.requirements.filter(r => r.category === key);
      category[key] = { required: state.program.categoryCredits[key], selected: credits(rs.filter(selected)), completed: credits(rs.filter(r => r.status === "Completed" && opt(r))) };
    });
    const warnings = [];
    const assignmentKeys = new Set(), duplicateAssignments = [];
    path.forEach(r => {
      const o = opt(r), key = o.credentialId ? `credential:${o.credentialId}` : `option:${o.id}`;
      if (assignmentKeys.has(key)) duplicateAssignments.push(key);
      assignmentKeys.add(key);
    });
    if (duplicateAssignments.length) warnings.push("A course or credential is assigned to more than one requirement.");
    if (selectedCredits > 120) warnings.push(`${selectedCredits - 120} credits exceed the degree total.`);
    if (outsideSelected > state.program.transferMaximum) warnings.push("Outside-SNHU credits exceed the 90-credit ceiling.");
    if (selectedCredits >= 120 && snhuSelected < state.program.snhuMinimum) warnings.push("The selected path does not meet the 30-credit SNHU residency minimum.");
    if (selectedCredits >= 120 && majorSnhu < state.program.majorResidencyMinimum) warnings.push("The selected path does not meet the 12-credit major residency minimum.");
    Object.entries(category).forEach(([key, x]) => { if (x.selected > x.required) warnings.push(`${window.DegreeData.categories[key]} exceeds its requirement.`); });
    path.filter(r => opt(r).verification !== "Confirmed").forEach(r => warnings.push(`${r.code}: selected equivalency is ${opt(r).verification.toLowerCase()}.`));
    const completeCategories = Object.values(category).every(x => x.selected === x.required);
    const valid = selectedCredits === 120 && completeCategories && snhuSelected >= 30 && majorSnhu >= 12 && outsideSelected <= 90 && !duplicateAssignments.length;
    const provisional = valid && path.some(r => opt(r).verification !== "Confirmed");
    return {
      selectedCredits, completedCredits, plannedCredits: credits(planned), inProgressCredits: credits(progress),
      remainingToSelect: Math.max(0, 120 - selectedCredits), byProvider, snhuSelected, snhuCompleted,
      majorSnhu, outsideSelected, category, warnings, duplicateAssignments, pathStatus: valid ? (provisional ? "Provisional" : "Valid") : "Incomplete"
    };
  }

  function score(o, mode, state, providerCounts) {
    const s = state.settings, provider = s.providers[o.provider] || {};
    const cost = o.cost ?? (provider.pricingModel === "perCredit" ? provider.price * o.credits : provider.price) ?? 0;
    const days = o.days ?? s.defaultCourseDays, hours = o.hours ?? s.defaultCourseHours;
    if (mode === "fastest") return days + o.gradingDelayDays + hours / 10;
    if (mode === "lowest-cost") return cost + days / 1000;
    if (mode === "fewest-providers") return (providerCounts[o.provider] || 0) ? 0 : 1000;
    if (mode === "conservative") return o.verification === "Confirmed" ? cost + days : 100000;
    if (mode === "max-transfer") return o.provider === "SNHU" ? 1000 : cost;
    return cost / 10 + days + hours + (o.verification === "Confirmed" ? 0 : 500);
  }

  function generatePlan(state, mode = "balanced") {
    const next = clone(state), scenario = next.scenarios.find(s => s.id === next.activeScenarioId);
    const counts = {};
    next.requirements.filter(r => r.status === "Completed").forEach(r => { const o = opt(r); if (o) counts[o.provider] = (counts[o.provider] || 0) + 1; });
    next.requirements.forEach(r => {
      if (r.status === "Completed" || scenario?.locks.includes(r.id)) return;
      let choices = r.options.filter(o => !scenario?.exclusions.includes(o.id) && o.verification !== "Not eligible");
      if (mode === "conservative") choices = choices.filter(o => o.verification === "Confirmed");
      if (!choices.length) return;
      choices.sort((a, b) => score(a, mode, next, counts) - score(b, mode, next, counts) || a.id.localeCompare(b.id));
      r.selectedOptionId = choices[0].id; r.status = "Planned"; counts[choices[0].provider] = (counts[choices[0].provider] || 0) + 1;
    });
    // Enforce residency using major SNHU courses first, then other SNHU courses.
    let a = audit(next);
    const convert = r => {
      const o = r.options.find(x => x.provider === "SNHU" && x.verification === "Confirmed");
      if (o) { r.selectedOptionId = o.id; r.status = "Planned"; return true; }
      return false;
    };
    next.requirements.filter(r => r.major && r.status !== "Completed").forEach(r => { if (a.majorSnhu < 12 && convert(r)) a = audit(next); });
    next.requirements.filter(r => r.status !== "Completed").forEach(r => { if (a.snhuSelected < 30 && convert(r)) a = audit(next); });
    if (scenario) {
      scenario.mode = mode;
      scenario.selections = Object.fromEntries(next.requirements.filter(selected).map(r => [r.id, r.selectedOptionId]));
    }
    next.meta.updatedAt = new Date().toISOString();
    return next;
  }

  function estimate(state) {
    const rs = state.requirements.filter(r => selected(r) && r.status !== "Completed"), providers = state.settings.providers;
    let cost = (+state.settings.booksMaterials || 0) + (+state.settings.transferEvaluationFees || 0) + (+state.settings.miscellaneousCosts || 0), days = 0, hours = 0, touchstones = 0;
    const subscriptions = {};
    rs.forEach(r => {
      const o = opt(r), p = providers[o.provider] || {};
      const familiarity = { "New material": 1, "Some familiarity": .9, "Strong familiarity": .75, "Mostly review": .6 }[o.familiarity] || 1;
      hours += o.hours ?? Math.ceil((o.baselineHours ?? state.settings.defaultCourseHours) * familiarity);
      days += (o.expectedDays ?? o.days ?? state.settings.defaultCourseDays) + (o.gradingDelayDays || 0);
      touchstones += +o.touchstones || 0;
      if (o.cost != null) cost += +o.cost;
      else if (p.pricingModel === "perCredit") cost += (+p.price || 0) * (+o.credits || 0);
      else if (p.pricingModel === "subscription") subscriptions[o.provider] = Math.max(subscriptions[o.provider] || 0, Math.ceil(days / (+p.periodDays || 30)));
      else cost += +p.price || 0;
      cost += +p.examFee || 0;
    });
    Object.entries(subscriptions).forEach(([name, periods]) => { cost += periods * (+providers[name].price || 0); });
    const concurrency = Math.max(1, +state.settings.concurrentCourses || 1), expected = Math.ceil(days / concurrency);
    return { cost, hours, touchstones, aggressiveDays: Math.ceil(expected * .75), expectedDays: expected, conservativeDays: Math.ceil(expected * 1.35) };
  }

  function sequence(state) {
    return state.requirements.filter(r => selected(r) && r.status !== "Completed").slice().sort((a, b) => {
      const ao = opt(a), bo = opt(b);
      return (ao.verification === "Confirmed" ? 0 : 1) - (bo.verification === "Confirmed" ? 0 : 1) ||
        (ao.prerequisites.length ? -1 : 0) - (bo.prerequisites.length ? -1 : 0) ||
        (ao.touchstones - bo.touchstones) || ((ao.hours ?? 40) - (bo.hours ?? 40)) || a.id.localeCompare(b.id);
    }).map((r, i) => ({ requirementId: r.id, rank: i + 1, reason: i < 2 ? "Confirmed option with low dependency risk" : "Follows higher-priority and prerequisite-sensitive work" }));
  }

  window.DegreeEngine = { STATUSES, VERIFY, validate, migrate, audit, generatePlan, estimate, sequence, clone, selected, optionFor: opt };
})();
