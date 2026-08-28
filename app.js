
const LAT=-31.3881,LON=-57.9598,$=x=>document.getElementById(x);
const WEATHER_REFRESH=10*60*1000, RADAR_REFRESH=5*60*1000;
let weatherTimer=null, radarTimer=null, countdownTimer=null, nextWeatherAt=null;

function wx(c){const m={0:["Despejado","☀️"],1:["Mayormente despejado","🌤️"],2:["Parcialmente nublado","⛅"],3:["Cubierto","☁️"],45:["Niebla","🌫️"],51:["Llovizna","🌦️"],53:["Llovizna","🌦️"],55:["Llovizna","🌧️"],61:["Lluvia débil","🌦️"],63:["Lluvia","🌧️"],65:["Lluvia intensa","🌧️"],80:["Chaparrones","🌦️"],81:["Chaparrones","🌧️"],82:["Chaparrones fuertes","⛈️"],95:["Tormenta","⛈️"],96:["Tormenta con granizo","⛈️"],99:["Tormenta fuerte","⛈️"]};return m[c]||["Variable","🌦️"]}
function compass(d){return ["N","NE","E","SE","S","SO","O","NO"][Math.round(d/45)%8]}
function uv(speed,deg){let r=deg*Math.PI/180;return {u:-speed*Math.sin(r),v:-speed*Math.cos(r)}}
function shear(s1,d1,s2,d2){let a=uv(s1,d1),b=uv(s2,d2);return Math.sqrt((b.u-a.u)**2+(b.v-a.v)**2)}
function day(s){return new Date(s+"T12:00").toLocaleDateString("es-UY",{weekday:"short",day:"2-digit"})}
function setOnlineState(){ $("offlineBanner").classList.toggle("hidden", navigator.onLine); }
function saveCache(key,data){localStorage.setItem(key,JSON.stringify({time:Date.now(),data}))}
function loadCache(key){try{return JSON.parse(localStorage.getItem(key)||"null")}catch{return null}}

