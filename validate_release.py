#!/usr/bin/env python3
"""Fail closed if any non-app artifact would be published by GitHub Pages."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re
import sys

PROJECT = Path(__file__).resolve().parent
PUBLIC = PROJECT / 'public'
ALLOWED = {
    '.nojekyll', 'index.html', 'app.js', 'studio.js', 'creative.js', 'creative-archive.js', 'install.js',
    'service-worker.js', 'privacy-v5.js', 'focus-v5.css', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'
}
EXPECTED_ICONS = {
    'icon-192.png':'ffaea9ca80aae2475df8d61b531ecf9bf94e542587a41aff04f6e71944ecc5ce',
    'icon-512.png':'0aecc034fb286c4be5cd1797675ddbd7a25ab71c35db2c65724bf540438fba93',
}
errors=[]
if not PUBLIC.is_dir():
    errors.append('public/ がありません')
else:
    actual={p.relative_to(PUBLIC).as_posix() for p in PUBLIC.rglob('*') if p.is_file()}
    extra=sorted(actual-ALLOWED)
    missing=sorted(ALLOWED-actual)
    if extra: errors.append('公開禁止ファイル: '+', '.join(extra))
    if missing: errors.append('必須ファイル不足: '+', '.join(missing))
    for name, sha in EXPECTED_ICONS.items():
        path=PUBLIC/name
        if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest()!=sha:
            errors.append('アイコンが変更されました（人物写真の混入防止）: '+name)
    if (PUBLIC/'manifest.webmanifest').exists():
        try:
            manifest=json.loads((PUBLIC/'manifest.webmanifest').read_text())
            if manifest.get('start_url')!='./index.html': errors.append('manifest start_url が変わっています')
            if manifest.get('scope')!='./': errors.append('manifest scope が変わっています')
        except (ValueError, OSError) as err:
            errors.append('manifest 解析失敗: '+str(err))
    if (PUBLIC/'index.html').exists():
        html=(PUBLIC/'index.html').read_text()
        for script in ('install.js','app.js','studio.js','privacy-v5.js','creative.js','creative-archive.js'):
            if f'src="./{script}"' not in html: errors.append(script+' の読み込みがありません')
    if (PUBLIC/'service-worker.js').exists():
        sw=(PUBLIC/'service-worker.js').read_text()
        if 'focus-shell-v5-7' not in sw: errors.append('Service Worker のキャッシュバージョンを確認してください')
workflow=PROJECT/'.github/workflows/pages.yml'
if not workflow.exists() or 'path: ./public' not in workflow.read_text():
    errors.append('Pagesデプロイは public/ のみを配信対象にしてください')
for file in PUBLIC.iterdir():
    if file.suffix in ('.js','.html','.css','.webmanifest'):
        text=file.read_text()
        if re.search(r'(?:docs\.google\.com/(?:spreadsheets|presentation)/d/|drive\.google\.com/drive/folders/)[A-Za-z0-9_-]{15,}',text):
            errors.append('コードに個人Google Driveの具体IDが含まれています: '+file.name)
if errors:
    print('FAIL:', '\n- '+'\n- '.join(errors),file=sys.stderr)
    sys.exit(1)
print('PASS: 配信ファイルは指定の13個のみです。人物写真、バックアップ、テスト画像は含まれません。')
