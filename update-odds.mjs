/**
 * update-odds.mjs — обновляет JSON-файлы с кэфами в папке odds/.
 *
 * Запускается:
 *   • в GitHub Action раз в 3 часа (есть ODDS_API_KEY) → тянет The Odds API,
 *     усредняет 1/X/2 по букмекерам, пишет odds/<key>.json;
 *   • локально без ключа → просто проставляет seed-значения (для первичного
 *     наполнения репозитория, чтобы CDN сразу отдавал валидные файлы).
 *
 * Формат файла (его читает баннер):
 *   { "home":2.10, "draw":3.40, "away":3.20,
 *     "kickoff":"2026-06-26T19:00:00Z", "updated":"...", "stale":false }
 */

import fs from "node:fs";
import path from "node:path";

const SPORT_KEY = "soccer_fifa_world_cup";
const REGIONS   = "eu";
const API_KEY   = process.env.ODDS_API_KEY || "";
const OUT_DIR   = path.join(process.cwd(), "odds");

// key — имя файла/баннера; home/away — регэкспы команд ("1"=home, "2"=away);
// seed — последний известный снимок кэфов (фолбэк + первичное наполнение).
const MATCHES = [
  { key:"switzerland-canada",    home:/switzerland|suisse|schweiz/i,   away:/canada/i,                          seed:{home:2.41, draw:3.07, away:3.30,  kickoff:"2026-06-24T19:00:00Z"} },
  { key:"scotland-brazil",       home:/scotland/i,                     away:/brazil|brasil/i,                   seed:{home:8.07, draw:5.23, away:1.37,  kickoff:"2026-06-24T22:00:00Z"} },
  { key:"morocco-haiti",         home:/morocco|maroc/i,                away:/haiti/i,                           seed:{home:1.18, draw:7.32, away:17.65, kickoff:"2026-06-24T22:00:00Z"} },
  { key:"southafrica-southkorea",home:/south\s*africa/i,               away:/korea/i,                           seed:{home:5.33, draw:3.81, away:1.68,  kickoff:"2026-06-25T01:00:00Z"} },
  { key:"curacao-ivorycoast",    home:/cura[cç]ao/i,                   away:/ivor|ivoire|c[oô]te/i,             seed:{home:18.92,draw:8.26, away:1.15,  kickoff:"2026-06-25T20:00:00Z"} },
  { key:"ecuador-germany",       home:/ecuador/i,                      away:/germany|deutschland/i,             seed:{home:3.72, draw:3.94, away:1.91,  kickoff:"2026-06-25T20:00:00Z"} },
  { key:"tunisia-netherlands",   home:/tunisia|tunisie/i,              away:/netherlands|holland|nederland/i,   seed:{home:22.48,draw:8.94, away:1.13,  kickoff:"2026-06-25T23:00:00Z"} },
  { key:"norway-france",         home:/norway|norge/i,                 away:/france/i,                          seed:{home:5.01, draw:4.22, away:1.64,  kickoff:"2026-06-26T19:00:00Z"} },
  { key:"senegal-iraq",          home:/senegal/i,                      away:/iraq/i,                            seed:{home:1.23, draw:6.48, away:12.64, kickoff:"2026-06-26T19:00:00Z"} },
  { key:"uruguay-spain",         home:/uruguay/i,                      away:/spain|espa[nñ]a/i,                 seed:{home:7.18, draw:4.25, away:1.49,  kickoff:"2026-06-27T00:00:00Z"} },
  { key:"panama-england",        home:/panama/i,                       away:/england/i,                         seed:{home:12.89,draw:7.22, away:1.20,  kickoff:"2026-06-27T21:00:00Z"} },
  { key:"croatia-ghana",         home:/croatia|hrvatska/i,             away:/ghana/i,                           seed:{home:1.63, draw:3.68, away:5.85,  kickoff:"2026-06-27T21:00:00Z"} },
];

const round2 = (v) => Math.round(v * 100) / 100;

function pickOdds(games, match) {
  const game = (games || []).find((g) => {
    const h = g.home_team || "", a = g.away_team || "";
    return (match.home.test(h) && match.away.test(a)) ||
           (match.home.test(a) && match.away.test(h));
  });
  if (!game) return null;

  const sum = { home: 0, draw: 0, away: 0 }, n = { home: 0, draw: 0, away: 0 };
  for (const bk of game.bookmakers || []) {
    const m = (bk.markets || []).find((x) => x.key === "h2h");
    if (!m) continue;
    for (const o of m.outcomes) {
      const slot = /draw/i.test(o.name) ? "draw"
        : match.home.test(o.name) ? "home"
        : match.away.test(o.name) ? "away" : null;
      if (slot) { sum[slot] += o.price; n[slot]++; }
    }
  }
  if (!n.home || !n.away) return null;

  return {
    home: round2(sum.home / n.home),
    draw: n.draw ? round2(sum.draw / n.draw) : null,
    away: round2(sum.away / n.away),
    kickoff: game.commence_time,
    updated: new Date().toISOString(),
    stale: false,
  };
}

function readExisting(key) {
  try { return JSON.parse(fs.readFileSync(path.join(OUT_DIR, key + ".json"), "utf8")); }
  catch { return null; }
}

function writeFileFor(key, obj) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, key + ".json"), JSON.stringify(obj) + "\n", "utf8");
}

async function main() {
  let games = null;
  if (API_KEY) {
    const api =
      `https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/odds/` +
      `?regions=${REGIONS}&markets=h2h&oddsFormat=decimal&apiKey=${API_KEY}`;
    const res = await fetch(api);
    if (res.ok) games = await res.json();
    else console.error("The Odds API error:", res.status, await res.text());
  } else {
    console.log("ODDS_API_KEY не задан — пишу seed-значения (первичное наполнение).");
  }

  for (const m of MATCHES) {
    let out = games ? pickOdds(games, m) : null;
    if (!out) {
      // нет котировки/нет ключа — сохраняем прежнее значение, иначе seed
      const prev = readExisting(m.key);
      out = prev
        ? { ...prev, stale: true }
        : { ...m.seed, updated: new Date().toISOString(), stale: true };
    }
    writeFileFor(m.key, out);
    console.log("  ✓", m.key + ".json", "→", `${out.home}/${out.draw}/${out.away}`, out.stale ? "(stale)" : "");
  }
  console.log("Готово.");
}

main().catch((e) => { console.error(e); process.exit(1); });
