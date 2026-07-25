(function () {
  "use strict";

  const option = (id, provider, code, title, verification = "Confirmed", extra = {}) => ({
    id, provider, code, title, credits: 3, verification,
    cost: null, baselineHours: 40, hours: null, minimumDays: 1, expectedDays: null, days: null, gradingDelayDays: 0,
    touchstones: 0, familiarity: "New material", prerequisites: [], residencyEligible: provider === "SNHU",
    majorResidencyEligible: provider === "SNHU", sourceUrl: "", effectiveDate: "",
    ...extra
  });

  const requirement = (id, category, code, name, extra = {}) => ({
    id, category, code, name, credits: 3, major: category === "core" || category === "mis",
    status: "Available", verification: "Confirmed", selectedOptionId: "",
    term: "", sequence: null, notes: "", completedBy: null, options: [], ...extra
  });

  const snhu = (id, code, title, extra) => option(`${id}-snhu`, "SNHU", code, title, "Confirmed", extra);
  function ensureProviderCandidates(requirements) {
    requirements.forEach(r => {
      if (r.residencySensitive || r.special) return;
      const candidates = [
        ["Sophia", "sophia", 25, 30],
        ["Study.com", "study", 35, 45]
      ];
      candidates.forEach(([provider, suffix, hours, days]) => {
        const existing = r.options.find(o => o.provider === provider);
        if (existing) {
          if (existing.verification !== "Confirmed") {
            existing.baselineHours ??= hours;
            existing.expectedDays ??= days;
            existing.candidate = true;
          }
          return;
        }
        r.options.push(option(
          `${r.id}-${suffix}-candidate`,
          provider,
          "ENTER COURSE",
          `Candidate ${provider} course — verify equivalency`,
          "Unverified",
          {
            candidate: true,
            baselineHours: hours,
            expectedDays: days,
            snhuEquivalent: r.code,
            notes: `Planning placeholder only. Enter the current ${provider} course and verify its SNHU application before relying on it.`
          }
        ));
      });
    });
    return requirements;
  }

  function createRequirements() {
    const completed = [
      requirement("gen-eng130", "gened", "ENG 130", "Foundations of Written Communication", { options: [snhu("gen-eng130", "ENG 130", "Foundations of Written Communication")] }),
      requirement("gen-com126", "gened", "COM 126", "Introduction to Mass Communication", { options: [snhu("gen-com126", "COM 126", "Introduction to Mass Communication")] }),
      requirement("gen-phy1", "gened", "PHY 1ELE", "Physics elective", { options: [snhu("gen-phy1", "PHY 1ELE", "Physics elective")] }),
      requirement("gen-fas3", "gened", "FAS 3ELE", "Fine arts elective", { options: [snhu("gen-fas3", "FAS 3ELE", "Fine arts elective")] }),
      requirement("gen-it3", "gened", "IT 3ELE", "Information technology elective", { options: [snhu("gen-it3", "IT 3ELE", "Information technology elective")] }),
      requirement("gen-lit2", "gened", "LIT 2ELE", "Literature elective", { options: [snhu("gen-lit2", "LIT 2ELE", "Literature elective")] }),
      ...Array.from({ length: 4 }, (_, i) => {
        const n = i + 1, id = `free-${n}`;
        return requirement(id, "free", "ELECTIVE", `Free elective ${n}`, { options: [snhu(id, "ELECTIVE", `SNHU free elective ${n}`)] });
      })
    ];
    const gen = [
      ["gen-sjs", "CSOJ / CSST", "Social Justice or Sustainability"],
      ["gen-eng190", "ENG 190", "Research and Persuasion"],
      ["gen-mat240", "MAT 240", "Applied Statistics"],
      ["gen-eeth", "EETH", "Ethical Thought and Equity"],
      ["gen-ehps", "EHPS", "Historical Perspectives"],
      ["gen-eco201", "ECO 201", "Microeconomics"],
      ["gen-eco202", "ECO 202", "Macroeconomics"],
      ["gen-clme", "CLME", "Culmination Experience"]
    ].map(([id, code, name]) => requirement(id, "gened", code, name, { options: [snhu(id, code, name)] }));
    const socialJustice = gen.find(r => r.id === "gen-sjs");
    socialJustice.residencySensitive = true;
    socialJustice.options = ["BUS 208","EG 110","ENV 219","HIS 270","POL 322","SCI 219","SCI 220","SPT 215","SST 101"].map((code, i) => snhu(`gen-sjs-${i}`, code, "Approved Social Justice and Sustainability option"));
    const research = gen.find(r => r.id === "gen-eng190");
    research.code = "ENG 190 / ENG 200";
    research.options = [snhu("gen-eng190-0", "ENG 190", "Research and Persuasion"), snhu("gen-eng190-1", "ENG 200", "Sophomore Seminar")];
    const culmination = gen.find(r => r.id === "gen-clme");
    culmination.special = true;
    culmination.residencySensitive = true;
    culmination.notes = "Upper-level transfer applicability and residency restrictions require explicit verification.";
    culmination.options[0].level = "upper";
    const core = [
      ["core-acc201", "ACC 201", "Financial Accounting"],
      ["core-acc202", "ACC 202", "Managerial Accounting"],
      ["core-bus206", "BUS 206", "Business Law I"],
      ["core-bus210", "BUS 210", "Managing and Leading in Business"],
      ["core-bus225", "BUS 225", "Critical Business Skills for Success"],
      ["core-bus400", "BUS 400", "Driving Business Opportunities"],
      ["core-fin320", "FIN 320", "Principles of Finance"],
      ["core-int220", "INT 220", "Global Dimensions in Business"],
      ["core-mkt205", "MKT 205", "Applied Marketing Strategies"],
      ["core-qso321", "QSO 321", "People, Planet, and Profit"]
    ].map(([id, code, name]) => {
      const r = requirement(id, "core", code, name, { options: [snhu(id, code, name)] });
      if (["core-acc201", "core-bus206", "core-fin320"].includes(id)) {
        r.options.push(option(`${id}-sophia`, "Sophia", "UNVERIFIED", `Possible ${name} equivalent`, "Unverified", { sourceUrl: "https://snhu.sophia.org/" }));
      }
      return r;
    });
    const mis = [
      ["mis-db", "DAD 220 / CIS 255", "Database requirement"],
      ["mis-sad", "CIS 315 / IT 315", "Systems analysis and design"],
      ["mis-client", "MIS 215 / CIS 335", "Client systems and business applications"],
      ["mis-bi", "MIS 350 / CIS 355", "Business intelligence and reporting"],
      ["mis-enterprise", "MIS 300 / CIS 410", "Enterprise information systems"]
    ].map(([id, code, name]) => requirement(id, "mis", code, name, {
      options: code.split(" / ").map((c, i) => snhu(`${id}-${i}`, c, name))
    }));
    const free = Array.from({ length: 7 }, (_, i) => {
      const n = i + 5, id = `free-${n}`;
      return requirement(id, "free", "ELECTIVE", `Free elective ${n}`, {
        options: [snhu(id, "ELECTIVE", `SNHU free elective ${n}`)]
      });
    });
    return ensureProviderCandidates([...completed, ...gen, ...core, ...mis, ...free]);
  }

  function blank() {
    return {
      schemaVersion: 4,
      meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), migratedFrom: null, origin: "blank" },
      student: { name: "", studentId: "", program: "BS Business Administration — Management Information Systems", catalog: "2026 C-5" },
      program: { totalCredits: 120, transferMaximum: 90, snhuMinimum: 30, majorResidencyMinimum: 12, categoryCredits: { gened: 42, core: 30, mis: 15, free: 33 } },
      requirements: createRequirements(),
      credentials: [{
        id: "credential-1", name: "", issuer: "", earned: false, earnedDate: "",
        expirationDate: "", evidence: "", credits: 3, equivalency: "", appliedRequirementId: "",
        candidateEquivalencies: [], verification: "Advisor confirmation required",
        notes: "Record an earned professional credential locally, then confirm its credit value and degree application with an advisor."
      }],
      scenarios: [{ id: "baseline", name: "Current plan", mode: "balanced", selections: {}, statuses: {}, locks: [], exclusions: [], overrides: {}, createdAt: new Date().toISOString() }],
      activeScenarioId: "baseline",
      verificationQueue: [
        "Which exact SNHU requirement will the PMP satisfy?",
        "What is the PMP’s approved credit value?",
        "Can the PMP satisfy a major requirement and count toward major residency?",
        "Which current Sophia courses are approved for each remaining requirement?",
        "Can a transferred upper-level course satisfy the Culmination Experience?",
        "Which remaining courses are required to be taken at SNHU?",
        "How will excess transfer credits be applied to the 33-credit free-elective requirement?",
        "Are any MIS concentration alternatives available through approved transfer partners?",
        "Does the Social Justice and Sustainability requirement have to be completed through SNHU?",
        "Which four or more major courses should be reserved for SNHU to satisfy the 12-credit major-residency minimum?"
      ].map((question, i) => ({ id: `q-${i + 1}`, question, answer: "", status: "Open", owner: "Advisor", dateAnswered: "", evidence: "", resultingChanges: "", affectedRequirementId: "", updatedAt: "" })),
      settings: {
        providers: {
          SNHU: { pricingModel: "perCredit", price: 0, effectiveDate: "", sourceUrl: "", notes: "Enter current tuition per credit." },
          Sophia: { pricingModel: "subscription", price: 0, periodDays: 30, effectiveDate: "", sourceUrl: "https://snhu.sophia.org/", notes: "Enter the plan price you expect to use." },
          Transfer: { pricingModel: "perCourse", price: 0, effectiveDate: "", sourceUrl: "", notes: "" },
          "Study.com": { pricingModel: "subscription", price: 0, periodDays: 30, effectiveDate: "", sourceUrl: "", notes: "Enter subscription and exam costs as currently applicable." },
          Credential: { pricingModel: "perCourse", price: 0, effectiveDate: "", sourceUrl: "", notes: "Include transcription or evaluation fees." },
          Other: { pricingModel: "perCourse", price: 0, effectiveDate: "", sourceUrl: "", notes: "Use for other transfer providers, books, materials, or miscellaneous costs." }
        },
        defaultCourseHours: 40, defaultCourseDays: 56, concurrentCourses: 2,
        booksMaterials: 0, transferEvaluationFees: 0, miscellaneousCosts: 0
      },
      ui: { tab: "overview", filter: "all", category: "all", studentIdVisible: false }
    };
  }

  function demo() {
    const state = blank();
    state.meta.origin = "demo";
    state.student.name = "Sample Learner";
    const selected = ["gen-eng130","gen-com126","gen-phy1","gen-fas3","gen-it3","gen-lit2","free-1","free-2","free-3","free-4"];
    selected.forEach((id, i) => {
      const r = state.requirements.find(x => x.id === id);
      const optionId = `${id}-demo-transfer`;
      r.options.push(option(optionId, "Transfer", `DEMO ${101 + i}`, `Fictional transfer course ${i + 1}`, "Confirmed", { institution: "Example Community College", snhuEquivalent: r.code }));
      r.selectedOptionId = optionId;
      r.status = "Completed";
      r.completedBy = { provider: "Transfer", code: `DEMO ${101 + i}`, title: `Fictional transfer course ${i + 1}`, institution: "Example Community College" };
    });
    return state;
  }

  window.DegreeData = { blank, demo, seed: blank, option, requirement, ensureProviderCandidates, categories: { gened: "General Education · The Commons", core: "Business Core", mis: "MIS Concentration", free: "Free Electives" } };
})();
