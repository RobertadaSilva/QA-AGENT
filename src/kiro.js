import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync, execSync } from 'child_process';

const MAX_RETRIES = 3;
const TIMEOUT = 180000;

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

export function detectKiro() {
  const isWindows = process.platform === 'win32';

  const envPath = process.env.KIRO_PATH;
  if (envPath) {
    try {
      execFileSync(envPath, ['--version'], { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
      console.log('   ✅ kiro-cli encontrado (KIRO_PATH)');
      return { mode: 'direct', cmd: envPath };
    } catch {}
  }

  if (isWindows) {
    const wslPaths = ['wsl.exe', 'C:\\Windows\\System32\\wsl.exe'];
    for (const wsl of wslPaths) {
      try {
        execSync(`"${wsl}" bash -lc "kiro-cli --version"`, { encoding: 'utf-8', timeout: 15000, stdio: 'pipe' });
        console.log('   ✅ kiro-cli encontrado (via WSL)');
        return { mode: 'wsl', cmd: wsl };
      } catch {}
    }
  }

  try {
    execFileSync('kiro-cli', ['--version'], { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
    console.log('   ✅ kiro-cli encontrado (PATH)');
    return { mode: 'direct', cmd: 'kiro-cli' };
  } catch {}

  if (!isWindows) {
    const wslPaths = ['wsl.exe', 'C:\\Windows\\System32\\wsl.exe'];
    for (const wsl of wslPaths) {
      try {
        execSync(`"${wsl}" bash -lc "kiro-cli --version"`, { encoding: 'utf-8', timeout: 15000, stdio: 'pipe' });
        console.log('   ✅ kiro-cli encontrado (via WSL)');
        return { mode: 'wsl', cmd: wsl };
      } catch {}
    }
  }

  console.error('❌ kiro-cli não encontrado. Defina KIRO_PATH no .env ou instale no PATH.');
  process.exit(1);
}

export function callKiro(prompt, kiro, options = {}) {
  const minLength = options.minLength ?? 50;
  const throwOnFail = options.throwOnFail ?? false;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      let raw;
      if (kiro.mode === 'wsl') {
        const tmpFile = path.join(os.tmpdir(), '.kiro-prompt-tmp.txt');
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
        raw = execFileSync(kiro.cmd, ['chat', '--no-interactive', '--trust-all-tools'], {
          input: prompt, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: TIMEOUT, env: process.env
        });
      }
      const output = cleanOutput(stripAnsi(raw));
      if (!output || output.length < minLength) throw new Error('Resposta vazia ou muito curta');
      return output;
    } catch (err) {
      console.error(`⚠️  Tentativa ${attempt}/${MAX_RETRIES} falhou: ${err.message}`);
      if (attempt === MAX_RETRIES) {
        if (throwOnFail) throw new Error('Falha após todas as tentativas');
        console.error('❌ Falha após todas as tentativas');
        process.exit(1);
      }
    }
  }
}
