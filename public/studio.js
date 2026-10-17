(()=>{'use strict';
/* Face-reference library: original photos remain local. ChatGPT handoff is manual. */
const META_KEY='focus-face-studio-v1',FOCUS_KEY='focus-reward-v1',DB_NAME='focus-face-originals-v1',STORE='originals',MAX_SIZE=15*1024*1024;
const $=id=>document.getElementById(id);
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const defaults=()=>({version:1,faces:[],selectedA:'',selectedB:'',reviews:{}});
function load(){try{let d=JSON.parse(localStorage.getItem(META_KEY));if(!d||!Array.isArray(d.faces))return defaults();return {...defaults(),...d,faces:d.faces.filter(x=>x&&typeof x.id==='string').slice(0,40),reviews:d.reviews&&typeof d.reviews==='object'?d.reviews:{}}}catch{return defaults()}}
let data=load(),libraryUrls=[],pendingUrls=[],renderEpoch=0,busy=false;
function save(){localStorage.setItem(META_KEY,JSON.stringify(data))}
function toast(text){const el=$('toast');el.textContent=text;el.classList.remove('hidden');setTimeout(()=>el.classList.add('hidden'),3200)}
function uid(){return (typeof crypto!=='undefined'&&crypto.randomUUID)?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2)}
function openDB(){return new Promise((resolve,reject)=>{if(typeof indexedDB==='undefined')return reject(Error('このブラウザは写真保存に対応していません'));const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||Error('写真の保存領域を開けません'))})}
async function dbOp(kind,key,blob){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,kind==='get'?'readonly':'readwrite');const object=tx.objectStore(STORE);const request=kind==='get'?object.get(key):kind==='delete'?object.delete(key):object.put(blob,key);let value;request.onsuccess=()=>value=request.result;tx.oncomplete=()=>{db.close();resolve(value)};tx.onerror=()=>{db.close();reject(tx.error||Error('保存に失敗しました'))}})}
function assertImage(file){if(!file||!file.type.startsWith('image/'))throw Error('元写真の画像ファイルを選んでください');if(file.size>MAX_SIZE)throw Error('画像は1枚15MB以内にしてください');if(file.size<1)throw Error('空の画像は登録できません')}
async function addFace(){if(busy)return;const name=$('faceName').value.trim(),memo=$('faceMemo').value.trim(),primary=$('facePrimary').files[0],secondary=$('faceSecondary').files[0];
 try{if(!name)throw Error('人物名を入力してください');if(!primary)throw Error('最優先の元写真を登録してください');assertImage(primary);if(secondary)assertImage(secondary);if(data.faces.length>=40)throw Error('登録できる人物は40件までです');
 busy=true;$('addFace').disabled=true;
 const id=uid();await dbOp('put',id+':primary',primary);
 try{if(secondary)await dbOp('put',id+':secondary',secondary)}catch(e){await dbOp('delete',id+':primary');throw e}
 data.faces.push({id,name:name.slice(0,60),memo:memo.slice(0,300),primaryName:primary.name,secondaryName:secondary?.name||'',createdAt:Date.now()});
 if(!data.selectedA)data.selectedA=id;else if(!data.selectedB&&data.selectedA!==id)data.selectedB=id;
 try{save()}catch(e){data.faces.pop();await dbOp('delete',id+':primary');if(secondary)await dbOp('delete',id+':secondary');throw Error('保存領域が不足しています')}
 $('faceName').value='';$('faceMemo').value='';$('facePrimary').value='';$('faceSecondary').value='';await render();toast('元写真を登録しました');
 }catch(e){toast(e.message||'保存に失敗しました')}finally{busy=false;$('addFace').disabled=false}}
