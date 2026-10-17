(()=>{'use strict';
const KEY='focus-creative-workspace-v1',DB='focus-creative-audio-v1',STORE='recordings';
const $=id=>document.getElementById(id);
const formats=new Set(['md','txt','js','ts','py','html','css','json','swift']);
const newId=()=>crypto.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
const timestamp=()=>new Date().toISOString();
const safeRevisions=x=>Array.isArray(x)?x.slice(-3).filter(r=>r&&typeof r.body==='string'&&r.body.length<=120000&&typeof r.savedAt==='string').map(r=>({body:r.body,title:String(r.title||'').slice(0,100),nextAction:String(r.nextAction||'').slice(0,240),savedAt:r.savedAt})):[];
let model={version:3,docs:[],selectedId:null},diskOK=true,saveTimer=null,recorder=null,stream=null,chunks=[],audioUrls=[];
try{const data=JSON.parse(localStorage.getItem(KEY)||'null');if(data&&Array.isArray(data.docs))model={version:3,docs:data.docs.filter(x=>typeof x.id==='string'&&typeof x.body==='string').slice(0,500).map(x=>({...x,project:String(x.project||'').slice(0,50),nextAction:String(x.nextAction||'').slice(0,240),snapshots:safeRevisions(x.snapshots)})),selectedId:typeof data.selectedId==='string'?data.selectedId:null}}catch{}
function persist(){const next=JSON.stringify(model);if(next.length>1750000){$('creativeSaved').textContent='保存上限です。書き出してください';return false}try{localStorage.setItem(KEY,next);diskOK=true;$('creativeSaved').textContent='保存済み';return true}catch(e){diskOK=false;$('creativeSaved').textContent='保存に失敗しました。書き出してください';return false}}
function doc(){return model.docs.find(x=>x.id===model.selectedId)}
function fmtTime(s){try{return new Date(s).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return '保存済み'}}
function create(kind){flush();const body=kind==='idea'?'# 今回つくりたいもの\n\n## ひらめき\n\n## 試したこと\n\n## 次にやること\n\n':'';const previousProject=doc()?.project||(($('creativeProjectFilter')?.value!=='all')?$('creativeProjectFilter')?.value:'')||'';const d={id:newId(),project:previousProject,title:kind==='code'?'新しいコード':kind==='idea'?'アイデアメモ':'新しいメモ',kind:kind==='code'?'code':'note',lang:kind==='code'?'js':'md',nextAction:'',snapshots:[],body,createdAt:timestamp(),updatedAt:timestamp()};model.docs.unshift(d);model.selectedId=d.id;persist();render();$('creativeBody').focus()}
function flush(){if(saveTimer){clearTimeout(saveTimer);saveTimer=null}const d=doc();if(!d||$('creativeEditArea').classList.contains('hidden'))return;const title=($('creativeTitle').value||'無題').slice(0,100),project=($('creativeProject').value||'').trim().slice(0,50),lang=formats.has($('creativeLanguage').value)?$('creativeLanguage').value:'txt',body=$('creativeBody').value,nextAction=($('creativeNextAction').value||'').slice(0,240);if(d.title!==title||d.project!==project||d.lang!==lang||d.body!==body||(d.nextAction||'')!==nextAction){Object.assign(d,{title,project,lang,body,nextAction,updatedAt:timestamp()});persist()}}
function changed(){const d=doc();if(!d)return;d.title=($('creativeTitle').value||'無題').slice(0,100);d.project=($('creativeProject').value||'').trim().slice(0,50);d.lang=$('creativeLanguage').value;d.body=$('creativeBody').value;d.nextAction=($('creativeNextAction').value||'').slice(0,240);d.updatedAt=timestamp();$('creativeSaved').textContent='保存中…';$('creativeCount').textContent=d.body.length.toLocaleString()+'文字';if(saveTimer)clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saveTimer=null;persist();drawDocList()},350)}
function refreshProjectFilter(){
 const select=$('creativeProjectFilter');if(!select)return;
 const previous=select.value||'all';const projects=[...new Set(model.docs.map(d=>(d.project||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
 select.replaceChildren();for(const [value,label] of [['all','すべてのプロジェクト'],...projects.map(x=>[x,x])]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option)}
 select.value=[...select.options].some(o=>o.value===previous)?previous:'all';
 const hints=$('creativeProjectSuggestions');if(hints){hints.replaceChildren();for(const name of projects){const opt=document.createElement('option');opt.value=name;hints.append(opt)}}
}
function drawDocList(){refreshProjectFilter();const root=$('creativeDocuments');root.replaceChildren();if(!model.docs.length){const el=document.createElement('p');el.className='hint';el.textContent='まだファイルがありません。';root.append(el)}const query=($('creativeSearch')?.value||'').trim().toLocaleLowerCase(),filter=$('creativeProjectFilter')?.value||'all';for(const d of model.docs.filter(d=>(filter==='all'||(d.project||'')===filter)&&(!query||(d.title+'\n'+d.body+'\n'+(d.project||'')).toLocaleLowerCase().includes(query)))){const b=document.createElement('button');b.type='button';b.className='creative-doc'+(d.id===model.selectedId?' active':'');const strong=document.createElement('strong');strong.textContent=d.title||'無題';const sub=document.createElement('small');sub.textContent=(d.project?d.project+' · ':'')+(d.kind==='code'?'CODE':'NOTE')+' · '+d.lang+' · '+fmtTime(d.updatedAt);b.append(strong,sub);b.onclick=()=>{if(d.id===model.selectedId)return;flush();model.selectedId=d.id;persist();render()};root.append(b)}}
function render(){drawDocList();const d=doc(),yes=Boolean(d);$('creativeEmpty').classList.toggle('hidden',yes);$('creativeEditArea').classList.toggle('hidden',!yes);if(!d){renderAudios().catch(e=>setAudioStatus('録音一覧の読み込みに失敗しました: '+e.message));return}if(document.activeElement!==$('creativeBody'))$('creativeBody').value=d.body;if(document.activeElement!==$('creativeTitle'))$('creativeTitle').value=d.title;if(document.activeElement!==$('creativeNextAction'))$('creativeNextAction').value=d.nextAction||'';$('creativeLanguage').value=formats.has(d.lang)?d.lang:'txt';$('creativeProject').value=d.project||'';$('creativeCount').textContent=d.body.length.toLocaleString()+'文字';$('creativeSaved').textContent=diskOK?'保存済み':'保存に失敗しました';renderRevisions();renderAudios().catch(e=>setAudioStatus('録音一覧の読み込みに失敗しました: '+e.message))}
function renderRevisions(){
 const select=$('creativeRevisionList'),d=doc();if(!select)return;
 const previous=select.value;select.replaceChildren();
 const history=safeRevisions(d?.snapshots);
 if(!history.length){const opt=document.createElement('option');opt.value='';opt.textContent='保存した版はありません';select.append(opt);return}
 history.forEach((r,i)=>{const opt=document.createElement('option');opt.value=String(i);opt.textContent=fmtTime(r.savedAt)+' · '+r.body.length+'文字';select.append(opt)});
 select.value=history.some((_,i)=>String(i)===previous)?previous:String(history.length-1);
}
function rememberRevision(){flush();const d=doc();if(!d)return false;
 if(d.body.length>120000){$('creativeSaved').textContent='版の保存は12万文字までです';return false}
 const before=JSON.stringify(d.snapshots||[]);
 const snap={body:d.body,title:d.title,nextAction:d.nextAction||'',savedAt:timestamp()};
 d.snapshots=safeRevisions([...(d.snapshots||[]),snap]);
 if(!persist()){d.snapshots=JSON.parse(before);return false}
 renderRevisions();return true;
}
function restoreRevision(){flush();const d=doc();if(!d)return;
 const history=safeRevisions(d.snapshots),index=Number($('creativeRevisionList').value);
 if(!history.length||!Number.isInteger(index)||index<0||index>=history.length)return;
 if(!confirm('保存した版に戻しますか？ 現在の内容は復元前に版として保存します。'))return;
 const target=history[index];
 if(!rememberRevision())return;
 Object.assign(d,{body:target.body,title:target.title||d.title,nextAction:target.nextAction||'',updatedAt:timestamp()});
 if(!persist()){$('creativeSaved').textContent='復元した内容を保存できませんでした';return}
 render();$('creativeBody').focus();
}
function resumeWork(){flush();const filter=$('creativeProjectFilter')?.value||'all';const docs=model.docs.filter(d=>filter==='all'||d.project===filter).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
 if(!docs.length){$('creativeSaved').textContent='前回の作業がありません。メモを追加してください';return}
 model.selectedId=docs[0].id;persist();render();$('creativeBody').focus();
}
function quickStartCreative(){flush();const name=(doc()?.project||doc()?.title||'創作').slice(0,80);
 const ok=window.FocusRuntime?.startCreativeSession?.(name);
 if(ok){updateTimer();$('creativeTimerStatus').textContent='創作の集中を開始しました';}
 else{$('creativeTimerStatus').textContent='すでにセッション中です。タイマーでご確認ください';}
}
function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000)}
function cleanName(n){return String(n||'untitled').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,70)||'untitled'}
function exportPackage(){flush();return {version:1,docs:typeof structuredClone==='function'?structuredClone(model.docs):JSON.parse(JSON.stringify(model.docs)),selectedId:model.selectedId}}
function restorePackage(pkg){if(!pkg||!Array.isArray(pkg.docs))return;const docs=[];for(const d of pkg.docs.slice(0,500)){if(!d||typeof d.id!=='string'||typeof d.body!=='string'||d.body.length>1000000)continue;docs.push({id:d.id,title:String(d.title||'無題').slice(0,100),kind:d.kind==='code'?'code':'note',lang:formats.has(d.lang)?d.lang:'txt',project:String(d.project||'').slice(0,50),nextAction:String(d.nextAction||'').slice(0,240),snapshots:safeRevisions(d.snapshots),body:d.body,createdAt:String(d.createdAt||timestamp()),updatedAt:String(d.updatedAt||timestamp())})}model={version:3,docs,selectedId:docs.some(d=>d.id===pkg.selectedId)?pkg.selectedId:(docs[0]?.id||null)};persist();render()}
function setAudioStatus(t){$('audioStatus').textContent=t}
function openDb(){return new Promise((resolve,reject)=>{if(!window.indexedDB){reject(Error('このブラウザでは音声保存に対応していません'));return}const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>{const db=q.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'})};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error||Error('データベースエラー'))})}
async function dbOperate(mode,callback){const db=await openDb();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),req=callback(tx.objectStore(STORE));let answer;req.onsuccess=()=>{answer=req.result};req.onerror=()=>reject(req.error||Error('音声保存エラー'));tx.oncomplete=()=>resolve(answer);tx.onabort=()=>reject(tx.error||Error('保存を完了できませんでした'));tx.onerror=()=>reject(tx.error||Error('保存を完了できませんでした'))})}finally{db.close()}}
const putAudio=o=>dbOperate('readwrite',st=>st.put(o));const getAudios=()=>dbOperate('readonly',st=>st.getAll());const removeAudio=id=>dbOperate('readwrite',st=>st.delete(id));
async function renderAudios(){const root=$('creativeAudios');if(!root)return;audioUrls.forEach(u=>URL.revokeObjectURL(u));audioUrls=[];const currentProject=$('creativeProjectFilter')?.value||'all';const entries=(await getAudios()).filter(a=>currentProject==='all'||(a.project||'')===currentProject).sort((a,b)=>String(b.when).localeCompare(String(a.when)));root.replaceChildren();if(!entries.length){const t=document.createElement('div');t.className='hint';t.textContent='録音はまだありません。';root.append(t);return}for(const o of entries){const el=document.createElement('div');el.className='creative-recording';const box=document.createElement('div');const title=document.createElement('div');title.className='recordname';title.textContent=o.title+(o.project?' · '+o.project:'')+' · '+fmtTime(o.when);const player=document.createElement('audio');player.controls=true;player.preload='none';const url=URL.createObjectURL(o.blob);audioUrls.push(url);player.src=url;box.append(title,player);const actions=document.createElement('div');actions.className='actions';const save=document.createElement('button');save.type='button';save.className='btn secondary';save.textContent='音声を保存';save.onclick=()=>download(o.blob,cleanName(o.title)+'.'+(o.mime?.includes('mp4')?'m4a':o.mime?.includes('mpeg')?'mp3':o.mime?.includes('wav')?'wav':'webm'));const del=document.createElement('button');del.className='btn ghost';del.type='button';del.textContent='削除';del.onclick=async()=>{if(!confirm('この音声を削除しますか？\nバックアップに含まれていない可能性があります。'))return;await removeAudio(o.id);await renderAudios()};actions.append(save,del);el.append(box,actions);root.append(el)}}
async function storeAudio(blob,title){if(!blob||!blob.size)throw Error('空の音声は保存できません');if(blob.size>40*1024*1024)throw Error('音声は40MBまでです。');const entry={id:newId(),title:String(title||'音声メモ').slice(0,120),when:timestamp(),project:doc()?.project||'',mime:blob.type||'audio/webm',blob};await putAudio(entry);await renderAudios();return entry}
async function startAudio(){if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setAudioStatus('このブラウザは録音に対応していません。音声の取り込みをご利用ください。');return}try{stream=await navigator.mediaDevices.getUserMedia({audio:true});const candidates=['audio/mp4','audio/webm;codecs=opus','audio/webm'];const mimeType=candidates.find(x=>MediaRecorder.isTypeSupported(x));recorder=new MediaRecorder(stream,mimeType?{mimeType}:undefined);chunks=[];recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};recorder.onstop=async()=>{try{const blob=new Blob(chunks,{type:recorder.mimeType||mimeType||'audio/webm'});await storeAudio(blob,'音声メモ '+new Date().toLocaleString('ja-JP'));setAudioStatus('録音を保存しました。重要な録音はファイルとして書き出してください。')}catch(e){setAudioStatus('音声を保存できませんでした: '+e.message)}finally{stream?.getTracks().forEach(t=>t.stop());stream=null;recorder=null;chunks=[];$('audioStart').disabled=false;$('audioStop').disabled=true}};recorder.start(1000);$('audioStart').disabled=true;$('audioStop').disabled=false;setAudioStatus('録音中…アプリを閉じると停止することがあります。')}catch(e){stream?.getTracks().forEach(t=>t.stop());stream=null;setAudioStatus('マイクを利用できません: '+e.message)}}
function updateTimer(){
 const s=window.FocusRuntime?.snapshot();if(!s)return;
 const ms=Math.max(0,s.remainingMs||0),sec=Math.ceil(ms/1000);
 $('creativeTimer').textContent=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
 $('creativeTimerStatus').textContent=({'running':'集中中','paused':'一時停止中','finished':'集中完了・達成の確認待ち','break-running':'休憩中','break-finished':'休憩終了','idle':'セッション未開始'})[s.status]||'準備中';
}
$('creativeBackToFocus').onclick=()=>document.querySelector('nav button[data-tab="focus"]')?.click();
setInterval(updateTimer,1000);updateTimer();
$('createNote').onclick=()=>create('note');$('createIdea').onclick=()=>create('idea');$('createCode').onclick=()=>create('code');$('creativeSearch').addEventListener('input',drawDocList);$('creativeProjectFilter').addEventListener('change',()=>{drawDocList();renderAudios().catch(e=>setAudioStatus(e.message))});$('creativeProject').addEventListener('input',changed);$('creativeNextAction').addEventListener('input',changed);$('creativeTitle').addEventListener('input',changed);$('creativeLanguage').addEventListener('change',changed);$('creativeBody').addEventListener('input',changed);
$('creativeBody').addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const t=e.target,start=t.selectionStart,end=t.selectionEnd;t.setRangeText('  ',start,end,'end');changed()}});
$('creativeResumeWork').onclick=resumeWork;$('creativeQuickStart').onclick=quickStartCreative;$('creativeSaveRevision').onclick=rememberRevision;$('creativeRestoreRevision').onclick=restoreRevision;
$('creativeCopy').onclick=async()=>{flush();const d=doc();if(!d)return;try{await navigator.clipboard.writeText(d.body);$('creativeSaved').textContent='コピーしました'}catch{$('creativeSaved').textContent='コピーできませんでした'}};
$('creativeDownload').onclick=()=>{flush();const d=doc();if(d)download(new Blob([d.body],{type:'text/plain;charset=utf-8'}),cleanName(d.title)+'.'+d.lang)};
$('creativeDelete').onclick=()=>{const d=doc();if(!d||!confirm('「'+d.title+'」を削除しますか？'))return;model.docs=model.docs.filter(x=>x.id!==d.id);model.selectedId=model.docs[0]?.id||null;persist();render()};
$('creativeImport').onclick=()=>$('creativeImportFile').click();$('creativeImportFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>1024*1024){alert('テキストファイルは1MBまでです');return}const ext=(f.name.split('.').pop()||'txt').toLowerCase();if(!formats.has(ext)){alert('対応形式ではありません');return}const body=await f.text();flush();const d={id:newId(),title:f.name.slice(0,100),kind:ext==='md'||ext==='txt'?'note':'code',lang:ext,project:doc()?.project||'',nextAction:'',snapshots:[],body,createdAt:timestamp(),updatedAt:timestamp()};model.docs.unshift(d);model.selectedId=d.id;persist();render();e.target.value=''};
$('audioStart').onclick=startAudio;$('audioStop').onclick=()=>{if(recorder?.state==='recording'){recorder.stop();$('audioStop').disabled=true}};$('audioImport').onclick=()=>$('audioImportFile').click();$('audioImportFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{if(!f.type.startsWith('audio/')&&!/\.(m4a|mp3|wav|webm)$/i.test(f.name))throw Error('音声ファイルを選択してください');await storeAudio(f,f.name);setAudioStatus('音声を取り込みました')}catch(err){setAudioStatus(err.message)}finally{e.target.value=''}};
// No microphone capture begins without a user action. No recording or documents are uploaded automatically.
window.addEventListener('pagehide',()=>{flush();persist()});
document.addEventListener('visibilitychange',()=>{if(document.hidden){flush();persist()}});
function safeRestorePackage(pkg){
 if(!pkg||!Array.isArray(pkg.docs)||pkg.docs.length>500||pkg.docs.some(d=>!d||typeof d.id!=='string'||typeof d.body!=='string'||d.body.length>1000000))throw Error('制作データが不正です');
 flush();if(!persist())throw Error('現在の制作データを保存できません。先に書き出してください');
 const previous=model;
 if(previous.docs.length)localStorage.setItem(KEY+'-before-restore',JSON.stringify(previous));
 try{restorePackage(pkg);if(!persist())throw Error('保存容量が不足しています')}catch(e){model=previous;persist();render();throw e}
}
window.FocusCreative={flush,render,exportPackage,restorePackage:safeRestorePackage,getAudios,putAudio,removeAudio,renderAudios,setAudioStatus};render();
})();
