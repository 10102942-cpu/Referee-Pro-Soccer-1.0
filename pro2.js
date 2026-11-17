/* ÁRBITRO PRO 2.0 · módulos de competición, base de datos y análisis */
(()=>{
 "use strict";
 const $=id=>document.getElementById(id);
 const TEAM_KEY="arbitroPro_teamDatabase_v1";
 const TOURNAMENT_KEY="arbitroPro_tournaments_v1";
 const META_KEY="arbitroPro_matchMetadata_v1";
 const METRICS_KEY="arbitroPro_matchMetrics_v1";
 let teams=readStore(TEAM_KEY,[]);
 let tournaments=readStore(TOURNAMENT_KEY,[]);
 let activeTournamentId="";
 let metrics=readStore(METRICS_KEY,{home:blankMetrics(),away:blankMetrics()});
 let metadata=readStore(META_KEY,{});
 function readStore(key,fallback){try{const v=JSON.parse(localStorage.getItem(key));return v??fallback}catch(e){return fallback}}
 function writeStore(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch(e){return false}}
 function uid(){return "ap2_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8)}
 function blankMetrics(){return {shots:0,onTarget:0,corners:0,fouls:0,offsides:0,possession:50}}
 function escapeText(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
 function say(id,msg){if($(id))$(id).textContent=msg}
 function safeTeamName(id){const t=teams.find(x=>x.id===id);return t?t.name:"Equipo"}
 function refreshTeamSelects(){
  ["dbTeamSelect","tournamentTeamSelect"].forEach(id=>{
   const el=$(id);if(!el)return;const prev=el.value;el.replaceChildren(new Option(id==="dbTeamSelect"?"Equipos guardados":"Selecciona un equipo",""));
   teams.forEach(t=>el.add(new Option(t.name,t.id)));
   if(teams.some(t=>t.id===prev))el.value=prev;
  });
 }
 function refreshTournamentSelect(){
  const el=$("tournamentSelect");if(!el)return;const prev=activeTournamentId||el.value;el.replaceChildren(new Option("Selecciona torneo",""));
  tournaments.forEach(t=>el.add(new Option(t.name,t.id)));if(tournaments.some(t=>t.id===prev))el.value=prev;
 }
 function activeTournament(){return tournaments.find(t=>t.id===activeTournamentId)||null}
 function refreshFixtureSelect(){
  const el=$("tournamentFixtureSelect");if(!el)return;const prev=el.value;el.replaceChildren(new Option("Selecciona un partido",""));
  const t=activeTournament();if(t)t.fixtures.forEach(f=>el.add(new Option("J"+f.round+" · "+safeTeamName(f.homeId)+" vs "+safeTeamName(f.awayId)+(f.played?" · "+f.homeGoals+"-"+f.awayGoals:" · Pendiente"),f.id)));
  if(t&&t.fixtures.some(f=>f.id===prev))el.value=prev;
 }
 window.saveMatchMetadata=function(){
  ["competitionName","matchRound","matchDate","matchVenue","officialReferee","officialAssistant1","officialAssistant2","officialFourth"].forEach(id=>metadata[id]=$(id).value);
  writeStore(META_KEY,metadata);say("metadataStatus","✓ Datos guardados en este dispositivo.");renderMetadata();
 };
 function renderMetadata(){
  Object.keys(metadata).forEach(id=>{if($(id)&&!$(id).value)$(id).value=metadata[id]||""});
 }
 window.saveTeamRecord=function(){
  const name=$("dbTeamName").value.trim();if(!name){alert("Escribe el nombre del equipo.");return}
  const lines=$("dbTeamPlayers").value.split(/\r?\n/).map((line,i)=>{
   const parts=line.split(",");const number=parseInt(parts[0],10);return {number:Number.isFinite(number)?Math.max(1,Math.min(99,number)):i+1,name:(Number.isFinite(number)?parts.slice(1).join(","):line).trim()||("Jugador "+(i+1))};
  }).filter(p=>p.name).slice(0,30);
  const selected=$("dbTeamSelect").value;
  const existing=teams.find(t=>t.id===selected);
  const record={id:existing?existing.id:uid(),name,short:$("dbTeamShort").value.trim(),coach:$("dbTeamCoach").value.trim(),color:$("dbTeamColor").value,players:lines};
  if(existing)teams=teams.map(t=>t.id===existing.id?record:t);else teams.push(record);
  writeStore(TEAM_KEY,teams);refreshTeamSelects();$("dbTeamSelect").value=record.id;
  say("teamDbStatus","✓ "+name+" guardado con "+lines.length+" jugadores.");
  renderTournament();
 };
 window.editTeamRecord=function(){
  const t=teams.find(x=>x.id===$("dbTeamSelect").value);if(!t){alert("Selecciona un equipo guardado.");return}
  $("dbTeamName").value=t.name;$("dbTeamShort").value=t.short||"";$("dbTeamCoach").value=t.coach||"";$("dbTeamColor").value=t.color||"#35e879";
  $("dbTeamPlayers").value=(t.players||[]).map(p=>p.number+", "+p.name).join("\n");
  say("teamDbStatus","Editando "+t.name+". Pulsa GUARDAR EQUIPO para aplicar los cambios.");
 };
 window.deleteTeamRecord=function(){
  const id=$("dbTeamSelect").value,t=teams.find(x=>x.id===id);if(!t){alert("Selecciona un equipo.");return}
  if(!confirm("¿Eliminar "+t.name+" de la base de datos? Los torneos existentes conservarán el nombre registrado."))return;
  teams=teams.filter(x=>x.id!==id);writeStore(TEAM_KEY,teams);refreshTeamSelects();say("teamDbStatus","Equipo eliminado.");
 };
 window.loadTeamIntoMatch=function(side){
  const t=teams.find(x=>x.id===$("dbTeamSelect").value);if(!t){alert("Selecciona un equipo guardado.");return}
  if(window.rosters&&rosters[side].length&&!confirm("¿Reemplazar la plantilla actual del "+(side==="home"?"local":"visitante")+"?"))return;
  const count=Math.max(1,Math.min(30,(t.players||[]).length||11));
  $(side+"Count").value=count;
  const oldConfirm=window.confirm;
  try{window.confirm=()=>true;window.buildRoster(side)}finally{window.confirm=oldConfirm}
  const list=rosters[side];
  (t.players||[]).forEach((p,i)=>{if(list[i]){list[i].name=p.name;list[i].number=p.number||i+1}});
  if($(side+"Name"))$(side+"Name").value=t.name;
  if(typeof renderRoster==="function")renderRoster(side);
  if(typeof renderPitch==="function")renderPitch();
  if(typeof updateHeadings==="function")updateHeadings();
  if(typeof updateSubOptions==="function")updateSubOptions();
  if(typeof renderCardOptions==="function")renderCardOptions();
  if(typeof refreshStatPlayers==="function")refreshStatPlayers();
  if(typeof fillScorerSelectors==="function")fillScorerSelectors();
  renderAnalyticsNames();say("teamDbStatus","✓ "+t.name+" cargado como "+(side==="home"?"local":"visitante")+".");
 };
 window.createTournament=function(){
  const name=$("tournamentName").value.trim();if(!name){alert("Escribe el nombre del torneo.");return}
  const t={id:uid(),name,teamIds:[],fixtures:[],createdAt:new Date().toISOString()};
  tournaments.push(t);activeTournamentId=t.id;writeStore(TOURNAMENT_KEY,tournaments);refreshTournamentSelect();$("tournamentSelect").value=t.id;renderTournament();say("tournamentStatus","✓ Torneo creado. Ahora agrega los equipos guardados.");
 };
 window.selectTournament=function(){
  const id=$("tournamentSelect").value;if(!id){alert("Selecciona un torneo.");return}
  activeTournamentId=id;const t=activeTournament();$("tournamentName").value=t.name;renderTournament();say("tournamentStatus","Torneo abierto: "+t.name);
 };
 window.deleteTournament=function(){
  const id=$("tournamentSelect").value||activeTournamentId,t=tournaments.find(x=>x.id===id);if(!t){alert("Selecciona un torneo.");return}
  if(!confirm("¿Eliminar el torneo "+t.name+" y su calendario?"))return;
  tournaments=tournaments.filter(x=>x.id!==id);activeTournamentId="";writeStore(TOURNAMENT_KEY,tournaments);refreshTournamentSelect();renderTournament();say("tournamentStatus","Torneo eliminado.");
 };
 window.addTournamentTeam=function(){
  const t=activeTournament(),id=$("tournamentTeamSelect").value,team=teams.find(x=>x.id===id);if(!t){alert("Primero crea o abre un torneo.");return}
  if(!team){alert("Selecciona un equipo de la base de datos.");return}
  if(t.teamIds.includes(id)){alert("Ese equipo ya está en el torneo.");return}
  if(t.fixtures.length){alert("No puedes modificar participantes después de generar el calendario. Elimina el calendario primero.");return}
  t.teamIds.push(id);writeStore(TOURNAMENT_KEY,tournaments);renderTournament();say("tournamentStatus",team.name+" agregado al torneo.");
 };
 window.generateTournamentFixtures=function(){
  const t=activeTournament();if(!t){alert("Primero crea o abre un torneo.");return}
  if(t.teamIds.length<2){alert("Agrega al menos dos equipos.");return}
  if(t.fixtures.length&&!confirm("¿Reemplazar el calendario actual? Se perderán los resultados guardados."))return;
  const ids=t.teamIds.slice();if(ids.length%2)ids.push(null);
  const n=ids.length,rounds=n-1,half=n/2,rotation=ids.slice();t.fixtures=[];
  for(let r=0;r<rounds;r++){
   for(let i=0;i<half;i++){
    const a=rotation[i],b=rotation[n-1-i];if(a&&b){const home=(r+i)%2===0?a:b,away=home===a?b:a;t.fixtures.push({id:uid(),round:r+1,homeId:home,awayId:away,played:false,homeGoals:null,awayGoals:null})}
   }
   rotation.splice(1,0,rotation.pop());
  }
  writeStore(TOURNAMENT_KEY,tournaments);renderTournament();say("tournamentStatus","✓ Calendario generado: "+t.fixtures.length+" partidos. Formato: una vuelta.");
 };
 function standings(t){
  const table={};t.teamIds.forEach(id=>table[id]={id,name:safeTeamName(id),played:0,w:0,d:0,l:0,gf:0,ga:0,pts:0});
  t.fixtures.filter(f=>f.played).forEach(f=>{
   const h=table[f.homeId],a=table[f.awayId];if(!h||!a)return;
   h.played++;a.played++;h.gf+=f.homeGoals;h.ga+=f.awayGoals;a.gf+=f.awayGoals;a.ga+=f.homeGoals;
   if(f.homeGoals>f.awayGoals){h.w++;h.pts+=3;a.l++}else if(f.homeGoals<f.awayGoals){a.w++;a.pts+=3;h.l++}else{h.d++;a.d++;h.pts++;a.pts++}
  });
  return Object.values(table).sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.name.localeCompare(b.name));
 }
 function renderTournament(){
  const t=activeTournament(),chips=$("tournamentTeams"),fixtures=$("tournamentFixtures"),body=$("tournamentStandings");if(!chips||!fixtures||!body)return;
  chips.replaceChildren();fixtures.replaceChildren();body.replaceChildren();
  if(!t){chips.textContent="Crea o abre un torneo para comenzar.";fixtures.textContent="No hay calendario activo.";body.innerHTML='<tr><td colspan="10">Todavía no hay tabla.</td></tr>';refreshFixtureSelect();return}
  $("tournamentName").value=t.name;
  t.teamIds.forEach(id=>{const chip=document.createElement("span");chip.className="team-chip";chip.textContent=safeTeamName(id);chips.append(chip)});
  if(!t.teamIds.length)chips.textContent="Todavía no hay equipos inscritos.";
  t.fixtures.forEach(f=>{
   const card=document.createElement("div");card.className="fixture-card"+(f.played?" done":"");
   const h=document.createElement("strong"),mid=document.createElement("b"),a=document.createElement("strong"),meta=document.createElement("span");
   h.textContent=safeTeamName(f.homeId);mid.textContent=f.played?f.homeGoals+" - "+f.awayGoals:"VS";a.textContent=safeTeamName(f.awayId);meta.className="fixture-meta";meta.textContent="Jornada "+f.round+" · "+(f.played?"Finalizado":"Pendiente");
   card.append(h,mid,a,meta);fixtures.append(card);
  });
  if(!t.fixtures.length)fixtures.textContent="Genera el calendario para ver los enfrentamientos.";
  standings(t).forEach((r,i)=>{const tr=document.createElement("tr");[i+1,r.name,r.played,r.w,r.d,r.l,r.gf,r.ga,r.gf-r.ga,r.pts].forEach(v=>{const td=document.createElement("td");td.textContent=v;tr.append(td)});body.append(tr)});
  refreshFixtureSelect();
 }
 window.loadTournamentFixture=function(){
  const t=activeTournament(),f=t&&t.fixtures.find(x=>x.id===$("tournamentFixtureSelect").value);if(!f){alert("Selecciona un partido del calendario.");return}
  const home=teams.find(x=>x.id===f.homeId),away=teams.find(x=>x.id===f.awayId);if(!home||!away){alert("Falta un equipo en la base de datos.");return}
  $("dbTeamSelect").value=home.id;loadTeamIntoMatch("home");$("dbTeamSelect").value=away.id;loadTeamIntoMatch("away");
  $("competitionName").value=t.name;$("matchRound").value="Jornada "+f.round;
  say("tournamentStatus","Partido cargado en el marcador.");
 };
 window.saveTournamentResult=function(){
  const t=activeTournament(),f=t&&t.fixtures.find(x=>x.id===$("tournamentFixtureSelect").value);if(!f){alert("Selecciona el partido del calendario.");return}
  const hg=Number($("homeScore").textContent),ag=Number($("awayScore").textContent);if(!Number.isInteger(hg)||!Number.isInteger(ag)){alert("El marcador no es válido.");return}
  if(f.played&&!confirm("Este partido ya tiene resultado. ¿Quieres reemplazarlo?"))return;
  f.played=true;f.homeGoals=hg;f.awayGoals=ag;writeStore(TOURNAMENT_KEY,tournaments);renderTournament();say("tournamentStatus","✓ Resultado guardado: "+safeTeamName(f.homeId)+" "+hg+" - "+ag+" "+safeTeamName(f.awayId));
 };
 function renderAnalyticsNames(){if($("analyticsHomeName"))$("analyticsHomeName").textContent=typeof teamName==="function"?teamName("home"):"LOCAL";if($("analyticsAwayName"))$("analyticsAwayName").textContent=typeof teamName==="function"?teamName("away"):"VISITANTE"}
 function renderAnalytics(){
  ["home","away"].forEach(team=>Object.keys(metrics[team]).forEach(key=>{
   const id=team+key[0].toUpperCase()+key.slice(1);if($(id))$(id).textContent=metrics[team][key];
  }));
  $("homePossession").value=metrics.home.possession;$("awayPossession").value=metrics.away.possession;
  $("possessionBalance").textContent="Posesión estimada: "+metrics.home.possession+" % — "+metrics.away.possession+" %";
  renderAnalyticsNames();
 }
 window.changeMatchStat=function(team,key,amount){
  if(!metrics[team]||!(key in metrics[team])||key==="possession")return;
  metrics[team][key]=Math.max(0,metrics[team][key]+amount);writeStore(METRICS_KEY,metrics);renderAnalytics();
 };
 window.setPossession=function(team,value){
  const n=Math.max(0,Math.min(100,parseInt(value,10)||0));metrics[team].possession=n;metrics[team==="home"?"away":"home"].possession=100-n;
  writeStore(METRICS_KEY,metrics);renderAnalytics();
 };
 function resetMetrics(){metrics={home:blankMetrics(),away:blankMetrics()};writeStore(METRICS_KEY,metrics);renderAnalytics()}
 const originalReset=window.resetMatch;
 if(typeof originalReset==="function")window.resetMatch=function(){originalReset();resetMetrics()};
 const originalUpdate=window.updateDisplay;
 if(typeof originalUpdate==="function")window.updateDisplay=function(){originalUpdate();renderAnalyticsNames()};
 window.refreshIncidentPlayers=function(){
  const team=$("incidentTeam").value,select=$("incidentPlayer"),prev=select.value;select.replaceChildren(new Option("Sin jugador específico",""));
  if(window.rosters&&rosters[team])rosters[team].forEach(p=>select.add(new Option(p.number+". "+p.name,p.id)));
  if([...select.options].some(o=>o.value===prev))select.value=prev;
 };
 window.registerDetailedIncident=function(){
  const type=$("incidentType").value,team=$("incidentTeam").value,p=rosters[team].find(x=>x.id===$("incidentPlayer").value);
  const desc=$("incidentDescription").value.trim(),minute=$("incidentMinute").value.trim();
  if(!desc){alert("Escribe una descripción objetiva del incidente.");return}
  const line="📝 "+type+" · "+(p?p.name+" ("+(team==="home"?teamName("home"):teamName("away"))+")":teamName(team))+" · "+desc;
  if(typeof addEvent==="function")addEvent(line,minute||null);
  const row=document.createElement("div");row.className="event";const strong=document.createElement("strong");strong.textContent=minute||"Incidente";const span=document.createElement("span");span.textContent=" — "+line;row.append(strong,span);
  const history=$("incidentHistory");if(history.querySelector(".small"))history.replaceChildren();history.prepend(row);
  $("incidentDescription").value="";say("tournamentStatus","Incidente agregado a la cronología.");
 };
 const originalReport=window.showMatchReport;
 window.showMatchReport=function(){
  if(typeof originalReport==="function")originalReport();
  const box=$("reportOutput");if(!box)return;
  const lines=["","DATOS DEL ENCUENTRO", "Competición: "+($("competitionName").value||"—"),"Jornada: "+($("matchRound").value||"—"),"Fecha: "+($("matchDate").value||"—"),"Sede: "+($("matchVenue").value||"—"),"Árbitro: "+($("officialReferee").value||"—"),"Asistentes: "+($("officialAssistant1").value||"—")+" / "+($("officialAssistant2").value||"—"),"Cuarto árbitro: "+($("officialFourth").value||"—"),"","ESTADÍSTICAS DEL PARTIDO"];
  ["home","away"].forEach(team=>{const m=metrics[team];lines.push(teamName(team)+": tiros "+m.shots+", a puerta "+m.onTarget+", córneres "+m.corners+", faltas "+m.fouls+", fuera de juego "+m.offsides+", posesión "+m.possession+"%")});
  box.textContent+=(box.textContent?"\n":"")+lines.join("\n");
 };
 function init(){
  refreshTeamSelects();refreshTournamentSelect();renderTournament();renderAnalytics();renderMetadata();refreshIncidentPlayers();
  const now=new Date();if(!$("matchDate").value){const local=new Date(now.getTime()-now.getTimezoneOffset()*60000);$("matchDate").value=local.toISOString().slice(0,16)}
  if("serviceWorker" in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
 }
 document.addEventListener("DOMContentLoaded",init);
 if(document.readyState!=="loading")init();
})();