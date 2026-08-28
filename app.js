
const $=id=>document.getElementById(id);
const REFRESH=10*60*1000, RADAR_REFRESH=5*60*1000;
let nextUpdateAt=0, weatherTimer=null, radarTimer=null, countdownTimer=null;

const CITIES=[
["Salto","Salto",-31.3881,-57.9598],["Artigas","Artigas",-30.4000,-56.4667],["Canelones","Canelones",-34.5228,-56.2778],
["Melo","Cerro Largo",-32.3703,-54.1675],["Colonia del Sacramento","Colonia",-34.4626,-57.8398],["Durazno","Durazno",-33.3806,-56.5236],
["Trinidad","Flores",-33.5165,-56.8996],["Florida","Florida",-34.0956,-56.2142],["Minas","Lavalleja",-34.3759,-55.2377],
["Maldonado","Maldonado",-34.9000,-54.9500],["Montevideo","Montevideo",-34.9011,-56.1645],["Paysandú","Paysandú",-32.3214,-58.0756],
["Fray Bentos","Río Negro",-33.1325,-58.2956],["Rivera","Rivera",-30.9053,-55.5508],["Rocha","Rocha",-34.4833,-54.3333],
["San José de Mayo","San José",-34.3375,-56.7136],["Mercedes","Soriano",-33.2524,-58.0305],["Tacuarembó","Tacuarembó",-31.7333,-55.9833],
["Treinta y Tres","Treinta y Tres",-33.2333,-54.3833],["Punta del Este","Maldonado",-34.9626,-54.9515],["Young","Río Negro",-32.6833,-57.6333],
["Bella Unión","Artigas",-30.2597,-57.5992],["Termas del Daymán","Salto",-31.456,-57.907],["Chuy","Rocha",-33.697,-53.459],
["Piriápolis","Maldonado",-34.8629,-55.2747],["Atlántida","Canelones",-34.7719,-55.7584],["Nueva Helvecia","Colonia",-34.3000,-57.2333],
["Cardona","Soriano",-33.8705,-57.3695],["Paso de los Toros","Tacuarembó",-32.8167,-56.5167],["Castillos","Rocha",-34.1987,-53.8592]
];

