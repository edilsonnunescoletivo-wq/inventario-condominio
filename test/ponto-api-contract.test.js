import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('rota de ponto não retorna hash de credencial em respostas de equipamento', () => {
  const source = fs.readFileSync(new URL('../app/api/ponto/[recurso]/route.js', import.meta.url), 'utf8');
  assert.match(source, /RETURNING id,nome,fabricante,modelo,host\(ip\) ip,porta,firmware,situacao/);
  assert.match(source, /RETURNING \$\{publicFields\[recurso\] \|\| 'id'\}/);
  assert.doesNotMatch(source, /equipamentos:\s*'[^']*credencial_integracao_hash/);
});