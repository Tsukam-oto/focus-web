from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re
root=Path(__file__).resolve().parents[1]/'public'
html=(root/'index.html').read_text()
html=re.sub(r'<script src="\./(?:install|app|studio|privacy-v5)\.js" defer></script>','',html)
html=html.replace('<link rel="stylesheet" href="./focus-v5.css" />','<style>'+ (root/'focus-v5.css').read_text()+'</style>')
checks=[]
def ok(expr,msg):
 assert expr,msg
 checks.append(msg)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844},accept_downloads=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html)
 page.evaluate('''()=>{Object.defineProperty(window,'localStorage',{configurable:true,value:{storage:{},getItem(k){return this.storage[k]??null},setItem(k,v){this.storage[k]=v},removeItem(k){delete this.storage[k]}}});}''')
 for n in ['install.js','app.js','studio.js','privacy-v5.js']:
  page.add_script_tag(content=(root/n).read_text())
 page.get_by_role('button',name='記録',exact=True).click()
 ok(page.locator('#activityHistory .empty').count()==1,'空の履歴を表示')
 page.locator('#manualDate').fill('2026-10-15T08:45')
 page.locator('#manualMinutes').fill('90')
 page.locator('#manualCategory').select_option(label='創作')
 page.locator('#manualTask').fill('編曲作業')
 page.locator('#addManualSession').click()
 data=json.loads(page.evaluate("localStorage.getItem('focus-reward-v1')"))
 ok(len(data['sessions'])==1 and data['sessions'][0]['source']=='manual','手動記録を保存')
 ok(data['points']==0 and data['sessions'][0]['earned']==0,'手動記録にポイントを付与しない')
 ok('90分' in page.locator('#activityHistory').inner_text(),'手動記録の画面表示')
 page.locator('#activityCategory').select_option(label='仕事')
 ok('この条件の記録はありません' in page.locator('#activityHistory').inner_text(),'ジャンル絞り込み')
 page.locator('#activityCategory').select_option(value='all')
 page.locator('#activityPeriod').select_option(value='day')
 ok('この条件の記録はありません' in page.locator('#activityHistory').inner_text(),'期間絞り込み')
 page.locator('#activityPeriod').select_option(value='all')
 with page.expect_download() as d:
  page.locator('#exportSessionsCsv').click()
 download=d.value
 ok(download.suggested_filename.startswith('focus-history-') and download.suggested_filename.endswith('.csv'),'CSV出力')
 page.locator('#addManualSession').click()
 data=json.loads(page.evaluate("localStorage.getItem('focus-reward-v1')"))
 ok(len(data['sessions'])==1,'重複手動登録を拒否')
 page.on('dialog',lambda d:d.accept())
 page.locator('.delete-manual').click()
 data=json.loads(page.evaluate("localStorage.getItem('focus-reward-v1')"))
 ok(len(data['sessions'])==0 and data['points']==0,'手動記録の削除とポイント保持')
 page.get_by_role('button',name='設定',exact=True).click()
 ok('終了時の通知' in page.locator('#panel-settings').inner_text(),'通知設定を表示')
 ok(not page.locator('[data-tab="reward"]').is_visible(),'通常モードの秘匿を維持')
 ok(not errors,'JavaScript runtime error '+repr(errors))
 page.screenshot(path=str(root.parent/'preview-v53-mobile.png'),full_page=True)
 # screenshot of activity populated; add again
 page.get_by_role('button',name='記録',exact=True).click()
 page.locator('#manualDate').fill('2026-10-15T08:45')
 page.locator('#manualMinutes').fill('90')
 page.locator('#manualCategory').select_option(label='創作')
 page.locator('#manualTask').fill('編曲作業')
 page.locator('#addManualSession').click()
 page.screenshot(path=str(root.parent/'preview-v53-activity.png'),full_page=True)
 b.close()
print('PASS',len(checks),'\n'+ '\n'.join(checks))
