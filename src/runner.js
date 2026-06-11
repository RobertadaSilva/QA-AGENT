import 'dotenv/config';
import { getTask, getSubtasks, createTask } from './asana.js';
import fs from 'fs';
import path from 'path';
import { execFileSync, execSync } from 'child_process';

const taskId = process.argv[2];
if (!taskId) {
  console.error('❌ Uso: npm run qa -- <taskId>');
  process.exit(1);
}

const QA_PROJECT = process.env.QA_PROJECT_ID || '1207335219525223';
const QA_SECTION = process.env.QA_SECTION_ID || '1207335219525234';
const MAX_RETRIES = 3;
const TIMEOUT = 100000;

// --- Utilitários ---

function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1B\].*?\x07/g, '');
}

function cleanOutput(str) {
  const lines = str.split('\n').filter(l => {
    const t = l.trimStart();
    if (/^[+-]\s+\d+\s*:/.test(t)) return false;
    if (/^\s+\d+,\s*\d+:/.test(t)) return false;
    if (t.startsWith('Replacing:') || t.startsWith('Appending to:') || t.startsWith('Purpose:')) return false;
    if (t.startsWith('- Completed in')) return false;
    if (t.startsWith('> ') && !t.startsWith('> **')) return false;
    if (t.startsWith('I\'ll ')) return false;
    return true;
  });
  const start = lines.findIndex(l => l.startsWith('#') || l.startsWith('##') || l.startsWith('- ') || l.startsWith('1.'));
  return start >= 0 ? lines.slice(start).join('\n').trim() : lines.join('\n').trim();
}

// --- Detecção do kiro-cli ---

function detectKiro() {
  const envPath = process.env.KIRO_PATH;
  if (envPath) {
    try {
      execFileSync(envPath, ['--version'], { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
      console.log('   ✅ kiro-cli encontrado (KIRO_PATH)');
      return { mode: 'direct', cmd: envPath };
    } catch {}
  }

  try {
    execFileSync('kiro-cli', ['--version'], { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
    console.log('   ✅ kiro-cli encontrado (PATH)');
    return { mode: 'direct', cmd: 'kiro-cli' };
  } catch {}

  const wslPaths = ['wsl.exe', 'C:\\Windows\\System32\\wsl.exe'];
  for (const wsl of wslPaths) {
    try {
      execSync(`"${wsl}" bash -lc "kiro-cli --version"`, { encoding: 'utf-8', timeout: 15000, stdio: 'pipe' });
      console.log('   ✅ kiro-cli encontrado (via wsl.exe)');
      return { mode: 'wsl', cmd: wsl };
    } catch {}
  }

  console.error('❌ kiro-cli não encontrado. Defina KIRO_PATH no .env ou instale no PATH.');
  process.exit(1);
}

// --- Chamada ao Kiro ---

function callKiro(prompt) {
  const kiro = detectKiro();
  return callKiroWithRetry(prompt, kiro);
}

function callKiroWithRetry(prompt, kiro) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      let raw;

      if (kiro.mode === 'wsl') {
        const tmpFile = path.join(process.cwd(), '.kiro-prompt-tmp.txt');
        fs.writeFileSync(tmpFile, prompt);
        const winPath = path.resolve(tmpFile).replace(/\\/g, '/');
        const wslPath = '/mnt/' + winPath[0].toLowerCase() + winPath.slice(2);
        try {
          raw = execSync(`"${kiro.cmd}" bash -lc "kiro-cli chat --no-interactive --trust-all-tools < '${wslPath}'"`, {
            encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: TIMEOUT
          });
        } finally {
          try { fs.unlinkSync(tmpFile); } catch {}
        }
      } else {
        raw = execFileSync(kiro.cmd, ['chat', prompt, '--no-interactive', '--trust-all-tools'], {
          encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: TIMEOUT
        });
      }

      const output = cleanOutput(stripAnsi(raw));
      if (!output || output.length < 50) throw new Error('Resposta vazia ou muito curta');
      return output;
    } catch (err) {
      console.error(`⚠️  Tentativa ${attempt}/${MAX_RETRIES} falhou: ${err.message}`);
      if (attempt === MAX_RETRIES) {
        console.error('❌ Falha após todas as tentativas');
        process.exit(1);
      }
    }
  }
}

// --- Helpers ---

function getOutputDir() {
  const date = new Date().toISOString().split('T')[0];
  const dir = `tests/generated/${date}`;
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function formatSubtasks(subtasks) {
  if (!subtasks.length) return '';
  let block = '\n\nSubtarefas:';
  for (const st of subtasks) {
    block += `\n${st.completed ? '✅' : '⬜'} ${st.name}`;
    if (st.notes) block += `\n   ${st.notes}`;
  }
  return block;
}

function findProjectPrompt(task) {
  const promptDir = 'kiro/prompts/projects';
  if (!fs.existsSync(promptDir)) return null;
  const files = fs.readdirSync(promptDir);
  const name = task.name.toLowerCase();
  for (const file of files) {
    const project = file.replace('.txt', '').replace(/-/g, ' ');
    if (name.includes(project) || name.includes(`[${project}]`)) {
      console.log(`   📋 Usando prompt específico: ${file}`);
      return path.join(promptDir, file);
    }
  }
  return null;
}

// --- Execução ---

async function run() {
  console.log(`\n🔍 Buscando task ${taskId} no Asana...`);
  const task = await getTask(taskId);
  if (!task) {
    console.error('❌ Task não encontrada ou sem acesso');
    process.exit(1);
  }
  console.log(`✅ Task: ${task.name}`);

  const subtasks = await getSubtasks(taskId);
  console.log(subtasks.length ? `📋 ${subtasks.length} subtarefa(s)\n` : '📋 Sem subtarefas\n');

  const taskContent = `${task.name}\n${task.notes}${formatSubtasks(subtasks)}`;

  // Tentar prompt específico do projeto (baseado no nome da task)
  const projectPrompt = findProjectPrompt(task);
  const promptFile = projectPrompt || 'kiro/prompts/generate-tests.txt';
  const prompt = fs.readFileSync(promptFile, 'utf-8')
    .replace('{{task}}', taskContent)
    .replace('{{context}}', '');

  console.log('🤖 Gerando cenários e casos de teste...\n');
  let output = callKiro(prompt);

  const hasRecommendations = /## Recomendações|Fluxos Distintos/i.test(output);
  if (!hasRecommendations && /## Cenários|## Casos/i.test(output)) {
    console.log('⚠️  Output incompleto. Gerando continuação...\n');
    const part2Prompt = fs.readFileSync('kiro/prompts/generate-tests-part2.txt', 'utf-8')
      .replace('{{task}}', taskContent)
      .replace('{{context}}', '')
      .replace('{{part1}}', output.slice(-2000));
    output = output + '\n\n' + callKiro(part2Prompt);
  }

  const dir = getOutputDir();
  const filePath = `${dir}/task-${taskId}.md`;
  fs.writeFileSync(filePath, `# ${task.name}\n\n${output}`);
  console.log(output);
  console.log(`\n💾 Salvo em ${filePath}`);

  try {
    const newTask = await createTask({ projectId: QA_PROJECT, sectionId: QA_SECTION, name: `[QA] ${task.name}`, notes: output });
    console.log(`📌 Card criado no Asana: ${newTask.gid}`);
  } catch (err) {
    console.log(`⚠️  Erro ao criar card: ${err.message}`);
  }

  console.log('\n🏁 Concluído!');
}

run();
