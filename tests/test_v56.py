from pathlib import Path
import json, tempfile, re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1] / 'public'
checks=[]
def check(cond,msg):
 assert cond,msg
 checks.append(msg)

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':390,'height':844},accept_downloads=True)
 page=context.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 html=(ROOT/'index.html').read_text()
 html=re.sub(r'<script src="\./[^"]+\.js" defer></script>','',html)
 html=html.replace('<link rel="stylesheet" href="./focus-v5.css" />','<style>'+(ROOT/'focus-v5.css').read_text()+'</style>')
 page.set_content(html)
 page.evaluate(r'''()=>{
 const content=new Map();let initial=false;
 const fake={objectStoreNames:{contains(n){return initial}},createObjectStore(){initial=true;return {}},close(){},transaction(){
  const tx={oncomplete:null,onerror:null,onabort:null,objectStore(){return {
    put(item){let r={};setTimeout(()=>{content.set(item.id,item);r.result=item.id;r.onsuccess?.();setTimeout(()=>tx.oncomplete?.(),1)},0);return r},
    getAll(){let r={};setTimeout(()=>{r.result=[...content.values()];r.onsuccess?.();setTimeout(()=>tx.oncomplete?.(),1)},0);return r},
    delete(id){let r={};setTimeout(()=>{content.delete(id);r.onsuccess?.();setTimeout(()=>tx.oncomplete?.(),1)},0);return r}
  }}};return tx;
 }};
 Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){let r={result:fake};setTimeout(()=>{if(!initial)r.onupgradeneeded?.();r.onsuccess?.()},0);return r}}});
 Object.defineProperty(window,'localStorage',{configurable:true,value:{storage:{},getItem(k){return this.storage[k]??null},setItem(k,v){this.storage[k]=v},removeItem(k){delete this.storage[k]}}});
 }''')
 for n in ['install.js','app.js','studio.js','privacy-v5.js','creative.js','creative-archive.js']:
  page.add_script_tag(content=(ROOT/n).read_text())
 page.get_by_role('button',name='制作',exact=True).click()
 check(page.locator('#creativeArchiveExport').is_visible(),'制作ZIP書き出しボタン')
 page.locator('#createIdea').click()
 page.locator('#creativeTitle').fill('新曲「秋」')
 page.locator('#creativeProject').fill('作曲プロジェクト')
 page.locator('#creativeBody').fill('# 作曲\nフレーズA')
 page.wait_for_timeout(500)
 page.locator('#createCode').click()
 page.locator('#creativeTitle').fill('notes.py')
 page.locator('#creativeProject').fill('アプリ開発')
 page.locator('#creativeBody').fill('print("focus")')
 page.wait_for_timeout(550)
 page.locator('#creativeProjectFilter').select_option('作曲プロジェクト')
 check(page.locator('#creativeDocuments .creative-doc').count()==1,'プロジェクト別の絞り込み')
 check('新曲' in page.locator('#creativeDocuments .creative-doc').inner_text(),'作品ごとのメモ識別')
 page.screenshot(path=str(ROOT.parent/'preview-v56-creative-mobile.png'),full_page=True)
 page.locator('#creativeProjectFilter').select_option('all')
 # Real IndexedDB on HTTPS fake origin. Put a tiny synthetic recording.
 record={"id":"voice-sample-1","title":"旋律の断片","when":"2026-10-17T12:00:00.000Z","project":"作曲プロジェクト"}
 page.evaluate("o=>window.FocusCreative.putAudio({...o,mime:'audio/wav',blob:new Blob([new Uint8Array([82,73,70,70,10,9,8,7])],{type:'audio/wav'})})",record)
 page.evaluate('window.FocusCreative.renderAudios()')
 page.wait_for_timeout(300)
 check(page.locator('.creative-recording').count()==1,'IndexedDB音声を表示')
 with page.expect_download() as dl:
  page.locator('#creativeArchiveExport').click()
 file=dl.value
 check(file.suggested_filename.startswith('FOCUS-CREATIVE-') and file.suggested_filename.endswith('.zip'),'制作ZIPを書き出す')
 tmp=Path(tempfile.mkdtemp())/'saved.zip';file.save_as(tmp)
 check(tmp.stat().st_size>250,'ZIPに音声を含める')
 import zipfile
 with zipfile.ZipFile(tmp) as z:
  check('workspace.json' in z.namelist() and 'recordings.json' in z.namelist(),'ZIPに制作メモと音声台帳')
  check('audio/voice-sample-1.wav' in z.namelist(),'ZIPに録音バイナリ')
  check(z.read('audio/voice-sample-1.wav')==bytes([82,73,70,70,10,9,8,7]),'音声バイト一致')
 page.evaluate("window.FocusCreative.restorePackage({docs:[],selectedId:null})")
 page.evaluate("window.FocusCreative.removeAudio('voice-sample-1')")
 check(len(page.evaluate('window.FocusCreative.exportPackage().docs'))==0,'復元前に制作メモを消去')
 check(len(page.evaluate('window.FocusCreative.getAudios()'))==0,'復元前に録音を消去')
 page.on('dialog',lambda d:d.accept())
 page.locator('#creativeArchiveFile').set_input_files(str(tmp))
 page.wait_for_timeout(650)
 check('復元しました' in page.locator('#audioStatus').inner_text(),'制作ZIPから復元する')
 check(len(page.evaluate('window.FocusCreative.exportPackage().docs'))==2,'復元後も2ドキュメント')
 audio=page.evaluate('window.FocusCreative.getAudios().then(xs=>xs.map(x=>({id:x.id,project:x.project,size:x.blob.size})))')
 check(len(audio)==1 and audio[0]['size']==8 and audio[0]['project']=='作曲プロジェクト','音声バイナリ・プロジェクトを復元')
 check(not errors,'JS例外なし '+str(errors))
 context.close();browser.close()
print('PASS',len(checks))
for c in checks:print('-',c)
