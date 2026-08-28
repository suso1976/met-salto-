
const $=id=>document.getElementById(id);
const REFRESH=10*60*1000;
let nextUpdateAt=0, weatherTimer=null, countdownTimer=null;

const CITIES=[
["Salto","Salto",-31.3881,-57.9598],["Artigas","Artigas",-30.4000,-56.4667],["Canelones","Canelones",-34.5228,-56.2778],
["Melo","Cerro Largo",-32.3703,-54.1675],["Colonia del Sacramento","Colonia",-34.4626,-57.8398],["Durazno","Durazno",-33.3806,-56.5236],
["Trinidad","Flores",-33.5165,-56.8996],["Florida","Florida",-34.0956,-56.2142],["Minas","Lavalleja",-34.3759,-55.2377],
["Maldonado","Maldonado",-34.9000,-54.9500],["Montevideo","Montevideo",-34.9011,-56.1645],["Paysandú","Paysandú",-32.3214,-58.0756],
["Fray Bentos","Río Negro",-33.1325,-58.2956],["Rivera","Rivera",-30.9053,-55.5508],["Rocha","Rocha",-34.4833,-54.3333],
["San José de Mayo","San José",-34.3375,-56.7136],["Mercedes","Soriano",-33.2524,-58.0305],["Tacuarembó","Tacuarembó",-31.7333,-55.9833],
["Treinta y Tres","Treinta y Tres",-33.2333,-54.3833],["Punta del Este","Maldonado",-34.9626,-54.9515],["Young","Río Negro",-32.6833,-57.6333],
["Bella Unión","Artigas",-30.2597,-57.5992],["Daymán","Salto",-31.456,-57.907],["Chuy","Rocha",-33.697,-53.459]
];

function wx(c){const m={0:["Despejado","☀️"],1:["Mayormente despejado","🌤️"],2:["Parcialmente nublado","⛅"],3:["Cubierto","☁️"],45:["Niebla","🌫️"],48:["Niebla","🌫️"],51:["Llovizna","🌦️"],53:["Llovizna","🌦️"],55:["Llovizna fuerte","🌧️"],61:["Lluvia débil","🌦️"],63:["Lluvia","🌧️"],65:["Lluvia intensa","🌧️"],80:["Chaparrones","🌦️"],81:["Chaparrones","🌧️"],82:["Chaparrones fuertes","⛈️"],95:["Tormenta","⛈️"],96:["Tormenta con granizo","⛈️"],99:["Tormenta fuerte","⛈️"]};return m[c]||["Variable","🌦️"]}
function compass(d){return ["N","NE","E","SE","S","SO","O","NO"][Math.round(d/45)%8]}
function uv(speed,deg){let r=deg*Math.PI/180;return {u:-speed*Math.sin(r),v:-speed*Math.cos(r)}}
function shear(s1,d1,s2,d2){let a=uv(s1,d1),b=uv(s2,d2);return Math.sqrt((b.u-a.u)**2+(b.v-a.v)**2)}
function dayName(s){return new Date(s+"T12:00").toLocaleDateString("es-UY",{weekday:"short",day:"2-digit"})}
function setOnline(){ $("offlineBanner").classList.toggle("hidden",navigator.onLine) }
function saveCache(key,data){localStorage.setItem(key,JSON.stringify({time:Date.now(),data}))}
function loadCache(key){try{return JSON.parse(localStorage.getItem(key)||"null")}catch{return null}}

function populateCities(filter=""){
  const f=filter.trim().toLowerCase(), old=$("citySelect").value;
  $("citySelect").innerHTML="";
  CITIES.filter(c=>!f||c[0].toLowerCase().includes(f)||c[1].toLowerCase().includes(f)).forEach(c=>{
    const o=document.createElement("option"); o.value=c[0]; o.textContent=`${c[0]} · ${c[1]}`; $("citySelect").appendChild(o);
  });
  if([...$("citySelect").options].some(o=>o.value===old)) $("citySelect").value=old;
}
function currentCity(){return CITIES.find(x=>x[0]===$("citySelect").value)||CITIES[0]}

