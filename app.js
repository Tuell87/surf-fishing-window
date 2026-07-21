
const DEFAULTS = {
  lat: 30.346,
  lon: -86.227,
  locationName: "Santa Rosa Beach, FL",
  tideStation: "8729376",
  notifyScore: 72
};
let config = {...DEFAULTS, ...JSON.parse(localStorage.getItem("fishConfig") || "{}")};
let lastNotificationKey = "";

const $ = id => document.getElementById(id);
$("notifyScore").value = config.notifyScore;
$("tideStation").value = config.tideStation;
$("locationName").textContent = config.locationName;

function saveConfig() {
  config.notifyScore = Number($("notifyScore").value || 72);
  config.tideStation = $("tideStation").value.trim() || DEFAULTS.tideStation;
  localStorage.setItem("fishConfig", JSON.stringify(config));
}

function windMph(text) {
  const n = parseFloat(String(text || "0").match(/[\d.]+/)?.[0] || 0);
  return n;
}
function dateYmd(d) {
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
}
function fmtTime(d) {
  return new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(d);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

async function getJson(url) {
  const res = await fetch(url, {headers:{Accept:"application/geo+json, application/json"}});
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).hostname}`);
  return res.json();
}

async function fetchWeather() {
  const point = await getJson(`https://api.weather.gov/points/${config.lat.toFixed(4)},${config.lon.toFixed(4)}`);
  const hourlyUrl = point.properties.forecastHourly;
  const [hourly, alerts] = await Promise.all([
    getJson(hourlyUrl),
    getJson(`https://api.weather.gov/alerts/active?point=${config.lat.toFixed(4)},${config.lon.toFixed(4)}`)
  ]);
  return {periods: hourly.properties.periods, alerts: alerts.features || []};
}

