(function () {
  "use strict";
  const KEYS = { current: "degreeOptimizerV3", v2: "degreeOptimizerV2", v1: "degreeCompass" };
  const clone = value => JSON.parse(JSON.stringify(value));

  function safeParse(text) {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Saved data is not a plan object.");
    return value;
  }

  function validateAndMigrate(value) {
    const migrated = window.DegreeEngine.migrate(value);
    const result = window.DegreeEngine.validate(migrated);
    if (!result.valid) throw new Error(result.errors.join(" "));
    return migrated;
  }

  function load(storage) {
    const memoryBackup = Object.fromEntries(Object.values(KEYS).map(key => [key, storage.getItem(key)]));
    const sourceKey = memoryBackup[KEYS.current] ? KEYS.current : memoryBackup[KEYS.v2] ? KEYS.v2 : memoryBackup[KEYS.v1] ? KEYS.v1 : "";
    if (!sourceKey) return { state: null, firstRun: true, migrated: false, error: "" };
    try {
      const state = validateAndMigrate(safeParse(memoryBackup[sourceKey]));
      const migrated = sourceKey !== KEYS.current;
      if (migrated) storage.setItem(KEYS.current, JSON.stringify(state));
      return { state, firstRun: false, migrated, error: "" };
    } catch (error) {
      // Restore exactly what was present before the attempted migration.
      Object.entries(memoryBackup).forEach(([key, value]) => value == null ? storage.removeItem(key) : storage.setItem(key, value));
      return { state: null, firstRun: false, migrated: false, error: `Your saved plan could not be migrated. The prior browser data was preserved. ${error.message}` };
    }
  }

  function save(storage, state) {
    const check = window.DegreeEngine.validate(state);
    if (!check.valid) throw new Error(check.errors.join(" "));
    storage.setItem(KEYS.current, JSON.stringify(state));
  }

  function deleteAll(storage) {
    Object.values(KEYS).forEach(key => storage.removeItem(key));
  }

  function sensitiveSignals(text) {
    const checks = [
      ["possible name or email", /\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/],
      ["possible student identifier", /student\s*(?:id|number)\s*[:#-]?\s*[A-Z0-9-]{6,}/i],
      ["possible birth date or address", /\b(?:date of birth|dob|street address|home address)\b/i]
    ];
    return checks.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
  }

  function importJson(text) {
    const signals = sensitiveSignals(text);
    const state = validateAndMigrate(safeParse(text));
    const audit = window.DegreeEngine.audit(state);
    return {
      state,
      signals,
      summary: {
        schemaVersion: state.schemaVersion,
        requirements: state.requirements.length,
        completedCredits: audit.completedCredits,
        selectedCredits: audit.selectedCredits,
        origin: state.meta?.origin || "import"
      }
    };
  }

  function exportJson(state) {
    return JSON.stringify(clone(state), null, 2);
  }

  window.DegreePrivacy = { KEYS, load, save, deleteAll, importJson, exportJson, sensitiveSignals, validateAndMigrate };
})();
