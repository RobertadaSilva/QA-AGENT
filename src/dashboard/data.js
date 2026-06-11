import fetch from 'node-fetch';

const TOKEN = process.env.ASANA_TOKEN;
if (!TOKEN) throw new Error('ASANA_TOKEN não configurado no .env');

const PROJECT_ID = '1207335219525223';
const SINCE = '2026-01-01';
const CACHE_TTL = 5 * 60 * 1000;
const VALID_PROJECTS = ['API', 'APP CAMPO', 'APP SOCIAL', 'GOV', 'IFRAME', 'PORTAL', 'Whatsapp'];

const headers = { Authorization: `Bearer ${TOKEN}` };
let cache = { data: null, timestamp: 0 };

export async function fetchAllTasks() {
  if (cache.data && Date.now() - cache.timestamp < CACHE_TTL) return cache.data;

  let tasks = [];
  let offset = null;

  do {
    const url = `https://app.asana.com/api/1.0/projects/${PROJECT_ID}/tasks?opt_fields=name,created_at,tags.name,custom_fields.name,custom_fields.display_value,custom_fields.number_value,memberships.section.name&limit=100${offset ? '&offset=' + offset : ''}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Asana API ${res.status}: ${res.statusText}. Verifique o ASANA_TOKEN.`);
    const data = await res.json();
    tasks.push(...data.data);
    offset = data.next_page?.offset;
  } while (offset);

  const filtered = tasks.filter(t => new Date(t.created_at) >= new Date(SINCE));
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
    const projects = tags.filter(tg => VALID_PROJECTS.includes(tg));
    return {
      name: t.name,
      section,
      projects,
      bugs: getBugs(t),
      hasBug: tags.includes('Prevenção'),
      noBug: tags.includes('N/BUGS'),
      isFinished: section === 'Finalizado',
      created: t.created_at?.slice(0, 10) || '',
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

export { PROJECT_ID, SINCE, CACHE_TTL, VALID_PROJECTS };
