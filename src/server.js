import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchAllTasks, normalize, analyze, fetchCycleTime, CACHE_TTL, PROJECT_ID, VALID_PROJECTS } from './dashboard/data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const SNAPSHOTS_DIR = path.join(__dirname, '..', 'data', 'snapshots');

function saveSnapshot(stats) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const file = path.join(SNAPSHOTS_DIR, `${today}.json`);
    if (fs.existsSync(file)) return;
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ date: today, ...stats }, null, 2));
    console.log(`   💾 Snapshot salvo: ${today}`);
    checkAnomalies(stats);
  } catch (err) {
    console.error(`   ⚠️ Erro ao salvar snapshot: ${err.message}`);
  }
}

function checkAnomalies(stats) {
  const THRESHOLD = 5;
  const alerts = [];
  for (const [project, cards] of Object.entries(stats.byProject)) {
    const bugs = stats.bugsByProject[project] || 0;
    const density = cards > 0 ? +(bugs / cards).toFixed(1) : 0;
    if (density > THRESHOLD) {
      alerts.push(`⚠️  ${project}: densidade ${density} (>${THRESHOLD})`);
    }
  }
  if (alerts.length) {
    console.log('\n   🚨 ANOMALIAS DETECTADAS:');
    alerts.forEach(a => console.log(`      ${a}`));
    const alertFile = path.join(SNAPSHOTS_DIR, 'alerts.log');
    const entry = `[${new Date().toISOString()}] ${alerts.join(' | ')}\n`;
    fs.appendFileSync(alertFile, entry);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/data') {
    try {
      const raw = await fetchAllTasks();
      const tasks = normalize(raw);
      const stats = analyze(tasks);
      const hoursMap = await fetchCycleTime(raw);
      tasks.forEach(t => { if (hoursMap[t.gid]) t.cycleHours = hoursMap[t.gid]; });
      saveSnapshot(stats);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ tasks, stats, projects: VALID_PROJECTS }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
  } else if (req.url === '/' || req.url === '/index.html') {
    try {
      const html = fs.readFileSync(path.join(__dirname, 'dashboard', 'index.html'), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Erro ao carregar dashboard: ' + err.message);
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n📊 Dashboard QA → http://localhost:${PORT}`);
  console.log(`   Projeto Asana: ${PROJECT_ID} | Cache: ${CACHE_TTL / 1000}s\n`);
});

process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT', () => { server.close(); process.exit(0); });
