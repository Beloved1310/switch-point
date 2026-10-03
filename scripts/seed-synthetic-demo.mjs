#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demoVersion = "v1-synthetic-demo";
const batchSize = 100;

function loadEnvFile(file) {
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "");
    }
    process.env[match[1]] = value;
  }
}

function parseCsv(source) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  if (value || row.length) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }
  const [header, ...records] = rows;
  return records.filter((cells) => cells.length === header.length).map((cells) =>
    Object.fromEntries(header.map((key, index) => [key, cells[index]])),
  );
}

function parseJsonCell(value, fallback = null) {
  return value === "" ? fallback : JSON.parse(value);
}

async function loadDemoConfig() {
  const source = readFileSync(path.join(root, "src/config/experiments/coffee-v1.ts"), "utf8")
    .replace(/^import type .*;\s*/gm, "")
    .replace("export const coffeeV1: ExperimentConfig =", "export const coffeeV1 =");
  const compiled = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  return {
    ...compiled.coffeeV1,
    version: "v1-synthetic-demo",
    category: "SYNTHETIC DEMO · Ground coffee, 227g",
    fulfilment: {
      enabled: false,
      rule: "Synthetic demo data only. No participant choices or rewards are real.",
    },
  };
}

async function postRows(url, key, table, rows, conflict) {
  for (let start = 0; start < rows.length; start += batchSize) {
    const endpoint = new URL(`/rest/v1/${table}`, url);
    endpoint.searchParams.set("on_conflict", conflict);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows.slice(start, start + batchSize)),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Supabase ${table} upsert failed (${response.status}): ${detail}`);
    }
  }
}

async function readRows(url, key, table, query) {
  const endpoint = new URL(`/rest/v1/${table}`, url);
  for (const [name, value] of Object.entries(query)) endpoint.searchParams.set(name, value);
  const response = await fetch(endpoint, {
    headers: { apikey: key, authorization: `Bearer ${key}`, prefer: "count=exact" },
  });
  if (!response.ok) throw new Error(`Supabase ${table} verification failed (${response.status}): ${await response.text()}`);
  return { rows: await response.json(), contentRange: response.headers.get("content-range") };
}

async function main() {
  loadEnvFile(path.join(root, ".env.local"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const config = await loadDemoConfig();
  if (config.version !== demoVersion || !config.category.startsWith("SYNTHETIC DEMO") || config.fulfilment.enabled) {
    throw new Error("Safety check failed: the configured demo version must be labelled synthetic with fulfilment disabled.");
  }

  const choicesCsv = readFileSync(path.join(root, "demo-data/synthetic-v1-pilot-choices.csv"), "utf8");
  const statedCsv = readFileSync(path.join(root, "demo-data/synthetic-v1-pilot-stated-reasons.csv"), "utf8");
  const rawChoices = parseCsv(choicesCsv);
  const rawStated = parseCsv(statedCsv);
  if (!rawChoices.length || !rawStated.length || rawChoices.some((row) => row.experiment_version !== demoVersion)) {
    throw new Error(`Seed files must contain records for ${demoVersion}; regenerate them first.`);
  }

  const statedByParticipant = new Map(rawStated.map((row) => [row.participant_id, row]));
  const choicesByParticipant = new Map();
  for (const row of rawChoices) {
    const list = choicesByParticipant.get(row.participant_id) ?? [];
    list.push(row);
    choicesByParticipant.set(row.participant_id, list);
  }
  if ([...choicesByParticipant.keys()].some((id) => !statedByParticipant.has(id))) {
    throw new Error("Every synthetic participant must have one stated-reason record.");
  }

  const participants = [...choicesByParticipant].map(([id, rows]) => {
    const baseline = rows.find((row) => row.scenario_id === "baseline");
    const stated = statedByParticipant.get(id);
    if (!baseline || rows.length !== 8 || !stated) throw new Error(`Incomplete synthetic record set for ${id}`);
    const controlledRows = rows.filter((row) => row.scenario_id !== "baseline");
    return {
      id,
      experiment_version: demoVersion,
      say_first: stated.phase === "before",
      plan: {
        sayFirst: stated.phase === "before",
        baselineLeft: baseline.left_product,
        order: controlledRows.map((row) => ({
          scenarioId: row.scenario_id,
          baselineOnLeft: row.left_product === baseline.chosen_product,
        })),
      },
      created_at: rows.map((row) => row.created_at).sort()[0],
      completed_at: rows.map((row) => row.created_at).sort().at(-1),
    };
  });

  const choices = rawChoices.map((row) => ({
    participant_id: row.participant_id,
    experiment_version: demoVersion,
    scenario_id: row.scenario_id,
    levers: parseJsonCell(row.levers, []),
    condition: parseJsonCell(row.condition),
    left_product: row.left_product,
    right_product: row.right_product,
    left_view: parseJsonCell(row.left_view),
    right_view: parseJsonCell(row.right_view),
    chosen_side: row.chosen_side,
    chosen_product: row.chosen_product,
    baseline_product: row.baseline_product || null,
    switched: row.switched === "" ? null : row.switched === "true",
    created_at: row.created_at,
  }));

  const stated = rawStated.map((row) => ({
    participant_id: row.participant_id,
    experiment_version: demoVersion,
    phase: row.phase,
    reason_text: row.reason_text,
    stated_price_threshold: row.stated_price_threshold === "" ? null : Number(row.stated_price_threshold),
    ai_status: row.ai_status,
    ai_category: row.ai_category,
    ai_confidence: row.ai_confidence,
    ai_model: "synthetic-demo-generator",
    override_category: null,
    created_at: row.created_at,
  }));

  const fingerprint = createHash("sha256").update(JSON.stringify(config)).digest("hex");
  if (process.argv.includes("--dry-run")) {
    console.log(`Validated ${participants.length} synthetic participants, ${choices.length} choices, and ${stated.length} stated reasons for ${demoVersion}.`);
    console.log(`Experiment fingerprint: ${fingerprint}`);
    console.log("Dry run only; Supabase was not contacted.");
    return;
  }
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local or the environment.");
  }
  await postRows(url, key, "experiments", [{ version: demoVersion, config, config_hash: fingerprint }], "version");
  await postRows(url, key, "participants", participants, "id");
  await postRows(url, key, "choices", choices, "participant_id,scenario_id");
  await postRows(url, key, "stated_reasons", stated, "participant_id");

  const [storedExperiment, storedParticipants, storedChoices, storedStated] = await Promise.all([
    readRows(url, key, "experiments", { select: "version,config_hash", version: `eq.${demoVersion}` }),
    readRows(url, key, "participants", { select: "id", experiment_version: `eq.${demoVersion}` }),
    readRows(url, key, "choices", { select: "id", experiment_version: `eq.${demoVersion}` }),
    readRows(url, key, "stated_reasons", { select: "participant_id", experiment_version: `eq.${demoVersion}` }),
  ]);
  const countOf = ({ contentRange }) => Number(contentRange?.split("/").at(-1));
  if (storedExperiment.rows.length !== 1 || storedExperiment.rows[0].config_hash !== fingerprint) {
    throw new Error(`Seed verification failed: ${demoVersion} config is missing or has a different fingerprint.`);
  }
  const counts = [storedParticipants, storedChoices, storedStated].map(countOf);
  const expected = [participants.length, choices.length, stated.length];
  if (counts.some((count, index) => count !== expected[index])) {
    throw new Error(`Seed verification failed: expected ${expected.join("/")} rows, found ${counts.join("/")}.`);
  }

  console.log(`Verified ${counts[0]} synthetic participants, ${counts[1]} choices, and ${counts[2]} stated reasons in ${demoVersion}.`);
  console.log("The live v1 experiment was not modified. Re-running this script updates the same synthetic records.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