function renderCity(d,name,dept,fromCache=false){
  const c=d.current,[txt,ico]=wx(c.weather_code);
  $("locationName").textContent=`${name} · ${dept}`;
  $("temp").textContent=Math.round(c.temperature_2m)+"°"; $("cond").textContent=txt; $("icon").textContent=ico;
  $("feel").textContent=Math.round(c.apparent_temperature)+"°"; $("dew").textContent=Math.round(c.dew_point_2m)+"°"; $("hum").textContent=Math.round(c.relative_humidity_2m)+"%";
  $("press").textContent=Math.round(c.pressure_msl)+" hPa"; $("wind").textContent=Math.round(c.wind_speed_10m)+" km/h"; $("gust").textContent=Math.round(c.wind_gusts_10m)+" km/h";
  $("dir").textContent=compass(c.wind_direction_10m)+" "+Math.round(c.wind_direction_10m)+"°"; $("cloud").textContent=Math.round(c.cloud_cover)+"%";
  $("updated").textContent=(fromCache?"Datos guardados · ":"Actualizado · ")+new Date().toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"});
  let i=d.hourly.time.findIndex(t=>t>=c.time); if(i<0)i=0;
  let cape=d.hourly.cape[i]??0,cin=d.hourly.convective_inhibition[i]??0,li=d.hourly.lifted_index[i];
  let shr=shear(d.hourly.wind_speed_10m[i],d.hourly.wind_direction_10m[i],d.hourly.wind_speed_500hPa[i],d.hourly.wind_direction_500hPa[i]);
  $("cape").textContent=Math.round(cape)+" J/kg"; $("cin").textContent=Math.round(cin)+" J/kg"; $("li").textContent=li==null?"--":li.toFixed(1); $("shear").textContent=Math.round(shr)+" km/h";
  $("t850").textContent=Math.round(d.hourly.temperature_850hPa[i])+" °C"; $("rh850").textContent=Math.round(d.hourly.relative_humidity_850hPa[i])+" %"; $("w850").textContent=Math.round(d.hourly.wind_speed_850hPa[i])+" km/h "+compass(d.hourly.wind_direction_850hPa[i]); $("z850").textContent=Math.round(d.hourly.geopotential_height_850hPa[i])+" m";
  $("t500").textContent=Math.round(d.hourly.temperature_500hPa[i])+" °C"; $("rh500").textContent=Math.round(d.hourly.relative_humidity_500hPa[i])+" %"; $("w500").textContent=Math.round(d.hourly.wind_speed_500hPa[i])+" km/h "+compass(d.hourly.wind_direction_500hPa[i]); $("z500").textContent=Math.round(d.hourly.geopotential_height_500hPa[i])+" m";

  let risk=(cape>1500&&li<0&&shr>35)?"Entorno favorable a tormentas organizadas":(cape>500&&li<1)?"Inestabilidad a vigilar":"Señales convectivas limitadas";
  $("stormRead").innerHTML=`<span class="pill ${risk.startsWith("Entorno")?"red":risk.startsWith("Inestabilidad")?"amber":"green"}">${risk}</span>`;

  $("hourly").innerHTML="";
  for(let k=i;k<Math.min(i+12,d.hourly.time.length);k++){
    let [t,ic]=wx(d.hourly.weather_code[k]);
    $("hourly").innerHTML+=`<div class="hour"><div class="time">${d.hourly.time[k].slice(11,16)}</div><div class="ico">${ic}</div><div class="hv">${Math.round(d.hourly.temperature_2m[k])}°</div><div class="mini">☔ ${d.hourly.precipitation_probability[k]??0}%</div><div class="mini">CAPE ${Math.round(d.hourly.cape[k]||0)}</div></div>`;
  }

  $("daily").innerHTML="";
  d.daily.time.forEach((x,k)=>{
    let [t,ic]=wx(d.daily.weather_code[k]);
    $("daily").innerHTML+=`<div class="day"><div><b>${dayName(x)}</b><br><span class="muted">${t}</span></div><div style="font-size:22px">${ic}</div><div><b>${Math.round(d.daily.temperature_2m_max[k])}°</b> / <span class="muted">${Math.round(d.daily.temperature_2m_min[k])}°</span></div><div>☔ ${d.daily.precipitation_probability_max[k]??0}%<br><span class="muted">${Number(d.daily.precipitation_sum[k]||0).toFixed(1)} mm</span></div></div>`;
  });

  $("summary").textContent=`${name}: ${Math.round(c.temperature_2m)} °C, ${txt.toLowerCase()}. Hoy: ${Math.round(d.daily.temperature_2m_max[0])}° / ${Math.round(d.daily.temperature_2m_min[0])}°, precipitación ${Number(d.daily.precipitation_sum[0]||0).toFixed(1)} mm, ráfagas máximas ${Math.round(d.daily.wind_gusts_10m_max[0]||0)} km/h. CAPE ${Math.round(cape)} J/kg, LI ${li==null?"--":li.toFixed(1)}.`;
}

