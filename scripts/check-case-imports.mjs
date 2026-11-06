// Windows/macOS safety: an extensionless relative import must resolve to the SAME file on a
// case-insensitive filesystem as on Linux. Vite tries extensions in resolve.extensions order
// (.ts before .tsx), so './Foo' can bind to 'foo.ts' on Windows when 'Foo.tsx' was intended.
import fs from 'node:fs';
import path from 'node:path';
const SRC=new URL('../src/',import.meta.url).pathname;
const EXTS=['.mjs','.js','.mts','.ts','.jsx','.tsx','.json'];
const dir=fs.readdirSync(SRC);
let bad=0;
for(const file of dir.filter(f=>/\.(ts|tsx)$/.test(f))){
 const text=fs.readFileSync(path.join(SRC,file),'utf8');
 for(const m of text.matchAll(/from\s+'(\.[^']+)'/g)){
  const spec=m[1];if(path.extname(spec))continue;
  const base=path.basename(spec).toLowerCase();
  const exact=EXTS.find(e=>fs.existsSync(path.join(SRC,spec+e)));
  const windows=EXTS.map(e=>dir.find(f=>f.toLowerCase()===base+e)).find(Boolean);
  if(exact&&windows&&path.basename(spec)+exact!==windows){console.error(`${file}: '${spec}' resolves to ${path.basename(spec)+exact} on Linux but ${windows} on Windows`);bad++}
  if(!exact&&windows){console.error(`${file}: '${spec}' has no exact-case file; Windows would bind ${windows}`);bad++}
 }
}
if(bad){console.error(`${bad} case-unsafe import(s)`);process.exit(1)}
console.log('case-insensitive import resolution check PASS');
