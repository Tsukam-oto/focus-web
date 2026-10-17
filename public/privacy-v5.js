(()=>{'use strict';
const KEY='focus-v5-pin-sha256', unlocked=()=>document.body.classList.contains('private-unlocked');
let entered=false;
async function hash(pin){const arr=new TextEncoder().encode('FOCUS-v5-screen-lock:'+pin);const dig=await crypto.subtle.digest('SHA-256',arr);return [...new Uint8Array(dig)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function lock(){entered=false;document.body.classList.remove('private-unlocked');const input=document.getElementById('privatePin');if(input)input.value='';if(document.querySelector('#panel-studio.active,#panel-reward.active,#panel-gallery.active')){document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id==='panel-focus'));document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab==='focus'));}}
async function unlock(){const input=document.getElementById('privatePin'),pin=input.value.trim(),stored=localStorage.getItem(KEY);if(stored&&await hash(pin)!==stored){show('PINが一致しません');return}entered=true;document.body.classList.add('private-unlocked');input.value='';document.querySelector('nav button[data-tab="reward"]').click();show('ポイント管理を開きました')}
function show(m){const el=document.getElementById('toast');el.textContent=m;el.classList.remove('hidden');setTimeout(()=>el.classList.add('hidden'),2600)}
async function setPin(){const old=localStorage.getItem(KEY);if(old){const p=prompt('現在のPINを入力してください');if(p===null)return;if(await hash(p)!==old){show('現在のPINが違います');return}}const next=prompt('新しいPIN（4〜12桁の数字）。空欄でPINを解除します');if(next===null)return;if(next===''){localStorage.removeItem(KEY);show('画面PINを解除しました');return}if(!/^\d{4,12}$/.test(next)){show('PINは4〜12桁の数字で設定してください');return}localStorage.setItem(KEY,await hash(next));lock();show('画面PINを設定しました')}
window.FocusPrivacy={lock,isUnlocked:unlocked};
document.getElementById('privateUnlock').addEventListener('click',unlock);
document.getElementById('privateSetPin').addEventListener('click',setPin);
document.getElementById('privatePin').addEventListener('keydown',e=>{if(e.key==='Enter')unlock()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)lock()});
window.addEventListener('pagehide',()=>{lock()});
lock();
})();
