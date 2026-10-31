// Sample flock data for trying Farm KPI and the calculators without typing.
// It lives in the browser only: saved KPI rows earn points and feed APPI, so
// made-up numbers must never reach them.

const START_WEEK = 30;
const HENS = 5000;
const EGG_PRICE_PER_KG = 26000;
const FEED_PRICE_PER_KG = 7500;
const FEED_SHARE_OF_COST = 0.7;
const HEAT_WEEKS = 2;
const HEAT_EXTRA_COST = 1500000; // Fans, electricity and supplements in a hot week.
const STORAGE_KEY = "aapm-farm-simulation";

export const SIMULATION_WEEK_OPTIONS = [4, 8, 12];
export const SIMULATION_SCENARIOS = {
  normal: { label: "Normal", description: "Flock sehat dengan penurunan HDP yang wajar." },
  panas: { label: "Stres panas", description: "Dua minggu terakhir kandang panas, jadi ada temuan untuk dibaca." },
};

/** Small seeded generator, so one configuration always draws the same flock. */
function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value, digits = 0) => Number(value.toFixed(digits));

export function simulateFarmWeeks({ weeks = 8, scenario = "normal" } = {}) {
  const random = seededRandom(weeks * 31 + (scenario === "panas" ? 7 : 1));
  const wobble = (size) => (random() * 2 - 1) * size;
  const rows = [];
  for (let index = 0; index < weeks; index += 1) {
    const week = START_WEEK + index;
    const heat = scenario === "panas" ? Math.max(0, index - (weeks - HEAT_WEEKS - 1)) : 0;
    const previous = rows[index - 1];
    // Any week-on-week dip reads as a concern, so a healthy flock ends on a good week.
    const closing = scenario === "normal" && index === weeks - 1;
    const henDayProduction = closing ? round(previous.henDayProduction + 0.2, 1) : round(93.5 - 0.12 * index + wobble(0.2) - heat * 1.6, 1);
    const eggWeight = closing ? round(previous.eggWeight + 0.1, 1) : round(60.5 + 0.09 * index + wobble(0.1) - heat * 0.3, 1);
    const feedIntake = closing ? previous.feedIntake : round(114 + wobble(0.6) - heat * 3.5, 1);
    const mortality = closing ? Math.min(previous.mortality, 0.03) : round(0.03 + random() * 0.02 + heat * 0.03, 2);
    const eggMassKg = (HENS * 7 * (henDayProduction / 100) * eggWeight) / 1000;
    const feedKg = (HENS * 7 * feedIntake) / 1000;
    rows.push({
      id: `sim-${week}`,
      simulated: true,
      week,
      henDayProduction,
      eggWeight,
      feedIntake,
      waterIntake: round(feedIntake * 2 + wobble(3) + heat * 22),
      mortality,
      temperature: round(28 + wobble(0.6) + heat * 2.4, 1),
      humidity: round(72 + wobble(3) - heat * 2),
      fcr: round(feedIntake / ((henDayProduction / 100) * eggWeight), 2),
      revenue: Math.round((eggMassKg * EGG_PRICE_PER_KG) / 1000) * 1000,
      cost: Math.round((feedKg * FEED_PRICE_PER_KG) / FEED_SHARE_OF_COST / 1000) * 1000 + heat * HEAT_EXTRA_COST,
      notes: heat ? "Simulasi: kandang panas, konsumsi pakan turun dan air naik." : null,
    });
  }
  return rows;
}

/**
 * One simulated week for a calculator. Only the first field moves, within 6%: the
 * rest stay on their examples, so the inputs cannot contradict each other (eggs
 * above the hen count would read as more than 100% HDP).
 */
export function simulateToolValues(fields, step) {
  const swing = [0, 0.03, -0.02, 0.05, -0.04, 0.02, -0.06, 0.04][step % 8];
  return Object.fromEntries(fields.map((field, index) => {
    if (index > 0) return [field.key, String(field.example)];
    const value = field.example * (1 + swing);
    return [field.key, String(Number.isInteger(field.example) ? Math.round(value) : round(value, 2))];
  }));
}

export function readSimulation() {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "null");
    return stored && SIMULATION_WEEK_OPTIONS.includes(stored.weeks) && SIMULATION_SCENARIOS[stored.scenario] ? stored : null;
  } catch {
    return null;
  }
}

export function writeSimulation(simulation) {
  try {
    if (simulation) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(simulation));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browsers; the simulation just ends on reload.
  }
}
