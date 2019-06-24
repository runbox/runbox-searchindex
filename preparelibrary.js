const { readFileSync, writeFileSync } = require('fs');

const packageJSON = JSON.parse(readFileSync('package.json').toString());

delete packageJSON['scripts'];
delete packageJSON['devDependencies'];

writeFileSync('dist/package.json', JSON.stringify(packageJSON, null, 1));