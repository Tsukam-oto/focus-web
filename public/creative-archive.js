/* FOCUS v5.6: self-contained (stored method) ZIP export/import for creative notes and audio.
   Never sends files to a server. No third-party library or network dependency. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const LIMIT=80*1024*1024,FILE_LIMIT=40*1024*1024;
const enc=new TextEncoder(),dec=new TextDecoder();
const bytes=s=>enc.encode(s);
const crcTable=new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let j=0;j<8;j++)c=c&1?(0xEDB88320^(c>>>1)):(c>>>1);crcTable[n]=c>>>0}
function crc32(a){let c=0xFFFFFFFF;for(let i=0;i<a.length;i++)c=crcTable[(c^a[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
const writer=(length)=>{const a=new Uint8Array(length);return {a,v:new DataView(a.buffer)}};
const ext=mime=>mime.includes('mp4')?'m4a':mime.includes('mpeg')?'mp3':mime.includes('wav')?'wav':'webm';
function zipPack(items){
 let chunks=[],central=[],offset=0;
 for(const entry of items){const name=bytes(entry.name),body=entry.data,check=crc32(body),h=writer(30+name.length);
   h.v.setUint32(0,0x04034b50,true);h.v.setUint16(4,20,true);h.v.setUint16(6,0x0800,true);h.v.setUint16(8,0,true);
   h.v.setUint32(14,check,true);h.v.setUint32(18,body.length,true);h.v.setUint32(22,body.length,true);h.v.setUint16(26,name.length,true);h.a.set(name,30);
   chunks.push(h.a,body);
   const c=writer(46+name.length);c.v.setUint32(0,0x02014b50,true);c.v.setUint16(4,20,true);c.v.setUint16(6,20,true);c.v.setUint16(8,0x0800,true);c.v.setUint16(10,0,true);c.v.setUint32(16,check,true);c.v.setUint32(20,body.length,true);c.v.setUint32(24,body.length,true);c.v.setUint16(28,name.length,true);c.v.setUint32(42,offset,true);c.a.set(name,46);central.push(c.a);
   offset+=h.a.length+body.length;
 }
 const centralSize=central.reduce((n,x)=>n+x.length,0),end=writer(22);
 end.v.setUint32(0,0x06054b50,true);end.v.setUint16(8,items.length,true);end.v.setUint16(10,items.length,true);end.v.setUint32(12,centralSize,true);end.v.setUint32(16,offset,true);
 return new Blob([...chunks,...central,end.a],{type:'application/zip'});
}
function unpack(buffer){
 const data=new Uint8Array(buffer),v=new DataView(buffer),out=new Map();let pos=0;
 while(pos+4<=data.byteLength){const sig=v.getUint32(pos,true);if(sig===0x02014b50||sig===0x06054b50)break;if(sig!==0x04034b50)throw Error('ZIPの構造が不正です');
   if(pos+30>data.length)throw Error('ZIPヘッダーが途中で切れています');
   const flags=v.getUint16(pos+6,true),method=v.getUint16(pos+8,true),check=v.getUint32(pos+14,true),length=v.getUint32(pos+18,true),plain=v.getUint32(pos+22,true),nameLength=v.getUint16(pos+26,true),extraLength=v.getUint16(pos+28,true);
   if((flags&0x8)||method!==0||length!==plain||length>FILE_LIMIT)throw Error('このZIP形式は未対応です。FOCUSで作成したZIPを使用してください');
   const begin=pos+30+nameLength+extraLength,finish=begin+length;
   if(finish>data.length||begin>data.length)throw Error('ZIPのデータが途中で切れています');
   const name=dec.decode(data.slice(pos+30,pos+30+nameLength));
   if(!/^((workspace\.json)|(recordings\.json)|(audio\/[A-Za-z0-9_-]+\.(m4a|mp3|wav|webm)))$/.test(name)||out.has(name))throw Error('ZIP内に不明または重複したファイルがあります');
   const item=data.slice(begin,finish);if(crc32(item)!==check)throw Error('ZIPの整合性検証に失敗しました: '+name);
   out.set(name,item);pos=finish;if(out.size>502)throw Error('ファイル件数が多すぎます');
 }
 if(!out.has('workspace.json')||!out.has('recordings.json'))throw Error('FOCUSの制作バックアップではありません');
 return out;
}
function archiveName(){const d=new Date();return 'FOCUS-CREATIVE-'+[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('')+'.zip'}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),12000)}
function status(msg){window.FocusCreative?.setAudioStatus(msg)}
async function exportAll(){const btn=$('creativeArchiveExport');btn.disabled=true;try{
 const studio=window.FocusCreative;if(!studio)throw Error('制作画面が読み込まれていません');
 const audios=await studio.getAudios();if(audios.length>500)throw Error('録音が多すぎます。個別に分けて保存してください');
 let total=0;for(const a of audios){if(!a.blob||a.blob.size>FILE_LIMIT)throw Error('40MBを超える録音があります。個別に書き出してください');total+=a.blob.size}
 if(total>LIMIT)throw Error('録音の合計が80MBを超えています。個別に書き出し、整理してからお試しください');
 const files=[{name:'workspace.json',data:bytes(JSON.stringify({format:'FOCUS-CREATIVE',version:2,exportedAt:new Date().toISOString(),workspace:studio.exportPackage()}))}];
 const manifest=[];for(const audio of audios){const file='audio/'+audio.id.replace(/[^A-Za-z0-9_-]/g,'_')+'.'+ext(audio.mime||audio.blob.type||'');if(manifest.some(x=>x.file===file))throw Error('録音IDが重複しています');manifest.push({id:audio.id,file,title:audio.title,when:audio.when,mime:audio.mime||audio.blob.type,project:audio.project||''});files.push({name:file,data:new Uint8Array(await audio.blob.arrayBuffer())})}
 files.push({name:'recordings.json',data:bytes(JSON.stringify({version:1,items:manifest}))});
 const blob=zipPack(files);download(blob,archiveName());status('ZIPの書き出しを開始しました（メモ・コード・録音 '+audios.length+'件）。保存先をご確認ください');
}catch(e){status('制作バックアップに失敗しました: '+(e.message||e))}finally{btn.disabled=false}}
async function importAll(file){if(!file)return;const btn=$('creativeArchiveImport');btn.disabled=true;try{
 if(file.size>90*1024*1024)throw Error('ZIPが大きすぎます（90MBまで）');
 const entries=unpack(await file.arrayBuffer());let head,items;try{head=JSON.parse(dec.decode(entries.get('workspace.json')));items=JSON.parse(dec.decode(entries.get('recordings.json')))}catch{throw Error('バックアップの管理情報を読み取れません')}
 if(head?.format!=='FOCUS-CREATIVE'||!head.workspace||!Array.isArray(head.workspace.docs)||!Array.isArray(items?.items)||items.items.length>500)throw Error('FOCUSの制作バックアップではありません');
 let total=0,seen=new Set();const verified=[];
 for(const item of items.items){if(!item||typeof item.id!=='string'||typeof item.file!=='string'||seen.has(item.id)||!entries.has(item.file))throw Error('音声管理情報が不正です');
   seen.add(item.id);const data=entries.get(item.file);total+=data.length;if(total>LIMIT)throw Error('音声の合計が80MBを超えています');
   if(!/^audio\/[A-Za-z0-9_-]+\.(m4a|mp3|wav|webm)$/.test(item.file))throw Error('不正な音声ファイル名です');
   verified.push({...item,blob:new Blob([data],{type:typeof item.mime==='string'&&item.mime.startsWith('audio/')?item.mime:'audio/webm'})});
 }
 if(!confirm('制作メモとコードをバックアップの内容に置き換え、録音 '+verified.length+'件を取り込みます。既存の録音は残ります。よろしいですか？'))return;
 // Upload audio first; if storage fails, the current text notes remain untouched.
 const existingIds=new Set((await window.FocusCreative.getAudios()).map(a=>a.id));
 for(const a of verified){await window.FocusCreative.putAudio({id:existingIds.has(a.id)?crypto.randomUUID():a.id,title:String(a.title||'録音').slice(0,120),when:String(a.when||new Date().toISOString()),project:String(a.project||'').slice(0,50),mime:a.blob.type,blob:a.blob})}
 window.FocusCreative.restorePackage(head.workspace);await window.FocusCreative.renderAudios();
 status('制作ZIPからメモと録音 '+verified.length+'件を復元しました。');
}catch(e){status('制作ZIPの復元に失敗しました: '+(e.message||e)+'（音声が一部登録された可能性があります）')}finally{btn.disabled=false;$('creativeArchiveFile').value=''}}
$('creativeArchiveExport').addEventListener('click',exportAll);
$('creativeArchiveImport').addEventListener('click',()=>$('creativeArchiveFile').click());
$('creativeArchiveFile').addEventListener('change',e=>importAll(e.target.files?.[0]));
window.FocusCreativeArchive={zipPack,unpack,exportAll,importAll};
})();
