import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL(
    '../app/api/ponto/[recurso]/route.js',
    import.meta.url
  ),
  'utf8'
);

test(
  'rota de ponto não retorna hash de credencial em respostas de equipamento',
  () => {
    /*
     * Confirma que existe uma definição explícita
     * dos campos públicos dos equipamentos.
     */
    const publicFieldsMatch = source.match(
      /equipamentos:\s*['"]([^'"]+)['"]/
    );

    assert.ok(
      publicFieldsMatch,
      'Não foi encontrada a lista de campos públicos de equipamentos.'
    );

    const equipmentPublicFields =
      publicFieldsMatch[1];

    /*
     * O hash da credencial nunca deve fazer
     * parte dos campos públicos retornados.
     */
    assert.doesNotMatch(
      equipmentPublicFields,
      /credencial_integracao_hash/i,
      'O hash da credencial não pode ser exposto nos campos públicos.'
    );

    /*
     * Confirma os principais campos esperados
     * na resposta pública do equipamento.
     */
    assert.match(
      equipmentPublicFields,
      /\bid\b/
    );

    assert.match(
      equipmentPublicFields,
      /\bnome\b/
    );

    assert.match(
      equipmentPublicFields,
      /\bfabricante\b/
    );

    assert.match(
      equipmentPublicFields,
      /\bmodelo\b/
    );

    assert.match(
      equipmentPublicFields,
      /host\(ip\)\s+ip/i
    );

    assert.match(
      equipmentPublicFields,
      /\bporta\b/
    );

    assert.match(
      equipmentPublicFields,
      /\bfirmware\b/
    );

    assert.match(
      equipmentPublicFields,
      /\bsituacao\b/
    );

    /*
     * Verifica especificamente o SELECT usado pelo
     * GET de equipamentos.
     *
     * Dessa forma, mesmo que o arquivo utilize
     * credencial_integracao_hash em INSERT/UPDATE,
     * garantimos que ela não seja enviada pelo GET.
     */
    const equipmentGetMatch = source.match(
      /else if\s*\(\s*recurso\s*===\s*['"]equipamentos['"]\s*\)([\s\S]*?)else if\s*\(\s*recurso\s*===\s*['"]jornadas['"]\s*\)/
    );

    assert.ok(
      equipmentGetMatch,
      'Não foi encontrado o bloco GET de equipamentos.'
    );

    const equipmentGetBlock =
      equipmentGetMatch[1];

    assert.doesNotMatch(
      equipmentGetBlock,
      /credencial_integracao_hash/i,
      'O GET de equipamentos não pode retornar o hash da credencial.'
    );

    
  }
);