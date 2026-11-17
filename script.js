const $=id=>document.getElementById(id);
let phase="ready",currentHalf=0,duration=45,remaining=0;
let extraSeconds=0,extraRemaining=0,running=false,paused=false,interval=null;
let homeScore=0,awayScore=0;
const players=new Map();
const rosters={home:[],away:[]};

const awayPositions=[
[50,8],[22,17],[40,17],[60,17],[78,17],
[25,29],[42,29],[58,29],[75,29],[38,40],[62,40]
];
const homePositions=awayPositions.map(([x,y])=>[x,100-y]);

function whistle(){
 const a=$("whistleAudio").cloneNode();
 a.play().catch(()=>{});
}
function getDuration(){
 let n=parseInt($("durationInput").value,10);
 if(!Number.isFinite(n))n=45;
 return Math.max(1,Math.min(45,n));
}
function formatTime(s){
 return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
}
function calculateExtraTime(){
 return Math.floor(Math.random()*Math.floor(duration*60*.2222))+1;
}
function currentMatchTime(){
 if(!currentHalf)return "PREPARTIDO";
 const prefix=currentHalf===1?"1T ":"2T ";
 if(phase==="break"||phase==="finished")return prefix+duration+"+"+formatTime(extraSeconds);
 if(remaining>0)return prefix+formatTime(duration*60-remaining);
 return prefix+duration+"+"+formatTime(extraSeconds-extraRemaining);
}
function addEvent(message,time=null){
 const box=$("events"),empty=box.querySelector(".small");
 if(empty)empty.remove();
 const item=document.createElement("div");
 item.className="event";
 const stamp=document.createElement("strong");
 stamp.textContent=time||currentMatchTime();
 const desc=document.createElement("span");
 desc.textContent=" — "+message;
 item.append(stamp,desc);
 box.prepend(item);
}
function teamName(team){
 return $(team==="home"?"homeName":"awayName").value.trim()||(team==="home"?"LOCAL":"VISITANTE");
}
function updateHeadings(){
 $("homeHeading").textContent=teamName("home");
 $("awayHeading").textContent=teamName("away");
}
$("homeName").addEventListener("input",()=>{updateHeadings();renderPitch()});
$("awayName").addEventListener("input",()=>{updateHeadings();renderPitch()});

