(()=>{'use strict';
const $=id=>document.getElementById(id);
const BACKUP_KEY='focus-face-lastbackup-v1';
let installPrompt=null;
const isInstalled=()=>window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
const isSecureSite=()=>location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname);
function updateBanner(){const banner=$('installBanner');if(!banner)return;
 const installed=isInstalled();banner.hidden=installed;
 $('installState').textContent=installed?'ホーム画面から起動しています。':(isSecureSite()?'ホーム画面に追加可能です。iPhoneではSafariの共有メニューを使用します。':'ローカルファイルやHTTPではPWAの一部機能が利用できません。HTTPS公開後に追加してください。');
 $('installBannerText').textContent=installPrompt?'アプリとして追加できます。':'ホーム画面に追加するとアプリのように使えます。';
 $('installBannerButton').textContent=installPrompt?'インストール':'追加方法を見る';
 $('installApp').classList.toggle('hidden',!installPrompt||installed);
}
function updateBackup(){const node=$('backupStatus');if(!node)return;let stamp;
 try{stamp=localStorage.getItem(BACKUP_KEY)}catch{}
 if(!stamp){node.textContent='バックアップは未作成です。利用者データとポイントを守るため、初回登録後に一度保存してください。';return}
 const date=new Date(stamp),days=Math.floor((Date.now()-date.getTime())/86400000);
 node.textContent=!Number.isFinite(date.getTime())?'バックアップ日付を確認できません。再度バックアップしてください。':(days>=7?'最後のバックアップから'+days+'日経過しました。もう一度保存してください。':'前回のバックアップ操作：'+date.toLocaleString('ja-JP')+'。ダウンロード先にファイルがあるか確認してください。');
}
async function showStorage(){let msg='保存データはブラウザごとに独立し、別端末へ自動同期されません。';
 try{if(navigator.storage?.estimate){const e=await navigator.storage.estimate();if(e.usage&&e.quota)msg+=' 推定使用量：'+(e.usage/1024/1024).toFixed(1)+'MB。'}
 if(navigator.storage?.persisted){const persisted=await navigator.storage.persisted();msg+=' '+(persisted?'ブラウザは永続保存を許可しています。':'永続保存は未保証です。必ずバックアップしてください。')}}catch{}
 $('storageState').textContent=msg;
}
$('installBannerButton')?.addEventListener('click',()=>{if(installPrompt){$('installApp').click();return}document.querySelector('nav button[data-tab="settings"]')?.click();$('installCard').scrollIntoView({block:'start',behavior:'smooth'})});
$('installApp')?.addEventListener('click',async()=>{if(!installPrompt)return;const event=installPrompt;installPrompt=null;try{await event.prompt();await event.userChoice}catch{}updateBanner()});
$('storagePersist')?.addEventListener('click',async()=>{try{if(!navigator.storage?.persist){$('storageState').textContent='このブラウザでは保存領域の保護要求に対応していません。バックアップで保護してください。';return}const ok=await navigator.storage.persist();$('storageState').textContent=ok?'永続保存が許可されました。念のためバックアップも続けてください。':'永続保存の許可は得られませんでした。バックアップで保護してください。';}catch{await showStorage()}});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;updateBanner()});
window.addEventListener('appinstalled',()=>{installPrompt=null;updateBanner()});
window.addEventListener('online',updateOnline);window.addEventListener('offline',updateOnline);
function updateOnline(){const b=$('dayBadge');if(!b)return;b.classList.toggle('status-offline',!navigator.onLine);b.title=navigator.onLine?'オンライン':'オフライン：保存済みの画面を利用できます';}
window.FocusInstall={updateBackup,showStorage};updateBanner();updateBackup();showStorage();updateOnline();
})();
