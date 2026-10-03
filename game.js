'use strict';
(() => {
  const $=id=>document.getElementById(id),canvas=$('river'),ctx=canvas.getContext('2d'),TAU=Math.PI*2;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const memories=[
    {title:'漏雨的伞',symbol:'伞',text:['第一次一起回家，伞骨断了一根。','你一路把伞往我这边推，第二天却说，是自己忘了躲雨。'],keep:'把伞影留在船边',guide:'让伞下的光照着前路',responses:['我还记得，你那天湿了哪边肩膀。','前面的水纹亮了。我把船往亮处拨了一点。']},
    {title:'皱角的车票',symbol:'票',text:['我们没赶上末班车，在站台分吃一只冷掉的饭团。','你拿车票垫着，认真分出了大的一半。'],keep:'把车票夹回旧日记',guide:'借它照出下一处转弯',responses:['那天没去成哪里。我却记得很清楚。','票上的站名淡了。前面仍有可以靠岸的地方。']},
    {title:'缺口的蓝杯',symbol:'杯',text:['你总把杯柄朝左放，因为我用左手。','我以前从没留意这件事。'],keep:'把杯子放在手边',guide:'让杯沿的光照向河心',responses:['伸手就能碰到的位置，还为它空着。','我把船拨正，左手依旧握着桨。']},
    {title:'写错的菜谱',symbol:'食',text:['你把一小勺盐写成了一大勺。','那锅汤我们笑了很久。后来每次吵架，你总想拿这件事蒙混过去。'],keep:'收好原来的菜谱',guide:'把改好的做法带到前头',responses:['这张纸上，连写错的地方我也认得。','下次煮汤，我会记得只放一小勺。']},
    {title:'没寄出的明信片',symbol:'山',text:['你选了一张雪山的明信片，说等身体好些就去。','病房窗外没有山，只有一棵落叶的树。'],keep:'把约定放在灯旁',guide:'让它照向更远的地方',responses:['那个冬天没能成行。我可以先不替它找一句解释。','我还想去看看。什么时候去，由我慢慢决定。']},
    {title:'多出来的钥匙',symbol:'家',text:['你去世以后，我把你的钥匙从钥匙圈上拆下。','回到门前时，我还是下意识往旁边让了一步。'],keep:'把钥匙留在内袋',guide:'借它的光认出家门',responses:['隔着布料，我知道它在。不必每次都拿出来。','门内现在只有我的脚步，灯仍然可以亮着。']}
  ];
  const chapters=[{number:'第一程',title:'那时候',line:'岸上的最后一扇窗暗了。船还在往前。'},{number:'第二程',title:'灯下的小事',line:'风小了一些。水里映着很远的厨房灯。'},{number:'第三程',title:'天亮以前',line:'远处有人卸货。早市快开了。'}];
  const endings={
    near:{title:'窗边',lines:['到岸时，我把身边的光一盏盏收拢。它们暂时都跟我回家。','早市刚开，我买了一杯热豆浆，在摊边慢慢喝完。','窗边还有一块空地方，刚好放得下这盏旧灯。'],last:'有些往事，我想放得近一点。'},
    both:{title:'两边都有光',lines:['几盏光跟我上岸，几盏留在了河面。','我在码头坐了一会儿，给朋友回了一句：到岸了。','路过早市时，我买齐了那张菜谱上的东西。今晚，可以再试一次。'],last:'身边放着旧事，手里提着今天。'},
    ahead:{title:'早市',lines:['河上的光在身后连成一线。旧灯提在手里，天已亮得不用照路。','早市有人卖花。我挑了一小束，是我一直喜欢的颜色。','回家以后，花放在桌上，灯挂回原处。我还是很想你。'],last:'今天，我想给桌上添一点颜色。'}
  };
  let width=innerWidth,height=innerHeight,time=0,lastTime=0;
  let mode='title',previousMode='playing',dialogKind='',returnFocus=null;
  let boat={x:.23,y:.71,vx:0,vy:0},light=100,elapsed=0,segment=0,choices=[],target=null,endingTime=0;
  let sparkTimer=0,fogTimer=0,captionUntil=0,hitCooldown=0,hudTimer=0;
  let sparks=[],fogs=[],ripples=[],particles=[],keys={},pointer=null,shieldPointer=false;
  let gentle=false,sound=false,audio=null,master=null,musicTimer=null,noteIndex=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,storeKey='afterglow-river-v1';
  function resize(){width=innerWidth;height=innerHeight;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);pointer=null;}
  addEventListener('resize',resize);resize();
  const isShielded=()=>!!(keys.Space||shieldPointer);
  const distance=(a,b)=>Math.hypot((a.x-b.x)*width,(a.y-b.y)*height);
  function say(text,duration=6){$('caption').textContent=text;captionUntil=time+duration;$('caption').classList.add('visible');}
  function burst(x,y,count=16){for(let i=0;i<count;i++)particles.push({x,y,vx:(Math.random()-.5)*.035,vy:(Math.random()-.7)*.045,life:1.6});}
  function tone(freq,when=0,duration=2,volume=.07){
    if(!audio||!sound||audio.state!=='running')return;
    const osc=audio.createOscillator(),gain=audio.createGain(),start=audio.currentTime+when;
    osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+.025);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    osc.connect(gain);gain.connect(master);osc.start(start);osc.stop(start+duration+.1);
  }
  function chime(){[523.25,659.25,783.99].forEach((f,i)=>tone(f,i*.12,1.8,.055));}
  function music(){if(!sound||document.hidden)return;const notes=[220,329.63,392,293.66,261.63,329.63,196,293.66];tone(notes[noteIndex%notes.length],0,3.9,.035);if(noteIndex%4===0)tone(110,0,5,.027);noteIndex++;}
  async function toggleSound(){
    sound=!sound;
    if(sound){try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();if(!master){master=audio.createGain();master.gain.value=.6;master.connect(audio.destination);}await audio.resume();music();if(!musicTimer)musicTimer=setInterval(music,1900);}catch{sound=false;}}
    if(master)master.gain.setTargetAtTime(sound?.6:0,audio.currentTime,.15);
    $('sound-btn').setAttribute('aria-pressed',String(sound));$('sound-btn').setAttribute('aria-label',sound?'关闭声音':'开启声音');$('sound-label').textContent=sound?'声音开':'声音关';
  }
  $('sound-btn').addEventListener('click',toggleSound);
  function save(){try{localStorage.setItem(storeKey,JSON.stringify({version:1,choices,gentle,complete:mode==='ending'}));}catch{}}
  function load(){try{const s=JSON.parse(localStorage.getItem(storeKey));if(s?.version===1&&Array.isArray(s.choices)&&s.choices.length<=6&&s.choices.every(c=>c==='keep'||c==='guide'))return s;}catch{}return null;}
  function segmentDuration(){return segment===0?8:17+segment*1.7;}
  function updateHUD(){
    const c=chapters[Math.min(2,Math.floor(segment/2))];$('chapter-number').textContent=c.number;$('chapter-title').textContent=c.title;
    $('memory-count').textContent=`${choices.length} / 6`;$('light-fill').style.width=`${light}%`;$('light-value').textContent=Math.ceil(light);
    $('light-fill').parentElement.setAttribute('aria-valuenow',String(Math.ceil(light)));
    $('journey-fill').style.width=`${Math.min(100,(segment+Math.min(1,elapsed/segmentDuration()))/6*100)}%`;$('shield-btn').classList.toggle('active',isShielded());
  }
  function clearInput(){keys={};pointer=null;shieldPointer=false;}
  function modal(kind,html){clearInput();dialogKind=kind;returnFocus=document.activeElement;$('dialog').innerHTML=html;$('overlay').hidden=false;$('dialog').scrollTop=0;$('dialog').focus();}
  function closeModal(){$('overlay').hidden=true;dialogKind='';clearInput();canvas.focus();}
  function newJourney(restore=false){
    const saved=restore?load():null;choices=saved?saved.choices.slice():[];gentle=saved?!!saved.gentle:false;segment=choices.length;
    boat={x:.23,y:.69,vx:0,vy:0};light=100;elapsed=0;target=null;sparks=[];fogs=[];ripples=[];particles=[];sparkTimer=0;fogTimer=0;endingTime=0;
    $('title-screen').hidden=true;$('title-note').hidden=true;$('title-footer').hidden=true;$('ending-screen').hidden=true;$('world').classList.remove('dawn');
    $('hud').hidden=false;$('controls').hidden=false;$('pause-btn').hidden=false;$('journal-btn').hidden=false;mode='intro';
    if(saved&&choices.length>0){closeModal();mode='playing';if(segment===6){finishJourney();return;}say('灯还亮着。我们从这里继续。',7);updateHUD();return;}
    modal('intro',`<div class="eyebrow">序 · 最后一盏灯</div><h2 id="dialog-title">今夜，把灯带回家。</h2><p>你去世后的第一个秋天，<br>我又划起了那条旧木船。</p><p>今晚，我要把你留下的灯带回家。<br>河面偶尔亮起旧事。靠近一些，把它们认出来。</p><div class="key-help"><span>划船</span><span>方向键 / WASD，或按住水面拖动</span><span>守灯</span><span>按住空格或「守灯」，抵挡冷雾</span><span>拾起回忆</span><span>靠近金色方灯，停留片刻</span></div><p class="subtle">对岸有明早的早市。我们要去那里。<br>阅读时河流会等你。随时按 Esc 暂停。</p><div class="dialog-actions"><button class="primary" id="sail-btn">带上这盏灯</button></div>`);
    $('sail-btn').onclick=()=>{closeModal();mode='playing';save();say('试着划动小船。靠近金色灯点，可以补充灯火。',9);updateHUD();chime();};
  }
  $('start-btn').onclick=()=>newJourney(false);
  const saved=load();if(saved&&saved.choices.length>0&&!saved.complete){$('saved-note').hidden=false;$('saved-note').innerHTML='<button class="text-button" id="continue-btn">继续上次的夜航</button>';$('continue-btn').onclick=()=>newJourney(true);}
  function showMemory(){
    mode='memory';const m=memories[segment];target=null;chime();burst(boat.x,boat.y,30);
    modal('memory',`<div class="eyebrow">拾起记忆 · ${String(segment+1).padStart(2,'0')} / 06</div><h2 id="dialog-title">${m.title}</h2>${m.text.map(t=>`<p>${t}</p>`).join('')}<p class="subtle">替这一点光，找个位置。两种选择都会留下记忆。</p><div class="choices"><button class="choice" data-choice="keep"><span><strong>${m.keep}</strong><small>留在身边 · 扩大船边的灯光</small></span><span class="choice-symbol" aria-hidden="true">◉</span></button><button class="choice" data-choice="guide"><span><strong>${m.guide}</strong><small>照向前路 · 河上多一盏引路灯</small></span><span class="choice-symbol" aria-hidden="true">✧</span></button></div>`);
    $('dialog').querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>chooseMemory(b.dataset.choice));
  }
  function chooseMemory(kind){
    if(mode!=='memory'||dialogKind!=='memory'||!['keep','guide'].includes(kind))return;
    const m=memories[segment];choices.push(kind);light=Math.min(100,light+20);save();chime();
    modal('response',`<div class="eyebrow">${kind==='keep'?'光，留在身边':'光，照向前路'}</div><h2 id="dialog-title">${m.title}</h2><p class="response-line">${m.responses[kind==='keep'?0:1]}</p><p class="subtle">${kind==='keep'?'这段旧事，会陪着船一起走。':'灯漂向前头，替你照亮一小段水路。'}</p><div class="dialog-actions"><button class="primary" id="onward-btn">${segment===5?'往有灯的岸边去':'继续划船'}</button></div>`);
    $('onward-btn').onclick=()=>{segment++;elapsed=0;fogs=[];light=Math.max(65,light);closeModal();mode='playing';if(segment>=6){finishJourney();return;}if(segment%2===0)say(chapters[Math.floor(segment/2)].line,8);else say(kind==='keep'?'灯光近了一些。你还可以慢慢划。':'前路亮了一些。那段往事仍在回忆里。',6);updateHUD();};
  }
  function pause(){
    if(mode!=='playing'&&mode!=='arrival')return;previousMode=mode;mode='paused';
    modal('pause',`<div class="eyebrow">在河上，歇一会儿</div><h2 id="dialog-title">灯会等你。</h2><div class="key-help"><span>方向键 / WASD</span><span>划动小船</span><span>按住水面拖动</span><span>让船跟随手指或鼠标</span><span>空格 / 守灯</span><span>减慢航速，抵挡冷雾</span><span>金色方灯 / 光点</span><span>拾起记忆 / 补充灯火</span><span>Esc / P</span><span>暂停或继续</span></div><div class="settings-row"><div><span>舒缓航行</span><p class="subtle">灯火不减，拾取范围更宽。</p></div><button id="gentle-btn" class="toggle" aria-pressed="${gentle}">${gentle?'已开启':'开启'}</button></div><div class="dialog-actions"><button id="resume-btn" class="primary">继续夜航</button><button id="pause-journal" class="secondary">翻看回忆</button></div>`);
    $('gentle-btn').onclick=()=>{gentle=!gentle;$('gentle-btn').setAttribute('aria-pressed',String(gentle));$('gentle-btn').textContent=gentle?'已开启':'开启';save();};$('resume-btn').onclick=resume;$('pause-journal').onclick=()=>showJournal('paused');
  }
  function resume(){if(mode==='paused'){closeModal();mode=previousMode;}}
  $('pause-btn').onclick=pause;
  function showJournal(from=mode){
    if(['memory','intro','rest','journal'].includes(mode))return;const backTo=from;mode='journal';
    modal('journal',`<div class="eyebrow">留存的旧事 · ${choices.length} / 6</div><h2 id="dialog-title">回忆没有被带走。</h2>${choices.length?'<div class="journal-list">'+choices.map((c,i)=>`<article class="journal-entry"><h3>${memories[i].title}</h3><p>${memories[i].text.join('')}</p><small>${c==='keep'?'光留在身边':'光照向前路'} · ${memories[i].responses[c==='keep'?0:1]}</small></article>`).join('')+'</div>':'<p>河面偶尔亮起旧事。<br>划近一些，我们慢慢把它们认出来。</p>'}<div class="dialog-actions"><button id="journal-close" class="primary">${backTo==='ending'?'回到岸边':'合上回忆'}</button></div>`);
    $('journal-close').onclick=()=>{closeModal();mode=backTo;if(backTo==='paused'){mode=previousMode;pause();}};
  }
  $('journal-btn').onclick=()=>showJournal();
  function rest(){
    mode='rest';light=0;modal('rest','<div class="eyebrow">风有些大</div><h2 id="dialog-title">靠一会儿岸，再出发。</h2><p>你用衣袖护住灯芯，在背风处坐了一会儿。<br>没有什么回忆丢失。也不必急着到岸。</p><p class="subtle">按住空格或「守灯」能抵挡冷雾。<br>也可以开启舒缓航行，让灯一直亮着。</p><div class="dialog-actions"><button id="relight-btn" class="primary">重新点灯</button><button id="rest-gentle" class="secondary">舒缓航行</button></div>');
    const leave=()=>{light=100;fogs=[];closeModal();mode='playing';say('灯重新亮了。往前的路还在。',6);};$('relight-btn').onclick=leave;$('rest-gentle').onclick=()=>{gentle=true;save();leave();};
  }
  function finishJourney(){mode='arrival';endingTime=0;target=null;fogs=[];$('world').classList.add('dawn');$('chapter-number').textContent='终程';$('chapter-title').textContent='有灯的岸边';say('听，早市开了。今晚的夜航，就到这里。',9);}
  function endingFor(list){const k=list.filter(x=>x==='keep').length;return k>=5?'near':k<=1?'ahead':'both';}
  function showEnding(){
    mode='ending';save();$('hud').hidden=true;$('controls').hidden=true;$('pause-btn').hidden=true;$('caption').classList.remove('visible');const k=choices.filter(x=>x==='keep').length,e=endings[endingFor(choices)];
    $('ending-screen').hidden=false;$('ending-screen').innerHTML=`<div class="ending-inner"><div class="eyebrow">天亮了 · 你已经到岸</div><h2>${e.title}</h2>${e.lines.map(s=>`<p>${s}</p>`).join('')}<p class="ending-summary">${k} 点光留在身边 · ${6-k} 点光照向前路</p><p class="ending-last">${e.last}</p><div class="dialog-actions"><button id="ending-journal" class="primary">翻看六件旧物</button><button id="again-btn" class="secondary">再走一程</button></div><p class="ending-note">这一次的选择，决定不了你爱得有多少。</p></div>`;
    $('ending-journal').onclick=()=>showJournal('ending');$('again-btn').onclick=()=>newJourney(false);chime();
  }
  function update(dt){
    if(mode==='arrival'){endingTime+=dt;boat.x+=(.85-boat.x)*dt*.22;boat.y+=(.60-boat.y)*dt*.2;if(endingTime>10)showEnding();return;}
    if(mode!=='playing')return;const shield=isShielded();let ax=0,ay=0;
    if(keys.ArrowLeft||keys.KeyA)ax--;if(keys.ArrowRight||keys.KeyD)ax++;if(keys.ArrowUp||keys.KeyW)ay--;if(keys.ArrowDown||keys.KeyS)ay++;
    if(pointer){ax=clamp((pointer.x-boat.x)*8,-1,1);ay=clamp((pointer.y-boat.y)*8,-1,1);}
    const speed=shield?.095:.235,yspeed=shield?.065:.17;boat.vx+=(ax*speed-boat.vx)*Math.min(1,dt*5);boat.vy+=(ay*yspeed-boat.vy)*Math.min(1,dt*5);boat.x=clamp(boat.x+boat.vx*dt,.065,.935);boat.y=clamp(boat.y+boat.vy*dt,.51,.82);
    if(Math.random()<dt*8)ripples.push({x:boat.x-.02,y:boat.y+.012,r:3,life:1});
    elapsed+=dt;hitCooldown-=dt;sparkTimer+=dt;fogTimer+=dt;
    if(sparkTimer>3.2){sparkTimer=0;sparks.push({x:1.04,y:.54+Math.random()*.25,phase:Math.random()*TAU});}
    if(fogTimer>6.5&&elapsed>5&&!gentle){fogTimer=0;fogs.push({x:1.1,y:.54+Math.random()*.24,r:width<700?31:48,phase:Math.random()*TAU});}
    if(!target&&elapsed>segmentDuration()&&segment<6){target={x:1.02,y:[.62,.76,.57,.73,.63,.76][segment],hold:0,age:0};say(`「${memories[segment].title}」在河面亮起。靠近金色方灯。`,7);}
    if(target){target.age+=dt;if(target.age>24){target.x+=(boat.x-target.x)*dt*.12;target.y+=(boat.y-target.y)*dt*.12;}else target.x=Math.max(.48,target.x-dt*.042);if(distance(boat,target)<(gentle?90:width<700?53:63)){target.hold+=dt;if(target.hold>.45){showMemory();updateHUD();return;}}else target.hold=Math.max(0,target.hold-dt);}
    const guides=choices.filter(c=>c==='guide').length;
    for(const s of sparks){s.x-=dt*(.045+guides*.002);if(distance(boat,s)<(shield?55:40)){s.x=-1;light=Math.min(100,light+14);burst(boat.x,boat.y,9);tone(659.25,0,.6,.035);}}
    for(const f of fogs){f.x-=dt*.065;f.y+=Math.sin(time+f.phase)*dt*.004;if(distance(boat,f)<f.r+17&&!shield&&!gentle){light-=dt*15;if(hitCooldown<=0){say('冷雾在吹动灯芯。按住空格或「守灯」。',4);hitCooldown=6;}}}
    sparks=sparks.filter(s=>s.x>-.1);fogs=fogs.filter(f=>f.x>-.2);if(!gentle)light=Math.max(0,light-dt*(shield?.2:.42));else light=Math.min(100,light+dt*4);
    if(light<=0){rest();updateHUD();return;}hudTimer+=dt;if(hudTimer>.1){hudTimer=0;updateHUD();}
  }
  function glow(x,y,r,color,alpha=1){ctx.save();ctx.globalAlpha=alpha;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'rgba(237,201,146,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();}
  function drawBoat(x,y,shield=false){
    const scale=width<700?.79:1,bob=reduced?0:Math.sin(time*1.6)*2;ctx.save();ctx.translate(x,y+bob);ctx.scale(scale,scale);const keep=choices.filter(c=>c==='keep').length;glow(11,-23,86+keep*16,'rgba(239,195,122,.19)',.6+light/160);
    // Functional game sprites: hull, rower, oar and the lantern.
    ctx.strokeStyle='rgba(197,221,218,.24)';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,17,54,8,0,0,TAU);ctx.stroke();ctx.fillStyle='#172c33';ctx.strokeStyle='#ad9880';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-43,2);ctx.quadraticCurveTo(2,15,48,-1);ctx.lineTo(30,17);ctx.quadraticCurveTo(0,25,-29,15);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle='#57777c';ctx.beginPath();ctx.moveTo(-32,10);ctx.quadraticCurveTo(0,22,35,6);ctx.stroke();
    ctx.save();ctx.translate(-9,-4);ctx.rotate(reduced?0:Math.sin(time*3)*.13);ctx.strokeStyle='#c4b297';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-19,-4);ctx.lineTo(29,29);ctx.stroke();ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(23,25);ctx.lineTo(34,33);ctx.stroke();ctx.restore();
    ctx.fillStyle='#0b1b23';ctx.beginPath();ctx.arc(-9,-29,7,0,TAU);ctx.fill();ctx.beginPath();ctx.moveTo(-15,-22);ctx.quadraticCurveTo(-23,-5,-12,3);ctx.lineTo(2,3);ctx.lineTo(-3,-17);ctx.closePath();ctx.fill();ctx.strokeStyle='#d5b887';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(17,0);ctx.lineTo(17,-42);ctx.lineTo(31,-42);ctx.lineTo(31,-35);ctx.stroke();glow(31,-27,23,'rgba(255,202,113,.35)',reduced?1:.88+Math.sin(time*11)*.12);ctx.fillStyle='#e8ba75';ctx.fillRect(26,-34,10,15);ctx.fillStyle='#fff0bd';ctx.fillRect(29,-31,4,10);ctx.strokeStyle='#aa8055';ctx.strokeRect(25,-35,12,17);
    for(let i=0;i<keep;i++){const a=time*.3+i*TAU/Math.max(1,keep),lx=Math.cos(a)*57,ly=Math.sin(a)*14+6;glow(lx,ly,11,'rgba(244,203,134,.5)');ctx.fillStyle='#efcf99';ctx.beginPath();ctx.arc(lx,ly,2,0,TAU);ctx.fill();}
    if(shield){ctx.strokeStyle='#d9c8a199';ctx.lineWidth=1;ctx.setLineDash([4,8]);ctx.beginPath();ctx.ellipse(0,-15,63,49,0,0,TAU);ctx.stroke();ctx.setLineDash([]);}ctx.restore();
  }
  function draw(dt){
    ctx.clearRect(0,0,width,height);const active=mode!=='title'&&mode!=='intro';
    for(let i=0;i<48;i++){const x=((i*173-time*(active?15:4))%(width+100)+width+100)%(width+100)-50,y=height*(.52+((i*47)%330)/1000);ctx.strokeStyle=`rgba(138,183,189,${.07+(Math.sin(time*.5+i)+1)*.035})`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+12+(i%5)*9,y);ctx.stroke();}
    for(let i=0;i<28;i++){const x=(i*127+Math.sin(time*.35+i)*20)%width,y=height*.54+(i*73)%(height*.38);ctx.fillStyle=`rgba(237,201,146,${.12+Math.sin(time*.7+i)*.1})`;ctx.beginPath();ctx.arc(x,y,1.2,0,TAU);ctx.fill();}
    for(const f of fogs){const x=f.x*width,y=f.y*height;ctx.save();ctx.translate(x,y);const g=ctx.createRadialGradient(0,0,0,0,0,f.r*1.7);g.addColorStop(0,'rgba(136,186,199,.13)');g.addColorStop(1,'rgba(120,180,198,0)');ctx.fillStyle=g;ctx.fillRect(-f.r*2,-f.r*2,f.r*4,f.r*4);for(let i=0;i<3;i++){ctx.strokeStyle=`rgba(141,182,195,${.15-i*.035})`;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,Math.sin(time+f.phase)*3,f.r*(1-i*.2),f.r*(.35-i*.05),Math.sin(time*.3+f.phase)*.2,0,TAU);ctx.stroke();}ctx.restore();}
    for(const s of sparks){const x=s.x*width,y=s.y*height+Math.sin(time*2+s.phase)*4;glow(x,y,24,'rgba(238,192,117,.25)');ctx.fillStyle='#f0d8a6';ctx.beginPath();ctx.arc(x,y,2.5,0,TAU);ctx.fill();}
    if(active){const guides=choices.filter(c=>c==='guide').length;for(let i=0;i<guides;i++){const x=(.36+i*.12+Math.sin(time*.15+i)*.02)*width,y=height*(.52+i%2*.025);glow(x,y,26,'rgba(237,201,146,.21)');ctx.fillStyle='#dfbd82';ctx.fillRect(x-3,y-5,6,9);ctx.strokeStyle='#b4966a33';ctx.beginPath();ctx.moveTo(x,y+9);ctx.lineTo(x+8,y+17);ctx.stroke();}drawBoat(boat.x*width,boat.y*height,isShielded()&&mode==='playing');}else drawBoat(width*.70,height*.77,false);
    if(target){const x=target.x*width,y=target.y*height+Math.sin(time*1.5)*3,r=width<700?18:23;glow(x,y,65,'rgba(244,201,131,.27)');ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.strokeStyle='#edd09b';ctx.fillStyle='#ddbd7720';ctx.lineWidth=1.2;ctx.fillRect(-r,-r,r*2,r*2);ctx.strokeRect(-r,-r,r*2,r*2);ctx.restore();ctx.fillStyle='#f0dcad';ctx.font=`${width<700?17:21}px serif`;ctx.textAlign='center';ctx.fillText(memories[segment].symbol,x,y+7);ctx.fillStyle='#e8d8b7';ctx.font='12px sans-serif';ctx.fillText('靠近，拾起',x,y+r+29);if(target.hold>0){ctx.strokeStyle='#ffe4ad';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,r+14,-Math.PI/2,-Math.PI/2+TAU*target.hold/.45);ctx.stroke();}}
    for(const r of ripples){r.life-=dt*.7;r.r+=dt*18;ctx.strokeStyle=`rgba(194,216,214,${Math.max(0,r.life)*.16})`;ctx.beginPath();ctx.ellipse(r.x*width,r.y*height,r.r*2,r.r*.4,0,0,TAU);ctx.stroke();}ripples=ripples.filter(r=>r.life>0);
    for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;ctx.fillStyle=`rgba(255,222,164,${Math.max(0,p.life/1.6)})`;ctx.beginPath();ctx.arc(p.x*width,p.y*height,1.8,0,TAU);ctx.fill();}particles=particles.filter(p=>p.life>0);
    if(mode==='arrival'){ctx.fillStyle=`rgba(231,185,126,${Math.min(.09,endingTime*.009)})`;ctx.fillRect(0,0,width,height);}
  }
  function frame(ms){const dt=Math.min(.04,(ms-lastTime)/1000||0);lastTime=ms;time+=dt;update(dt);draw(reduced?dt*.35:dt);if(time>captionUntil)$('caption').classList.remove('visible');requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
  function setPointer(e){if(mode!=='playing')return;const r=canvas.getBoundingClientRect();pointer={x:clamp((e.clientX-r.left)/r.width,.065,.935),y:clamp((e.clientY-r.top)/r.height,.51,.82)};}
  canvas.tabIndex=0;canvas.addEventListener('pointerdown',e=>{if(mode!=='playing')return;canvas.setPointerCapture(e.pointerId);setPointer(e);});canvas.addEventListener('pointermove',e=>{if(pointer)setPointer(e);});for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,()=>{pointer=null;});
  $('shield-btn').addEventListener('pointerdown',e=>{if(mode!=='playing')return;e.preventDefault();shieldPointer=true;$('shield-btn').setPointerCapture(e.pointerId);updateHUD();});for(const ev of ['pointerup','pointercancel','lostpointercapture'])$('shield-btn').addEventListener(ev,()=>{shieldPointer=false;updateHUD();});
  addEventListener('keydown',e=>{
    if(e.code==='Tab'&&!$('overlay').hidden){const focusables=Array.from($('dialog').querySelectorAll('button,[href],input,select,textarea,[tabindex="0"]'));if(focusables.length){const first=focusables[0],last=focusables[focusables.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('dialog'))){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
    if((e.code==='Escape'||e.code==='KeyP')&&!e.repeat){if(mode==='paused')resume();else if(mode==='journal')$('journal-close')?.click();else pause();return;}
    if(mode==='playing'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD','Space'].includes(e.code)){if(e.code==='Space'&&document.activeElement?.tagName==='BUTTON'&&document.activeElement!==$('shield-btn'))return;e.preventDefault();keys[e.code]=true;}
  });
  addEventListener('keyup',e=>{keys[e.code]=false;});addEventListener('blur',()=>{clearInput();if(mode==='playing'||mode==='arrival')pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(mode==='playing'||mode==='arrival')pause();if(master)master.gain.setTargetAtTime(0,audio.currentTime,.1);}else if(master&&sound)master.gain.setTargetAtTime(.6,audio.currentTime,.2);});
  // Feature-detected tools expose the same journey state and controls as the UI.
  const modelContext=document.modelContext;
  if(modelContext?.registerTool){
    const lifecycle=new AbortController();
    const readState=()=>({mode,memoriesCollected:choices.length,chapter:Math.min(3,Math.floor(segment/2)+1),light:Math.ceil(light),gentle,choices:choices.slice()});
    const register=tool=>{try{Promise.resolve(modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
    register({name:'read_journey',title:'读取夜航状态',description:'Read current chapter, lantern strength, pause state, and memory choices.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:readState});
    register({name:'set_journey_paused',title:'暂停或继续夜航',description:'Pause or resume active sailing, using the visible pause dialog.',inputSchema:{type:'object',properties:{paused:{type:'boolean'}},required:['paused'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!input||typeof input.paused!=='boolean')throw new Error('paused must be a boolean');if(input.paused){if(!['playing','arrival','paused'].includes(mode))throw new Error('Sailing is not active');if(mode!=='paused')pause();}else{if(mode!=='paused')throw new Error('The journey is not paused');resume();}return readState();}});
    register({name:'choose_memory_light',title:'选择记忆的光',description:'Choose keep or guide for the currently open memory. This saves the player choice and opens its response.',inputSchema:{type:'object',properties:{choice:{type:'string',enum:['keep','guide']}},required:['choice'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!input||!['keep','guide'].includes(input.choice))throw new Error('choice must be keep or guide');if(mode!=='memory'||dialogKind!=='memory')throw new Error('No memory choice is open');chooseMemory(input.choice);return readState();}});
    addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  }
})();
