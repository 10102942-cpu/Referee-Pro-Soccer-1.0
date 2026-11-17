/* ÁRBITRO PRO 2.0 · COLABORACIÓN DEL EQUIPO ARBITRAL */
(()=>{
 "use strict";
 const $=id=>document.getElementById(id);
 let peer=null,host=false,remote=false,roomPin="",roomCode="",connections=new Map(),members=new Map(),broadcastTimer=null,localAudioStream=null,voiceCalls=new Map(),voiceEnabled=false,micMuted=false,voiceReady=false;
 let lastApplied="",isApplying=false,readonlySaved=[];
 const roles={principal:"1.er árbitro · Principal",assistant1:"Asistente 1",assistant2:"Asistente 2",fourth:"4.º árbitro"};
 const status=(msg)=>{if($("crewStatus"))$("crewStatus").textContent=msg};
 const role=()=> $("crewRole").value;
 const displayName=()=> $("crewName").value.trim().slice(0,32)||roles[role()];
 const randomPin=()=>String(Math.floor(100000+Math.random()*900000));
 const randomRoomId=()=>"ap"+Array.from({length:6},()=> "0123456789abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random()*36)]).join("");
 function setButtons(connected){
  $("crewCreateBtn").disabled=!!peer;
  $("crewJoinBtn").disabled=!!peer;
  $("crewLeaveBtn").disabled=!peer;
  $("crewRole").disabled=!!peer;
  $("crewName").disabled=!!peer;
 }
 function setReadonly(on){
  if(on&&!remote)return;
  if(on){
   document.body.classList.add("crew-view-only");
   document.querySelectorAll("main>section:not(#crewPanel) button,main>section:not(#crewPanel) input,main>section:not(#crewPanel) select,main>section:not(#crewPanel) textarea").forEach(el=>{
    if(el.dataset.crewLock==="1")return;
    readonlySaved.push([el,el.disabled]);el.dataset.crewLock="1";el.disabled=true;
   });
  }else{
   document.body.classList.remove("crew-view-only");
   readonlySaved.forEach(([el,wasDisabled])=>{if(el&&el.isConnected){el.disabled=wasDisabled;delete el.dataset.crewLock}});
   readonlySaved=[];
  }
 }
 function setMembers(){
  const box=$("crewMembers");box.replaceChildren();
  const list=host?[{name:displayName(),role:"principal",id:roomCode,online:true},...Array.from(members.values())]:Array.from(members.values());
  if(!peer&&!remote){box.textContent="Solo este dispositivo.";return}
  list.forEach(m=>{
   const card=document.createElement("div");card.className="crew-member";
   const name=document.createElement("strong"),label=document.createElement("span");
   name.textContent=m.name||"Árbitro";label.textContent=roles[m.role]||m.role;
   const dot=document.createElement("span");dot.textContent="● Conectado";dot.style.color="#55e98a";
   card.append(name,label,dot);box.append(card);
  });
 }
 function updateReportPanel(){
  const joined=remote;
  $("crewReportBox").hidden=!joined;
  $("crewAssistantActions").hidden=!joined||!["assistant1","assistant2"].includes(role());
  $("crewFourthActions").hidden=!joined||role()!=="fourth";
 }
 function resetRoomUI(){
  $("crewRoomInfo").hidden=true;$("crewRoomCodeDisplay").textContent="—";$("crewPinDisplay").textContent="••••••";
  $("crewReportBox").hidden=true;setButtons(false);setReadonly(false);setMembers();
 }
 function makePeer(id){
  if(!window.Peer){status("No se pudo cargar PeerJS. Comprueba la conexión a Internet.");return null}
  try{const p=id?new Peer(id):new Peer();p.on("call",handleIncomingVoiceCall);return p}catch(e){status("No se pudo iniciar la conexión: "+e.message);return null}
 }
 function updateVoiceUI(){
  const panel=$("crewVoicePanel");if(!panel)return;
  panel.hidden=!voiceReady;
  $("crewVoiceStart").hidden=voiceEnabled;
  $("crewMicToggle").hidden=!voiceEnabled;
  $("crewVoiceStop").hidden=!voiceEnabled;
  $("crewMicToggle").textContent=micMuted?"🎙️ ACTIVAR MICRÓFONO":"🔇 SILENCIAR MICRÓFONO";
  $("crewVoiceStatus").textContent=!voiceEnabled?"Voz desactivada.":(micMuted?"Micrófono silenciado · puedes escuchar.":"Micrófono activo · conectado al equipo.");
 }
 function attachVoiceCall(call,direction){
  const id=call.peer,old=voiceCalls.get(id);
  if(old&&old.call!==call){try{old.call.close()}catch(e){}}
  voiceCalls.set(id,{call,direction});
  call.on("stream",stream=>{
   let audio=document.getElementById("crew-audio-"+id);
   if(!audio){audio=document.createElement("audio");audio.id="crew-audio-"+id;audio.autoplay=true;audio.playsInline=true;audio.style.position="fixed";audio.style.width="1px";audio.style.height="1px";audio.style.opacity="0";audio.style.pointerEvents="none";document.body.append(audio)}
   audio.srcObject=stream;audio.muted=false;audio.volume=1;const play=audio.play();if(play&&play.catch)play.catch(()=>{const unlock=$("crewAudioUnlock");if(unlock)unlock.hidden=false;status("Audio recibido. Pulsa ACTIVAR AUDIO DEL MÓVIL para escucharlo.");});
  });
  call.on("close",()=>{if(voiceCalls.get(id)?.call===call)voiceCalls.delete(id);const a=document.getElementById("crew-audio-"+id);if(a){a.srcObject=null;a.remove()}});
  call.on("error",()=>{if(voiceCalls.get(id)?.call===call)voiceCalls.delete(id)});
 }
 function handleIncomingVoiceCall(call){
  if(!peer||!voiceReady){try{call.close()}catch(e){}return}
  const current=voiceCalls.get(call.peer);
  if(current){try{current.call.close()}catch(e){}voiceCalls.delete(call.peer)}
  try{call.answer(localAudioStream||undefined);attachVoiceCall(call,"incoming")}catch(e){status("No se pudo abrir el audio: "+e.message)}
 }
 function syncVoiceCalls(){
  if(!peer||!voiceEnabled||!peer.id)return;
  const ids=host?Array.from(members.keys()):Array.from(members.values()).map(m=>m.id);
  ids.filter(id=>id&&id!==peer.id).forEach(id=>{
   const current=voiceCalls.get(id),localIsLower=String(peer.id).localeCompare(String(id))<0;
   if(current&&current.call.open&&!(current.direction==="incoming"&&localIsLower))return;
   if(current){try{current.call.close()}catch(e){}voiceCalls.delete(id)}
   try{const call=peer.call(id,localAudioStream,{metadata:{kind:"referee-voice"}});if(call)attachVoiceCall(call,"outgoing")}catch(e){}
  });
 }
 async function startVoice(){
  if(!peer||!voiceReady||voiceEnabled)return;
  if(!navigator.mediaDevices?.getUserMedia){status("El navegador no permite usar el micrófono. Abre la página mediante HTTPS.");return}
  try{
   localAudioStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
   voiceEnabled=true;micMuted=false;localAudioStream.getAudioTracks().forEach(t=>t.enabled=true);voiceCalls.forEach(x=>{try{x.call.close()}catch(e){}});voiceCalls.clear();updateVoiceUI();syncVoiceCalls();
   status("Chat de voz activado. Los demás árbitros también deben activar su micrófono para hablar.");
  }catch(e){status(e.name==="NotAllowedError"?"Permite el micrófono en los permisos del navegador.":"No se pudo activar el micrófono: "+(e.message||e.name))}
 }
 function unlockRemoteAudio(){
  document.querySelectorAll('[id^="crew-audio-"]').forEach(a=>{a.muted=false;a.volume=1;const p=a.play();if(p&&p.catch)p.catch(()=>{});});
  if($("crewAudioUnlock"))$("crewAudioUnlock").hidden=true;
  status("Audio del móvil activado.");
 }
 function toggleMic(){
  if(!localAudioStream)return;
  micMuted=!micMuted;localAudioStream.getAudioTracks().forEach(t=>t.enabled=!micMuted);updateVoiceUI();
 }
 function stopVoice(){
  voiceEnabled=false;micMuted=false;voiceCalls.forEach(x=>{try{x.call.close()}catch(e){}});voiceCalls.clear();
  if(localAudioStream){localAudioStream.getTracks().forEach(t=>t.stop());localAudioStream=null}
  document.querySelectorAll('[id^="crew-audio-"]').forEach(a=>{a.srcObject=null;a.remove()});updateVoiceUI();
 }
 function getMatchSnapshot(){
  const eventRows=[...$("events").querySelectorAll(".event")].map(row=>({time:row.querySelector("strong")?.textContent||"",text:row.querySelector("span")?.textContent||row.textContent||""}));
  const incidentRows=[...$("incidentHistory").querySelectorAll(".event")].map(row=>({time:row.querySelector("strong")?.textContent||"",text:row.querySelector("span")?.textContent||row.textContent||""}));
  const metrics=(()=>{try{return JSON.parse(localStorage.getItem("arbitroPro_matchMetrics_v1"))}catch(e){return null}})();
  const meta={};["competitionName","matchRound","matchDate","matchVenue","officialReferee","officialAssistant1","officialAssistant2","officialFourth"].forEach(id=>meta[id]=$(id).value);
  return {
   phase,currentHalf,duration,remaining,extraSeconds,extraRemaining,running,paused,homeScore,awayScore,
   rosters:{home:JSON.parse(JSON.stringify(rosters.home)),away:JSON.parse(JSON.stringify(rosters.away))},
   players:Array.from(players.entries()),events:eventRows,incidents:incidentRows,
   cards:[...$("cardRegister").querySelectorAll(".card-player")].map(x=>x.textContent),
   individual:[...$("individualStats").querySelectorAll(".event")].map(x=>x.textContent),
   metrics,meta,homeName:$("homeName").value,awayName:$("awayName").value,
   clock:$("clock").textContent,status:$("status").textContent,extraBanner:$("extraBanner").textContent,
   homeCount:$("homeCount").value,awayCount:$("awayCount").value,
   mode:$("matchMode").value,matchTime:typeof window.currentMatchTime==="function"?window.currentMatchTime():""
  };
 }
 function appendTextRows(container,rows){
  container.replaceChildren();
  if(!rows||!rows.length){const empty=document.createElement("div");empty.className="small";empty.textContent="Todavía no hay registros.";container.append(empty);return}
  rows.forEach(row=>{
   const item=document.createElement("div");item.className="event";
   const stamp=document.createElement("strong");stamp.textContent=row.time||"";
   const text=document.createElement("span");text.textContent=row.text||"";
   item.append(stamp,text);container.append(item);
  });
 }
 function applySnapshot(s){
  if(!s||isApplying)return;
  isApplying=true;lastApplied=String(Date.now());
  try{
   if(remote){clearInterval(interval);interval=null}
   phase=s.phase;currentHalf=s.currentHalf;duration=s.duration;remaining=s.remaining;extraSeconds=s.extraSeconds;extraRemaining=s.extraRemaining;running=s.running;paused=s.paused;
   homeScore=s.homeScore;awayScore=s.awayScore;
   rosters.home=s.rosters.home||[];rosters.away=s.rosters.away||[];
   players.clear();(s.players||[]).forEach(([id,p])=>players.set(id,p));
   $("homeName").value=s.homeName||"LOCAL";$("awayName").value=s.awayName||"VISITANTE";
   $("homeCount").value=s.homeCount||rosters.home.length;$("awayCount").value=s.awayCount||rosters.away.length;
   $("homeScore").textContent=homeScore;$("awayScore").textContent=awayScore;
   $("clock").textContent=s.clock||"00:00";$("status").textContent=s.status||"PREPARADO";$("extraBanner").textContent=s.extraBanner||"";
   if(s.meta)Object.entries(s.meta).forEach(([id,value])=>{if($(id))$(id).value=value||""});
   $("analyticsHomeName").textContent=$("homeName").value;$("analyticsAwayName").textContent=$("awayName").value;
   if(s.metrics){
    ["home","away"].forEach(team=>Object.entries(s.metrics[team]||{}).forEach(([key,value])=>{
     const id=team+key[0].toUpperCase()+key.slice(1);if($(id))$(id).textContent=value;
     if($(team+"Possession")&&key==="possession")$(team+"Possession").value=value;
    }));
    $("possessionBalance").textContent="Posesión estimada: "+s.metrics.home.possession+" % — "+s.metrics.away.possession+" %";
   }
   if(typeof renderRoster==="function"){renderRoster("home");renderRoster("away")}
   if(typeof renderPitch==="function")renderPitch();
   if(typeof updateHeadings==="function")updateHeadings();
   if(typeof updateSubOptions==="function")updateSubOptions();
   if(typeof renderCardOptions==="function")renderCardOptions();
   if(typeof updateDisplay==="function")updateDisplay();
   appendTextRows($("events"),s.events);
   $("cardRegister").replaceChildren();
   (s.cards||[]).forEach(text=>{const row=document.createElement("div");row.className="card-player";row.textContent=text;$("cardRegister").append(row)});
   if(!(s.cards||[]).length)$("cardRegister").textContent="Todavía no hay tarjetas.";
   appendTextRows($("individualStats"),s.individual);
   appendTextRows($("incidentHistory"),s.incidents);
   if($("modeDescription"))window.setMatchMode(s.mode||"normal");
   if(remote)setReadonly(true);
  }catch(e){status("No se pudo actualizar el partido compartido: "+e.message)}
  finally{isApplying=false}
 }
 function send(conn,data){try{if(conn&&conn.open)conn.send(data)}catch(e){}}
 function broadcast(type,payload){
  const packet={type,payload};
  connections.forEach(conn=>send(conn,packet));
 }
 function broadcastSnapshot(){if(host&&connections.size)broadcast("snapshot",getMatchSnapshot())}
 function updateCrewListPacket(){broadcast("members",[{id:roomCode,name:displayName(),role:"principal"},...Array.from(members.values())]);syncVoiceCalls()}
 function handleReport(packet,conn){
  if(!host||!packet||packet.type!=="report")return;
  const p=packet.payload||{},kind=String(p.kind||"Aviso").slice(0,60),who=String(p.name||"Árbitro").slice(0,32),roleName=roles[p.role]||"Equipo arbitral";
  const team=p.team==="home"||p.team==="away"?p.team:"none";
  const player=String(p.player||"").slice(0,40),detail=String(p.detail||"").slice(0,180);
  const teamLabel=team==="none"?"":(" · "+(team==="home"?teamName("home"):teamName("away")));
  const text="📡 "+roleName+" ("+who+") · "+kind+teamLabel+(player?" · "+player:"")+(detail?" · "+detail:"");
  if(typeof window.addEvent==="function")window.addEvent(text);
  if(team!=="none"&&typeof window.changeMatchStat==="function"){
   if(kind==="Falta observada")window.changeMatchStat(team,"fouls",1);
   if(kind==="Córner")window.changeMatchStat(team,"corners",1);
   if(kind==="Fuera de juego")window.changeMatchStat(team,"offsides",1);
  }
  send(conn,{type:"reportAck",payload:{ok:true,message:"Aviso recibido por el árbitro principal."}});
  broadcastSnapshot();
 }
 function addConnection(conn,metadata){
  conn.on("open",()=>{
   const m=metadata||conn.metadata||{};
   if(String(m.pin||"")!==roomPin){send(conn,{type:"rejected",payload:{message:"PIN incorrecto."}});setTimeout(()=>conn.close(),250);return}
   const currentRole=String(m.role||"assistant1");
   if(!["assistant1","assistant2","fourth"].includes(currentRole)){send(conn,{type:"rejected",payload:{message:"Solo pueden entrar los asistentes y el cuarto árbitro."}});setTimeout(()=>conn.close(),250);return}
   if(members.size>=3){send(conn,{type:"rejected",payload:{message:"La sala ya tiene los tres puestos de apoyo ocupados."}});setTimeout(()=>conn.close(),250);return}
   if([...members.values()].some(x=>x.role===currentRole)){send(conn,{type:"rejected",payload:{message:"Ese puesto ya está ocupado. Elige otra función."}});setTimeout(()=>conn.close(),250);return}
   const member={id:conn.peer,name:String(m.name||"Árbitro").slice(0,32),role:currentRole};
   members.set(conn.peer,member);connections.set(conn.peer,conn);
   const officialField=currentRole==="assistant1"?"officialAssistant1":currentRole==="assistant2"?"officialAssistant2":currentRole==="fourth"?"officialFourth":null;
   if(officialField&&$(officialField)&&!$(officialField).value.trim()){$(officialField).value=member.name;if(typeof window.saveMatchMetadata==="function")window.saveMatchMetadata()}
   send(conn,{type:"welcome",payload:{room:roomCode,role:currentRole}});
   send(conn,{type:"snapshot",payload:getMatchSnapshot()});
   updateCrewListPacket();status("Sala activa. "+members.size+" árbitro(s) de apoyo conectado(s).");
   conn.on("data",data=>handleReport(data,conn));
   conn.on("close",()=>{members.delete(conn.peer);connections.delete(conn.peer);updateCrewListPacket();status("Conexión actualizada. "+members.size+" árbitro(s) de apoyo conectado(s).")});
   conn.on("error",()=>{members.delete(conn.peer);connections.delete(conn.peer);updateCrewListPacket()});
  });
 }
 window.crewCreateRoom=function(){
  if(peer)return;
  $("crewRole").value="principal";$("crewRole").disabled=true;
  roomPin=randomPin();host=true;remote=false;
  if($("officialReferee")&&!$("officialReferee").value.trim()){$("officialReferee").value=displayName();if(typeof window.saveMatchMetadata==="function")window.saveMatchMetadata()}
  let attempts=0;
  const start=()=>{
   const candidate=randomRoomId();
   peer=makePeer(candidate);
   if(!peer){host=false;return}
   setButtons(true);status("Reservando código corto para la sala…");
   let opened=false;
   peer.on("open",id=>{
    opened=true;roomCode=id;
    $("crewRoomInfo").hidden=false;$("crewRoomCodeDisplay").textContent=id;$("crewPinDisplay").textContent=roomPin;
    $("crewRoomCode").value=id;$("crewPin").value=roomPin;
    setButtons(true);setMembers();voiceReady=true;updateVoiceUI();status("Sala lista. Comparte el código corto y el PIN.");
    broadcastTimer=setInterval(broadcastSnapshot,850);
   });
   peer.on("connection",conn=>addConnection(conn,conn.metadata));
   peer.on("error",err=>{
    if(!opened&&err.type==="unavailable-id"&&attempts++<8){
     try{peer.destroy()}catch(e){} peer=null;start();return;
    }
    status("Error de conexión: "+(err.type||err.message||"desconocido")+". Comprueba Internet y vuelve a crear la sala si persiste.");
    if(!opened)window.crewLeaveRoom();
   });
  };
  start();
 };
 window.crewJoinRoom=function(){
  if(peer)return;
  const code=$("crewRoomCode").value.trim().toLowerCase(),pin=$("crewPin").value.trim(),selected=role();
  if(!code||!/^[a-z0-9_-]{4,32}$/.test(code)||!/^[0-9]{6}$/.test(pin)){alert("Introduce el código corto de sala y el PIN de seis dígitos.");return}
  if(selected==="principal"){alert("Elige Asistente 1, Asistente 2 o 4.º árbitro para unirte.");return}
  peer=makePeer();if(!peer)return;
  remote=true;host=false;roomCode=code;roomPin=pin;setButtons(true);status("Conectando al servidor de señalización…");
  let conn=null,finished=false,timeout=null;
  const fail=(message)=>{
   if(finished)return;finished=true;if(timeout)clearTimeout(timeout);status(message);
   if(conn){try{conn.close()}catch(e){}}
   if(peer){try{peer.destroy()}catch(e){}}
   peer=null;remote=false;connections.clear();setButtons(false);updateReportPanel();setReadonly(false);
  };
  peer.on("open",()=>{
   status("Servidor conectado. Buscando la sala "+code+"…");
   conn=peer.connect(code,{reliable:true,metadata:{pin,name:displayName(),role:selected}});
   connections.set("host",conn);
   timeout=setTimeout(()=>{if(!conn.open)fail("No se pudo unir: la sala no respondió. Revisa el código y que el árbitro principal siga conectado.")},18000);
   conn.on("open",()=>{if(timeout)clearTimeout(timeout);setButtons(true);setReadonly(true);updateReportPanel();status("Canal conectado. Verificando acceso…")});
   conn.on("data",packet=>{
    if(packet.type==="rejected"){status(packet.payload?.message||"Acceso rechazado.");window.crewLeaveRoom();return}
    if(packet.type==="welcome"){finished=true;voiceReady=true;updateVoiceUI();status("¡Conectado! Tu función: "+(roles[selected]||selected));updateReportPanel()}
    if(packet.type==="snapshot")applySnapshot(packet.payload);
    if(packet.type==="members"){members.clear();(packet.payload||[]).forEach(m=>members.set(m.id,m));setMembers();syncVoiceCalls()}
    if(packet.type==="reportAck")status(packet.payload?.message||"Aviso enviado.");
    if(packet.type==="closed"){status("El árbitro principal cerró la sala.");window.crewLeaveRoom()}
   });
   conn.on("close",()=>{if(!finished)fail("Se cerró la conexión antes de completar el acceso. Comprueba que la sala siga activa.");else{status("Se perdió la conexión con la sala.");window.crewLeaveRoom()}});
   conn.on("error",()=>fail("No se pudo completar el canal de datos. Comprueba la red y vuelve a intentarlo."));
  });
  peer.on("error",err=>fail("No se pudo localizar la sala ("+(err.type||err.message||"error")+"). Comprueba el código, el PIN y la conexión a Internet."));
 };
 window.crewSendReport=function(kind){
  if(!remote||!connections.has("host"))return;
  const payload={kind,role:role(),name:displayName(),team:$("crewReportTeam").value,player:$("crewReportPlayer").value.trim(),detail:$("crewReportDetail").value.trim()};
  send(connections.get("host"),{type:"report",payload});
  status("Aviso enviado al árbitro principal: "+kind+".");
  $("crewReportDetail").value="";
 };
 window.crewCopyInvite=function(){
  const text="ÁRBITRO PRO · Sala: "+roomCode+" · PIN: "+roomPin;
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(()=>status("Invitación copiada.")).catch(()=>status("No se pudo copiar automáticamente; copia el código y PIN manualmente."));
  else status("Copia manualmente el código y el PIN.");
 };
 window.crewLeaveRoom=function(){
  stopVoice();voiceReady=false;updateVoiceUI();
  if(broadcastTimer){clearInterval(broadcastTimer);broadcastTimer=null}
  if(host)connections.forEach(conn=>{send(conn,{type:"closed",payload:{message:"El árbitro principal cerró la sala."}});conn.close()});
  connections.clear();members.clear();
  if(peer){try{peer.destroy()}catch(e){}}
  peer=null;host=false;remote=false;roomPin="";roomCode="";
  resetRoomUI();status("Modo individual: el partido sigue funcionando en este dispositivo.");
  updateReportPanel();setMembers();updateVoiceUI();
 };
 function init(){
  $("crewName").value="";
  $("crewRole").value="principal";
  $("crewRole").addEventListener("change",updateReportPanel);
  updateReportPanel();setButtons(false);setMembers();updateVoiceUI();
  $("crewVoiceStart").addEventListener("click",startVoice);
  if($("crewAudioUnlock"))$("crewAudioUnlock").addEventListener("click",unlockRemoteAudio);
  $("crewMicToggle").addEventListener("click",toggleMic);
  $("crewVoiceStop").addEventListener("click",stopVoice);
 }
 document.addEventListener("DOMContentLoaded",init);
 if(document.readyState!=="loading")init();
})();