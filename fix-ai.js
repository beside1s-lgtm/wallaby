const fs = require('fs');

const reportFile = 'src/ai/flows/report-briefing-flow.ts';
let content = fs.readFileSync(reportFile, 'utf8');

// Use simple string replacement
content = content.replace(/prompt: `당신은[\s\S]*?`,/, `prompt: async (input) => \`당신은 학생의 PAPS(학생건강체력평가) 결과를 분석하고 종합적인 피드백을 제공하는 전문 체육 코치입니다.

### 분석 데이터:
- 학생 이름: \${input.studentName}
- PAPS 종합 등급: \${input.overallGrade}
- PAPS 요인별 상세 결과: \${JSON.stringify(input.papsSummary)}

### 작성 가이드라인:
1.  **종합 평가:** '종합 등급'을 바탕으로 학생의 현재 체력 수준을 한 문장으로 평가해주세요. (예: "\${input.studentName} 학생은 현재 \${input.overallGrade} 수준의 균형 잡힌 체력을 가지고 있습니다.")
2.  **강점 및 보완점:** '요인별 상세 결과'에서 점수(score)가 가장 높은 요인 하나를 강점으로, 가장 낮은 요인 하나를 보완점으로 언급하며 한 문장으로 요약해주세요.
3.  **추천 운동:** 보완점을 개선할 수 있는 구체적이고 간단한 운동 1~2가지를 추천하며 한 문장으로 마무리해주세요.
4.  전체 내용은 반드시 **3문장 이내**의 간결하고 긍정적인 문체로 작성해주세요. 학생에게 직접 말하는 것처럼 친근한 어조를 사용하세요.
5.  **중요:** 종합 브리핑과 추천 운동에서 '앉아윗몸앞으로굽히기' 같은 종목명 대신 '유연성', '50m 달리기' 대신 '순발력', '왕복오래달리기' 대신 '심폐지구력', '윗몸 말아올리기' 대신 '근지구력'과 같이 PAPS 측정 가이드라인에 제시된 '체력 요소' 이름으로 설명해주세요.
\`,`);

fs.writeFileSync(reportFile, content, 'utf8');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts')) { 
      results.push(file);
    }
  });
  return results;
}

const tsFiles = walk('./src');
for (const file of tsFiles) {
  let text = fs.readFileSync(file, 'utf8');
  let newText = text.replace(/gemini-2\.0-flash/g, 'gemini-3.0-flash').replace(/gemini-2\.5-flash/g, 'gemini-3.0-flash');
  if (text !== newText) {
    fs.writeFileSync(file, newText, 'utf8');
    console.log('Updated ' + file);
  }
}
