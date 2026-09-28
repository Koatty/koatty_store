import { execFileSync } from 'child_process';
import path from 'path';

test('an otherwise idle process can exit after creating an in-memory cache', () => {
  const filename = path.resolve(__dirname, '../../src/store/memory_cache.ts');
  const script = `
    const ts = require('typescript'), fs = require('fs');
    require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'), {
      compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
    }).outputText,file);
    const {MemoryCache} = require(${JSON.stringify(filename)});
    const cache = new MemoryCache({database:0});
    cache.set('key','value'); console.log('CACHE_READY');
  `;
  const output = execFileSync(process.execPath, ['-e',script], {cwd:path.resolve(__dirname,'../..'),encoding:'utf8',timeout:3000});
  expect(output).toContain('CACHE_READY');
});