function buildRoster(team){
 let count=parseInt($(team+"Count").value,10);
 if(!Number.isFinite(count))count=11;
 count=Math.max(1,Math.min(30,count));
 $(team+"Count").value=count;
 if(rosters[team].length&&!confirm("¿Recrear esta plantilla? Se perderán sus nombres y posiciones."))return;
 rosters[team].forEach(oldPlayer=>players.delete(oldPlayer.id));
 updateCardRegister();
 // Si hay más de 3 jugadores, deja al menos uno como suplente.
 // Con 1, 2 o 3 jugadores, todos comienzan como titulares.
 const initialStarters=count>3?Math.min(11,count-1):count;
 rosters[team]=Array.from({length:count},(_,i)=>({
  id:team+"_"+i+"_"+Date.now(),
  name:"Jugador "+(i+1),starter:i<initialStarters,expelled:false,number:i+1,
  x:awayPositions[i%11][0],y:team==="away"?awayPositions[i%11][1]:homePositions[i%11][1]
 }));
 renderRoster(team);renderPitch();updateSubOptions();
}
function renderRoster(team){
 const box=$(team+"Roster");box.replaceChildren();
 rosters[team].forEach((p,i)=>{
  const row=document.createElement("div");row.className="player-row";
  const check=document.createElement("input");
  check.type="checkbox";check.checked=p.starter;check.disabled=p.expelled;
  check.addEventListener("change",()=>{
   if(check.checked&&rosters[team].filter(x=>x.starter&&!x.expelled).length>=11){
    check.checked=false;alert("Máximo 11 titulares.");return;
   }
   p.starter=check.checked;renderRosterInfo(team);renderPitch();updateSubOptions();
  });
  const name=document.createElement("input");name.type="text";name.value=p.name;
  name.addEventListener("change",()=>{
   const old=p.name;p.name=name.value.trim()||"Jugador "+(i+1);
   const card=players.get(p.id);if(card)card.name=p.name;
   updateCardRegister();renderPitch();updateSubOptions();renderCardOptions();
  });
  const badge=document.createElement("span");badge.className="badge";
  badge.textContent=p.expelled?"EXPULSADO":p.starter?"TITULAR":"SUPLENTE";
  row.append(check,name,badge);box.append(row);
 });
 renderRosterInfo(team);
 renderCardOptions();
}
function renderRosterInfo(team){
 const list=rosters[team];
 $(team+"RosterInfo").textContent=
 "En cancha: "+list.filter(p=>p.starter&&!p.expelled).length+
 " | Suplentes: "+list.filter(p=>!p.starter&&!p.expelled).length+
 " | Expulsados: "+list.filter(p=>p.expelled).length;
}
// CANCHA Y MOVIMIENTO
function renderPitch(){
 const box=$("pitchPlayers");box.replaceChildren();
 for(const team of ["away","home"]){
  rosters[team].filter(p=>p.starter&&!p.expelled).forEach(p=>{
   const token=document.createElement("div");
   token.className="pitch-player "+(team==="away"?"away":"");
   token.style.left=p.x+"%";token.style.top=p.y+"%";
   token.dataset.id=p.id;token.dataset.team=team;
   const number=document.createElement("span");
   number.className="number";number.textContent=p.number+". ";
   const name=document.createElement("span");name.textContent=p.name;
   token.append(number,name);
   token.title=p.name+" — arrastra para mover";
   box.append(token);
   enableDrag(token,p);
  });
 }
}

function enableDrag(element,player){
 let dragging=false;
 const wrap=$("pitchWrap");
 element.addEventListener("pointerdown",e=>{
  e.preventDefault();
  dragging=true;element.classList.add("dragging");
  element.setPointerCapture(e.pointerId);
 });
 element.addEventListener("pointermove",e=>{
  if(!dragging)return;
  const rect=wrap.getBoundingClientRect();
  let x=(e.clientX-rect.left)/rect.width*100;
  let y=(e.clientY-rect.top)/rect.height*100;
  x=Math.max(2,Math.min(98,x));
  y=Math.max(1,Math.min(99,y));
  player.x=x;player.y=y;
  element.style.left=x+"%";element.style.top=y+"%";
 });
 function stop(){
  if(!dragging)return;
  dragging=false;element.classList.remove("dragging");
 }
 element.addEventListener("pointerup",stop);
 element.addEventListener("pointercancel",stop);
}

function resetPositions(){
 for(const team of ["home","away"]){
  rosters[team].forEach(p=>{
   const pos=(team==="home"?homePositions:awayPositions)[(p.number-1)%11];
   p.x=pos[0];p.y=pos[1];
  });
 }
 renderPitch();
}

function updateSubOptions(){
 const team=$("subTeam").value,out=$("playerOut"),inside=$("playerIn");
 out.replaceChildren();inside.replaceChildren();
 const starters=rosters[team].filter(p=>p.starter&&!p.expelled);
 const bench=rosters[team].filter(p=>!p.starter&&!p.expelled);
 starters.forEach(p=>out.add(new Option(p.name,p.id)));
 bench.forEach(p=>inside.add(new Option(p.name,p.id)));
 if(!starters.length)out.add(new Option("No hay titulares",""));
 if(!bench.length)inside.add(new Option("No hay suplentes",""));
}
function makeSubstitution(){
 const team=$("subTeam").value;
 const outgoing=rosters[team].find(p=>p.id===$("playerOut").value);
 const incoming=rosters[team].find(p=>p.id===$("playerIn").value);
 if(!outgoing||!incoming||!outgoing.starter||incoming.starter||outgoing.expelled||incoming.expelled){
  alert("Selecciona correctamente los jugadores.");return;
 }
 outgoing.starter=false;incoming.starter=true;
 incoming.x=outgoing.x;incoming.y=outgoing.y;
 addEvent("🔄 CAMBIO de "+teamName(team)+": sale "+outgoing.name+" y entra "+incoming.name);
 whistle();renderRoster(team);renderPitch();updateSubOptions();
}

