const fs = require('fs');

const lines = fs.readFileSync('spanish2.csv', 'utf8').split('\n');
const header = lines[0].trim();
const fixed = [header];

for (let i = 1; i < lines.length; i++) {
  let line = lines[i].trim();
  if (!line) continue;

  // 1. 우선 ,로 분리
  let fields = [];
  let cur = '';
  let inQuotes = false;
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ',' && !inQuotes) {
      fields.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  fields.push(cur);

  // 2. 컬럼 개수 보정
  if (fields.length === 7) {
    // 한글 뜻이 따옴표 없이 두 컬럼으로 쪼개진 경우
    // 0:rank, 1:spanish, 2:pos, 3:en, 4:ko1, 5:ko2, 6:category
    const korean = `"${fields[4].trim()}, ${fields[5].trim()}"`;
    fields = [fields[0], fields[1], fields[2], fields[3], korean, fields[6]];
  } else if (fields.length > 7) {
    // 한글 뜻에 쉼표가 더 많은 경우
    const korean = `"${fields.slice(4, fields.length - 1).map(f => f.trim()).join(', ')}"`;
    fields = [fields[0], fields[1], fields[2], fields[3], korean, fields[fields.length - 1]];
  } else if (fields.length < 6) {
    // 부족한 경우 빈 값 추가
    while (fields.length < 6) fields.push('');
  }

  // 3. 쉼표 포함 필드는 자동으로 "..."로 감싸기 (이미 감싸진 경우는 그대로)
  fields = fields.map((f, idx) => {
    f = f.trim();
    if (f.startsWith('"') && f.endsWith('"')) return f;
    if (f.includes(',') && idx !== 0) return `"${f.replace(/"/g, '""')}"`;
    return f;
  });

  fixed.push(fields.join(','));
}

fs.writeFileSync('spanish2_fixed.csv', fixed.join('\n'), 'utf8');
console.log('✅ spanish2_fixed.csv 파일이 생성되었습니다!');