import 'dotenv/config';
import fs from 'fs';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function generateTests() {
  const diff = fs.readFileSync('diff.txt', 'utf-8');

  let existingTests = [];
  if (fs.existsSync('tests/')) {
    existingTests = fs.readdirSync('tests/').filter(f => f.endsWith('.yaml'));
  }

  const prompt = `
Você é um QA senior. Analise o diff de código abaixo e:
1. Identifique quais fluxos de usuário foram afetados
2. Gere ou atualize arquivos YAML de teste no formato Midscene.js
3. Cada YAML deve testar um fluxo completo em linguagem natural (português)
4. Mantenha testes existentes que não foram afetados
5. Use o formato:

page:
  url: \${BASE_URL}
tasks:
  - name: Nome do fluxo
    flow:
      - ai: ação em linguagem natural
      - aiAssert: validação em linguagem natural

Testes existentes: ${existingTests.join(', ') || 'nenhum'}

Diff do código:
${diff.substring(0, 10000)}

Retorne APENAS os YAMLs, separados por ---FILENAME: nome.yaml---
`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Erro na API do Gemini');
  }

  const output = data.candidates[0].content.parts[0].text;
  const files = output.split('---FILENAME:');

  if (!fs.existsSync('tests/')) {
    fs.mkdirSync('tests/', { recursive: true });
  }

  files.forEach(block => {
    if (!block.trim()) return;
    const [nameLine, ...content] = block.split('\n');
    const filename = nameLine.replace('---', '').trim();
    if (filename) {
      fs.writeFileSync(`tests/${filename}`, content.join('\n'));
      console.log(`✓ Gerado: tests/${filename}`);
    }
  });

  console.log('\nTestes gerados com sucesso.');
}

generateTests().catch(err => {
  console.error('Erro ao gerar testes:', err.message);
  process.exit(1);
});