function startHalf(n){
 currentHalf=n;duration=getDuration();$("durationInput").value=duration;
 remaining=duration*60;extraSeconds=calculateExtraTime();extraRemaining=extraSeconds;
 phase=n===1?"first":"second";paused=false;running=true;
 addEvent("Inicio del "+(n===1?"primer":"segundo")+" tiempo");
 whistle();updateDisplay();interval=setInterval(tick,1000);
}
function startMatch(){
 if(phase==="ready")startHalf(1);
 else if(phase==="break")startHalf(2);
}
function tick(){
 if(!running||paused)return;
 if(remaining>0)remaining--;else if(extraRemaining>0)extraRemaining--;
 updateDisplay();if(remaining===0&&extraRemaining===0)endHalf();
}
function endHalf(){
 clearInterval(interval);interval=null;running=false;paused=false;
 const n=currentHalf;
 addEvent(n===1?"Final del primer tiempo":"Final del segundo tiempo",
 (n===1?"1T ":"2T ")+duration+"+"+formatTime(extraSeconds));
 whistle();phase=n===1?"break":"finished";updateDisplay();
}
function togglePause(){
 if(phase!=="first"&&phase!=="second")return;
 paused=!paused;updateDisplay();addEvent(paused?"Partido pausado":"Partido reanudado");
}
function manualWhistle(){whistle();addEvent("Silbato manual")}
function changeScore(team,amount){
 if(team==="home")homeScore=Math.max(0,homeScore+amount);
 else awayScore=Math.max(0,awayScore+amount);
 if(amount>0){whistle();addEvent("⚽ GOL de "+teamName(team))}
 updateDisplay();
}
function renderCardOptions(){
 const team=$("playerTeam").value,select=$("cardPlayer");
 if(!select)return;
 const previous=select.value;
 select.replaceChildren();
 const eligible=rosters[team].filter(p=>!p.expelled);
 if(!eligible.length){
  select.add(new Option("No hay jugadores disponibles",""));
  return;
 }
 eligible.forEach(p=>{
  const status=p.starter?"TITULAR":"SUPLENTE";
  select.add(new Option(p.number+". "+p.name+" — "+status,p.id));
 });
 if(eligible.some(p=>p.id===previous))select.value=previous;
}
function giveCard(type){
 const team=$("playerTeam").value;
 const p=rosters[team].find(x=>x.id===$("cardPlayer").value);
 if(!p){alert("Selecciona un jugador de la plantilla.");return}
 if(p.expelled){alert(p.name+" ya está expulsado.");renderCardOptions();return}
 let card=players.get(p.id);
 if(!card){
  card={playerId:p.id,name:p.name,team,teamName:teamName(team),yellows:0,red:false,expelled:false};
  players.set(p.id,card);
 }
 card.name=p.name;
 card.teamName=teamName(team);
 whistle();
 if(type==="yellow"){
  card.yellows++;
  if(card.yellows===1){
   addEvent("🟨 Amarilla para "+p.name+" ("+teamName(team)+")");
  }else if(card.yellows===2){
   card.red=true;card.expelled=true;
   addEvent("🟨🟨 SEGUNDA AMARILLA + 🟥 ROJA. "+p.name+" ("+teamName(team)+") EXPULSADO");
  }
 }else{
  card.red=true;card.expelled=true;
  addEvent("🟥 ROJA DIRECTA para "+p.name+" ("+teamName(team)+"). EXPULSADO");
 }
 if(card.expelled){
  p.expelled=true;
  p.starter=false;
  renderRoster(team);
  renderPitch();
  updateSubOptions();
 }
 updateCardRegister();
 renderCardOptions();
}
function updateCardRegister(){
 const box=$("cardRegister");box.replaceChildren();
 if(!players.size){box.textContent="Todavía no hay tarjetas.";box.className="small";return}
 box.className="";
 for(const p of players.values()){
  const row=document.createElement("div");row.className="card-player";
  row.textContent=p.name+" — "+p.teamName+" | 🟨 "+p.yellows+" | 🟥 "+(p.red?1:0)+(p.expelled?" | EXPULSADO":"");
  box.append(row);
 }
}
function updateDisplay(){
 $("homeScore").textContent=homeScore;$("awayScore").textContent=awayScore;
 $("clock").textContent=currentHalf===0?"00:00":remaining>0?formatTime(duration*60-remaining):duration+"+"+formatTime(extraSeconds-extraRemaining);
 $("status").textContent={ready:"PREPARADO",first:paused?"PRIMER TIEMPO · PAUSADO":"PRIMER TIEMPO",break:"DESCANSO",second:paused?"SEGUNDO TIEMPO · PAUSADO":"SEGUNDO TIEMPO",finished:"🏁 PARTIDO TERMINADO"}[phase];
 $("extraBanner").textContent=(currentHalf>0&&(phase==="first"||phase==="second")&&remaining===0)?"TIEMPO AÑADIDO: +"+formatTime(extraSeconds):"";
 $("pauseBtn").disabled=!(phase==="first"||phase==="second");
 $("pauseBtn").textContent=paused?"▶ REANUDAR":"⏸ PAUSAR";
 $("startBtn").disabled=running||phase==="finished";
 $("startBtn").textContent=phase==="ready"?"▶ INICIAR PARTIDO":phase==="break"?"▶ INICIAR 2.º TIEMPO":phase==="finished"?"PARTIDO TERMINADO":"PARTIDO EN JUEGO";
}
function resetMatch(){
 if(!confirm("¿Reiniciar el partido, marcador y tarjetas?"))return;
 clearInterval(interval);interval=null;
 phase="ready";currentHalf=0;duration=getDuration();remaining=0;
 extraSeconds=0;extraRemaining=0;running=false;paused=false;
 homeScore=0;awayScore=0;players.clear();
 $("events").innerHTML='<div class="small">Todavía no hay eventos.</div>';
 updateCardRegister();updateDisplay();
}

