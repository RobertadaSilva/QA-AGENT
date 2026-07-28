import 'dotenv/config';
import fs from 'fs';
import { getTask, getSubtasks, createTask, addTag } from './asana.js';
import { detectKiro, callKiro } from './kiro.js';
import { classifySize, SIZE_TAG_GIDS } from './classify.js';

const taskIds = process.argv.slice(2);
if (!taskIds.length) {
  console.error('❌ Uso: npm run qa -- <taskId> [taskId2] [taskId3]');
  process.exit(1);
}

const QA_PROJECT = process.env.QA_PROJECT_ID || '1207335219525223';
const QA_SECTION = process.env.QA_SECTION_ID || '1207335219525234';
const kiro = detectKiro();

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
      return `${promptDir}/${file}`;
    }
  }
  return null;
}

async function run(taskId) {
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

  const projectPrompt = findProjectPrompt(task);
  const promptFile = projectPrompt || 'kiro/prompts/generate-tests.txt';
  const prompt = fs.readFileSync(promptFile, 'utf-8')
    .replace('{{task}}', taskContent)
    .replace('{{context}}', '');

  console.log('🤖 Gerando cenários e casos de teste...\n');
  let output = callKiro(prompt, kiro);

  const hasRecommendations = /## Recomendações|Fluxos Distintos/i.test(output);
  if (!hasRecommendations && /## Cenários|## Casos/i.test(output)) {
    console.log('⚠️  Output incompleto. Gerando continuação...\n');
    const part2Prompt = fs.readFileSync('kiro/prompts/generate-tests-part2.txt', 'utf-8')
      .replace('{{task}}', taskContent)
      .replace('{{context}}', '')
      .replace('{{part1}}', output.slice(-2000));
    output = output + '\n\n' + callKiro(part2Prompt, kiro);
  }

  console.log('✅ Cenários gerados com sucesso\n');

  try {
    const newTask = await createTask({ projectId: QA_PROJECT, sectionId: QA_SECTION, name: `[QA] ${task.name}`, notes: output });
    console.log(`📌 Card criado no Asana: ${newTask.gid}`);

    console.log('📏 Classificando tamanho da demanda...');
    const sizeField = task.custom_fields?.find(f => f.name === 'Tamanho (em tech)');
    const sizeFromTask = sizeField?.display_value?.toLowerCase() || null;
    const size = (sizeFromTask && SIZE_TAG_GIDS[sizeFromTask]) ? sizeFromTask : classifySize(taskContent, kiro);
    if (size && SIZE_TAG_GIDS[size]) {
      await addTag(newTask.gid, SIZE_TAG_GIDS[size]);
      console.log(`🏷️  Tamanho: ${size.toUpperCase()}${sizeFromTask ? ' (da task)' : ' (IA)'}`);
    } else {
      console.log('⚠️  Não foi possível classificar o tamanho');
    }
  } catch (err) {
    console.log(`⚠️  Erro ao criar card: ${err.message}`);
  }

  console.log('\n🏁 Concluído!');
}

for (const taskId of taskIds) {
  await run(taskId);
}
