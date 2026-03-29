const sdk = require('./src/lib/wvlet/wvlet-sdk.js');
console.log('WvletJS keys:', Object.keys(sdk));
console.log('Has WvletJS:', !!sdk.WvletJS);
if (sdk.WvletJS) {
  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(sdk.WvletJS));
  const publicMethods = methods.filter(k => k.indexOf('$') === -1);
  console.log('WvletJS public methods:', publicMethods);

  // Test toWvlet
  const sql = "SELECT n_name, SUM(l_extendedprice * (1 - l_discount)) AS revenue FROM customer, orders, lineitem, supplier, nation WHERE c_custkey = o_custkey AND o_orderkey = l_orderkey AND l_suppkey = s_suppkey AND s_nationkey = n_nationkey AND n_name = 'JAPAN' GROUP BY n_name ORDER BY revenue DESC";
  const opts = JSON.stringify({ target: 'duckdb' });

  console.log('\n--- Testing toWvlet ---');
  try {
    const result = sdk.WvletJS.toWvlet(sql, opts);
    console.log('toWvlet result:', result);
  } catch (e) {
    console.log('toWvlet error:', e.message);
  }

  console.log('\n--- Testing refactorWvlet ---');
  const complexSql = "SELECT n_name, SUM(l_extendedprice * (1 - l_discount)) AS revenue FROM customer, orders, lineitem, supplier, nation WHERE c_custkey = o_custkey AND o_orderkey = l_orderkey AND l_suppkey = s_suppkey AND s_nationkey = n_nationkey AND n_name = 'JAPAN' AND o_totalprice > 50000 AND l_quantity BETWEEN 1 AND 15 AND l_extendedprice * (1 - l_discount) > (SELECT AVG(l_extendedprice * (1 - l_discount)) FROM customer, orders, lineitem, supplier, nation WHERE c_custkey = o_custkey AND o_orderkey = l_orderkey AND l_suppkey = s_suppkey AND s_nationkey = n_nationkey AND n_name = 'GERMANY' AND o_totalprice > 100000 AND l_quantity BETWEEN 10 AND 25 AND l_extendedprice * (1 - l_discount) > (SELECT AVG(l_extendedprice * (1 - l_discount)) FROM customer, orders, lineitem, supplier, nation WHERE c_custkey = o_custkey AND o_orderkey = l_orderkey AND l_suppkey = s_suppkey AND s_nationkey = n_nationkey AND n_name = 'BRAZIL' AND o_totalprice > 150000 AND l_quantity BETWEEN 20 AND 35)) GROUP BY n_name ORDER BY revenue DESC";
  try {
    const result = sdk.WvletJS.refactorWvlet(complexSql, opts);
    console.log('refactorWvlet result:', result);
  } catch (e) {
    console.log('refactorWvlet error:', e.message);
  }
}
