const DEFAULTS={lat:30.346,lon:-86.227,locationName:"Santa Rosa Beach, FL",tideStation:"8729376",notifyScore:72,followLocation:false};
const TIDE_STATIONS={"8729376":{name:"NOAA 8729376 — Santa Rosa Hogtown Bayou",lat:30.4,lon:-86.2283}};
let config={...DEFAULTS,...JSON.parse(localStorage.getItem("fishConfig")||"{}")};let lastNotificationKey="",map,forecastMarker,tideMarker,accuracyCircle,lastTideStation=null;const $=id=>document.getElementById(id);
$("notifyScore").value=config.notifyScore;$("tideStation").value=config.tideStation;$("locationName").textContent=config.locationName;$("followLocation").checked=!!config.followLocation;
function saveConfig(){config.notifyScore=Number($("notifyScore").value||72);config.tideStation=$("tideStation").value.trim()||DEFAULTS.tideStation;config.followLocation=!!$("followLocation").checked;localStorage.setItem("fishConfig",JSON.stringify(config))}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[c])}
function initMap(){
  if(!window.L){$("mapStatus").textContent="Map library unavailable";return}
  map=L.map("map",{zoomControl:true,attributionControl:true}).setView([config.lat,config.lon],13);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  updateMapMarkers(false);
  const invalidate=()=>{if(map)map.invalidateSize()};
  setTimeout(invalidate,150);
  window.addEventListener("resize",invalidate);
  window.addEventListener("orientationchange",()=>setTimeout(invalidate,200));
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)setTimeout(invalidate,100)});
  if(window.ResizeObserver){new ResizeObserver(()=>invalidate()).observe($("map"))}
}
function updateMapMarkers(recenter=true,accuracy=null){
  if(!map)return;
  const hasAccuracy=Number.isFinite(accuracy)&&accuracy>0;
  if(forecastMarker){forecastMarker.setLatLng([config.lat,config.lon])}
  else{forecastMarker=L.circleMarker([config.lat,config.lon],{radius:10,color:"#fff",weight:3,fillColor:"#176c87",fillOpacity:1}).addTo(map)}
  forecastMarker.bindPopup(`<strong>${escapeHtml(config.locationName)}</strong><br>Forecast location`);
  if(hasAccuracy){
    if(accuracyCircle){accuracyCircle.setLatLng([config.lat,config.lon]);accuracyCircle.setRadius(accuracy)}
    else{accuracyCircle=L.circle([config.lat,config.lon],{radius:accuracy,color:"#176c87",weight:1,fillColor:"#176c87",fillOpacity:.1}).addTo(map)}
  }else if(accuracyCircle){map.removeLayer(accuracyCircle);accuracyCircle=null}
  const s=TIDE_STATIONS[config.tideStation];
  if(s){
    if(tideMarker&&lastTideStation===config.tideStation){tideMarker.setLatLng([s.lat,s.lon])}
    else{if(tideMarker)map.removeLayer(tideMarker);tideMarker=L.marker([s.lat,s.lon]).addTo(map).bindPopup(`<strong>⚓ ${escapeHtml(s.name)}</strong><br>Used for tide predictions`);lastTideStation=config.tideStation}
  }else if(tideMarker){map.removeLayer(tideMarker);tideMarker=null;lastTideStation=null}
  $("openMapsLink").href=`https://maps.apple.com/?ll=${config.lat},${config.lon}&q=${encodeURIComponent(config.locationName)}`;
  $("mapStatus").textContent=`${config.lat.toFixed(4)}, ${config.lon.toFixed(4)}`;
  if(recenter){map.stop();map.setView([config.lat,config.lon],14)}
}
const CAMS=[
  {name:"30A Bay Cam",desc:"Choctawhatchee Bay view from The Bay in Santa Rosa Beach.",url:"https://30a.com/bay-cam/",lat:30.393,lon:-86.199},
  {name:"31 on 30A Beachcam",desc:"Gulf-front beach view in Santa Rosa Beach.",url:"https://30a.com/31-on-30a-webcam-santa-rosa-beach-fl/",lat:30.348,lon:-86.234},
  {name:"Vue on 30A Beach Cam",desc:"Beachfront dining view overlooking the Gulf of Mexico.",url:"https://www.livebeaches.com/webcams/vue-on-30a-beach-cam/",lat:30.3482,lon:-86.2358},
  {name:"SkylineWebcams — Santa Rosa Beach",desc:"Wide view of the white-sand coastline.",url:"https://www.skylinewebcams.com/en/webcam/united-states/florida/santa-rosa/santa-rosa-beach.html",lat:30.348,lon:-86.236},
  {name:"WebcamTaxi — Santa Rosa Beach",desc:"Gulf of Mexico view near the Vue on 30A.",url:"https://www.webcamtaxi.com/en/usa/florida/santa-rosa-beach.html",lat:30.348,lon:-86.235}
];
const CAM_RADIUS_MILES=40;
function haversineMiles(lat1,lon1,lat2,lon2){const R=3958.8,toRad=d=>d*Math.PI/180,dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;return R*2*Math.asin(Math.sqrt(a))}
function renderCams(){
  const list=$("camsList");if(!list)return;
  $("camsLocation").textContent=config.locationName;
  const nearby=CAMS.map(c=>({...c,dist:haversineMiles(config.lat,config.lon,c.lat,c.lon)})).filter(c=>c.dist<=CAM_RADIUS_MILES).sort((a,b)=>a.dist-b.dist);
  const cards=nearby.map(c=>`<article class="camera-card"><div class="camera-preview">${escapeHtml(c.name.toUpperCase())}</div><div class="camera-copy"><h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(c.desc)} • ${c.dist.toFixed(1)} mi away</p><a class="button-link" href="${c.url}" target="_blank" rel="noopener">Open live cam</a></div></article>`).join("");
  const searchUrl=`https://www.google.com/search?q=${encodeURIComponent(`${config.locationName} beach cam live webcam`)}`;
  const mapsUrl=`https://www.google.com/maps/search/beach+camera/@${config.lat},${config.lon},12z`;
  const fallback=`<article class="camera-card"><div class="camera-preview">SEARCH</div><div class="camera-copy"><h3>Find more cams near ${escapeHtml(config.locationName)}</h3><p>${nearby.length?"Didn't see the spot you wanted? Search the web for more options nearby.":"No curated cams saved for this location yet. Search the web for cams nearby."}</p><a class="button-link" href="${searchUrl}" target="_blank" rel="noopener">Search the web</a></div></article><article class="camera-card"><div class="camera-preview">MAP</div><div class="camera-copy"><h3>Browse nearby on the map</h3><p>Opens a map centered on your forecast location so you can spot piers, beach accesses, and cams nearby.</p><a class="button-link" href="${mapsUrl}" target="_blank" rel="noopener">Open map search</a></div></article>`;
  list.innerHTML=cards+fallback;
}
function windMph(t){return parseFloat(String(t||"0").match(/[\d.]+/)?.[0]||0)}function dateYmd(d){return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`}function fmtTime(d){return new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(d)}
async function getJson(url){const r=await fetch(url,{headers:{Accept:"application/geo+json, application/json"}});if(!r.ok)throw new Error(`${r.status} from ${new URL(url).hostname}`);return r.json()}
async function fetchWeather(){const p=await getJson(`https://api.weather.gov/points/${config.lat.toFixed(4)},${config.lon.toFixed(4)}`);const[h,a]=await Promise.all([getJson(p.properties.forecastHourly),getJson(`https://api.weather.gov/alerts/active?point=${config.lat.toFixed(4)},${config.lon.toFixed(4)}`)]);return{periods:h.properties.periods,alerts:a.features||[]}}
async function fetchTides(){const b=new Date(),e=new Date(Date.now()+3*86400000),p=new URLSearchParams({product:"predictions",application:"SurfFishingPhone",begin_date:dateYmd(b),end_date:dateYmd(e),datum:"MLLW",station:config.tideStation,time_zone:"lst_ldt",units:"english",interval:"hilo",format:"json"});try{const d=await getJson(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${p}`);return(d.predictions||[]).map(x=>({time:new Date(x.t.replace(" ","T")),type:x.type==="H"?"High":"Low",feet:Number(x.v)}))}catch(err){console.warn("Tide data unavailable",err);return[]}}
function dangerAlerts(f){const terms=["hurricane","tropical storm","storm surge","tornado","high surf","rip current","flash flood","severe thunderstorm","special marine warning"];return[...new Set(f.map(x=>x.properties?.event||"").filter(e=>terms.some(t=>e.toLowerCase().includes(t))))]}
function nearestTide(start,tides){if(!tides.length)return{note:"Tide unavailable",bonus:0};const n=tides.reduce((a,b)=>Math.abs(b.time-start)<Math.abs(a.time-start)?b:a),hours=Math.abs(n.time-start)/3600000;return{note:`${n.type} ${n.time.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})} (${n.feet.toFixed(1)} ft)`,bonus:Math.max(0,10-hours*4)}}
function scorePeriod(p,tides,dangers){const start=new Date(p.startTime),wind=windMph(p.windSpeed),rain=Number(p.probabilityOfPrecipitation?.value||0),forecast=String(p.shortForecast||"").toLowerCase(),reasons=[];let score=100;if(dangers.length){score-=65;reasons.push(`Active hazard: ${dangers.slice(0,2).join(", ")}`)}if(forecast.includes("thunder")){score-=45;reasons.push("Thunderstorms possible")}else if(rain>=70){score-=28;reasons.push(`Heavy rain risk ${rain}%`)}else if(rain>=40){score-=15;reasons.push(`Rain risk ${rain}%`)}else if(rain<=20){score+=4;reasons.push("Low rain chance")}if(wind>=25){score-=35;reasons.push(`Very strong wind ${wind} mph`)}else if(wind>=18){score-=22;reasons.push(`Strong wind ${wind} mph`)}else if(wind>=13){score-=10;reasons.push(`Breezy ${wind} mph`)}else if(wind>=3){score+=8;reasons.push(`Manageable wind ${wind} mph`)}const h=start.getHours();if([5,6,7,18,19,20].includes(h)){score+=12;reasons.push("Prime dawn/dusk period")}else if(h<5||h>20){score-=10;reasons.push("Outside daylight hours")}const tide=nearestTide(start,tides);score+=tide.bonus;if(tide.bonus>=5)reasons.push("Good moving-water timing");score=Math.max(0,Math.min(100,Math.round(score)));const verdict=score>=80?"Excellent":score>=68?"Good":score>=50?"Marginal":"Avoid";return{start,temp:p.temperature,wind,rain,tide:tide.note,score,verdict,reasons}}
function render(windows,dangers){const safety=$("safetyCard");safety.className=`card safety ${dangers.length?"danger":"safe"}`;$("safetyTitle").textContent=dangers.length?"Do not surf fish right now":"No major hazard override detected";$("safetyText").textContent=dangers.length?`Active alert${dangers.length>1?"s":""}: ${dangers.join(", ")}. Local flags and officials override this app.`:"Continue checking lightning, beach flags, surf height, and local instructions.";const eligible=dangers.length?windows:windows.filter(w=>w.start>new Date()),best=[...eligible].sort((a,b)=>b.score-a.score)[0];if(best){$("bestTime").textContent=fmtTime(best.start);$("bestScore").textContent=best.score;$("bestSummary").textContent=dangers.length?`Hazard override active. Computed score: ${best.verdict}.`:`${best.verdict} • ${best.tide}`}$("windows").innerHTML=windows.map(w=>`<article class="window"><div><div class="time">${escapeHtml(fmtTime(w.start))}</div><div class="details">${w.temp??"—"}°F • Wind ${w.wind} mph • Rain ${w.rain}%<br>${escapeHtml(w.tide)}<br>${escapeHtml(w.reasons.slice(0,3).join(" • "))}</div></div><div class="badge ${w.verdict.toLowerCase()}">${w.score}</div></article>`).join("");$("updatedAt").textContent=`Updated ${new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}`;localStorage.setItem("lastForecast",JSON.stringify({windows,dangers,savedAt:new Date().toISOString()}));maybeNotify(best,dangers)}
async function refresh(){$("refreshBtn").disabled=true;$("safetyTitle").textContent="Checking official conditions…";try{saveConfig();updateMapMarkers(config.followLocation);const[{periods,alerts},tides]=await Promise.all([fetchWeather(),fetchTides()]),dangers=dangerAlerts(alerts),windows=periods.slice(0,48).map(p=>scorePeriod(p,tides,dangers));render(windows,dangers)}catch(e){$("safetyCard").className="card safety warning";$("safetyTitle").textContent="Live update unavailable";$("safetyText").textContent=`${e.message}. Showing the most recent saved data when available.`;const saved=JSON.parse(localStorage.getItem("lastForecast")||"null");if(saved)render(saved.windows.map(w=>({...w,start:new Date(w.start)})),saved.dangers)}finally{$("refreshBtn").disabled=false}}
async function maybeNotify(best,dangers){if(!best||dangers.length||!("Notification"in window)||Notification.permission!=="granted"||best.score<config.notifyScore)return;const key=`${best.start.toISOString()}-${best.score}`;if(key===lastNotificationKey)return;lastNotificationKey=key;new Notification("Good surf-fishing window found",{body:`${fmtTime(best.start)}: ${best.score}/100 (${best.verdict}). ${best.tide}`,icon:"icons/icon-192.png"})}
$("refreshBtn").addEventListener("click",refresh);$("notifyScore").addEventListener("change",saveConfig);$("tideStation").addEventListener("change",()=>{saveConfig();updateMapMarkers(false)});$("followLocation").addEventListener("change",saveConfig);$("centerMapBtn").addEventListener("click",()=>updateMapMarkers(true));$("locationBtn").addEventListener("click",()=>{if(!navigator.geolocation){alert("Location is not supported on this device.");return}$("mapStatus").textContent="Finding your location…";navigator.geolocation.getCurrentPosition(pos=>{config.lat=pos.coords.latitude;config.lon=pos.coords.longitude;config.locationName="Current location";$("locationName").textContent=config.locationName;saveConfig();updateMapMarkers(true,pos.coords.accuracy);refresh();renderCams()},err=>{$("mapStatus").textContent="Location not changed";alert(`Location permission was not granted: ${err.message}`)},{enableHighAccuracy:true,timeout:15000,maximumAge:60000})});$("notifyBtn").addEventListener("click",async()=>{if(!("Notification"in window)){alert("Notifications are not supported here.");return}const result=await Notification.requestPermission();alert(result==="granted"?"Notifications enabled while the app is open.":"Notification permission was not granted.")});$("dismissInstall").addEventListener("click",()=>$("installCard").classList.add("hidden"));if(navigator.standalone!==true)$("installCard").classList.remove("hidden");if("serviceWorker"in navigator)navigator.serviceWorker.register("service-worker.js");initMap();refresh();renderCams();setInterval(refresh,15*60*1000);

function activateTab(tabId) {
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === tabId);
  });

  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  const selected = document.getElementById(tabId);
  if (selected) selected.classList.add('active');

  const details = document.getElementById('forecast-details');
  if (details) details.classList.toggle('active', tabId === 'forecast');

  if (tabId === 'map-section' && map) {
    setTimeout(() => map.invalidateSize(), 100);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', () => activateTab(button.dataset.tab));
});
