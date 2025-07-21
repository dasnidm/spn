const path = require('path');
const fs = require('fs');
const csv = require('csvtojson');

csv()
  .fromFile('../spanish5.csv')
  .then((jsonObj) => {
    const outputPath = path.join(__dirname, 'public', 'words.json');
    fs.writeFileSync(outputPath, JSON.stringify(jsonObj, null, 2), 'utf8');
    console.log('✅ words.json 생성 완료!', outputPath);
  });