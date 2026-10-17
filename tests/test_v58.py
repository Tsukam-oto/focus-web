"""v5.8 browser assertions for iPhone suspension and concurrent edits."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]/'public'
results=[]
def ck(ok,msg):
    assert ok,msg
    results.append(msg)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':390,'height':844})
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    html=(ROOT/'index.html').read_text()
    html=re.sub(r'<script src="\./[^"]+\.js" defer></script>','',html)
    html=html.replace('<link rel="stylesheet" href="./focus-v5.css" />','<style>'+(ROOT/'focus-v5.css').read_text()+'</style>')
    page.set_content(html)
    page.evaluate('''()=>{
      const backing={};Object.defineProperty(window,'localStorage',{configurable:true,value:{backing,getItem(k){return this.backing[k]??null},setItem(k,v){this.backing[k]=v},removeItem(k){delete this.backing[k]}}});
    }''')
    for f in ['install.js','app.js','studio.js','privacy-v5.js','creative.js','creative-archive.js']:
        page.add_script_tag(content=(ROOT/f).read_text())
    page.get_by_role('button',name='制作',exact=True).click()
    page.locator('#createCode').click()
    page.locator('#creativeTitle').fill('iPhone quick background')
    page.locator('#creativeBody').fill('const draft = "important";')
    page.evaluate("window.dispatchEvent(new Event('pagehide'))")
    d=page.evaluate("JSON.parse(localStorage.getItem('focus-creative-workspace-v1'))")
    ck(any(x['body']=='const draft = "important";' for x in d['docs']),'pagehide saves debounce-pending text')
    ck('保存済み' in page.locator('#creativeSaved').inner_text(),'autosave label confirms commit')
    page.locator('#creativeBody').fill('second draft')
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))")
    d=page.evaluate("JSON.parse(localStorage.getItem('focus-creative-workspace-v1'))")
    ck(any(x['body']=='second draft' for x in d['docs']),'visibilitychange saves pending edit')
    # Simulate the saved workspace having been updated by another tab.
    page.evaluate('''()=>{
      const fresh={version:3,docs:[{id:'external',title:'Second tab',body:'Second tab text',kind:'note',lang:'md',project:'',snapshots:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}],selectedId:'external'};
      localStorage.backing['focus-creative-workspace-v1']=JSON.stringify(fresh);
      window.dispatchEvent(new StorageEvent('storage',{key:'focus-creative-workspace-v1',newValue:JSON.stringify(fresh)}));
    }''')
    page.locator('#creativeBody').fill('stale changes')
    page.wait_for_timeout(500)
    d=page.evaluate("JSON.parse(localStorage.getItem('focus-creative-workspace-v1'))")
    ck(d['docs'][0]['id']=='external','concurrent edit is not overwritten')
    ck('別タブ' in page.locator('#creativeSaved').inner_text(),'conflict warns user to export local draft')
    # Failed restore must leave the in-memory edited document open and report failure.
    ck(page.evaluate("window.FocusCreative.restorePackage({docs:[],selectedId:null})") is False,'restore refuses to overwrite newer tab data')
    ck(page.locator('#creativeBody').input_value()=='stale changes','failed restore preserves current editing view')
    ck(not errors,'no unexpected script errors: '+str(errors))
    context.close();browser.close()
print('PASS',len(results))
for x in results:print('-',x)