function revoke(urls){urls.forEach(u=>URL.revokeObjectURL(u));urls.length=0}
async function renderFaceList(){const root=$('faceList');revoke(libraryUrls);const epoch=++renderEpoch;
 if(!data.faces.length){root.innerHTML='<div class="empty" style="grid-column:1/-1">未登録です。左のフォームから元写真を登録してください。</div>';return}
 root.innerHTML=data.faces.map(f=>`<div class="face-card" data-id="${esc(f.id)}"><div class="face-photo" data-preview="${esc(f.id)}">元写真</div><div class="face-info"><strong>${esc(f.name)}</strong><p>${esc(f.memo||'特徴メモなし')}</p><div class="face-tools"><button type="button" data-action="share" data-id="${esc(f.id)}">元写真を共有</button><button type="button" data-action="download" data-id="${esc(f.id)}">保存</button><button type="button" data-action="edit" data-id="${esc(f.id)}">編集</button><button type="button" data-action="delete" data-id="${esc(f.id)}">削除</button></div></div></div>`).join('');
 for(const f of data.faces){try{const b=await dbOp('get',f.id+':primary');if(epoch!==renderEpoch)return;const area=root.querySelector(`[data-preview="${CSS.escape(f.id)}"]`);if(!area)continue;if(b){const u=URL.createObjectURL(b);libraryUrls.push(u);const img=document.createElement('img');img.src=u;img.alt=f.name+'の元写真';img.onerror=()=>{img.replaceWith(document.createTextNode('プレビュー非対応（保存は可能）'))};area.replaceChildren(img)}else{area.textContent='保存写真なし'}}catch{}}
 }