$("durationInput").addEventListener("change",()=>{
 if(phase==="ready"){$("durationInput").value=getDuration();updateDisplay()}
});

buildRoster("home");buildRoster("away");
updateHeadings();renderCardOptions();updateCardRegister();updateDisplay();

/* ===== MODULOS EXTRA ARBITRO PRO 2026 ===== */
(()=>{
 const $x=id=>document.getElementById(id);
 const STORAGE_KEY="arbitroPro2026State_v2";
 let extraDuration=15,shoot={home:0,away:0,homeTaken:0,awayTaken:0},shootActive=false;
 let stats={},undoStack=[],restoring=false;
 const safe=(v)=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
 function allPlayers(){return [...rosters.home.map(p=>({...p,team:"home"})),...rosters.away.map(p=>({...p,team:"away"}))]}
 function snapshot(){
  return JSON.parse(JSON.stringify({phase,currentHalf,duration,remaining,extraSeconds,extraRemaining,running,paused,homeScore,awayScore,
   rosters:{home:rosters.home,away:rosters.away},players:[...players.entries()],events:$x("events").innerHTML,
   stats,shoot,shootActive,extraDuration,cardRegister:$x("cardRegister").innerHTML}));
 }
 function restore(s){
  restoring=true;clearInterval(interval);interval=null;
  phase=s.phase;currentHalf=s.currentHalf;duration=s.duration;remaining=s.remaining;extraSeconds=s.extraSeconds;
  extraRemaining=s.extraRemaining;running=false;paused=s.paused;homeScore=s.homeScore;awayScore=s.awayScore;
  rosters.home=s.rosters.home||[];rosters.away=s.rosters.away||[];
  players.clear();(s.players||[]).forEach(([k,v])=>players.set(k,v));
  stats=s.stats||{};shoot=s.shoot||shoot;shootActive=!!s.shootActive;extraDuration=s.extraDuration||15;
  $x("events").innerHTML=s.events||'<div class="small">Todavía no hay eventos.</div>';
  $x("cardRegister").innerHTML=s.cardRegister||"Todavía no hay tarjetas.";
  $x("extraDuration").value=extraDuration;$x("shootHome").textContent=shoot.home;$x("shootAway").textContent=shoot.away;
  $x("shootoutBox").hidden=!shootActive;
  renderRoster("home");renderRoster("away");renderPitch();updateSubOptions();renderCardOptions();
  updateDisplay();
  if(s.running&&!s.paused&&(phase==="first"||phase==="second")){running=true;interval=setInterval(tick,1000)}
  restoring=false;save();
 }
 function save(){
  if(restoring)return;
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(snapshot()));$x("saveStatus").textContent="✓ Partido guardado automáticamente en este dispositivo."}
  catch(e){$x("saveStatus").textContent="No se pudo guardar automáticamente en este navegador."}
 }
 function beforeAction(){undoStack.push(snapshot());if(undoStack.length>40)undoStack.shift()}
 window.undoAction=function(){if(!undoStack.length){alert("No hay acciones recientes para deshacer.");return}const s=undoStack.pop();restore(s);addEvent("↶ Se deshizo la última acción");save()};
 const wrap=(name)=>{const original=window[name];if(typeof original!=="function")return;window[name]=function(...args){beforeAction();const result=original.apply(this,args);save();return result}};
 ["changeScore","giveCard","makeSubstitution","resetMatch"].forEach(wrap);
 window.addEvent=function(message,time=null){
  const box=$x("events"),empty=box.querySelector(".small");if(empty)empty.remove();
  const item=document.createElement("div");item.className="event";
  const stamp=document.createElement("strong");stamp.textContent=time||window.currentMatchTime();
  const desc=document.createElement("span");desc.textContent=" — "+message;item.append(stamp,desc);box.prepend(item);save();
 };
 window.currentMatchTime=function(){
  if(!currentHalf)return "PREPARTIDO";
  if(currentHalf===3||currentHalf===4)return (currentHalf===3?"PRÓRROGA 1 ":"PRÓRROGA 2 ")+(remaining>0?formatTime(extraDuration*60-remaining):extraDuration+"+");
  return (currentHalf===1?"1T ":"2T ")+(remaining>0?formatTime(duration*60-remaining):duration+"+"+formatTime(extraSeconds-extraRemaining));
 };
 const oldUpdate=window.updateDisplay;
 window.updateDisplay=function(){oldUpdate();if(currentHalf===3||currentHalf===4){$x("clock").textContent=remaining>0?formatTime(extraDuration*60-remaining):formatTime(extraDuration*60);$x("status").textContent=(currentHalf===3?"PRÓRROGA · PRIMER TIEMPO":"PRÓRROGA · SEGUNDO TIEMPO")+(paused?" · PAUSADO":"");$x("extraBanner").textContent="TIEMPO EXTRA";$x("startBtn").disabled=true;$x("pauseBtn").disabled=false;$x("pauseBtn").textContent=paused?"▶ REANUDAR":"⏸ PAUSAR"}};
 const oldEnd=window.endHalf;
 window.endHalf=function(){
  if(currentHalf===3){clearInterval(interval);interval=null;running=false;paused=false;phase="extraBreak";addEvent("Final de la primera parte de la prórroga");whistle();updateDisplay();$x("extraSecondBtn").disabled=false;save();return}
  if(currentHalf===4){clearInterval(interval);interval=null;running=false;paused=false;phase="finished";addEvent("Final de la prórroga");whistle();updateDisplay();save();return}
  oldEnd();save();
 };
 window.startExtraHalf=function(n){
  if(phase!=="finished"&&phase!=="extraBreak"){alert("La prórroga se habilita cuando termina el segundo tiempo.");return}
  if(n===4&&phase!=="extraBreak"){alert("Primero debe terminar el primer tiempo extra.");return}
  beforeAction();extraDuration=Math.max(1,Math.min(30,parseInt($x("extraDuration").value,10)||15));
  currentHalf=n;duration=extraDuration;remaining=duration*60;extraSeconds=0;extraRemaining=0;
  phase=n===3?"first":"second";running=true;paused=false;
  addEvent(n===3?"Inicio de la prórroga — primer tiempo":"Inicio de la prórroga — segundo tiempo");
  whistle();updateDisplay();clearInterval(interval);interval=setInterval(tick,1000);
  $x("extraStartBtn").disabled=true;$x("extraSecondBtn").disabled=n!==3;save();
 };
 window.togglePause=function(){
  if(currentHalf===3||currentHalf===4){paused=!paused;updateDisplay();addEvent(paused?"Prórroga pausada":"Prórroga reanudada");save();return}
  const old=window.__oldTogglePause;if(old)old();
 };
 // Preserve original pause handler for normal periods.
 const originalPause=window.togglePause;
 window.togglePause=function(){
  if(currentHalf===3||currentHalf===4){beforeAction();paused=!paused;updateDisplay();addEvent(paused?"Prórroga pausada":"Prórroga reanudada");save();return}
  const p=window.__pauseOriginal;if(p)p();
 };
 window.__pauseOriginal=window.__pauseOriginal||(()=>{paused=!paused;updateDisplay();addEvent(paused?"Partido pausado":"Partido reanudado")});
 // Rebuild normal pause behavior without depending on inline-handler reassignment.
 window.togglePause=function(){
  if(currentHalf===3||currentHalf===4){beforeAction();paused=!paused;updateDisplay();addEvent(paused?"Prórroga pausada":"Prórroga reanudada");save();return}
  beforeAction();paused=!paused;updateDisplay();addEvent(paused?"Partido pausado":"Partido reanudado");save();
 };
 window.toggleShootout=function(){beforeAction();shootActive=!shootActive;$x("shootoutBox").hidden=!shootActive;$x("shootHomeName").textContent=teamName("home");$x("shootAwayName").textContent=teamName("away");addEvent(shootActive?"Inicio de la tanda de penaltis":"Se cerró el panel de penaltis");save()};
 window.shootPenalty=function(team,scored){beforeAction();shoot[team+"Taken"]++;if(scored)shoot[team]++;$x("shootHome").textContent=shoot.home;$x("shootAway").textContent=shoot.away;addEvent("Penalti de "+teamName(team)+": "+(scored?"GOL":"FALLADO")+" ("+shoot[team]+" / "+shoot[team+"Taken"]+")");if(navigator.vibrate)navigator.vibrate(scored?100:[70,40,70]);save()};
 function refreshSelect(id,team,includeEmpty){const sel=$x(id),prev=sel.value;sel.replaceChildren();if(includeEmpty)sel.add(new Option("Sin seleccionar",""));rosters[team].forEach(p=>{if(!p.expelled)sel.add(new Option(p.number+". "+p.name,p.id))});if([...sel.options].some(o=>o.value===prev))sel.value=prev}
 window.refreshStatPlayers=function(){const t=$x("statTeam").value;["statPlayer","goalScorer","goalAssist","injuryPlayer"].forEach(id=>refreshSelect(id,t,id==="goalAssist"));};
 window.recordGoal=function(){
  const id=$x("goalScorer").value,p=allPlayers().find(x=>x.id===id);if(!p){alert("Selecciona al goleador.");return}
  beforeAction();const team=p.team;homeOrAwayScore(team,1);stats[id]??={goals:0,assists:0,injuries:0};stats[id].goals++;
  const aid=$x("goalAssist").value,a=allPlayers().find(x=>x.id===aid);
  if(a&&a.id!==id){stats[aid]??={goals:0,assists:0,injuries:0};stats[aid].assists++}
  addEvent("⚽ GOL de "+p.name+" ("+teamName(team)+")"+(a&&a.id!==id?" — asistencia: "+a.name:""));
  whistle();updateDisplay();renderStats();vibrate(120);save();
 };
 function homeOrAwayScore(team,n){if(team==="home")homeScore=Math.max(0,homeScore+n);else awayScore=Math.max(0,awayScore+n)}
 window.recordInjury=function(){const p=allPlayers().find(x=>x.id===$x("injuryPlayer").value);if(!p){alert("Selecciona un jugador.");return}beforeAction();stats[p.id]??={goals:0,assists:0,injuries:0};stats[p.id].injuries++;addEvent("🩹 Atención por lesión: "+p.name+" ("+teamName(p.team)+")");vibrate([70,40,70]);renderStats();save()};
 window.quickEvent=function(name){beforeAction();addEvent("⚡ "+name);if(name.includes("Lesión"))vibrate([70,40,70]);save()};
 window.recordVAR=function(){
  beforeAction();const reason=$x("varReason").value,decision=$x("varDecision").value,team=$x("varTeam").value;
  if(decision==="Gol anulado"){if(team==="home"&&homeScore>0)homeScore--;else if(team==="away"&&awayScore>0)awayScore--;else alert("No hay un gol en ese marcador para anular. La revisión quedará registrada igualmente.")}
  addEvent("📺 VAR — "+reason+" — "+decision+" ("+teamName(team)+")");
  updateDisplay();vibrate([80,50,80]);save();
 };
 function renderStats(){
  const box=$x("individualStats");box.replaceChildren();
  allPlayers().forEach(p=>{const s=stats[p.id]||{goals:0,assists:0,injuries:0};const row=document.createElement("div");row.className="event";row.textContent=p.number+". "+p.name+" ("+teamName(p.team)+") — ⚽ "+s.goals+" goles · 🎯 "+s.assists+" asistencias · 🩹 "+s.injuries+" lesiones";box.append(row)});
 }
 function vibrate(pattern){try{if(navigator.vibrate)navigator.vibrate(pattern)}catch(e){}}
 window.toggleTheme=function(){document.body.classList.toggle("light-theme");localStorage.setItem("arbitroProTheme",document.body.classList.contains("light-theme")?"light":"dark")};
 window.toggleFullscreen=function(){if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>{});else document.exitFullscreen?.()};
 function reportText(){
  const lines=["INFORME ARBITRAL — ÁRBITRO PRO 2026","Partido: "+teamName("home")+" "+homeScore+" - "+awayScore+" "+teamName("away"),"Estado: "+$x("status").textContent,"","ESTADÍSTICAS INDIVIDUALES"];
  allPlayers().forEach(p=>{const s=stats[p.id]||{goals:0,assists:0,injuries:0};lines.push(p.number+". "+p.name+" ("+teamName(p.team)+") — goles: "+s.goals+", asistencias: "+s.assists+", lesiones: "+s.injuries+(p.expelled?", EXPULSADO":""))});
  lines.push("","TANDA DE PENALES: "+shoot.home+" - "+shoot.away,"","CRONOLOGÍA");
  [...$x("events").querySelectorAll(".event")].reverse().forEach(e=>lines.push(e.innerText));
  lines.push("","TARJETAS", $x("cardRegister").innerText);
  return lines.join("\n");
 }
 window.showMatchReport=function(){const box=$x("reportOutput");box.hidden=false;box.textContent=reportText()};
 window.exportMatchReport=function(){window.showMatchReport();window.print();};
 // Dorsales editables en la lista de cada equipo.
 const oldRenderRoster=window.renderRoster;
 window.renderRoster=function(team){oldRenderRoster(team);const rows=$x(team+"Roster").querySelectorAll(".player-row");rosters[team].forEach((p,i)=>{const row=rows[i];if(!row)return;const num=document.createElement("input");num.type="number";num.min="1";num.max="99";num.value=p.number;num.title="Dorsal";num.style.width="58px";num.addEventListener("change",()=>{p.number=Math.max(1,Math.min(99,parseInt(num.value,10)||1));num.value=p.number;renderPitch();refreshStatPlayers();save()});row.insertBefore(num,row.children[1])})};
 // Guardar cambios al editar nombres, equipos o duración.
 document.addEventListener("input",e=>{if(e.target.matches("input,select"))save()});
 document.addEventListener("change",e=>{if(e.target.matches("input,select"))save()});
 document.addEventListener("visibilitychange",()=>{if(document.hidden)save()});
 window.addEventListener("beforeunload",save);
 const theme=localStorage.getItem("arbitroProTheme");if(theme==="light")document.body.classList.add("light-theme");
 $x("extraDuration").addEventListener("change",()=>{extraDuration=Math.max(1,Math.min(30,parseInt($x("extraDuration").value,10)||15));$x("extraDuration").value=extraDuration;save()});
 refreshStatPlayers();renderStats();
 try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){const s=JSON.parse(raw);if(s&&s.rosters&&confirm("Se encontró un partido guardado. ¿Quieres recuperarlo?"))restore(s)}}catch(e){}
 setInterval(save,5000);
})();

