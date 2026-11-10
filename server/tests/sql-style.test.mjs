import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSql } from '../../tools/sql-style.mjs';
test('formato T-SQL conserva GO como separador y respeta literales/comentarios', () => {
  const source = "SELECT N'GO'; -- GO no separa aquí\nGO\nIF 1=1 BEGIN SELECT 1 value; END;";
  const formatted = formatSql(source);
  assert.ok(formatted.includes("N'GO'"));
  assert.ok(formatted.includes('\nGO\n'));
  assert.ok(!formatted.includes('GO IF'));
  assert.equal(formatSql(formatted), formatted);
});
