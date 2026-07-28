import { callKiro } from './kiro.js';

const SIZE_TAG_GIDS = {
  micro: '1215803917662496',
  p: '1215803917662493',
  m: '1215803917662491',
  g: '1215803917662492',
  gg: '1215803917662495'
};

export function classifySize(taskContent, kiro) {
  const sizePrompt = `Classifique o tamanho desta demanda de QA. Considere:
- micro: ajuste visual, texto, correção simples
- p: funcionalidade pequena, 1-2 telas, sem integração complexa
- m: funcionalidade média, múltiplas telas ou integrações
- g: funcionalidade grande, fluxo completo, múltiplas integrações
- gg: épico, sistema novo, muitas dependências

Demanda:
${taskContent}

Responda APENAS com uma palavra: micro, p, m, g ou gg`;

  try {
    const raw = callKiro(sizePrompt, kiro, { minLength: 1, throwOnFail: true });
    const match = raw.toLowerCase().match(/\b(micro|gg|[pmg])\b/);
    return match ? match[1] : null;
  } catch { return null; }
}

export { SIZE_TAG_GIDS };
