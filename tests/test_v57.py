from pathlib import Path
from playwright.sync_api import sync_playwright
import re, json
ROOT=Path(__file__).resolve().parents[1]/'public'
results=[]
def ck(ok,name):
    assert ok,name
    results.append(name)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':390,'height':844},accept_downloads=True)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    html=(ROOT/'index.html').read_text();html=re.sub(r'<script src="\./[^"]+\.js" defer></script>','',html)
    html=html.replace('<link rel="stylesheet" href="./focus-v5.css" />','<style>'+(ROOT/'focus-v5.css').read_text()+'</style>')
    page.set_content(html)
    page.evaluate('''()=>{
       const backing=new Map();let created=false;
       const fake={objectStoreNames:{contains(){return created}},createObjectStore(){created=true;return{}},close(){},transaction(){const tx={oncomplete:null,onerror:null,onabort:null,objectStore(){return{put(item){let r={};setTimeout(()=>{backing.set(item.id,item);r.result=item.id;r.onsuccess?.();setTimeout(()=>tx.oncomplete?.(),1)},0);return r},getAll(){let r={};setTimeout(()=>{r.result=[...backing.values()];r.onsuccess?.();setTimeout(()=>tx.oncomplete?.(),1)},0);return r},delete(id){let r={};setTimeout(()=>{backing.delete(id);r.onsuccess?.();setTimeout(()=>tx.oncomplete?.(),1)},0);return r}}}};return tx;}};
       Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){let r={result:fake};setTimeout(()=>{if(!created)r.onupgradeneeded?.();r.onsuccess?.()},0);return r}}});
       Object.defineProperty(window,'localStorage',{configurable:true,value:{backing:{},getItem(k){return this.backing[k]??null},setItem(k,v){this.backing[k]=v},removeItem(k){delete this.backing[k]}}});
    }''')
    for f in ['install.js','app.js','studio.js','privacy-v5.js','creative.js','creative-archive.js']:
        page.add_script_tag(content=(ROOT/f).read_text())
    page.get_by_role('button',name='制作',exact=True).click()
    ck(page.locator('#creativeQuickStart').is_visible(),'制作タイマー開始ボタンが表示される')
    page.locator('#createCode').click();page.locator('#creativeTitle').fill('作曲ツール.js')
    page.locator('#creativeProject').fill('新曲制作');page.locator('#creativeNextAction').fill('旋律のバリデーションを追加')
    page.locator('#creativeBody').fill('const melody = [60,62,64];');page.wait_for_timeout(400)
    page.locator('#creativeSaveRevision').click()
    ck(page.locator('#creativeRevisionList option').count()==1,'1版保存')
    page.locator('#creativeBody').fill('const melody = [];');page.wait_for_timeout(420)
    page.on('dialog',lambda x:x.accept())
    page.locator('#creativeRestoreRevision').click()
    ck('60,62,64' in page.locator('#creativeBody').input_value(),'指定版の本文に戻る')
    ck(page.locator('#creativeNextAction').input_value()=='旋律のバリデーションを追加','次回の一手を保存')
    ck(page.locator('#creativeRevisionList option').count()==2,'復元前の内容も保存')
    page.locator('#createNote').click();page.locator('#creativeTitle').fill('別プロジェクト');page.locator('#creativeProject').fill('別の制作');page.locator('#creativeBody').fill('テスト');page.wait_for_timeout(450)
    page.locator('#creativeProjectFilter').select_option('新曲制作');page.locator('#creativeResumeWork').click()
    ck(page.locator('#creativeTitle').input_value()=='作曲ツール.js','プロジェクト内で前回ファイル再開')
    page.locator('#creativeQuickStart').click()
    s=page.evaluate('window.FocusRuntime.snapshot()')
    ck(s['category']=='創作' and s['status']=='running' and 1490000<=s['remainingMs']<=1500000,'25分創作タイマー開始')
    page.locator('#creativeQuickStart').click()
    ck('セッション中' in page.locator('#creativeTimerStatus').inner_text(),'2重タイマーを防止')
    ck(page.locator('.private-nav').first.is_hidden(),'通常画面で非公開メニューが隠れる')
    pkg=page.evaluate('window.FocusCreative.exportPackage()')
    d=next(x for x in pkg['docs'] if x['title']=='作曲ツール.js')
    ck(d['nextAction']=='旋律のバリデーションを追加' and len(d['snapshots'])==2,'ZIP書き出し用データに版と次回作業')
    page.evaluate('window.FocusCreative.restorePackage({docs:[],selectedId:null})')
    page.evaluate('(p)=>window.FocusCreative.restorePackage(p)',pkg)
    fresh=page.evaluate('window.FocusCreative.exportPackage()')
    rd=next(x for x in fresh['docs'] if x['title']=='作曲ツール.js')
    ck(rd['nextAction']=='旋律のバリデーションを追加' and len(rd['snapshots'])==2,'制作データの復元で版履歴維持')
    ck(not errors,'ブラウザJavaScriptエラーなし '+str(errors))
    page.locator('#creativeProjectFilter').select_option('新曲制作');page.locator('#creativeResumeWork').click()
    page.screenshot(path=str(ROOT.parent/'preview-v57-creative-mobile.png'),full_page=True)
    context.close();browser.close()
print('PASS',len(results))
for name in results: print('-',name)