async function loadCity(){
  const [name,dept,lat,lon]=currentCity();
  const hourly=["temperature_2m","dew_point_2m","relative_humidity_2m","pressure_msl","precipitation_probability","weather_code","wind_speed_10m","wind_direction_10m","wind_gusts_10m","cape","convective_inhibition","lifted_index","temperature_850hPa","relative_humidity_850hPa","wind_speed_850hPa","wind_direction_850hPa","geopotential_height_850hPa","temperature_500hPa","relative_humidity_500hPa","wind_speed_500hPa","wind_direction_500hPa","geopotential_height_500hPa"].join(",");
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,dew_point_2m,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=${hourly}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max&timezone=America%2FMontevideo&forecast_days=7`;
  try{
    const r=await fetch(url,{cache:"no-store"}); if(!r.ok) throw new Error(r.status);
    const d=await r.json(); saveCache("met_salto_city_"+name,d); renderCity(d,name,dept,false);
    nextUpdateAt=Date.now()+REFRESH;
  }catch(e){
    const cached=loadCache("met_salto_city_"+name);
    if(cached) renderCity(cached.data,name,dept,true);
  }
  setOnline();
}

async function loadNational(){
  const capitals=CITIES.slice(0,19);
  const lats=capitals.map(c=>c[2]).join(","), lons=capitals.map(c=>c[3]).join(",");
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=America%2FMontevideo&forecast_days=1`;
  try{
    const r=await fetch(url,{cache:"no-store"}); if(!r.ok) throw new Error(r.status);
    const arr=await r.json(), data=Array.isArray(arr)?arr:[arr];
    $("nationalGrid").innerHTML="";
    data.forEach((d,i)=>{
      const c=capitals[i],[txt,ico]=wx(d.current.weather_code);
      $("nationalGrid").innerHTML+=`<div class="cityCard" data-city="${c[0]}"><div class="cityHead"><div><div class="cityName">${c[0]}</div><div class="muted">${c[1]}</div></div><div><span style="font-size:22px">${ico}</span> <span class="cityTemp">${Math.round(d.current.temperature_2m)}°</span></div></div><div class="cityMeta">${txt} · Viento ${Math.round(d.current.wind_speed_10m)} km/h<br>Hoy ${Math.round(d.daily.temperature_2m_max[0])}° / ${Math.round(d.daily.temperature_2m_min[0])}° · Lluvia ${Number(d.daily.precipitation_sum[0]||0).toFixed(1)} mm</div></div>`;
    });
    document.querySelectorAll(".cityCard").forEach(el=>el.addEventListener("click",()=>{
      $("citySelect").value=el.dataset.city; loadCity(); window.scrollTo({top:0,behavior:"smooth"});
    }));
  }catch(e){
    $("nationalGrid").innerHTML='<div class="status">No se pudo cargar el resumen nacional.</div>';
  }
}

function updateCountdown(){
  if(!nextUpdateAt){$("nextUpdate").textContent="";return}
  const s=Math.max(0,Math.floor((nextUpdateAt-Date.now())/1000));
  $("nextUpdate").textContent=`Próxima actualización en ${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
}

async function loadAll(){setOnline(); await Promise.all([loadCity(),loadNational()]);}

populateCities();
$("citySelect").value="Salto";
$("citySelect").addEventListener("change",loadCity);
$("citySearch").addEventListener("input",e=>populateCities(e.target.value));
$("refreshBtn").addEventListener("click",loadAll);

window.addEventListener("online",loadAll);
window.addEventListener("offline",setOnline);
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"){
    const cached=loadCache("met_salto_city_"+currentCity()[0]);
    if(!cached || Date.now()-cached.time>5*60*1000) loadAll();
  }
});

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
}

weatherTimer=setInterval(loadAll,REFRESH);
countdownTimer=setInterval(updateCountdown,1000);
loadAll();
