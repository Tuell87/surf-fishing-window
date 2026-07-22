const DEFAULTS={lat:30.346,lon:-86.227,locationName:"Santa Rosa Beach, FL",tideStation:"8729376",notifyScore:72};
// Fallback used only if the NOAA station list can't be fetched (offline, etc.)
const FALLBACK_STATION={id:"8729376",name:"Santa Rosa Hogtown Bayou",state:"FL",lat:30.4,lon:-86.2283};
let tideStations=[FALLBACK_STATION];
let config={...DEFAULTS,...JSON.parse(localStorage.getItem("fishConfig")||"{}")};let lastNotificationKey="",map,forecastMarker,tideMarker,accuracyCircle;const $=id=>document.getElementById(id);
$("notifyScore").value=config.notifyScore;$("locationName").textContent=config.locationName;
function saveConfig(){config.notifyScore=Number($("notifyScore").value||72);config.tideStation=$("tideStation").value.trim()||DEFAULTS.tideStation;localStorage.setItem("fishConfig",JSON.stringify(config))}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[c])}

// --- Map (v0.2.1 stability rewrite, v0.2.3 multi-source) ------------------
// v0.2.3: rather than depending on one tile provider, we keep an ordered
// list. If the active source starts erroring out repeatedly (an outage,
// rate limiting, etc.) we automatically swap to the next one instead of
// leaving gray tiles on screen.
const TILE_SOURCES=[
  {url:"https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",options:{subdomains:"abcd",maxZoom:20,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'}},
  {url:"https://tile.openstreetmap.org/{z}/{x}/{y}.png",options:{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}},
  {url:"https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",options:{subdomains:"abc",maxZoom:17,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | &copy; OpenTopoMap'}}
];
let activeTileIndex=0,tileErrorCount=0,tileLayer;
function addTileLayer(index){
  if(tileLayer)map.removeLayer(tileLayer);
  const src=TILE_SOURCES[index];
  activeTileIndex=index;
  tileErrorCount=0;
  tileLayer=L.tileLayer(src.url,src.options).addTo(map);
  tileLayer.on("tileerror",err=>{
    tileErrorCount++;
    // Retry the individual failed tile (up to 2x) instead of leaving it
    // permanently blank — this is what was missing: scattered one-off tile
    // failures (a handful out of dozens per view) never hit the "swap the
    // whole source" threshold below, so they just sat blank forever.
    const tile=err.tile;
    if(tile){
      const attempts=Number(tile.dataset.retryCount||0);
      if(attempts<2){
        tile.dataset.retryCount=String(attempts+1);
        setTimeout(()=>{tile.src=tile.src},600*(attempts+1));
      }
    }
    // Separately, if the whole source is unhealthy (lots of errors, not
    // just one-off blips), swap to the next source in the list.
    if(tileErrorCount>=12 && activeTileIndex<TILE_SOURCES.length-1){
      $("mapStatus").textContent="Switching map source…";
      addTileLayer(activeTileIndex+1);
    }
  });
}
function initMap(){
  if(!window.L){$("mapStatus").textContent="Map library unavailable";return}
  map=L.map("map",{zoomControl:true,attributionControl:true}).setView([config.lat,config.lon],13);
  addTileLayer(0);
  updateMapMarkers(false);
  const fixSize=()=>{if(map)map.invalidateSize(false)};
  setTimeout(fixSize,200);
  setTimeout(fixSize,600);
  window.addEventListener("resize",fixSize);
  window.addEventListener("orientationchange",()=>setTimeout(fixSize,300));
}
function updateMapMarkers(recenter=false,accuracy=null){
  if(!map)return;
  if(!forecastMarker){
    forecastMarker=L.circleMarker([config.lat,config.lon],{radius:10,color:"#fff",weight:3,fillColor:"#176c87",fillOpacity:1}).addTo(map).bindPopup(`<strong>${escapeHtml(config.locationName)}</strong><br>Forecast location`);
  }else{
    forecastMarker.setLatLng([config.lat,config.lon]);
    forecastMarker.setPopupContent(`<strong>${escapeHtml(config.locationName)}</strong><br>Forecast location`);
  }
  if(Number.isFinite(accuracy)&&accuracy>0){
    if(!accuracyCircle){
      accuracyCircle=L.circle([config.lat,config.lon],{radius:accuracy,color:"#176c87",weight:1,fillColor:"#176c87",fillOpacity:.1}).addTo(map);
    }else{
      accuracyCircle.setLatLng([config.lat,config.lon]);
      accuracyCircle.setRadius(accuracy);
    }
  }
  const s=tideStations.find(x=>x.id===config.tideStation);
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
  if(recenter){map.stop();map.setView([config.lat,config.lon],map.getZoom()||14)}
}
// -------------------------------------------------------------------------

// --- Tabs ------------------------------------------------------------------
// Switching tabs shows/hides whole panels (Forecast / Map / Cameras) and
// scrolls back to the top, so the tapped section lands right under the
// sticky tab bar instead of leaving you scrolled mid-page.
function initTabs(){
  const buttons=[...document.querySelectorAll(".tab-button")];
  buttons.forEach(btn=>{
    btn.addEventListener("click",()=>{
      buttons.forEach(b=>{b.classList.toggle("active",b===btn);b.setAttribute("aria-selected",b===btn?"true":"false")});
      document.querySelectorAll(".tab-panel").forEach(p=>p.classList.toggle("active",p.id===`panel-${btn.dataset.tab}`));
      window.scrollTo({top:0,behavior:"smooth"});
      if(btn.dataset.tab==="map"){
        // Leaflet measures its container's size when it's created. A map
        // built while its tab is hidden (display:none) gets a 0x0 reading,
        // which is what produced the glitchy/blotchy tiles — no amount of
        // invalidateSize() afterward fully recovers from that. The fix is
        // to not build the map until its panel is actually visible.
        if(!map){
          initMap();
        }else{
          setTimeout(()=>map.invalidateSize(false),50);
          setTimeout(()=>map.invalidateSize(false),300);
        }
      }
      if(btn.dataset.tab==="cameras"){renderCameras()}
    });
  });
}

// --- Live cams ---------------------------------------------------------
// Primary source: Windy Webcams API (real, nearby live cams worldwide).
// Fallback source: the curated 30A list, used only if the API call fails
// or returns nothing for the current location.
const WINDY_API_KEY="iEJjQvIzDa5Mxw2pWQSulIxstrZEumPO";
const CAM_RADIUS_MILES=15;
const WINDY_RADIUS_KM=Math.round(CAM_RADIUS_MILES*1.60934);
const CAM_HUB_URL="https://30awatchtower.com/";
const LIVE_CAMS=[
  {name:"Vue on 30A",town:"Santa Rosa Beach, FL",lat:30.353,lon:-86.239,url:"https://www.webcamtaxi.com/en/usa/florida/santa-rosa-beach.html",desc:"Beach & Gulf view"},
  {name:"The Bay Restaurant",town:"Santa Rosa Beach, FL",lat:30.386,lon:-86.203,url:"https://www.webcamtaxi.com/en/usa/florida/santarosabeach-thebay.html",desc:"Choctawhatchee Bay view"},
  {name:"Grayton Beach",town:"Grayton Beach, FL",lat:30.324,lon:-86.157,url:"https://www.skylinewebcams.com/en/webcam/united-states/florida/grayton-beach/grayton-beach.html",desc:"Beach view"},
  {name:"31 on 30A",town:"Inlet Beach, FL",lat:30.281,lon:-86.033,url:"https://30a.com/31-on-30a-webcam-santa-rosa-beach-fl/",desc:"Beach view"}
];
function milesBetween(lat1,lon1,lat2,lon2){
  const R=3958.8,toRad=d=>d*Math.PI/180,dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
async function fetchWindyCams(){
  const url=`https://api.windy.com/webcams/api/v3/webcams?nearby=${config.lat.toFixed(4)},${config.lon.toFixed(4)},${WINDY_RADIUS_KM}&limit=12&include=location,images,urls`;
  const r=await fetch(url,{headers:{"x-windy-api-key":WINDY_API_KEY}});
  if(!r.ok)throw new Error(`${r.status} from Windy Webcams API`);
  const data=await r.json();
  const list=data.webcams||data.result?.webcams||[];
  return list.map(w=>{
    const loc=w.location||{};
    return{
      name:w.title||w.name||"Live cam",
      town:[loc.city,loc.region].filter(Boolean).join(", ")||loc.country||"",
      lat:loc.latitude??loc.lat,
      lon:loc.longitude??loc.lon,
      url:w.urls?.detail||w.url||"https://www.windy.com/webcams",
      desc:"Live cam",
      thumb:w.images?.current?.thumbnail||w.images?.current?.preview||null
    };
  }).filter(c=>Number.isFinite(c.lat)&&Number.isFinite(c.lon));
}
async function renderCameras(){
  $("cameraStatus").textContent="Finding nearby cams…";
  let cams,source="live";
  try{
    cams=await fetchWindyCams();
    if(!cams.length)throw new Error("No cams returned");
  }catch(err){
    console.warn("Windy Webcams unavailable, using curated list",err);
    source="curated";
    cams=LIVE_CAMS.map(c=>({...c}));
  }
  const withDist=cams.map(c=>({...c,miles:milesBetween(config.lat,config.lon,c.lat,c.lon)})).sort((a,b)=>a.miles-b.miles);
  const near=withDist.filter(c=>c.miles<=CAM_RADIUS_MILES);
  const shown=(near.length?near:withDist).slice(0,8);
  $("cameraStatus").textContent=shown.length?`${source==="live"?"Live":"Curated"} • within ${CAM_RADIUS_MILES} mi${near.length?"":" (nearest shown)"}`:"No cams found nearby";
  $("cameraGrid").innerHTML=shown.map(c=>`<article class="camera-card">${c.thumb?`<img class="camera-preview-img" src="${c.thumb}" alt="${escapeHtml(c.name)}" loading="lazy">`:`<div class="camera-preview">${escapeHtml(c.name)}</div>`}<div class="camera-copy"><h3>${escapeHtml(c.name)}</h3><p><span class="distance">${c.miles.toFixed(1)} mi</span> • ${escapeHtml(c.town||"")} • ${escapeHtml(c.desc||"")}</p><a class="button-link" href="${c.url}" target="_blank" rel="noopener">Open live cam</a></div></article>`).join("")
    +`<p class="fineprint camera-note">${source==="live"?"Live cams from the Windy Webcams network.":"Showing a curated backup list — live search was unavailable."} Links open the provider's own page in a new tab. For more cams along the whole 30A corridor, see <a href="${CAM_HUB_URL}" target="_blank" rel="noopener">30A Watchtower</a>.</p>`;
}
// -------------------------------------------------------------------------

// --- Tide stations -------------------------------------------------------
// NOAA's own public station directory (no key needed) — fetched once,
// then filtered/sorted by distance from the current forecast location,
// same pattern as the live cams list.
const NOAA_STATIONS_URL="https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions";
let tideStationsLoaded=false;
async function loadTideStations(){
  if(tideStationsLoaded)return tideStations;
  try{
    const r=await fetch(NOAA_STATIONS_URL);
    if(!r.ok)throw new Error(`${r.status} from NOAA station list`);
    const data=await r.json();
    const list=(data.stationList||data.stations||[]).filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lng)).map(s=>({id:String(s.id),name:s.name,state:s.state||"",lat:s.lat,lon:s.lng}));
    if(list.length)tideStations=list;
    tideStationsLoaded=true;
  }catch(err){
    console.warn("NOAA station list unavailable, using fallback station",err);
    tideStations=[FALLBACK_STATION];
  }
  return tideStations;
}
function renderTideStationOptions(){
  const withDist=tideStations.map(s=>({...s,miles:milesBetween(config.lat,config.lon,s.lat,s.lon)})).sort((a,b)=>a.miles-b.miles);
  const nearest=withDist.slice(0,20);
  // Always keep the currently-selected station in the list even if it fell
  // outside the nearest 20, so switching location doesn't silently change it.
  if(!nearest.some(s=>s.id===config.tideStation)){
    const current=withDist.find(s=>s.id===config.tideStation);
    if(current)nearest.unshift(current);
  }
  const sel=$("tideStation");
  sel.innerHTML=nearest.map(s=>`<option value="${s.id}">${s.id} — ${escapeHtml(s.name)}${s.state?", "+escapeHtml(s.state):""} (${s.miles.toFixed(1)} mi)</option>`).join("");
  sel.value=config.tideStation;
  if(sel.value!==config.tideStation && nearest.length){
    // Selected station wasn't in the list at all (e.g. first load); default
    // to the nearest one instead of silently leaving it blank.
    config.tideStation=nearest[0].id;
    sel.value=config.tideStation;
    saveConfig();
  }
}
// -------------------------------------------------------------------------

function windMph(t){return parseFloat(String(t||"0").match(/[\d.]+/)?.[0]||0)}function dateYmd(d){return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`}function fmtTime(d){return new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(d)}
function fmtHour(d){return new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit"}).format(d)}
function dayLabel(d){const today=new Date(),tom=new Date(Date.now()+86400000);if(d.toDateString()===today.toDateString())return"Today";if(d.toDateString()===tom.toDateString())return"Tomorrow";return new Intl.DateTimeFormat("en-US",{weekday:"long",month:"short",day:"numeric"}).format(d)}
// Compact, day-grouped list: one line per window (time • quick stats • score
// badge) instead of a full paragraph per window, so 48 hours doesn't turn
// into 48 cards of dense text.
function renderWindowsCompact(windows){
  const groups=new Map();
  windows.forEach(w=>{const key=w.start.toDateString();if(!groups.has(key))groups.set(key,[]);groups.get(key).push(w)});
  let html="";
  for(const items of groups.values()){
    html+=`<h3 class="day-heading">${escapeHtml(dayLabel(items[0].start))}</h3><div class="windows-compact">`;
    html+=items.map(w=>`<div class="window-row"><span class="w-time">${escapeHtml(fmtHour(w.start))}</span><span class="w-stat">${w.temp??"—"}°F • ${w.wind}mph • ${w.rain}%</span><span class="badge ${w.verdict.toLowerCase()}">${w.score}</span></div>`).join("");
    html+="</div>";
  }
  return html;
}
async function getJson(url){const r=await fetch(url,{headers:{Accept:"application/geo+json, application/json"}});if(!r.ok)throw new Error(`${r.status} from ${new URL(url).hostname}`);return r.json()}
async function fetchWeather(){const p=await getJson(`https://api.weather.gov/points/${config.lat.toFixed(4)},${config.lon.toFixed(4)}`);const[h,a]=await Promise.all([getJson(p.properties.forecastHourly),getJson(`https://api.weather.gov/alerts/active?point=${config.lat.toFixed(4)},${config.lon.toFixed(4)}`)]);return{periods:h.properties.periods,alerts:a.features||[]}}
async function fetchTides(){const b=new Date(),e=new Date(Date.now()+3*86400000),p=new URLSearchParams({product:"predictions",application:"SurfFishingPhone",begin_date:dateYmd(b),end_date:dateYmd(e),datum:"MLLW",station:config.tideStation,time_zone:"lst_ldt",units:"english",interval:"hilo",format:"json"});try{const d=await getJson(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${p}`);return(d.predictions||[]).map(x=>({time:new Date(x.t.replace(" ","T")),type:x.type==="H"?"High":"Low",feet:Number(x.v)}))}catch(err){console.warn("Tide data unavailable",err);return[]}}
function dangerAlerts(f){const terms=["hurricane","tropical storm","storm surge","tornado","high surf","rip current","flash flood","severe thunderstorm","special marine warning"];return[...new Set(f.map(x=>x.properties?.event||"").filter(e=>terms.some(t=>e.toLowerCase().includes(t))))]}
function nearestTide(start,tides){if(!tides.length)return{note:"Tide unavailable",bonus:0};const n=tides.reduce((a,b)=>Math.abs(b.time-start)<Math.abs(a.time-start)?b:a),hours=Math.abs(n.time-start)/3600000;return{note:`${n.type} ${n.time.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})} (${n.feet.toFixed(1)} ft)`,bonus:Math.max(0,10-hours*4)}}
function scorePeriod(p,tides,dangers){const start=new Date(p.startTime),wind=windMph(p.windSpeed),rain=Number(p.probabilityOfPrecipitation?.value||0),forecast=String(p.shortForecast||"").toLowerCase(),reasons=[];let score=100;if(dangers.length){score-=65;reasons.push(`Active hazard: ${dangers.slice(0,2).join(", ")}`)}if(forecast.includes("thunder")){score-=45;reasons.push("Thunderstorms possible")}else if(rain>=70){score-=28;reasons.push(`Heavy rain risk ${rain}%`)}else if(rain>=40){score-=15;reasons.push(`Rain risk ${rain}%`)}else if(rain<=20){score+=4;reasons.push("Low rain chance")}if(wind>=25){score-=35;reasons.push(`Very strong wind ${wind} mph`)}else if(wind>=18){score-=22;reasons.push(`Strong wind ${wind} mph`)}else if(wind>=13){score-=10;reasons.push(`Breezy ${wind} mph`)}else if(wind>=3){score+=8;reasons.push(`Manageable wind ${wind} mph`)}const h=start.getHours();if([5,6,7,18,19,20].includes(h)){score+=12;reasons.push("Prime dawn/dusk period")}else if(h<5||h>20){score-=10;reasons.push("Outside daylight hours")}const tide=nearestTide(start,tides);score+=tide.bonus;if(tide.bonus>=5)reasons.push("Good moving-water timing");score=Math.max(0,Math.min(100,Math.round(score)));const verdict=score>=80?"Excellent":score>=68?"Good":score>=50?"Marginal":"Avoid";return{start,temp:p.temperature,wind,rain,tide:tide.note,score,verdict,reasons}}
function render(windows,dangers){const safety=$("safetyCard");safety.className=`card safety ${dangers.length?"danger":"safe"}`;$("safetyTitle").textContent=dangers.length?"Do not surf fish right now":"No major hazard override detected";$("safetyText").textContent=dangers.length?`Active alert${dangers.length>1?"s":""}: ${dangers.join(", ")}. Local flags and officials override this app.`:"Continue checking lightning, beach flags, surf height, and local instructions.";const eligible=dangers.length?windows:windows.filter(w=>w.start>new Date()),best=[...eligible].sort((a,b)=>b.score-a.score)[0];if(best){$("bestTime").textContent=fmtTime(best.start);$("bestScore").textContent=best.score;$("bestSummary").textContent=dangers.length?`Hazard override active. Computed score: ${best.verdict}.`:`${best.verdict} • ${best.tide}`}$("windows").innerHTML=renderWindowsCompact(windows);$("updatedAt").textContent=`Updated ${new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}`;localStorage.setItem("lastForecast",JSON.stringify({windows,dangers,savedAt:new Date().toISOString()}));maybeNotify(best,dangers)}
async function refresh(){$("refreshBtn").disabled=true;$("safetyTitle").textContent="Checking official conditions…";try{saveConfig();updateMapMarkers(false);const[{periods,alerts},tides]=await Promise.all([fetchWeather(),fetchTides()]),dangers=dangerAlerts(alerts),windows=periods.slice(0,48).map(p=>scorePeriod(p,tides,dangers));render(windows,dangers)}catch(e){$("safetyCard").className="card safety warning";$("safetyTitle").textContent="Live update unavailable";$("safetyText").textContent=`${e.message}. Showing the most recent saved data when available.`;const saved=JSON.parse(localStorage.getItem("lastForecast")||"null");if(saved)render(saved.windows.map(w=>({...w,start:new Date(w.start)})),saved.dangers)}finally{$("refreshBtn").disabled=false}}
async function maybeNotify(best,dangers){if(!best||dangers.length||!("Notification"in window)||Notification.permission!=="granted"||best.score<config.notifyScore)return;const key=`${best.start.toISOString()}-${best.score}`;if(key===lastNotificationKey)return;lastNotificationKey=key;new Notification("Good surf-fishing window found",{body:`${fmtTime(best.start)}: ${best.score}/100 (${best.verdict}). ${best.tide}`,icon:"icons/icon-192.png"})}
$("refreshBtn").addEventListener("click",refresh);$("notifyScore").addEventListener("change",saveConfig);$("tideStation").addEventListener("change",()=>{saveConfig();updateMapMarkers(false)});$("centerMapBtn").addEventListener("click",()=>updateMapMarkers(true));$("locationBtn").addEventListener("click",()=>{if(!navigator.geolocation){alert("Location is not supported on this device.");return}$("mapStatus").textContent="Finding your location…";navigator.geolocation.getCurrentPosition(pos=>{config.lat=pos.coords.latitude;config.lon=pos.coords.longitude;config.locationName="Current location";$("locationName").textContent=config.locationName;saveConfig();updateMapMarkers(true,pos.coords.accuracy);renderCameras();renderTideStationOptions();refresh()},err=>{$("mapStatus").textContent="Location not changed";alert(`Location permission was not granted: ${err.message}`)},{enableHighAccuracy:true,timeout:15000,maximumAge:60000})});$("notifyBtn").addEventListener("click",async()=>{if(!("Notification"in window)){alert("Notifications are not supported here.");return}const result=await Notification.requestPermission();alert(result==="granted"?"Notifications enabled while the app is open.":"Notification permission was not granted.")});$("dismissInstall").addEventListener("click",()=>$("installCard").classList.add("hidden"));if(navigator.standalone!==true)$("installCard").classList.remove("hidden");if("serviceWorker"in navigator)navigator.serviceWorker.register("service-worker.js");initTabs();loadTideStations().then(renderTideStationOptions);renderCameras();refresh();setInterval(refresh,15*60*1000);
