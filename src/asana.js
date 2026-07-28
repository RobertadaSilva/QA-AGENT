import 'dotenv/config';
import fetch from 'node-fetch';

const ASANA_TOKEN = process.env.ASANA_TOKEN;
if (!ASANA_TOKEN) {
  console.error('❌ ASANA_TOKEN não configurado no .env');
  process.exit(1);
}

const headers = { Authorization: `Bearer ${ASANA_TOKEN}` };
const TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options);
      return res;
    } catch (err) {
      const isLast = attempt === retries;
      const isTimeout = err.name === 'AbortError';
      const msg = isTimeout ? 'timeout (15s)' : err.message;
      if (isLast) throw new Error(`Falha após ${retries} tentativas (último erro: ${msg})`);
      console.log(`   ⚠️  Tentativa ${attempt}/${retries} falhou (${msg}). Retentando em ${attempt * 2}s...`);
      await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
}

export async function getTask(taskId) {
  const res = await fetchWithRetry(`https://app.asana.com/api/1.0/tasks/${taskId}?opt_fields=name,notes,custom_fields.name,custom_fields.display_value`, { headers });
  if (!res.ok) throw new Error(`Asana API ${res.status}: ${res.statusText}`);
  const data = await res.json();
  return data.data;
}

export async function getSubtasks(taskId) {
  const res = await fetchWithRetry(`https://app.asana.com/api/1.0/tasks/${taskId}/subtasks?opt_fields=name,notes,completed`, { headers });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

function mdToAsanaHtml(md) {
  const lines = md.split('\n');
  let html = '';
  let listType = null;
  let tableHeaders = null;

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function closeList() { if (listType) { html += `</${listType}>`; listType = null; } }
  function fmt(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); }

  for (const line of lines) {
    const t = line.trim();
    if (/^\|.*\|$/.test(t)) {
      if (/^\|[\s-:|]+\|$/.test(t)) continue;
      const cells = t.split('|').filter(c => c.trim()).map(c => c.trim());
      if (!tableHeaders) {
        tableHeaders = cells;
        closeList();
        html += fmt(cells.join(' | ')) + '\n';
        continue;
      }
      if (listType !== 'ul') { closeList(); html += '<ul>'; listType = 'ul'; }
      html += `<li>${fmt(cells.join(' | '))}</li>`;
    } else {
      tableHeaders = null;
      if (/^#{1,4} /.test(t)) {
        closeList();
        const level = Math.min(t.match(/^#+/)[0].length, 2);
        const text = t.replace(/^#+\s*/, '');
        html += `<h${level}>${fmt(text)}</h${level}>`;
      } else if (/^[-*] /.test(t)) {
        if (listType !== 'ul') { closeList(); html += '<ul>'; listType = 'ul'; }
        html += `<li>${fmt(t.slice(2))}</li>`;
      } else if (/^\d+\. /.test(t)) {
        if (listType !== 'ol') { closeList(); html += '<ol>'; listType = 'ol'; }
        html += `<li>${fmt(t.replace(/^\d+\. /, ''))}</li>`;
      } else if (/^[━─-]{3,}$/.test(t)) {
        closeList(); html += '<hr/>';
      } else if (t === '') {
        closeList(); html += '\n';
      } else {
        closeList(); html += fmt(t) + '\n';
      }
    }
  }
  closeList();
  return `<body>${html}</body>`;
}

export async function createTask({ projectId, sectionId, name, notes }) {
  let htmlNotes = mdToAsanaHtml(notes);
  const MAX = 60000;
  if (Buffer.byteLength(htmlNotes) > MAX) {
    const truncated = notes.slice(0, Math.floor(MAX * 0.7));
    const lastSection = truncated.lastIndexOf('\n## ');
    const cut = lastSection > 0 ? truncated.slice(0, lastSection) : truncated;
    htmlNotes = mdToAsanaHtml(cut + '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n⚠️ Documento truncado por limite do Asana.');
  }
  const res = await fetchWithRetry('https://app.asana.com/api/1.0/tasks', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: { name, html_notes: htmlNotes, projects: [projectId], memberships: [{ project: projectId, section: sectionId }] }
    })
  });
  const data = await res.json();
  if (data.errors) throw new Error(data.errors.map(e => e.message).join('; '));
  return data.data;
}

// export async function commentOnTask(taskId, message) {
//   const res = await fetch(`https://app.asana.com/api/1.0/tasks/${taskId}/stories`, {
//     method: 'POST',
//     headers: { ...headers, 'Content-Type': 'application/json' },
//     body: JSON.stringify({ data: { text: message } })
//   });
//   return res.json();
// }

export async function addTag(taskGid, tagGid) {
  const res = await fetchWithRetry(`https://app.asana.com/api/1.0/tasks/${taskGid}/addTag`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { tag: tagGid } })
  });
  if (!res.ok) throw new Error(`Erro ao adicionar tag: ${res.status}`);
}