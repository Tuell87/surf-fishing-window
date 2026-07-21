const DEFAULTS={lat:30.346,lon:-86.227,locationName:"Santa Rosa Beach, FL",tideStation:"8729376",notifyScore:72};
const TIDE_STATIONS={"8729376":{name:"NOAA 8729376 — Santa Rosa Hogtown Bayou",lat:30.4,lon:-86.2283}};
let config={...DEFAULTS,...JSON.parse(localStorage.getItem("fishConfig")||"{}")};let lastNotificationKey="",map,forecastMarker,tideMarker,accuracyCircle;const $=id=>document.getElementById(id);
$("notifyScore").value=config.notifyScore;$("tideStation").value=config.tideStation;$("locationName").textContent=config.locationName;
function saveConfig(){config.notifyScore=Number($("notifyScore").value||72);config.tideStation=$("tideStation").value.trim()||DEFAULTS.tideStation;localStorage.setItem("fishConfig",JSON.stringify(config))}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[c])}

// --- Map (v0.2.1 stability rewrite) ---------------------------------------
// The map is built once. After that we MOVE markers with setLatLng instead of
// deleting and re-adding them, and we never recenter or re-zoom during a
// forecast refresh. That removes the flicker and the zoom "jump" on iPhone.
function initMap(){
  if(!window.L){$("mapStatus").textContent="Map library unavailable";return}
  map=L.map("map",{zoomControl:true,attributionControl:true}).setView([config.lat,config.lon],13);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  updateMapMarkers(false);
  // iOS PWAs sometimes report the container size wrong until layout settles,
  // which makes zooming jump. Re-check the size a couple of times after load
  // and whenever the phone rotates.
  const fixSize=()=>{if(map)map.invalidateSize(false)};
  setTimeout(fixSize,200);
  setTimeout(fixSize,600);
  window.addEventListener("resize",fixSize);
  window.addEventListener("orientationchange",()=>setTimeout(fixSize,300));
}
function updateMapMarkers(recenter=false,accuracy=null){
  if(!map)return;
  // Forecast (blue) marker — create once, then move.
  if(!forecastMarker){
    forecastMarker=L.circleMarker([config.lat,config.lon],{radius:10,color:"#fff",weight:3,fillColor:"#176c87",fillOpacity:1}).addTo(map).bindPopup(`<strong>${escapeHtml(config.locationName)}</strong><br>Forecast location`);
  }else{
    forecastMarker.setLatLng([config.lat,config.lon]);
    forecastMarker.setPopupContent(`<strong>${escapeHtml(config.locationName)}</strong><br>Forecast location`);
  }
  // Accuracy circle — only touched when we have a fresh GPS accuracy value.
  if(Number.isFinite(accuracy)&&accuracy>0){
    if(!accuracyCircle){
      accuracyCircle=L.circle([config.lat,config.lon],{radius:accuracy,color:"#176c87",weight:1,fillColor:"#176c87",fillOpacity:.1}).addTo(map);
    }else{
      accuracyCircle.setLatLng([config.lat,config.lon]);
      accuracyCircle.setRadius(accuracy);
    }
  }
  // Tide station (anchor) marker — create once, move if the station changes.
  const s=TIDE_STATIONS[config.tideStation];
  if(s){
    if(!tideMarker){
      tideMarker=L.marker([s.lat,s.lon]).addTo(map).bindPopup(`<strong>⚓ ${escapeHtml(s.name)}</strong><br>Used for tide predictions`);
    }else{
      tideMarker.setLatLng([s.lat,s.lon]);
      tideMarker.setPopupContent(`<strong>⚓ ${escapeHtml(s.name)}</strong><br>Used for tide predictions`);
    }
  }
  $("openMapsLink").href=`https://maps.apple.com/?ll=${config.lat},${config.lon}&q=${encodeURIComponent(config.locationName)}`;
  $("mapStatus").textContent=`${config.lat.toFixed(4)}, ${config.lon.toFixed(4)}`;
  // Only recenter on an explicit request (Center button or a fresh GPS fix),
  // and keep the user's current zoom instead of snapping back to 14.
  if(recenter){map.stop();map.setView([config.lat,config.lon],map.getZoom()||14)}
}
// -------------------------------------------------------------------------

