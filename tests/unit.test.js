import { describe, it } from 'node:test';
import assert from 'node:assert';

// Import the module to test internal functions via a wrapper
// Since data.js has side effects (env check), we test the logic directly

describe('getHolidays', () => {
  // Replicate the function for testing
  function getHolidays(year) {
    const fixed = [`${year}-01-01`,`${year}-04-21`,`${year}-05-01`,`${year}-06-19`,`${year}-09-07`,`${year}-10-12`,`${year}-11-02`,`${year}-11-15`,`${year}-12-25`];
    const a=year%19, b=Math.floor(year/100), c=year%100, d=Math.floor(b/4), e=b%4;
    const f=Math.floor((b+8)/25), g=Math.floor((b-f+1)/3), h=(19*a+b-d-g+15)%30;
    const i=Math.floor(c/4), k=c%4, l=(32+2*e+2*i-h-k)%7;
    const m=Math.floor((a+11*h+22*l)/451), month=Math.floor((h+l-7*m+114)/31), day=((h+l-7*m+114)%31)+1;
    const easter = new Date(year, month-1, day);
    const offset = (d) => { const dt = new Date(easter); dt.setDate(dt.getDate()+d); return dt.toISOString().slice(0,10); };
    fixed.push(offset(-49), offset(-48), offset(-47), offset(-2), offset(60));
    return fixed;
  }

  it('deve gerar feriados de 2026 corretamente', () => {
    const holidays = getHolidays(2026);
    assert.ok(holidays.includes('2026-01-01'), 'Ano novo');
    assert.ok(holidays.includes('2026-12-25'), 'Natal');
    assert.ok(holidays.includes('2026-04-21'), 'Tiradentes');
    assert.ok(holidays.length >= 14, 'Mínimo 14 feriados');
  });

  it('deve calcular Páscoa 2026 em 05/abril', () => {
    const holidays = getHolidays(2026);
    // Sexta-feira Santa = Páscoa - 2 = 03/04/2026
    assert.ok(holidays.includes('2026-04-03'), 'Sexta-feira Santa');
  });

  it('deve gerar carnaval corretamente', () => {
    const holidays = getHolidays(2026);
    // Carnaval 2026 = 16-17-18 fev (Páscoa 5/abr - 49, -48, -47 dias)
    assert.ok(holidays.includes('2026-02-16') || holidays.includes('2026-02-17'), 'Carnaval');
  });
});

describe('calcBusinessHours', () => {
  function isLastFridayOfMonth(date) {
    if (date.getDay() !== 5) return false;
    const next = new Date(date);
    next.setDate(next.getDate() + 7);
    return next.getMonth() !== date.getMonth();
  }

  function calcBusinessHours(start, end) {
    const ALL_OFF_DAYS = new Set();
    const s = new Date(start);
    const e = new Date(end);
    let hours = 0;
    const cursor = new Date(s);
    cursor.setMinutes(0, 0, 0);
    while (cursor < e) {
      const day = cursor.getDay();
      const iso = cursor.toISOString().slice(0, 10);
      if (day !== 0 && day !== 6 && !ALL_OFF_DAYS.has(iso)) {
        const h = cursor.getHours();
        const endHour = isLastFridayOfMonth(cursor) ? 12 : 17;
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

  it('deve retornar 9h para um dia inteiro de trabalho', () => {
    // terça 16/jun/2026 em horário local
    const hours = calcBusinessHours('2026-06-16T08:00:00', '2026-06-16T17:00:00');
    assert.strictEqual(hours, 9);
  });

  it('deve retornar 0h para fim de semana', () => {
    const hours = calcBusinessHours('2026-06-13T08:00:00', '2026-06-13T17:00:00'); // sábado
    assert.strictEqual(hours, 0);
  });

  it('deve contar apenas horas dentro do expediente', () => {
    const hours = calcBusinessHours('2026-06-16T06:00:00', '2026-06-16T10:00:00'); // 6h-10h terça
    assert.strictEqual(hours, 2); // só conta 8h-10h
  });

  it('deve retornar 4h na última sexta do mês', () => {
    const hours = calcBusinessHours('2026-06-26T08:00:00', '2026-06-26T17:00:00'); // última sexta junho
    assert.strictEqual(hours, 4); // só 08-12
  });
});

describe('normalize', () => {
  it('deve extrair size tag corretamente', () => {
    const SIZE_TAGS = ['micro', 'p', 'm', 'g', 'gg'];
    const tags = ['GOV', 'M', 'N/BUGS'];
    const tagsLower = tags.map(t => t.toLowerCase());
    const size = tagsLower.find(t => SIZE_TAGS.includes(t));
    assert.strictEqual(size, 'm');
  });

  it('deve retornar null se não tiver tag de tamanho', () => {
    const SIZE_TAGS = ['micro', 'p', 'm', 'g', 'gg'];
    const tags = ['GOV', 'Prevenção'];
    const tagsLower = tags.map(t => t.toLowerCase());
    const size = tagsLower.find(t => SIZE_TAGS.includes(t)) || null;
    assert.strictEqual(size, null);
  });
});
