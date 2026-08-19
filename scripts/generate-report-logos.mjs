import fs from 'fs';

const tsaPath = 'public/tsa-logo.png';
const satPath = 'public/sat-logo.png';

const tsaBase64 = fs.readFileSync(tsaPath).toString('base64');
const satBase64 = fs.readFileSync(satPath).toString('base64');

const output = `export const TSA_LOGO_BASE64 = "data:image/png;base64,${tsaBase64}";

export const SAT_LOGO_BASE64 = "data:image/png;base64,${satBase64}";
`;

fs.writeFileSync('src/utils/reportLogos.ts', output);
console.log('Successfully generated src/utils/reportLogos.ts');