function renderMain(d, fromCache=false){
  const c=d.current,[txt,ico]=wx(c.weather_code);
  $("temp").textContent=Math.round(c.temperature_2m)+"°";$("cond").textContent=txt;$("icon").textContent=ico;
  $("feel").textContent=Math.round(c.apparent_temperature)+"°";$("dew").textContent=Math.round(c.dew_point_2m)+"°";$("hum").textContent=Math.round(c.relative_humidity_2m)+"%";
  $("press").textContent=Math.round(c.pressure_msl)+" hPa";$("wind").textContent=Math.round(c.wind_speed_10m)+" km/h";$("gust").textContent=Math.round(c.wind_gusts_10m)+" km/h";$("dir").textContent=compass(c.wind_direction_10m)+" "+Math.round(c.wind_direction_10m)+"°";$("cloud").textContent=Math.round(c.cloud_cover)+"%";
  $("updated").textContent=(fromCache?"Últimos datos guardados · ":"Actualizado · ")+new Date().toLocaleString("es-UY",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
  let i=d.hourly.time.findIndex(t=>t>=c.time);if(i<0)i=0;
  let cape=d.hourly.cape[i]??0,cin=d.hourly.convective_inhibition[i]??0,li=d.hourly.lifted_index[i];
  let shr=shear(d.hourly.wind_speed_10m[i],d.hourly.wind_direction_10m[i],d.hourly.wind_speed_500hPa[i],d.hourly.wind_direction_500hPa[i]);
  $("cape").textContent=Math.round(cape)+" J/kg";$("cin").textContent=Math.round(cin)+" J/kg";$("li").textContent=(li==null?"--":li.toFixed(1));$("shear").textContent=Math.round(shr)+" km/h";
  $("t850").textContent=Math.round(d.hourly.temperature_850hPa[i])+" °C";$("rh850").textContent=Math.round(d.hourly.relative_humidity_850hPa[i])+" %";$("w850").textContent=Math.round(d.hourly.wind_speed_850hPa[i])+" km/h "+compass(d.hourly.wind_direction_850hPa[i]);$("z850").textContent=Math.round(d.hourly.geopotential_height_850hPa[i])+" m";
  $("t500").textContent=Math.round(d.hourly.temperature_500hPa[i])+" °C";$("rh500").textContent=Math.round(d.hourly.relative_humidity_500hPa[i])+" %";$("w500").textContent=Math.round(d.hourly.wind_speed_500hPa[i])+" km/h "+compass(d.hourly.wind_direction_500hPa[i]);$("z500").textContent=Math.round(d.hourly.geopotential_height_500hPa[i])+" m";
  let risk=(cape>1500&&li<0&&shr>35)?"Entorno potencialmente favorable a tormentas organizadas":(cape>500&&li<1)?"Hay inestabilidad a vigilar":"Señales convectivas actualmente limitadas";
  $("stormRead").innerHTML=`<span class="pill ${risk.startsWith("Entorno")?"red":risk.startsWith("Hay")?"amber":"green"}">${risk}</span>`;
  $("hourly").innerHTML="";
  for(let k=i;k<Math.min(i+12,d.hourly.time.length);k++){let [t,ic]=wx(d.hourly.weather_code[k]);$("hourly").innerHTML+=`<div class="hour"><div class="time">${d.hourly.time[k].slice(11,16)}</div><div class="ico">${ic}</div><div class="hv">${Math.round(d.hourly.temperature_2m[k])}°</div><div class="mini">☔ ${d.hourly.precipitation_probability[k]??0}%</div><div class="mini">CAPE ${Math.round(d.hourly.cape[k]||0)}</div></div>`}
  $("daily").innerHTML="";
  d.daily.time.forEach((x,k)=>{let [t,ic]=wx(d.daily.weather_code[k]);$("daily").innerHTML+=`<div class="day"><div><b>${day(x)}</b><br><span class="muted">${t}</span></div><div style="font-size:22px">${ic}</div><div><b>${Math.round(d.daily.temperature_2m_max[k])}°</b> / <span class="muted">${Math.round(d.daily.temperature_2m_min[k])}°</span></div><div>☔ ${d.daily.precipitation_probability_max[k]??0}%<br><span class="muted">${Number(d.daily.precipitation_sum[k]||0).toFixed(1)} mm</span></div></div>`});
  $("summary").textContent=`850 hPa: ${Math.round(d.hourly.temperature_850hPa[i])} °C con ${Math.round(d.hourly.relative_humidity_850hPa[i])}% HR. 500 hPa: ${Math.round(d.hourly.temperature_500hPa[i])} °C. CAPE ${Math.round(cape)} J/kg, LI ${li==null?"--":li.toFixed(1)} y cizalladura aproximada ${Math.round(shr)} km/h. Hoy se prevén ${Number(d.daily.precipitation_sum[0]||0).toFixed(1)} mm y ráfagas máximas cercanas a ${Math.round(d.daily.wind_gusts_10m_max[0]||0)} km/h.`;
}

async function loadWeather(){
  const hourly=["temperature_2m","dew_point_2m","relative_humidity_2m","pressure_msl","precipitation_probability","weather_code","wind_speed_10m","wind_direction_10m","wind_gusts_10m","cape","convective_inhibition","lifted_index","temperature_850hPa","relative_humidity_850hPa","wind_speed_850hPa","wind_direction_850hPa","geopotential_height_850hPa","temperature_500hPa","relative_humidity_500hPa","wind_speed_500hPa","wind_direction_500hPa","geopotential_height_500hPa"].join(",");
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,dew_point_2m,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=${hourly}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max&timezone=America%2FMontevideo&forecast_days=7`;
  try{
    const r=await fetch(url,{cache:"no-store"}); if(!r.ok) throw new Error(r.status);
    const d=await r.json(); saveCache("met_salto_weather",d); renderMain(d,false);
    nextWeatherAt=Date.now()+WEATHER_REFRESH;
  }catch(e){
    const cached=loadCache("met_salto_weather");
    if(cached) renderMain(cached.data,true);
  }
  setOnlineState();
}

async function loadRadar(){
  try{
    const r=await fetch("https://api.rainviewer.com/public/weather-maps.json",{cache:"no-store"}); if(!r.ok) throw new Error(r.status);
    const j=await r.json(),f=j.radar.past.at(-1);
    const src=`${j.host}${f.path}/512/6/${LAT}/${LON}/2/1_0.png`;
    $("radar").src=src;
    $("radarTime").textContent="Radar "+new Date(f.time*1000).toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"});
    saveCache("met_salto_radar",{src,time:f.time});
  }catch(e){
    const cached=loadCache("met_salto_radar");
    if(cached){$("radar").src=cached.data.src;$("radarTime").textContent="Radar guardado";}
  }
}

function updateCountdown(){
  if(!nextWeatherAt){$("nextUpdate").textContent="";return}
  const s=Math.max(0,Math.floor((nextWeatherAt-Date.now())/1000));
  $("nextUpdate").textContent=`Próxima actualización automática en ${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
}

function startTimers(){
  clearInterval(weatherTimer); clearInterval(radarTimer); clearInterval(countdownTimer);
  weatherTimer=setInterval(loadWeather,WEATHER_REFRESH);
  radarTimer=setInterval(loadRadar,RADAR_REFRESH);
  countdownTimer=setInterval(updateCountdown,1000);
}

async function loadAll(){await Promise.all([loadWeather(),loadRadar()]);}

$("refreshBtn").addEventListener("click",loadAll);
window.addEventListener("online",()=>{setOnlineState();loadAll()});
window.addEventListener("offline",setOnlineState);
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"){
    const cached=loadCache("met_salto_weather");
    if(!cached || Date.now()-cached.time>5*60*1000) loadAll();
  }
});

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
}

setOnlineState();
loadAll();
startTimers();