/* ===== MODOS DE PARTIDO Y CONTROL DE SONIDO ===== */
(()=>{
 const byId=id=>document.getElementById(id);
 window.soundsEnabled=(()=>{try{return localStorage.getItem("arbitroProSounds")!=="off"}catch(e){return true}})();
 window.toggleSounds=function(){
  window.soundsEnabled=!window.soundsEnabled;
  try{localStorage.setItem("arbitroProSounds",window.soundsEnabled?"on":"off")}catch(e){}
  updateSoundButton();
  if(!window.soundsEnabled){
   const audio=byId("whistleAudio");
   if(audio){audio.pause();audio.currentTime=0}
  }
 };
 function updateSoundButton(){
  const b=byId("soundToggle");if(!b)return;
  b.textContent=window.soundsEnabled?"🔊 SONIDO ACTIVADO":"🔇 SONIDO SILENCIADO";
  b.classList.toggle("secondary",!window.soundsEnabled);
 }
 const originalWhistle=window.whistle;
 window.whistle=function(){if(window.soundsEnabled)originalWhistle()};
 window.setMatchMode=function(mode){
  const fast=mode==="fast";
  document.body.classList.toggle("fast-mode",fast);
  byId("modeDescription").textContent=fast
   ?"Fútbol rápido: registra goles con su autor, tarjetas, cambios y revisiones VAR. Oculta estadísticas y anotaciones secundarias."
   :"Fútbol normal: permite registrar goles, asistencias, tarjetas, cambios, lesiones, acciones y revisiones.";
  try{localStorage.setItem("arbitroProMatchMode",mode)}catch(e){}
 };
 function fillScorerSelectors(){
  for(const team of ["home","away"]){
   const select=byId(team+"GoalPlayer");if(!select)continue;
   const previous=select.value;select.replaceChildren(new Option("Selecciona jugador",""));
   rosters[team].forEach(p=>{if(!p.expelled)select.add(new Option(p.number+". "+p.name,p.id))});
   if([...select.options].some(o=>o.value===previous))select.value=previous;
  }
 }
 const originalBuild=window.buildRoster;
 window.buildRoster=function(team){originalBuild(team);fillScorerSelectors()};
 const originalRender=window.renderRoster;
 window.renderRoster=function(team){originalRender(team);fillScorerSelectors()};
 const originalGoal=window.recordGoal;
 window.registerScoreGoal=function(team){
  const playerId=byId(team+"GoalPlayer").value;
  if(!playerId){alert("Selecciona quién marcó el gol.");return}
  byId("statTeam").value=team;
  window.refreshStatPlayers();
  byId("goalScorer").value=playerId;
  originalGoal();
  fillScorerSelectors();
 };
 const mode=(()=>{try{return localStorage.getItem("arbitroProMatchMode")||"normal"}catch(e){return "normal"}})();
 byId("matchMode").value=mode;window.setMatchMode(mode);
 updateSoundButton();fillScorerSelectors();
})();