function wx(c){const m={0:["Despejado","☀️"],1:["Mayormente despejado","🌤️"],2:["Parcialmente nublado","⛅"],3:["Cubierto","☁️"],45:["Niebla","🌫️"],48:["Niebla con escarcha","🌫️"],51:["Llovizna débil","🌦️"],53:["Llovizna","🌦️"],55:["Llovizna fuerte","🌧️"],61:["Lluvia débil","🌦️"],63:["Lluvia","🌧️"],65:["Lluvia intensa","🌧️"],80:["Chaparrones","🌦️"],81:["Chaparrones","🌧️"],82:["Chaparrones fuertes","⛈️"],95:["Tormenta","⛈️"],96:["Tormenta con granizo","⛈️"],99:["Tormenta fuerte","⛈️"]};return m[c]||["Variable","🌦️"]}
function compass(d){if(d==null)return"--";return ["N","NE","E","SE","S","SO","O","NO"][Math.round(d/45)%8]}
function uv(speed,deg){let r=deg*Math.PI/180;return {u:-speed*Math.sin(r),v:-speed*Math.cos(r)}}
function shear(s1,d1,s2,d2){let a=uv(s1,d1),b=uv(s2,d2);return Math.sqrt((b.u-a.u)**2+(b.v-a.v)**2)}
function dayName(s){return new Date(s+"T12:00").toLocaleDateString("es-UY",{weekday:"short",day:"2-digit"})}
function fmtTime(s){return s?new Date(s).toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"}):"--"}
function setOnline(){ $("offlineBanner").classList.toggle("hidden",navigator.onLine) }
function saveCache(key,data){try{localStorage.setItem(key,JSON.stringify({time:Date.now(),data}))}catch{}}
function loadCache(key){try{return JSON.parse(localStorage.getItem(key)||"null")}catch{return null}}
function currentCity(){return CITIES.find(x=>x[0]===$("citySelect").value)||CITIES[0]}
function setSelectedCity(name){$("citySelect").value=name;localStorage.setItem("met_salto_last_city",name);$("citySearch").value="";$("searchResults").classList.add("hidden")}

function populateCities(){
  $("citySelect").innerHTML="";
  CITIES.forEach(c=>{const o=document.createElement("option");o.value=c[0];o.textContent=`${c[0]} · ${c[1]}`;$("citySelect").appendChild(o)});
  const saved=localStorage.getItem("met_salto_last_city");
  $("citySelect").value=CITIES.some(c=>c[0]===saved)?saved:"Salto";
}

function renderSearch(q){
  const f=q.trim().toLowerCase(), box=$("searchResults");
  if(!f){box.classList.add("hidden");box.innerHTML="";return}
  const matches=CITIES.filter(c=>c[0].toLowerCase().includes(f)||c[1].toLowerCase().includes(f)).slice(0,10);
  box.innerHTML=matches.length?matches.map(c=>`<div class="searchResult" data-city="${c[0]}"><b>${c[0]}</b><span>${c[1]}</span></div>`).join(""):'<div class="searchResult"><span>Sin coincidencias</span></div>';
  box.classList.remove("hidden");
  box.querySelectorAll("[data-city]").forEach(el=>el.addEventListener("click",()=>{setSelectedCity(el.dataset.city);loadAll(true)}));
}

function chart(el,series){
  const W=700,H=190,P=30;
  const vals=series.flatMap(s=>s.values).filter(Number.isFinite);
  if(!vals.length){$(el).innerHTML="";return}
  let min=Math.min(...vals),max=Math.max(...vals),pad=Math.max(1,(max-min)*.12);min-=pad;max+=pad;if(max===min)max=min+1;
  const len=Math.max(...series.map(s=>s.values.length));
  const X=i=>P+i*(W-2*P)/(len-1||1),Y=v=>H-P-(v-min)*(H-2*P)/(max-min);
  let svg=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
  for(let k=0;k<4;k++){let y=P+k*(H-2*P)/3;svg+=`<line x1="${P}" y1="${y}" x2="${W-P}" y2="${y}" stroke="rgba(255,255,255,.08)" stroke-width="1"/>`}
  series.forEach((s,idx)=>{const color=idx===0?"#59b7ff":"#ffd166";const pts=s.values.map((v,i)=>Number.isFinite(v)?`${X(i)},${Y(v)}`:"").filter(Boolean).join(" ");svg+=`<polyline fill="none" stroke="${color}" stroke-width="3" vector-effect="non-scaling-stroke" points="${pts}"/>`});
  svg+=`<text x="4" y="${P+4}" fill="#9bb0c7" font-size="11">${max.toFixed(1)}</text><text x="4" y="${H-P}" fill="#9bb0c7" font-size="11">${min.toFixed(1)}</text></svg>`;
  $(el).innerHTML=svg;
}

function renderCity(d,name,dept,fromCache=false){
  const c=d.current,[txt,ico]=wx(c.weather_code);
  $("locationName").textContent=`${name} · ${dept}`;$("temp").textContent=Math.round(c.temperature_2m)+"°";$("cond").textContent=txt;$("icon").textContent=ico;
  $("feel").textContent=Math.round(c.apparent_temperature)+"°";$("dew").textContent=Math.round(c.dew_point_2m)+"°";$("hum").textContent=Math.round(c.relative_humidity_2m)+"%";
  $("press").textContent=Math.round(c.pressure_msl)+" hPa";$("wind").textContent=Math.round(c.wind_speed_10m)+" km/h";$("gust").textContent=Math.round(c.wind_gusts_10m)+" km/h";
  $("dir").textContent=compass(c.wind_direction_10m)+" "+Math.round(c.wind_direction_10m)+"°";$("cloud").textContent=Math.round(c.cloud_cover)+"%";
  $("visibility").textContent=c.visibility!=null?(c.visibility/1000).toFixed(1)+" km":"--";$("precipNow").textContent=(c.precipitation??0).toFixed(1)+" mm";
  $("updated").textContent=(fromCache?"Datos guardados · ":"Actualizado · ")+new Date().toLocaleString("es-UY",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});

  let i=d.hourly.time.findIndex(t=>t>=c.time);if(i<0)i=0;
  const uvNow=d.hourly.uv_index?.[i]??0;$("uv").textContent=uvNow.toFixed(1);
  const p0=d.hourly.pressure_msl[i],p6=d.hourly.pressure_msl[Math.min(i+6,d.hourly.pressure_msl.length-1)],ptr=p6-p0;
  $("pressTrend").textContent=(ptr>0?"+":"")+ptr.toFixed(1)+" hPa";$("pressTrend").title=ptr>1?"En ascenso":ptr<-1?"En descenso":"Estable";

  const cape=d.hourly.cape[i]??0,cin=d.hourly.convective_inhibition[i]??0,li=d.hourly.lifted_index[i];
  const shr=shear(d.hourly.wind_speed_10m[i],d.hourly.wind_direction_10m[i],d.hourly.wind_speed_500hPa[i],d.hourly.wind_direction_500hPa[i]);
  const cape24=Math.max(...d.hourly.cape.slice(i,i+24).map(v=>v??0));
  $("cape").textContent=Math.round(cape)+" J/kg";$("capeMax").textContent=Math.round(cape24)+" J/kg";$("cin").textContent=Math.round(cin)+" J/kg";$("li").textContent=li==null?"--":li.toFixed(1);$("shear").textContent=Math.round(shr)+" km/h";
  $("rh850mini").textContent=Math.round(d.hourly.relative_humidity_850hPa[i])+"%";
  $("t850").textContent=Math.round(d.hourly.temperature_850hPa[i])+" °C";$("rh850").textContent=Math.round(d.hourly.relative_humidity_850hPa[i])+" %";$("w850").textContent=Math.round(d.hourly.wind_speed_850hPa[i])+" km/h "+compass(d.hourly.wind_direction_850hPa[i]);$("z850").textContent=Math.round(d.hourly.geopotential_height_850hPa[i])+" m";
  $("t500").textContent=Math.round(d.hourly.temperature_500hPa[i])+" °C";$("rh500").textContent=Math.round(d.hourly.relative_humidity_500hPa[i])+" %";$("w500").textContent=Math.round(d.hourly.wind_speed_500hPa[i])+" km/h "+compass(d.hourly.wind_direction_500hPa[i]);$("z500").textContent=Math.round(d.hourly.geopotential_height_500hPa[i])+" m";

  const risk=(cape24>1800&&li<0&&shr>40)?"Entorno convectivo significativo":(cape24>700&&li<1)?"Inestabilidad a vigilar":"Señales convectivas limitadas";
  const cls=risk.startsWith("Entorno")?"red":risk.startsWith("Inestabilidad")?"amber":"green";
  $("stormRead").innerHTML=`<span class="pill ${cls}">${risk}</span> CAPE, LI y cizalladura se muestran como orientación. La severidad real también depende del forzamiento, humedad profunda y estructura vertical.`;

  $("todayRange").textContent=`${Math.round(d.daily.temperature_2m_max[0])}° / ${Math.round(d.daily.temperature_2m_min[0])}°`;
  $("todayRain").textContent=`☔ ${(d.daily.precipitation_sum[0]||0).toFixed(1)} mm · ${d.daily.precipitation_probability_max[0]??0}%`;
  $("sunrise").textContent=fmtTime(d.daily.sunrise[0]);$("sunset").textContent=fmtTime(d.daily.sunset[0]);$("uvMax").textContent=(d.daily.uv_index_max[0]??0).toFixed(1);$("gustMax").textContent=Math.round(d.daily.wind_gusts_10m_max[0]||0)+" km/h";

  $("hourly").innerHTML="";
  for(let k=i;k<Math.min(i+12,d.hourly.time.length);k++){
    const [t,ic]=wx(d.hourly.weather_code[k]);
    $("hourly").innerHTML+=`<div class="hour"><div class="time">${d.hourly.time[k].slice(11,16)}</div><div class="ico" title="${t}">${ic}</div><div class="hv">${Math.round(d.hourly.temperature_2m[k])}°</div><div class="mini">☔ ${d.hourly.precipitation_probability[k]??0}%</div><div class="mini">💨 ${Math.round(d.hourly.wind_speed_10m[k])}</div><div class="mini">CAPE ${Math.round(d.hourly.cape[k]||0)}</div></div>`;
  }

  $("daily").innerHTML="";
  d.daily.time.forEach((x,k)=>{
    const [t,ic]=wx(d.daily.weather_code[k]);
    $("daily").innerHTML+=`<div class="day"><div><b>${dayName(x)}</b><br><span class="muted">${t}</span></div><div style="font-size:22px">${ic}</div><div><b>${Math.round(d.daily.temperature_2m_max[k])}°</b> / <span class="muted">${Math.round(d.daily.temperature_2m_min[k])}°</span></div><div>☔ ${d.daily.precipitation_probability_max[k]??0}%<br><span class="muted">${Number(d.daily.precipitation_sum[k]||0).toFixed(1)} mm</span></div></div>`;
  });

  chart("pressureChart",[{values:d.hourly.pressure_msl.slice(i,i+24)}]);
  chart("tempChart",[{values:d.hourly.temperature_2m.slice(i,i+24)},{values:d.hourly.dew_point_2m.slice(i,i+24)}]);

  const ptrText=ptr>1?"subiendo":ptr<-1?"bajando":"estable";
  $("summary").textContent=`${name}: ${Math.round(c.temperature_2m)} °C, ${txt.toLowerCase()}. Hoy ${Math.round(d.daily.temperature_2m_max[0])}° / ${Math.round(d.daily.temperature_2m_min[0])}°, lluvia prevista ${Number(d.daily.precipitation_sum[0]||0).toFixed(1)} mm y ráfagas máximas ${Math.round(d.daily.wind_gusts_10m_max[0]||0)} km/h. La presión está ${ptrText} (${ptr>=0?"+":""}${ptr.toFixed(1)} hPa a 6 h). CAPE máximo 24 h ${Math.round(cape24)} J/kg, LI ${li==null?"--":li.toFixed(1)} y cizalladura aproximada ${Math.round(shr)} km/h.`;
}

