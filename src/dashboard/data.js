import fetch from 'node-fetch';

const ASANA_TOKEN = process.env.ASANA_TOKEN;
if (!ASANA_TOKEN) throw new Error('ASANA_TOKEN não configurado no .env');

const PROJECT_ID = '1207335219525223';
const SINCE = process.env.SINCE || '2026-01-01';
const CACHE_TTL = 5 * 60 * 1000;
const VALID_PROJECTS = ['API', 'APP CAMPO', 'APP SOCIAL', 'GOV', 'PORTAL', 'Whatsapp'];
const SIZE_TAGS = ['micro', 'p', 'm', 'g', 'gg'];

const headers = { Authorization: `Bearer ${ASANA_TOKEN}` };
let cache = { data: null, timestamp: 0 };

export async function fetchAllTasks() {
  if (cache.data && Date.now() - cache.timestamp < CACHE_TTL) return cache.data;

  let tasks = [];
  let offset = null;
  let pages = 0;
  const MAX_PAGES = 50;

  do {
    const url = `https://app.asana.com/api/1.0/projects/${PROJECT_ID}/tasks?opt_fields=gid,name,created_at,tags.name,custom_fields.name,custom_fields.display_value,custom_fields.number_value,memberships.section.name&limit=100${offset ? '&offset=' + offset : ''}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Asana API ${res.status}: ${res.statusText}. Verifique o ASANA_TOKEN.`);
    const data = await res.json();
    tasks.push(...data.data);
    offset = data.next_page?.offset;
    if (++pages >= MAX_PAGES) break;
  } while (offset);

  const filtered = tasks.filter(t => {
    if (new Date(t.created_at) < new Date(SINCE)) return false;
    const section = t.memberships?.[0]?.section?.name;
    if (section === 'Finalizado - antigo') return false;
    return true;
  });
  cache = { data: filtered, timestamp: Date.now() };
  return filtered;
}

function getBugs(task) {
  const field = task.custom_fields?.find(f =>
    f.name === 'Número de relatos dos usuários' ||
    f.name === 'Numero de relatos dos usuarios'
  );
  if (!field) return 0;
  if (field.number_value != null) return field.number_value;
  const parsed = parseInt(field.display_value);
  return isNaN(parsed) ? 0 : parsed;
}

export function normalize(tasks) {
  return tasks.map(t => {
    const section = t.memberships?.[0]?.section?.name || 'Sem seção';
    const tags = (t.tags || []).map(tg => tg.name);
    const tagsLower = tags.map(tg => tg.toLowerCase());
    const projects = tags.filter(tg => VALID_PROJECTS.includes(tg));
    const size = tagsLower.find(tg => SIZE_TAGS.includes(tg)) || null;
    return {
      gid: t.gid,
      name: t.name,
      section,
      projects,
      size,
      bugs: getBugs(t),
      hasBug: tags.includes('Prevenção'),
      noBug: tags.includes('N/BUGS'),
      isFinished: section === 'Finalizado',
      created: t.created_at?.slice(0, 10) || '',
      createdAt: t.created_at || '',
      month: (t.created_at || '').slice(0, 7)
    };
  });
}

export function analyze(normalized) {
  const byProject = {};
  const bugsByProject = {};
  const monthly = {};
  let totalBugs = 0, completed = 0, cardsWithBug = 0, cardsNoBug = 0;

  for (const t of normalized) {
    if (t.isFinished) completed++;
    if (t.hasBug) cardsWithBug++;
    if (t.noBug) cardsNoBug++;
    totalBugs += t.bugs;

    if (t.projects.length > 0) {
      const p = t.projects[0];
      byProject[p] = (byProject[p] || 0) + 1;
      bugsByProject[p] = (bugsByProject[p] || 0) + t.bugs;
    }

    if (!monthly[t.month]) monthly[t.month] = { total: 0, bugs: 0, completed: 0 };
    monthly[t.month].total++;
    monthly[t.month].bugs += t.bugs;
    if (t.isFinished) monthly[t.month].completed++;
  }

  const bugRate = normalized.length > 0 ? +((cardsWithBug / normalized.length) * 100).toFixed(1) : 0;
  const density = cardsWithBug > 0 ? +(totalBugs / cardsWithBug).toFixed(1) : 0;

  return {
    total: normalized.length, completed, wip: normalized.length - completed,
    totalBugs, cardsWithBug, cardsNoBug, bugRate, density,
    byProject, bugsByProject, monthly
  };
}

// --- Cycle Time ---

function getHolidays(year) {
  // Feriados fixos
  const fixed = [`${year}-01-01`,`${year}-04-21`,`${year}-05-01`,`${year}-06-19`,`${year}-09-07`,`${year}-10-12`,`${year}-11-02`,`${year}-11-15`,`${year}-12-25`];
  // Páscoa (algoritmo de Meeus)
  const a=year%19, b=Math.floor(year/100), c=year%100, d=Math.floor(b/4), e=b%4;
  const f=Math.floor((b+8)/25), g=Math.floor((b-f+1)/3), h=(19*a+b-d-g+15)%30;
  const i=Math.floor(c/4), k=c%4, l=(32+2*e+2*i-h-k)%7;
  const m=Math.floor((a+11*h+22*l)/451), month=Math.floor((h+l-7*m+114)/31), day=((h+l-7*m+114)%31)+1;
  const easter = new Date(year, month-1, day);
  const offset = (d) => { const dt = new Date(easter); dt.setDate(dt.getDate()+d); return dt.toISOString().slice(0,10); };
  // Carnaval (seg+ter+qua cinzas), Sexta-feira Santa, Corpus Christi
  fixed.push(offset(-49), offset(-48), offset(-47), offset(-2), offset(60));
  return fixed;
}

