import ts from 'typescript';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const root = new URL('../outputs/progress-tests/', import.meta.url);
await mkdir(root, {recursive:true});
await writeFile(new URL('package.json', root), JSON.stringify({type:'commonjs'}));
for (const file of ['app/model.ts', 'app/progress-model.ts', 'app/domain.ts', 'app/autopay.ts', 'tests/progress.test.ts']) {
  const target = new URL(file.replace(/\.ts$/, '.js'), root);
  await mkdir(new URL('./',target), {recursive:true});
  const source = await readFile(new URL('../'+file, import.meta.url), 'utf8');
  const {outputText} = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
  await writeFile(target,outputText);
}
const {fileURLToPath} = await import('node:url');
const result = spawnSync(process.execPath,['--test',fileURLToPath(new URL('tests/progress.test.js', root))],{stdio:'inherit'});
process.exitCode = result.status ?? 1;