async function loadCity(){
  const [name,dept,lat,lon]=currentCity();
  const hourly=["temperature_2m","dew_point_2m","relative_humidity_2m","pressure_msl","precipitation_probability","precipitation","weather_code","wind_speed_10m","wind_direction_10m","wind_gusts_10m","cape","convective_inhibition","lifted_index","uv_index","temperature_850hPa","relative_humidity_850hPa","wind_speed_850hPa","wind_direction_850hPa","geopotential_height_850hPa","temperature_500hPa","relative_humidity_500hPa","wind_speed_500hPa","wind_direction_500hPa","geopotential_height_500hPa"].join(",");
  const current=["temperature_2m","relative_humidity_2m","apparent_temperature","dew_point_2m","weather_code","cloud_cover","pressure_msl","wind_speed_10m","wind_direction_10m","wind_gusts_10m","precipitation","visibility"].join(",");
  const daily=["weather_code","temperature_2m_max","temperature_2m_min","precipitation_sum","precipitation_probability_max","wind_gusts_10m_max","sunrise","sunset","uv_index_max"].join(",");
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=${current}&hourly=${hourly}&daily=${daily}&timezone=America%2FMontevideo&forecast_days=7`;
  try{
    const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error(r.status);
    const d=await r.json();saveCache("met_salto_city_"+name,d);renderCity(d,name,dept,false);nextUpdateAt=Date.now()+REFRESH;
  }catch(e){
    const cached=loadCache("met_salto_city_"+name);
    if(cached)renderCity(cached.data,name,dept,true);else{$("cond").textContent="No se pudieron obtener datos";console.error(e)}
  }
  setOnline();
}

async function loadRadar(){
  const [name,,lat,lon]=currentCity();
  try{
    const r=await fetch("https://api.rainviewer.com/public/weather-maps.json",{cache:"no-store"});if(!r.ok)throw new Error(r.status);
    const j=await r.json(),f=j.radar?.past?.at(-1);if(!f)throw new Error("Sin frame");
    const src=`${j.host}${f.path}/512/6/${lat}/${lon}/2/1_0.png`;
    $("radar").src=src;$("radarTime").textContent=new Date(f.time*1000).toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"});
    saveCache("met_salto_radar_"+name,{src,time:f.time});
  }catch(e){
    const cached=loadCache("met_salto_radar_"+name);
    if(cached){$("radar").src=cached.data.src;$("radarTime").textContent="guardado"}else{$("radarTime").textContent="no disponible"}
  }
}

async function loadNational(){
  const capitals=CITIES.slice(0,19);
  const lats=capitals.map(c=>c[2]).join(","),lons=capitals.map(c=>c[3]).join(",");
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=America%2FMontevideo&forecast_days=1`;
  try{
    const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error(r.status);
    const raw=await r.json(),data=Array.isArray(raw)?raw:[raw];
    $("nationalGrid").innerHTML="";
    data.forEach((d,i)=>{
      const c=capitals[i],[txt,ico]=wx(d.current.weather_code);
      $("nationalGrid").innerHTML+=`<div class="cityCard" data-city="${c[0]}"><div class="cityHead"><div><div class="cityName">${c[0]}</div><div class="muted">${c[1]}</div></div><div><span style="font-size:21px">${ico}</span> <span class="cityTemp">${Math.round(d.current.temperature_2m)}°</span></div></div><div class="cityMeta">Sens. ${Math.round(d.current.apparent_temperature)}° · ${txt}<br>Viento ${Math.round(d.current.wind_speed_10m)} km/h · Hoy ${Math.round(d.daily.temperature_2m_max[0])}° / ${Math.round(d.daily.temperature_2m_min[0])}° · Lluvia ${(d.daily.precipitation_sum[0]||0).toFixed(1)} mm</div></div>`;
    });
    document.querySelectorAll(".cityCard").forEach(el=>el.addEventListener("click",()=>{setSelectedCity(el.dataset.city);loadAll(true);window.scrollTo({top:0,behavior:"smooth"})}));

    let maxT={v:-999,i:0},minT={v:999,i:0},maxW={v:-1,i:0},maxR={v:-1,i:0};
    data.forEach((d,i)=>{
      if(d.current.temperature_2m>maxT.v)maxT={v:d.current.temperature_2m,i};
      if(d.current.temperature_2m<minT.v)minT={v:d.current.temperature_2m,i};
      if(d.current.wind_speed_10m>maxW.v)maxW={v:d.current.wind_speed_10m,i};
      if((d.daily.precipitation_sum[0]||0)>maxR.v)maxR={v:d.daily.precipitation_sum[0]||0,i};
    });
    $("nationalExtremes").innerHTML=`
      <div class="extreme"><div class="label">Más cálida ahora</div><div class="big">${Math.round(maxT.v)}°</div><div class="where">${capitals[maxT.i][0]}</div></div>
      <div class="extreme"><div class="label">Más fresca ahora</div><div class="big">${Math.round(minT.v)}°</div><div class="where">${capitals[minT.i][0]}</div></div>
      <div class="extreme"><div class="label">Mayor viento</div><div class="big">${Math.round(maxW.v)} km/h</div><div class="where">${capitals[maxW.i][0]}</div></div>
      <div class="extreme"><div class="label">Mayor lluvia hoy</div><div class="big">${maxR.v.toFixed(1)} mm</div><div class="where">${capitals[maxR.i][0]}</div></div>`;
  }catch(e){
    $("nationalGrid").innerHTML='<div class="status">No se pudo cargar el resumen nacional.</div>';
    $("nationalExtremes").innerHTML="";
  }
}

