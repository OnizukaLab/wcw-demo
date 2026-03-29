#!/bin/bash
# ──────────────────────────────────────────────────────────────
# generate-transformations.sh
# wvc to_wvlet を使ってカタログクエリの Flatten 結果を生成し、
# transformations.json を更新する。
#
# 使用法:
#   cd wcw-demo && bash scripts/generate-transformations.sh
# ──────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEMO_DIR="$(dirname "$SCRIPT_DIR")"
WVC="$(cd "$DEMO_DIR/.." && pwd)/wvlet/wvc/target/scala-3.7.3/wvc"
CATALOG="$DEMO_DIR/public/data/catalog.json"
OUT="$DEMO_DIR/public/data/transformations.json"

if [ ! -x "$WVC" ]; then
  echo "❌ wvc binary not found at: $WVC"
  echo "   Run 'sbt wvc/nativeLink' in the wvlet directory first."
  exit 1
fi

echo "🔧 Using wvc: $WVC"
echo "📖 Reading catalog: $CATALOG"

# node スクリプトで catalog.json を読み、各クエリの SQL を wvc で変換
node -e "
const fs = require('fs');
const { execSync } = require('child_process');
const os = require('os');
const path = require('path');

const catalog = JSON.parse(fs.readFileSync('$CATALOG', 'utf8'));
const wvc = '$WVC';

const transformations = {};
const tmpFile = path.join(os.tmpdir(), 'wvc_input.sql');

for (const q of catalog.queries) {
  const id = q.id;
  const sql = q.sql.replace(/;\\s*\$/, '').trim();
  
  console.log('  Converting: ' + id + ' ...');
  
  try {
    // SQL を一時ファイルに書き出してから wvc にパイプ
    fs.writeFileSync(tmpFile, sql);
    const flatWvlet = execSync(
      'cat ' + tmpFile + ' | ' + wvc + ' to_wvlet',
      { encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    
    // Flatten ステージ
    const stages = [
      { name: 'Flatten', wvlet: flatWvlet }
    ];
    
    // カタログにDeduplicated版wvletがあり、Flattenと異なればDeDupステージ追加
    if (q.wvlet && q.wvlet.trim() !== flatWvlet) {
      stages.push({ name: 'DeDup', wvlet: q.wvlet.trim() });
    }
    
    // Final は常に最終形（カタログの wvlet、なければ Flatten）
    const finalWvlet = q.wvlet ? q.wvlet.trim() : flatWvlet;
    if (stages.length > 0 && stages[stages.length - 1].wvlet !== finalWvlet) {
      stages.push({ name: 'Final', wvlet: finalWvlet });
    }
    
    transformations[id] = { stages };
    console.log('  ✅ ' + id + ': ' + stages.length + ' stages (wvc)');
  } catch (e) {
    console.error('  ⚠️  ' + id + ': wvc failed, using catalog wvlet as fallback');
    console.error('     ' + (e.stderr || e.message || '').split('\\n')[0]);
    // フォールバック: カタログの wvlet をそのまま使用
    if (q.wvlet) {
      transformations[id] = {
        stages: [
          { name: 'Flatten', wvlet: q.wvlet.trim() },
        ]
      };
    }
  }
}

// 一時ファイル削除
try { fs.unlinkSync(tmpFile); } catch(_) {}

const output = { transformations };
fs.writeFileSync('$OUT', JSON.stringify(output, null, 2));
console.log('\\n✅ Written: $OUT');
console.log('   Queries: ' + Object.keys(transformations).length);
"

echo "🏁 Done."