const currentYear = new Date().getFullYear();
const HOLIDAYS = [...getHolidays(currentYear), ...getHolidays(currentYear + 1)];

// Emendas: feriado na terça → segunda é folga; feriado na quinta → sexta é folga
const BRIDGE_DAYS = [];
for (const h of HOLIDAYS) {
  const d = new Date(h + 'T12:00:00Z');
  const dow = d.getUTCDay();
  if (dow === 2) {
    const mon = new Date(d); mon.setUTCDate(mon.getUTCDate() - 1);
    BRIDGE_DAYS.push(mon.toISOString().slice(0, 10));
  } else if (dow === 4) {
    const fri = new Date(d); fri.setUTCDate(fri.getUTCDate() + 1);
    BRIDGE_DAYS.push(fri.toISOString().slice(0, 10));
  }
}
const ALL_OFF_DAYS = new Set([...HOLIDAYS, ...BRIDGE_DAYS]);

function isLastFridayOfMonth(date) {
  if (date.getDay() !== 5) return false;
  const next = new Date(date);
  next.setDate(next.getDate() + 7);
  return next.getMonth() !== date.getMonth();
}

function isBusinessDay(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  const iso = date.toISOString().slice(0, 10);
  return !ALL_OFF_DAYS.has(iso);
}

function getWorkEndHour(date) {
  return isLastFridayOfMonth(date) ? 12 : 17;
}

function calcBusinessHours(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  let hours = 0;
  const cursor = new Date(s);
  cursor.setMinutes(0, 0, 0);

  while (cursor < e) {
    if (isBusinessDay(cursor)) {
      const h = cursor.getHours();
      const endHour = getWorkEndHour(cursor);
      if (h >= 8 && h < endHour) {
        const blockStart = Math.max(cursor.getTime(), s.getTime());
        const blockEnd = Math.min(cursor.getTime() + 3600000, e.getTime());
        if (blockEnd > blockStart) hours += (blockEnd - blockStart) / 3600000;
      }
    }
    cursor.setTime(cursor.getTime() + 3600000);
  }
  return +hours.toFixed(1);
}

async function getTaskWorkHours(taskGid, createdAt) {
  const url = `https://app.asana.com/api/1.0/tasks/${taskGid}/stories?opt_fields=resource_subtype,text,created_at&limit=100`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const data = await res.json();

  const stories = data.data;
  const finishedStory = stories.filter(s => s.resource_subtype === 'section_changed' && s.text?.includes('Finalizado')).pop();
  if (!finishedStory) return null;

  // Detect pause periods (moved to "Pausado" → moved out)
  const pausePeriods = [];
  let pauseStart = null;
  for (const s of stories) {
    if (s.resource_subtype === 'section_changed') {
      if (s.text?.includes('"Pausado"')) pauseStart = s.created_at;
      else if (pauseStart) { pausePeriods.push({ start: pauseStart, end: s.created_at }); pauseStart = null; }
    }
  }

  // Collect activity timestamps (excluding pause periods)
  const timestamps = [createdAt, ...stories.map(s => s.created_at)].sort();
  const activeTimestamps = timestamps.filter(ts => !pausePeriods.some(p => ts >= p.start && ts <= p.end));

  if (activeTimestamps.length === 0) return null;

  // Group into work blocks: gap > 9 business hours = idle
  const blocks = [];
  let blockStart = activeTimestamps[0];
  let blockEnd = activeTimestamps[0];

  for (let i = 1; i < activeTimestamps.length; i++) {
    const gap = calcBusinessHours(blockEnd, activeTimestamps[i]);
    if (gap > 9) {
      blocks.push({ start: blockStart, end: blockEnd });
      blockStart = activeTimestamps[i];
    }
    blockEnd = activeTimestamps[i];
  }
  blocks.push({ start: blockStart, end: blockEnd });

  let totalHours = 0;
  for (const b of blocks) {
    const h = calcBusinessHours(b.start, b.end);
    totalHours += Math.max(h, 0.5);
  }

  return totalHours > 0 ? +totalHours.toFixed(1) : null;
}

let cycleCache = { data: null, timestamp: 0 };
const CYCLE_CACHE_TTL = 15 * 60 * 1000;

export async function fetchCycleTime(tasks) {
  if (cycleCache.data && Date.now() - cycleCache.timestamp < CYCLE_CACHE_TTL) return cycleCache.data;

  const finishedWithSize = tasks.filter(t => {
    const section = t.memberships?.[0]?.section?.name;
    const tags = (t.tags || []).map(tg => tg.name.toLowerCase());
    return section === 'Finalizado' && tags.some(tg => SIZE_TAGS.includes(tg));
  });

  const hoursMap = {};
  const BATCH_SIZE = 10;
  for (let i = 0; i < finishedWithSize.length; i += BATCH_SIZE) {
    const batch = finishedWithSize.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(t => getTaskWorkHours(t.gid, t.created_at).catch(() => null).then(hours => ({ gid: t.gid, hours })))
    );
    for (const { gid, hours } of results) {
      if (hours) hoursMap[gid] = hours;
    }
    if (i + BATCH_SIZE < finishedWithSize.length) await new Promise(r => setTimeout(r, 1000));
  }

  cycleCache = { data: hoursMap, timestamp: Date.now() };
  return hoursMap;
}

export { PROJECT_ID, SINCE, CACHE_TTL, VALID_PROJECTS, SIZE_TAGS };