function updateCountdown(){
  if(!nextUpdateAt){$("nextUpdate").textContent="";return}
  const s=Math.max(0,Math.floor((nextUpdateAt-Date.now())/1000));
  $("nextUpdate").textContent=`Próxima actualización en ${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
}

async function loadAll(includeNational=false){
  setOnline();
  const jobs=[loadCity(),loadRadar()];
  if(includeNational||!$("nationalGrid").children.length)jobs.push(loadNational());
  await Promise.all(jobs);
}

populateCities();
$("citySelect").addEventListener("change",()=>{localStorage.setItem("met_salto_last_city",$("citySelect").value);loadAll(false)});
$("citySearch").addEventListener("input",e=>renderSearch(e.target.value));
document.addEventListener("click",e=>{if(!e.target.closest(".searchWrap"))$("searchResults").classList.add("hidden")});
$("refreshBtn").addEventListener("click",()=>loadAll(true));
window.addEventListener("online",()=>loadAll(true));window.addEventListener("offline",setOnline);
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"){
    const cached=loadCache("met_salto_city_"+currentCity()[0]);
    if(!cached||Date.now()-cached.time>5*60*1000)loadAll(false);
  }
});

if(!window.matchMedia("(display-mode: standalone)").matches&&!window.navigator.standalone)$("installHint").classList.remove("hidden");

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
}

weatherTimer=setInterval(()=>loadAll(false),REFRESH);
radarTimer=setInterval(loadRadar,RADAR_REFRESH);
countdownTimer=setInterval(updateCountdown,1000);
loadAll(true);
