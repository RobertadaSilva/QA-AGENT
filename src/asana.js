import 'dotenv/config';
import fetch from 'node-fetch';

const ASANA_TOKEN = process.env.ASANA_TOKEN;
if (!ASANA_TOKEN) {
  console.error('❌ ASANA_TOKEN não configurado no .env');
  process.exit(1);
}

const headers = { Authorization: `Bearer ${ASANA_TOKEN}` };

export async function getTask(taskId) {
  const res = await fetch(`https://app.asana.com/api/1.0/tasks/${taskId}`, { headers });
  if (!res.ok) throw new Error(`Asana API ${res.status}: ${res.statusText}`);
  const data = await res.json();
  return data.data;
}

export async function getSubtasks(taskId) {
  const res = await fetch(`https://app.asana.com/api/1.0/tasks/${taskId}/subtasks?opt_fields=name,notes,completed`, { headers });
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
  const res = await fetch('https://app.asana.com/api/1.0/tasks', {
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
