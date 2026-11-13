/* Browser speech recognition is optional. Structuring is deterministic, not an LLM. */
const VoiceDraft={
 extract(raw){
  const text=String(raw||'').trim();
  const chunks=text.split(/[，。；\n]/).map(x=>x.trim()).filter(Boolean);
  return {raw:text,phenomenon:text,impact:chunks.filter(x=>/装不上|无法|影响|停工|不能|阻碍|延误/.test(x)).join('；'),
   measurements:(text.match(/(?:大概|约|估计|疑似)?\s*[+＋\-−负正]?\s*\d+(?:\.\d+)?\s*(?:毫米|厘米|米|mm|cm|MPa|兆帕|度)/gi)||[]).join('；')};
 },
 panel(){return `<section class="voice-panel"><div class="row between"><strong>说一下现场问题</strong>${tag('语音草稿','teal')}</div><p>例如：12层东面 E04，预埋件大概外凸18毫米，转接件装不上。</p><button type="button" id="voiceHold" class="voice-hold" aria-label="按住说话，松开结束" disabled>按住说话，松开结束</button><p id="voiceStatus" role="status" aria-live="polite">正在检查浏览器支持情况…</p><label class="voice-consent"><input id="voiceConsent" type="checkbox">同意启用浏览器语音识别。音频可能由浏览器服务商在线处理，请勿口述敏感信息。</label><label for="voiceRaw">识别原文（可手动修改）</label><textarea id="voiceRaw" name="voiceRaw" placeholder="识别结果会出现在这里；也可以直接输入口述内容。"></textarea><div class="fieldbuttons"><button type="button" id="voiceBuild">整理成草稿</button><button type="button" id="voiceExample">试用示例口述</button></div><p class="quiet">整理使用本地规则，未接入大模型。不保存原始音频；原文与确认后的字段随问题保存。试用示例不会打开麦克风。</p></section>`;},
 active:null,session:null,
 init(){
  const hold=$('voiceHold');if(!hold)return;
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const session={raw:'',source:'manual',used:false,listening:false,ended:true};this.session=session;
  const say=t=>{if(this.session===session&&$('voiceStatus'))$('voiceStatus').textContent=t;};
  say(Recognition?'勾选同意后可按住说话；也可直接输入。':'当前浏览器不支持语音识别，请手动输入或试用示例口述。');
  $('voiceConsent').addEventListener('change',()=>{hold.disabled=!Recognition||!$('voiceConsent').checked;if(hold.disabled)this.stop();});
  const start=()=>{
   if(hold.disabled||!session.ended)return;
   if($('voiceRaw').value.trim()){say('已有原文。继续录入会追加内容；需要重录可先清空原文。');}
   const rec=new Recognition();this.active=rec;session.listening=true;session.ended=false;session.source='browser-speech';
   rec.lang='zh-CN';rec.interimResults=true;rec.continuous=true;
   const prefix=$('voiceRaw').value.trim();let confirmed='';
   rec.onresult=e=>{if(this.session!==session)return;let interim='';for(let k=e.resultIndex;k<e.results.length;k++){if(e.results[k].isFinal)confirmed+=e.results[k][0].transcript;else interim+=e.results[k][0].transcript;}session.raw=[prefix,confirmed].filter(Boolean).join('；');$('voiceRaw').value=session.raw;this.invalidate();say(interim?'正在识别：'+interim:'已识别，松开后可整理草稿。');};
   rec.onerror=e=>{say(({ 'not-allowed':'未获得麦克风权限，请允许浏览器访问或手动输入。','no-speech':'没有听清，请重试或手动输入。','network':'语音服务连接失败，请重试或手动输入。','audio-capture':'未检测到可用麦克风，请手动输入。',aborted:'录音已取消。'})[e.error]||'语音识别失败，请手动输入。');session.failed=true;};
   rec.onend=()=>{session.ended=true;session.listening=false;if(this.session!==session)return;hold.classList.remove('listening');hold.textContent='按住说话，松开结束';if(!session.failed)say('录音已结束，请核对原文，再整理成草稿。');};
   session.failed=false;hold.classList.add('listening');hold.textContent='正在听，松开结束';say('正在录音…');
   try{rec.start();}catch{session.ended=true;session.listening=false;hold.classList.remove('listening');say('无法启动语音，请手动输入。');}
  };
  hold.addEventListener('pointerdown',e=>{e.preventDefault();hold.setPointerCapture(e.pointerId);start();});
  hold.addEventListener('pointerup',()=>this.stop());hold.addEventListener('pointercancel',()=>this.stop());
  hold.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)&&!e.repeat){e.preventDefault();start();}});
  hold.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();this.stop();}});
  hold.addEventListener('blur',()=>this.stop());
  $('voiceRaw').addEventListener('input',()=>{session.source='manual';this.invalidate();});
  $('voiceExample').addEventListener('click',()=>{if(!session.ended){say('请先结束录音。');return;}$('voiceRaw').value='【演示口述】12层东面 E04，预埋件大概外凸18毫米，转接件装不上。';session.source='example';this.invalidate();say('已填入演示口述，未使用麦克风。请点击整理成草稿。');});
  $('voiceBuild').addEventListener('click',()=>{
   if(!session.ended){say('语音尚未结束，请稍候再整理。');return;}
   const raw=$('voiceRaw').value.trim();if(!raw){say('请先说话或输入口述内容。');return;}
   const d=this.extract(raw);session.raw=raw;session.used=true;
   $('f-text').value=d.phenomenon;$('f-impact').value=d.impact;$('f-measurement').value=d.measurements;
   this.invalidate();say('草稿已生成。位置未自动更改；数字仍是口述记录，请逐项核对。');$('voiceReview').hidden=false;$('voiceReview').scrollIntoView({block:'nearest'});
  });
  $('form').addEventListener('input',e=>{if(e.target.name!=='voiceConfirmed')this.invalidate();});
 },
 invalidate(){const confirm=$('form')?.querySelector('[name="voiceConfirmed"]');if(confirm)confirm.checked=false;},
 stop(){if(this.active&&this.session?.listening){this.session.listening=false;try{this.active.stop();}catch{}}},
 close(){this.stop();if(this.active){this.active.onresult=null;this.active.onend=null;this.active.onerror=null;try{this.active.abort();}catch{}}this.active=null;this.session=null;},
 collect(p){
  if(!this.session)return;
  if(!this.session.ended)throw Error('请先结束语音识别，再提交。');
  if(p.voiceRaw&&!this.session.used)throw Error('请先将口述整理成草稿并核对，或清空原文后直接手动填写。');
  if(this.session.used&&!p.voiceConfirmed)throw Error('请核对位置、数字、单位和事实后勾选确认。');
  if(this.session.used&&p.voiceRaw!==this.session.raw)throw Error('原文已修改，请重新整理草稿。');
  if(this.session.used)p.voiceDraft={source:this.session.source,raw:p.voiceRaw,phenomenon:p.text,impact:p.impact||'',measurement:p.measurement||'',valueKind:p.valueKind||'unconfirmed',confirmed:true,location:p.location,method:'local-rules-v1'};
 }
};
if(typeof module!=='undefined')module.exports=VoiceDraft;

function voiceEvidence(v){if(!v)return '';return `<details class="voice-evidence"><summary>语音草稿与人工核对记录</summary><p>输入来源：${esc(({example:'示例口述',manual:'手动输入或修订原文','browser-speech':'浏览器语音识别'})[v.source]||v.source)}</p><p>原文：${esc(v.raw)}</p><p>施工影响：${esc(v.impact||'未提及')}</p><p>口述数值：${esc(v.measurement||'未提及')} · ${esc(({unconfirmed:'待确认',estimate:'估计值',measured:'实测值（仍需核查依据）'})[v.valueKind])}</p><p>提交位置：${esc(v.location)}</p><p class="quiet">提交人已核对草稿；不代表技术审查或验收通过。整理方式：本地规则。</p></details>`;}