async function fetchTides() {
  const begin = new Date(), end = new Date(Date.now()+3*86400000);
  const p = new URLSearchParams({
    product:"predictions", application:"SurfFishingPhone",
    begin_date:dateYmd(begin), end_date:dateYmd(end),
    datum:"MLLW", station:config.tideStation, time_zone:"lst_ldt",
    units:"english", interval:"hilo", format:"json"
  });
  try {
    const data = await getJson(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${p}`);
    return (data.predictions || []).map(x => ({
      time:new Date(x.t.replace(" ","T")),
      type:x.type === "H" ? "High" : "Low",
      feet:Number(x.v)
    }));
  } catch (e) {
    console.warn("Tide data unavailable", e);
    return [];
  }
}

function dangerAlerts(features) {
  const terms = ["hurricane","tropical storm","storm surge","tornado","high surf",
    "rip current","flash flood","severe thunderstorm","special marine warning"];
  return [...new Set(features.map(f => f.properties?.event || "")
    .filter(e => terms.some(t => e.toLowerCase().includes(t))))];
}

function nearestTide(start, tides) {
  if (!tides.length) return {note:"Tide unavailable", bonus:0};
  const nearest = tides.reduce((a,b) =>
    Math.abs(b.time-start) < Math.abs(a.time-start) ? b : a);
  const hours = Math.abs(nearest.time-start)/3600000;
  return {
    note:`${nearest.type} ${nearest.time.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})} (${nearest.feet.toFixed(1)} ft)`,
    bonus:Math.max(0,10-hours*4)
  };
}

function scorePeriod(p,tides,dangers) {
  const start = new Date(p.startTime);
  const wind = windMph(p.windSpeed);
  const rain = Number(p.probabilityOfPrecipitation?.value || 0);
  const forecast = String(p.shortForecast || "").toLowerCase();
  const reasons = [];
  let score = 100;

  if (dangers.length) { score -= 65; reasons.push(`Active hazard: ${dangers.slice(0,2).join(", ")}`); }
  if (forecast.includes("thunder")) { score -= 45; reasons.push("Thunderstorms possible"); }
  else if (rain >= 70) { score -= 28; reasons.push(`Heavy rain risk ${rain}%`); }
  else if (rain >= 40) { score -= 15; reasons.push(`Rain risk ${rain}%`); }
  else if (rain <= 20) { score += 4; reasons.push("Low rain chance"); }

  if (wind >= 25) { score -= 35; reasons.push(`Very strong wind ${wind} mph`); }
  else if (wind >= 18) { score -= 22; reasons.push(`Strong wind ${wind} mph`); }
  else if (wind >= 13) { score -= 10; reasons.push(`Breezy ${wind} mph`); }
  else if (wind >= 3) { score += 8; reasons.push(`Manageable wind ${wind} mph`); }

  const h = start.getHours();
  if ([5,6,7,18,19,20].includes(h)) { score += 12; reasons.push("Prime dawn/dusk period"); }
  else if (h < 5 || h > 20) { score -= 10; reasons.push("Outside daylight hours"); }

  const tide = nearestTide(start,tides);
  score += tide.bonus;
  if (tide.bonus >= 5) reasons.push("Good moving-water timing");

  score = Math.max(0,Math.min(100,Math.round(score)));
  const verdict = score >= 80 ? "Excellent" : score >= 68 ? "Good" : score >= 50 ? "Marginal" : "Avoid";
  return {start,temp:p.temperature,wind,rain,tide:tide.note,score,verdict,reasons};
}

function render(windows,dangers) {
  const safety = $("safetyCard");
  safety.className = "card safety " + (dangers.length ? "danger" : "safe");
  $("safetyTitle").textContent = dangers.length ? "Do not surf fish right now" : "No major hazard override detected";
  $("safetyText").textContent = dangers.length
    ? `Active alert${dangers.length>1?"s":""}: ${dangers.join(", ")}. Local flags and officials override this app.`
    : "Continue checking lightning, beach flags, surf height, and local instructions.";

  const eligible = dangers.length ? windows : windows.filter(w => w.start > new Date());
  const best = [...eligible].sort((a,b)=>b.score-a.score)[0];
  if (best) {
    $("bestTime").textContent = fmtTime(best.start);
    $("bestScore").textContent = best.score;
    $("bestSummary").textContent = dangers.length
      ? `Hazard override active. Computed score: ${best.verdict}.`
      : `${best.verdict} • ${best.tide}`;
  }

  $("windows").innerHTML = windows.map(w => `
    <article class="window">
      <div>
        <div class="time">${escapeHtml(fmtTime(w.start))}</div>
        <div class="details">${w.temp ?? "—"}°F • Wind ${w.wind} mph • Rain ${w.rain}%<br>
        ${escapeHtml(w.tide)}<br>${escapeHtml(w.reasons.slice(0,3).join(" • "))}</div>
      </div>
      <div class="badge ${w.verdict.toLowerCase()}">${w.score}</div>
    </article>`).join("");

  $("updatedAt").textContent = `Updated ${new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}`;
  localStorage.setItem("lastForecast", JSON.stringify({windows,dangers,savedAt:new Date().toISOString()}));
  maybeNotify(best,dangers);
}

async function refresh() {
  $("refreshBtn").disabled = true;
  $("safetyTitle").textContent = "Checking official conditions…";
  try {
    saveConfig();
    const [{periods,alerts},tides] = await Promise.all([fetchWeather(),fetchTides()]);
    const dangers = dangerAlerts(alerts);
    const windows = periods.slice(0,48).map(p => scorePeriod(p,tides,dangers));
    render(windows,dangers);
  } catch (e) {
    $("safetyCard").className = "card safety warning";
    $("safetyTitle").textContent = "Live update unavailable";
    $("safetyText").textContent = e.message + ". Showing the most recent saved data when available.";
    const saved = JSON.parse(localStorage.getItem("lastForecast") || "null");
    if (saved) render(saved.windows.map(w=>({...w,start:new Date(w.start)})),saved.dangers);
  } finally {
    $("refreshBtn").disabled = false;
  }
}

async function maybeNotify(best,dangers) {
  if (!best || dangers.length || Notification.permission !== "granted" || best.score < config.notifyScore) return;
  const key = `${best.start.toISOString()}-${best.score}`;
  if (key === lastNotificationKey) return;
  lastNotificationKey = key;
  new Notification("Good surf-fishing window found", {
    body:`${fmtTime(best.start)}: ${best.score}/100 (${best.verdict}). ${best.tide}`,
    icon:"icons/icon-192.png"
  });
}

$("refreshBtn").onclick = refresh;
$("notifyScore").onchange = saveConfig;
$("tideStation").onchange = saveConfig;
$("locationBtn").onclick = () => {
  if (!navigator.geolocation) return alert("Location is not supported on this device.");
  navigator.geolocation.getCurrentPosition(pos => {
    config.lat = pos.coords.latitude;
    config.lon = pos.coords.longitude;
    config.locationName = "Current location";
    $("locationName").textContent = config.locationName;
    saveConfig(); refresh();
  }, err => alert("Location permission was not granted: " + err.message), {enableHighAccuracy:true,timeout:15000});
};
$("notifyBtn").onclick = async () => {
  if (!("Notification" in window)) return alert("Notifications are not supported here.");
  const result = await Notification.requestPermission();
  alert(result === "granted" ? "Notifications enabled while the app is open." : "Notification permission was not granted.");
};

$("dismissInstall").onclick = () => $("installCard").classList.add("hidden");
if (navigator.standalone !== true) $("installCard").classList.remove("hidden");
if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js");
refresh();
setInterval(refresh, 15*60*1000);
