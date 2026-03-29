const { WvletJS } = require('./src/lib/wvlet/wvlet-sdk.js');

const q11 = `SELECT ps_partkey, SUM(ps_supplycost * ps_availqty) AS value
FROM partsupp, supplier, nation
WHERE ps_suppkey = s_suppkey AND s_nationkey = n_nationkey AND n_name = 'GERMANY'
GROUP BY ps_partkey
HAVING SUM(ps_supplycost * ps_availqty) > (
    SELECT SUM(ps_supplycost * ps_availqty) * 0.0001000000
    FROM partsupp, supplier, nation
    WHERE ps_suppkey = s_suppkey AND s_nationkey = n_nationkey AND n_name = 'GERMANY'
)
ORDER BY value DESC`;

const opts = JSON.stringify({ target: 'duckdb' });

console.log('=== toWvlet ===');
const r1 = JSON.parse(WvletJS.toWvlet(q11, opts));
console.log(r1.sql);

console.log('\n=== refactorWvlet ===');
const r2 = JSON.parse(WvletJS.refactorWvlet(q11, opts));
console.log(r2.sql);

console.log('\n=== SAME?', r1.sql === r2.sql, '===');
if (r1.sql !== r2.sql) {
  console.log('\n*** SUCCESS: refactorWvlet produced different output! ***');
}