function renderSelects(){for(const [id,key,placeholder] of [['studioFaceA','selectedA','人物を選んでください'],['studioFaceB','selectedB','2人画像の場合に選択']]){const select=$(id);const prior=data[key];select.innerHTML='<option value="">'+placeholder+'</option>'+data.faces.map(f=>`<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');select.value=data.faces.some(f=>f.id===prior)?prior:'';data[key]=select.value}}
function readReward(){try{const x=JSON.parse(localStorage.getItem(FOCUS_KEY));return x&&Array.isArray(x.gallery)?x:{gallery:[],points:0}}catch{return{gallery:[],points:0}}}
function renderHistory(){const state=readReward(),root=$('studioHistory');if(!state.gallery.length){root.className='empty';root.textContent='まだ生成記録がありません。ご褒美画像を受け取った後に評価できます。';return}
 root.className='';root.innerHTML=state.gallery.slice(0,25).map(g=>{const r=data.reviews[g.id]||{};const people=Array.isArray(g.faceProfiles)?g.faceProfiles.map(x=>x.name).join('＋'):'人物未設定';return `<div class="history-item" data-review="${esc(g.id)}"><b>${esc(people)} / ${esc(g.theme)}</b><p>${esc(new Date(g.when).toLocaleString('ja-JP'))}　${g.hasImage?'画像登録済':'画像未登録'}</p><label class="mini">顔の一致度</label><select data-role="rating"><option value="">未評価</option><option value="good" ${r.rating==='good'?'selected':''}>似ている</option><option value="average" ${r.rating==='average'?'selected':''}>まあまあ</option><option value="bad" ${r.rating==='bad'?'selected':''}>別人化した</option></select><label class="mini">次回の改善メモ</label><textarea data-role="memo" maxlength="300" rows="2" placeholder="例：顔をもっとアップにする">${esc(r.memo||'')}</textarea></div>`}).join('')}
async function render(){renderSelects();renderHistory();await renderFaceList()}
function getSelectedFaces(people){const a=data.faces.find(f=>f.id===data.selectedA),b=data.faces.find(f=>f.id===data.selectedB);
 if(!a)throw Error('顔を登録し、左／1人目を選択してください');if(people==='two'&&!b)throw Error('2人画像では右／2人目も選択してください');if(people==='two'&&a.id===b.id)throw Error('2人画像では別々の人物を選択してください');return (people==='two'?[a,b]:[a]).map((f,i)=>({id:f.id,name:f.name,memo:f.memo,primaryName:f.primaryName,secondaryName:f.secondaryName,position:people==='two'?(i===0?'左':'右'):'1人'}))}
function faceInstructions(p){if(!Array.isArray(p.faceProfiles)||!p.faceProfiles.length)return '元写真を添付してください。';let lines=[];
 lines.push('【顔の固定：最優先条件】');lines.push('以下の人物の元写真をこの会話に実際に添付したうえで生成してください。元写真は外部サイト側に保存されており、この指示文だけではChatGPTから参照できません。写真が添付されていなければ、まず添付を求めてください。');
 p.faceProfiles.forEach((f,i)=>{const role=f.position==='1人'?'人物':f.position+'の人物';lines.push(`${i+1}. ${role}「${f.name}」: 最優先の元写真「${f.primaryName}」${f.secondaryName?'、補助写真「'+f.secondaryName+'」':''}。${f.memo?'維持事項：'+f.memo+'。':''}`)});
 lines.push('顔の輪郭、目元、鼻、口、前髪と髪の生え際を元写真にできる限り合わせ、服装・背景・ポーズだけを変えてください。AI生成結果を顔の参照画像として再利用しないでください。');
 if(p.faceProfiles.length===2)lines.push('必ず左右の人物を指定通りに対応させ、顔の混合・入れ替わりを避けてください。');
 lines.push('実在の人物の同一性を完全保証するものではなく、自然な写真表現を優先してください。');return lines.join('\n')}
function makeDownload(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.rel='noopener';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),3500)}
async function downloadFace(id,slot='primary'){const face=data.faces.find(f=>f.id===id);if(!face)return;try{const b=await dbOp('get',id+':'+slot);if(!b)throw Error('写真が見つかりません');let name=slot==='primary'?face.primaryName:face.secondaryName;makeDownload(b,name||face.name+'.jpg');toast('写真を保存しました。ChatGPT側で添付してください。')}catch(e){toast(e.message)}}
async function shareFace(id,slot='primary'){
 const face=data.faces.find(f=>f.id===id);if(!face)return;
 try{
   const b=await dbOp('get',id+':'+slot);if(!b)throw Error('元写真が見つかりません');
   const name=(slot==='primary'?face.primaryName:face.secondaryName)||face.name+'.jpg';
   const f=new File([b],name,{type:b.type||'image/jpeg'});
   if(typeof navigator.share==='function' && typeof navigator.canShare==='function' && navigator.canShare({files:[f]})){
     try{await navigator.share({files:[f],title:'ChatGPTで使用する元写真'});return}catch(e){if(e.name==='AbortError')return}
   }
   makeDownload(b,name);toast('共有に対応していないため、写真を保存しました。ChatGPTで添付してください。');
 }catch(e){toast(e.message||'写真の共有に失敗しました')}
}
async function renderPendingRefs(pending,box){revoke(pendingUrls);const old=box.querySelector('.ref-block');if(old)old.remove();if(!pending.faceProfiles)return;const holder=document.createElement('div');holder.className='ref-block';holder.innerHTML='<h3>添付する元写真</h3><p class="privacy-note">各画像を端末に保存し、ChatGPTで元写真を添付してから指示文を送信してください。サイトから自動添付はできません。</p><div class="ref-grid"></div>';box.insertBefore(holder,box.querySelector('.promptbox'));
 for(const [i,f] of pending.faceProfiles.entries()){const entry=document.createElement('div');entry.className='ref-item';const strong=document.createElement('strong');strong.textContent=f.position+'：'+f.name;entry.append(strong);const img=document.createElement('img');img.alt=f.name+'の元写真';try{const b=await dbOp('get',f.id+':primary');if(b){const u=URL.createObjectURL(b);pendingUrls.push(u);img.src=u}else img.alt='写真が見つかりません'}catch{}entry.append(img);const btn=document.createElement('button');btn.type='button';btn.className='btn secondary';btn.textContent='最優先写真を共有';btn.onclick=()=>shareFace(f.id);entry.append(btn);const dl=document.createElement('button');dl.type='button';dl.className='btn ghost';dl.style.marginTop='5px';dl.textContent='元写真を保存';dl.onclick=()=>downloadFace(f.id);entry.append(dl);
 if(f.secondaryName){const btn2=document.createElement('button');btn2.type='button';btn2.className='btn ghost';btn2.style.marginTop='5px';btn2.textContent='補助写真も保存';btn2.onclick=()=>downloadFace(f.id,'secondary');entry.append(btn2)}holder.querySelector('.ref-grid').append(entry)} }
function recordClaim(id,p){data.reviews[id]={rating:'',memo:'',faceIds:(p.faceProfiles||[]).map(f=>f.id)};save()}
function asDataUrl(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('写真を読み取れません'));r.readAsDataURL(blob)})}
async function exportPackage(){const originals={};for(const f of data.faces){for(const slot of ['primary','secondary']){if(slot==='secondary'&&!f.secondaryName)continue;const b=await dbOp('get',f.id+':'+slot);if(!b)throw Error('元写真が不足しているためバックアップできません: '+f.name);originals[f.id+':'+slot]=await asDataUrl(b)}}return {version:1,meta:data,originals}}
async function restorePackage(pkg){if(!pkg||!pkg.meta||!Array.isArray(pkg.meta.faces)||pkg.meta.faces.length>40||typeof pkg.originals!=='object')throw Error('顔ライブラリのバックアップが不正です');for(const f of pkg.meta.faces){if(!f||typeof f.id!=='string'||!/^[-a-zA-Z0-9.]+$/.test(f.id)||typeof f.name!=='string')throw Error('顔の登録内容が不正です');for(const slot of ['primary',...(f.secondaryName?['secondary']:[])]){const raw=pkg.originals[f.id+':'+slot];if(typeof raw!=='string'||!/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(raw)||raw.length>22*1024*1024)throw Error('バックアップ写真が不正です');const blob=await(await fetch(raw)).blob();if(blob.size>MAX_SIZE)throw Error('復元する写真が15MBを超えます');await dbOp('put',f.id+':'+slot,blob)}}data={...defaults(),...pkg.meta};save();await render()}
async function editFace(id){const f=data.faces.find(x=>x.id===id);if(!f)return;const name=prompt('人物名を編集',f.name);if(name===null)return;if(!name.trim()){toast('人物名は空にできません');return}const memo=prompt('顔の維持事項・メモを編集',f.memo||'');if(memo===null)return;f.name=name.trim().slice(0,60);f.memo=memo.slice(0,300);save();await render()}
async function deleteFace(id){const f=data.faces.find(x=>x.id===id);if(!f||!confirm('「'+f.name+'」の登録写真を削除しますか？ この操作は元に戻せません。'))return;data.faces=data.faces.filter(x=>x.id!==id);if(data.selectedA===id)data.selectedA=data.faces[0]?.id||'';if(data.selectedB===id)data.selectedB='';save();for(const slot of ['primary','secondary'])try{await dbOp('delete',id+':'+slot)}catch{}await render();toast('登録を削除しました')}
$('addFace').addEventListener('click',addFace);
$('faceList').addEventListener('click',async e=>{const b=e.target.closest('button[data-action]');if(!b)return;const id=b.dataset.id;if(b.dataset.action==='share')await shareFace(id);if(b.dataset.action==='download')await downloadFace(id);if(b.dataset.action==='edit')await editFace(id);if(b.dataset.action==='delete')await deleteFace(id)});
for(const [id,key] of [['studioFaceA','selectedA'],['studioFaceB','selectedB']])$(id).addEventListener('change',e=>{data[key]=e.target.value;save()});
$('studioGoReward').addEventListener('click',()=>document.querySelector('nav button[data-tab="reward"]').click());
$('studioHistory').addEventListener('change',e=>{const block=e.target.closest('[data-review]');if(!block)return;const id=block.dataset.review,r=data.reviews[id]||{rating:'',memo:''};r.rating=block.querySelector('[data-role="rating"]').value;r.memo=block.querySelector('[data-role="memo"]').value.slice(0,300);data.reviews[id]=r;save();toast('評価を保存しました')});
window.FaceStudio={render,getSelectedFaces,faceInstructions,renderPendingRefs,recordClaim,exportPackage,restorePackage};
})();