function windMph(t){return parseFloat(String(t||"0").match(/[\d.]+/)?.[0]||0)}function dateYmd(d){return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`}function fmtTime(d){return new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(d)}
async function getJson(url){const r=await fetch(url,{headers:{Accept:"application/geo+json, application/json"}});if(!r.ok)throw new Error(`${r.status} from ${new URL(url).hostname}`);return r.json()}
async function fetchWeather(){const p=await getJson(`https://api.weather.gov/points/${config.lat.toFixed(4)},${config.lon.toFixed(4)}`);const[h,a]=await Promise.all([getJson(p.properties.forecastHourly),getJson(`https://api.weather.gov/alerts/active?point=${config.lat.toFixed(4)},${config.lon.toFixed(4)}`)]);return{periods:h.properties.periods,alerts:a.features||[]}}
async function fetchTides(){const b=new Date(),e=new Date(Date.now()+3*86400000),p=new URLSearchParams({product:"predictions",application:"SurfFishingPhone",begin_date:dateYmd(b),end_date:dateYmd(e),datum:"MLLW",station:config.tideStation,time_zone:"lst_ldt",units:"english",interval:"hilo",format:"json"});try{const d=await getJson(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${p}`);return(d.predictions||[]).map(x=>({time:new Date(x.t.replace(" ","T")),type:x.type==="H"?"High":"Low",feet:Number(x.v)}))}catch(err){console.warn("Tide data unavailable",err);return[]}}
function dangerAlerts(f){const terms=["hurricane","tropical storm","storm surge","tornado","high surf","rip current","flash flood","severe thunderstorm","special marine warning"];return[...new Set(f.map(x=>x.properties?.event||"").filter(e=>terms.some(t=>e.toLowerCase().includes(t))))]}
function nearestTide(start,tides){if(!tides.length)return{note:"Tide unavailable",bonus:0};const n=tides.reduce((a,b)=>Math.abs(b.time-start)<Math.abs(a.time-start)?b:a),hours=Math.abs(n.time-start)/3600000;return{note:`${n.type} ${n.time.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})} (${n.feet.toFixed(1)} ft)`,bonus:Math.max(0,10-hours*4)}}
function scorePeriod(p,tides,dangers){const start=new Date(p.startTime),wind=windMph(p.windSpeed),rain=Number(p.probabilityOfPrecipitation?.value||0),forecast=String(p.shortForecast||"").toLowerCase(),reasons=[];let score=100;if(dangers.length){score-=65;reasons.push(`Active hazard: ${dangers.slice(0,2).join(", ")}`)}if(forecast.includes("thunder")){score-=45;reasons.push("Thunderstorms possible")}else if(rain>=70){score-=28;reasons.push(`Heavy rain risk ${rain}%`)}else if(rain>=40){score-=15;reasons.push(`Rain risk ${rain}%`)}else if(rain<=20){score+=4;reasons.push("Low rain chance")}if(wind>=25){score-=35;reasons.push(`Very strong wind ${wind} mph`)}else if(wind>=18){score-=22;reasons.push(`Strong wind ${wind} mph`)}else if(wind>=13){score-=10;reasons.push(`Breezy ${wind} mph`)}else if(wind>=3){score+=8;reasons.push(`Manageable wind ${wind} mph`)}const h=start.getHours();if([5,6,7,18,19,20].includes(h)){score+=12;reasons.push("Prime dawn/dusk period")}else if(h<5||h>20){score-=10;reasons.push("Outside daylight hours")}const tide=nearestTide(start,tides);score+=tide.bonus;if(tide.bonus>=5)reasons.push("Good moving-water timing");score=Math.max(0,Math.min(100,Math.round(score)));const verdict=score>=80?"Excellent":score>=68?"Good":score>=50?"Marginal":"Avoid";return{start,temp:p.temperature,wind,rain,tide:tide.note,score,verdict,reasons}}
function render(windows,dangers){const safety=$("safetyCard");safety.className=`card safety ${dangers.length?"danger":"safe"}`;$("safetyTitle").textContent=dangers.length?"Do not surf fish right now":"No major hazard override detected";$("safetyText").textContent=dangers.length?`Active alert${dangers.length>1?"s":""}: ${dangers.join(", ")}. Local flags and officials override this app.`:"Continue checking lightning, beach flags, surf height, and local instructions.";const eligible=dangers.length?windows:windows.filter(w=>w.start>new Date()),best=[...eligible].sort((a,b)=>b.score-a.score)[0];if(best){$("bestTime").textContent=fmtTime(best.start);$("bestScore").textContent=best.score;$("bestSummary").textContent=dangers.length?`Hazard override active. Computed score: ${best.verdict}.`:`${best.verdict} • ${best.tide}`}$("windows").innerHTML=windows.map(w=>`<article class="window"><div><div class="time">${escapeHtml(fmtTime(w.start))}</div><div class="details">${w.temp??"—"}°F • Wind ${w.wind} mph • Rain ${w.rain}%<br>${escapeHtml(w.tide)}<br>${escapeHtml(w.reasons.slice(0,3).join(" • "))}</div></div><div class="badge ${w.verdict.toLowerCase()}">${w.score}</div></article>`).join("");$("updatedAt").textContent=`Updated ${new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}`;localStorage.setItem("lastForecast",JSON.stringify({windows,dangers,savedAt:new Date().toISOString()}));maybeNotify(best,dangers)}
async function refresh(){$("refreshBtn").disabled=true;$("safetyTitle").textContent="Checking official conditions…";try{saveConfig();updateMapMarkers(false);const[{periods,alerts},tides]=await Promise.all([fetchWeather(),fetchTides()]),dangers=dangerAlerts(alerts),windows=periods.slice(0,48).map(p=>scorePeriod(p,tides,dangers));render(windows,dangers)}catch(e){$("safetyCard").className="card safety warning";$("safetyTitle").textContent="Live update unavailable";$("safetyText").textContent=`${e.message}. Showing the most recent saved data when available.`;const saved=JSON.parse(localStorage.getItem("lastForecast")||"null");if(saved)render(saved.windows.map(w=>({...w,start:new Date(w.start)})),saved.dangers)}finally{$("refreshBtn").disabled=false}}
async function maybeNotify(best,dangers){if(!best||dangers.length||!("Notification"in window)||Notification.permission!=="granted"||best.score<config.notifyScore)return;const key=`${best.start.toISOString()}-${best.score}`;if(key===lastNotificationKey)return;lastNotificationKey=key;new Notification("Good surf-fishing window found",{body:`${fmtTime(best.start)}: ${best.score}/100 (${best.verdict}). ${best.tide}`,icon:"icons/icon-192.png"})}
$("refreshBtn").addEventListener("click",refresh);$("notifyScore").addEventListener("change",saveConfig);$("tideStation").addEventListener("change",()=>{saveConfig();updateMapMarkers(false)});$("centerMapBtn").addEventListener("click",()=>updateMapMarkers(true));$("locationBtn").addEventListener("click",()=>{if(!navigator.geolocation){alert("Location is not supported on this device.");return}$("mapStatus").textContent="Finding your location…";navigator.geolocation.getCurrentPosition(pos=>{config.lat=pos.coords.latitude;config.lon=pos.coords.longitude;config.locationName="Current location";$("locationName").textContent=config.locationName;saveConfig();updateMapMarkers(true,pos.coords.accuracy);refresh()},err=>{$("mapStatus").textContent="Location not changed";alert(`Location permission was not granted: ${err.message}`)},{enableHighAccuracy:true,timeout:15000,maximumAge:60000})});$("notifyBtn").addEventListener("click",async()=>{if(!("Notification"in window)){alert("Notifications are not supported here.");return}const result=await Notification.requestPermission();alert(result==="granted"?"Notifications enabled while the app is open.":"Notification permission was not granted.")});$("dismissInstall").addEventListener("click",()=>$("installCard").classList.add("hidden"));if(navigator.standalone!==true)$("installCard").classList.remove("hidden");if("serviceWorker"in navigator)navigator.serviceWorker.register("service-worker.js");initMap();refresh();setInterval(refresh,15*60*1000);
