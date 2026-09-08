/* ============================================================
   WeatherGuard AI — live data wiring
   - Current conditions: Java backend /weather
   - Hourly / daily forecast: Open-Meteo
   - Historical weather: Open-Meteo archive
   - AI risk map: 7-point Bareilly grid
   ============================================================ */

/*
   Guard against this file being included/executed twice on the
   same page (duplicate <script> tag, duplicate layout include,
   SPA re-injection, etc). Without this, a second execution throws
   "Identifier 'X' has already been declared" on the first
   top-level const/let in the file.
*/
if (window.__weatherguardScriptLoaded) {
    console.warn(
        "WeatherGuard script.js was included more than once on this page — skipping duplicate execution. Check your HTML for a repeated <script src=\"script.js\"> tag."
    );
} else {
    window.__weatherguardScriptLoaded = true;

    (function () {

    const WEATHER_API = "https://weather-alert-system-2.onrender.com/weather";
    const AI_PREDICT_API = "https://weather-alert-system-2.onrender.com/predict";
    const OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast";
    const OPEN_METEO_GEOCODE = "https://geocoding-api.open-meteo.com/v1/search";
    const OPEN_METEO_ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";

    let lastKnownCoords = null;

    /* ============================================================
       BAREILLY AI RISK MAP
       ============================================================ */

    const RISK_GRID_POINTS = {
        "bareilly_center": {
            name: "Bareilly Center",
            lat: 28.3670,
            lon: 79.4304
        },
        "north": {
            name: "North",
            lat: 28.4700,
            lon: 79.4304
        },
        "south": {
            name: "South",
            lat: 28.2640,
            lon: 79.4304
        },
        "east": {
            name: "East",
            lat: 28.3670,
            lon: 79.5600
        },
        "west": {
            name: "West",
            lat: 28.3670,
            lon: 79.3000
        },
        "northeast": {
            name: "Northeast",
            lat: 28.4600,
            lon: 79.5500
        },
        "southwest": {
            name: "Southwest",
            lat: 28.2700,
            lon: 79.3100
        }
    };

    let riskMap = null;
    let riskMarkers = [];
    let riskMapInitialized = false;
    let riskRefreshTimer = null;

    /* ---------- small helpers ---------- */

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el && value !== undefined && value !== null) {
            el.textContent = value;
        }
    }

    function round(n, decimals = 0) {
        if (typeof n !== "number" || Number.isNaN(n)) return undefined;
        const f = Math.pow(10, decimals);
        return Math.round(n * f) / f;
    }

    function playReveal(section) {
        section.querySelectorAll(".reveal-up").forEach((el) => {
            el.style.animation = "none";
            void el.offsetWidth;
            el.style.animation = "";
        });
    }

    /* ============================================================
       LEAFLET MAP LOADER
       ============================================================ */

    function loadLeaflet() {
        return new Promise((resolve, reject) => {
            if (window.L) {
                resolve();
                return;
            }

            if (!document.getElementById("leaflet-css")) {
                const css = document.createElement("link");
                css.id = "leaflet-css";
                css.rel = "stylesheet";
                css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
                document.head.appendChild(css);
            }

            const existingScript = document.getElementById("leaflet-js");

            if (existingScript) {
                existingScript.addEventListener("load", resolve);
                existingScript.addEventListener("error", reject);
                return;
            }

            const script = document.createElement("script");
            script.id = "leaflet-js";
            script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
            script.onload = resolve;
            script.onerror = () => reject(new Error("Leaflet failed to load"));
            document.head.appendChild(script);
        });
    }

    /* ---------- map styling ---------- */

    function injectRiskMapStyles() {
        if (document.getElementById("weatherguard-map-styles")) return;

        const style = document.createElement("style");
        style.id = "weatherguard-map-styles";

        style.textContent = `
            #mapFrame.weatherguard-risk-map {
                width: 100%;
                height: 500px;
                min-height: 500px;
                background: #111;
                position: relative;
                z-index: 1;
            }

            #mapFrame.weatherguard-risk-map .leaflet-container {
                width: 100%;
                height: 100%;
                font-family: Inter, sans-serif;
            }

            .weatherguard-map-legend {
                background: rgba(15, 15, 15, 0.92);
                color: #fff;
                padding: 12px 15px;
                border-radius: 10px;
                border: 1px solid rgba(255,255,255,0.15);
                box-shadow: 0 4px 18px rgba(0,0,0,0.35);
                font-family: Inter, sans-serif;
                font-size: 12px;
                line-height: 1.6;
            }

            .weatherguard-map-legend-title {
                font-weight: 700;
                margin-bottom: 7px;
                font-size: 13px;
            }

            .weatherguard-map-legend-row {
                display: flex;
                align-items: center;
                gap: 7px;
                margin: 3px 0;
            }

            .weatherguard-map-legend-dot {
                width: 11px;
                height: 11px;
                border-radius: 50%;
                display: inline-block;
            }

            .risk-map-loading {
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 999;
                background: rgba(10,10,10,0.72);
                color: white;
                font-family: Inter, sans-serif;
                font-size: 14px;
                pointer-events: none;
            }

            .risk-map-popup {
                font-family: Inter, sans-serif;
                min-width: 210px;
                color: #111;
            }

            .risk-map-popup-title {
                font-size: 16px;
                font-weight: 700;
                margin-bottom: 7px;
            }

            .risk-map-popup-risk {
                font-size: 23px;
                font-weight: 800;
                margin-bottom: 4px;
            }

            .risk-map-popup-status {
                display: inline-block;
                font-size: 11px;
                font-weight: 700;
                padding: 3px 7px;
                border-radius: 5px;
                margin-bottom: 10px;
            }

            .risk-map-popup-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 6px 12px;
                font-size: 12px;
            }

            .risk-map-tooltip {
                font-family: Inter, sans-serif;
                font-size: 12px;
                line-height: 1.5;
            }

            .risk-map-tooltip strong {
                font-size: 13px;
            }

            @media (max-width: 700px) {
                #mapFrame.weatherguard-risk-map {
                    height: 420px;
                    min-height: 420px;
                }
            }
        `;

        document.head.appendChild(style);
    }

    /* ---------- replace old Google Maps iframe ---------- */

    function prepareRiskMapContainer() {
        let map = document.getElementById("mapFrame");

        if (!map) return null;

        if (map.tagName.toLowerCase() === "iframe") {
            const replacement = document.createElement("div");
            replacement.id = "mapFrame";

            map.parentNode.replaceChild(replacement, map);
            map = replacement;
        }

        map.classList.add("weatherguard-risk-map");

        return map;
    }

    /* ---------- risk colors ---------- */

    function getRiskColor(risk) {
        if (risk >= 0.50) return "#dc2828";
        if (risk >= 0.25) return "#f0b41e";
        return "#28b45a";
    }

    function getRiskStatus(risk) {
        if (risk >= 0.50) return "SEVERE";
        if (risk >= 0.25) return "WATCH";
        return "NORMAL";
    }

    function getRiskStatusBackground(risk) {
        if (risk >= 0.50) return "#dc2828";
        if (risk >= 0.25) return "#f0b41e";
        return "#28b45a";
    }

    /* ---------- legend ---------- */

    function createRiskLegend() {
        if (!riskMap) return;

        const legend = L.control({ position: "bottomright" });

        legend.onAdd = function () {
            const div = L.DomUtil.create(
                "div",
                "weatherguard-map-legend"
            );

            div.innerHTML = `
                <div class="weatherguard-map-legend-title">
                    AI Rain Risk
                </div>

                <div class="weatherguard-map-legend-row">
                    <span
                        class="weatherguard-map-legend-dot"
                        style="background:#28b45a"
                    ></span>
                    Normal &lt; 25%
                </div>

                <div class="weatherguard-map-legend-row">
                    <span
                        class="weatherguard-map-legend-dot"
                        style="background:#f0b41e"
                    ></span>
                    Watch 25–49%
                </div>

                <div class="weatherguard-map-legend-row">
                    <span
                        class="weatherguard-map-legend-dot"
                        style="background:#dc2828"
                    ></span>
                    Severe ≥ 50%
                </div>
            `;

            L.DomEvent.disableClickPropagation(div);

            return div;
        };

        legend.addTo(riskMap);
    }

    /* ============================================================
       FETCH WEATHER FOR ONE MAP POINT
       ============================================================ */

    async function getRiskPointData(key, point) {
        const predictUrl =
            `${AI_PREDICT_API}?lat=${point.lat}&lon=${point.lon}` +
            `&point=${encodeURIComponent(key)}`;

        const weatherUrl =
            `${OPEN_METEO_FORECAST}?latitude=${point.lat}` +
            `&longitude=${point.lon}` +
            `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,rain` +
            `&timezone=auto`;

        const [predictionRes, weatherRes] = await Promise.all([
            fetch(predictUrl),
            fetch(weatherUrl)
        ]);

        if (!predictionRes.ok) {
            throw new Error(`Prediction failed for ${point.name}`);
        }

        if (!weatherRes.ok) {
            throw new Error(`Weather failed for ${point.name}`);
        }

        const prediction = await predictionRes.json();
        const weather = await weatherRes.json();

        if (prediction.error) {
            throw new Error(prediction.error);
        }

        const current = weather.current || {};

        const riskScore = Number(prediction.risk_score);

        if (!Number.isFinite(riskScore)) {
            throw new Error(`Invalid risk score for ${point.name}`);
        }

        return {
            key,
            name: point.name,
            lat: point.lat,
            lon: point.lon,
            risk: Math.max(0, Math.min(1, riskScore)),
            label: prediction.label || getRiskStatus(riskScore),
            temperature: current.temperature_2m,
            humidity: current.relative_humidity_2m,
            wind: current.wind_speed_10m,
            rain: current.rain || 0
        };
    }

    /* ============================================================
       DRAW / UPDATE MAP MARKERS
       ============================================================ */

    function renderRiskMarker(data) {
        const color = getRiskColor(data.risk);
        const status = getRiskStatus(data.risk);
        const percentage = round(data.risk * 100, 1);

        const radius = 8 + data.risk * 16;

        const marker = L.circleMarker(
            [data.lat, data.lon],
            {
                radius,
                color: "#ffffff",
                weight: 2,
                opacity: 1,
                fillColor: color,
                fillOpacity: 0.88
            }
        );

        const temperature =
            data.temperature !== undefined
                ? `${round(data.temperature)}°C`
                : "—";

        const humidity =
            data.humidity !== undefined
                ? `${round(data.humidity)}%`
                : "—";

        const wind =
            data.wind !== undefined
                ? `${round(data.wind)} km/h`
                : "—";

        const rain =
            data.rain !== undefined
                ? `${round(data.rain, 1)} mm`
                : "—";

        marker.bindTooltip(
            `
            <div class="risk-map-tooltip">
                <strong>${data.name}</strong><br>
                Risk: <b>${percentage}%</b><br>
                Status: <b>${status}</b><br>
                Temperature: ${temperature}<br>
                Humidity: ${humidity}<br>
                Wind: ${wind}<br>
                Rain: ${rain}
            </div>
            `,
            {
                direction: "top",
                offset: [0, -radius],
                opacity: 0.95
            }
        );

        marker.bindPopup(
            `
            <div class="risk-map-popup">

                <div class="risk-map-popup-title">
                    ${data.name}
                </div>

                <div
                    class="risk-map-popup-risk"
                    style="color:${color}"
                >
                    ${percentage}%
                </div>

                <div
                    class="risk-map-popup-status"
                    style="
                        background:${getRiskStatusBackground(data.risk)};
                        color:#fff;
                    "
                >
                    ${status}
                </div>

                <div class="risk-map-popup-grid">
                    <div>🌡️ Temperature</div>
                    <div><b>${temperature}</b></div>

                    <div>💧 Humidity</div>
                    <div><b>${humidity}</b></div>

                    <div>🌬️ Wind</div>
                    <div><b>${wind}</b></div>

                    <div>🌧️ Rain</div>
                    <div><b>${rain}</b></div>
                </div>

            </div>
            `,
            {
                maxWidth: 280
            }
        );

        marker.addTo(riskMap);

        riskMarkers.push(marker);
    }

    /* ---------- map loading state ---------- */

    function setRiskMapLoading(message) {
        const container = document.getElementById("mapFrame");
        if (!container) return;

        let loading = document.getElementById("riskMapLoading");

        if (!loading) {
            loading = document.createElement("div");
            loading.id = "riskMapLoading";
            loading.className = "risk-map-loading";
            container.appendChild(loading);
        }

        loading.textContent = message;
        loading.style.display = "flex";
    }

    function hideRiskMapLoading() {
        const loading = document.getElementById("riskMapLoading");

        if (loading) {
            loading.style.display = "none";
        }
    }

    /* ============================================================
       REFRESH ALL 7 RISK POINTS
       ============================================================ */

    async function refreshRiskMap() {
        if (!riskMap) return;

        setRiskMapLoading("Loading AI risk data…");

        riskMarkers.forEach((marker) => {
            riskMap.removeLayer(marker);
        });

        riskMarkers = [];

        const entries = Object.entries(RISK_GRID_POINTS);

        const results = await Promise.allSettled(
            entries.map(([key, point]) =>
                getRiskPointData(key, point)
            )
        );

        let successful = 0;

        results.forEach((result) => {
            if (result.status === "fulfilled") {
                renderRiskMarker(result.value);
                successful++;
            } else {
                console.warn(
                    "Risk map point failed:",
                    result.reason
                );
            }
        });

        if (successful === 0) {
            setRiskMapLoading(
                "AI risk data unavailable right now. Retrying…"
            );
            return;
        }

        hideRiskMapLoading();

        console.log(
            `Risk map updated: ${successful}/${entries.length} points`
        );
    }

    /* ============================================================
       INITIALIZE RISK MAP
       ============================================================ */

    async function initRiskMap() {
        const container = prepareRiskMapContainer();

        if (!container) {
            console.warn("Risk map container not found.");
            return;
        }

        injectRiskMapStyles();

        try {
            await loadLeaflet();

            if (riskMapInitialized) {
                await refreshRiskMap();
                return;
            }

            riskMap = L.map(container, {
                zoomControl: true,
                attributionControl: true
            }).setView(
                [28.3670, 79.4304],
                9.3
            );

            L.tileLayer(
                "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                {
                    maxZoom: 19,
                    attribution:
                        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
                }
            ).addTo(riskMap);

            createRiskLegend();

            riskMapInitialized = true;

            await refreshRiskMap();

            if (riskRefreshTimer) {
                clearInterval(riskRefreshTimer);
            }

            riskRefreshTimer = setInterval(
                refreshRiskMap,
                10 * 60 * 1000
            );

            setTimeout(() => {
                if (riskMap) {
                    riskMap.invalidateSize();
                }
            }, 300);

        } catch (error) {
            console.error("Risk map initialization failed:", error);

            container.innerHTML = `
                <div
                    style="
                        height:100%;
                        min-height:300px;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        color:#aaa;
                        font-family:Inter,sans-serif;
                        text-align:center;
                        padding:30px;
                    "
                >
                    AI weather map is unavailable right now.
                </div>
            `;
        }
    }

    /* ============================================================
       WMO WEATHER CODES
       ============================================================ */

    const WMO_CODES = {
        0: ["☀️", "Clear sky"],
        1: ["🌤️", "Mainly clear"],
        2: ["⛅", "Partly cloudy"],
        3: ["☁️", "Overcast"],
        45: ["🌫️", "Fog"],
        48: ["🌫️", "Rime fog"],
        51: ["🌦️", "Light drizzle"],
        53: ["🌦️", "Moderate drizzle"],
        55: ["🌦️", "Dense drizzle"],
        56: ["🌧️", "Freezing drizzle"],
        57: ["🌧️", "Freezing drizzle"],
        61: ["🌧️", "Slight rain"],
        63: ["🌧️", "Moderate rain"],
        65: ["🌧️", "Heavy rain"],
        66: ["🌧️", "Freezing rain"],
        67: ["🌧️", "Freezing rain"],
        71: ["🌨️", "Slight snow"],
        73: ["🌨️", "Moderate snow"],
        75: ["🌨️", "Heavy snow"],
        77: ["🌨️", "Snow grains"],
        80: ["🌦️", "Rain showers"],
        81: ["🌦️", "Rain showers"],
        82: ["⛈️", "Violent showers"],
        85: ["🌨️", "Snow showers"],
        86: ["🌨️", "Snow showers"],
        95: ["⛈️", "Thunderstorm"],
        96: ["⛈️", "Thunderstorm, hail"],
        99: ["⛈️", "Thunderstorm, hail"],
    };

    function codeInfo(code) {
        return WMO_CODES[code] || ["🌡️", "Unknown"];
    }

    function formatHour(dateObj) {
        return dateObj
            .toLocaleTimeString(undefined, {
                hour: "numeric",
                hour12: true
            })
            .replace(" ", "");
    }

    /* ============================================================
       REVERSE GEOCODING
       ============================================================ */

    async function reverseGeocode(lat, lon) {
        try {
            const res = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en` 
            ); 
 
            if (!res.ok) { 
                throw new Error("Reverse geocode failed"); 
            } 
 
            const data = await res.json(); 
 
            return ( 
                data.locality || 
                data.city || 
                data.principalSubdivision || 
                `${lat.toFixed(2)}, ${lon.toFixed(2)}` 
            ); 
 
        } catch (err) { 
            console.warn( 
                "Reverse geocoding failed, falling back to coords:", 
                err 
            ); 
 
            return `${lat.toFixed(2)}, ${lon.toFixed(2)}`; 
        } 
    } 
 
    /* ============================================================ 
       CURRENT CONDITIONS 
       ============================================================ */ 
 
    function describeConditions(rainMm, humidity) { 
        if (rainMm > 0.5) { 
            return "Rain falling right now — grab an umbrella."; 
        } 
 
        if (humidity > 80) { 
            return "Warm and humid conditions."; 
        } 
 
        if (humidity < 30) { 
            return "Dry conditions, clear skies likely."; 
        } 
 
        return "Mild conditions right now."; 
    } 
 
    function populateCurrentWeather(data, placeName) { 
        console.log("Current weather data:", data); 
 
        const current = data.current || {}; 
 
        setText("heroLoc", placeName); 
 
        const temp = round(current.temperature_2m); 
        const feelsLike = round(current.apparent_temperature); 
        const humidity = round(current.relative_humidity_2m); 
        const wind = round(current.wind_speed_10m); 
        const pressure = round(current.pressure_msl); 
 
        const visibilityKm = 
            current.visibility !== undefined 
                ? round(current.visibility / 1000, 1) 
                : undefined; 
 
        const uv = round(current.uv_index, 1); 
        const rain = current.rain || 0; 
 
        if (temp !== undefined) { 
            setText("heroTemp", `${temp}°`); 
        } 
 
        setText( 
            "heroDesc", 
            describeConditions(rain, humidity ?? 50) 
        ); 
 
        setText( 
            "curTemp", 
            temp !== undefined ? `${temp}°C` : undefined 
        ); 
 
        setText( 
            "curFeels", 
            feelsLike !== undefined ? `${feelsLike}°C` : undefined 
        ); 
 
        setText( 
            "curHumidity", 
            humidity !== undefined ? `${humidity}%` : undefined 
        ); 
 
        setText( 
            "curWind", 
            wind !== undefined ? `${wind} km/h` : undefined 
        ); 
 
        setText( 
            "curPressure", 
            pressure !== undefined ? `${pressure} hPa` : undefined 
        ); 
 
        setText( 
            "curVisibility", 
            visibilityKm !== undefined 
                ? `${visibilityKm} km` 
                : undefined 
        ); 
 
        setText( 
            "curUV", 
            uv !== undefined ? `${uv}` : undefined 
        ); 
 
        setText( 
            "curRain", 
            `${round(rain, 1)} mm` 
        ); 
 
        if (humidity !== undefined) { 
            const fill = document.getElementById( 
                "humidityFill" 
            ); 
 
            if (fill) { 
                fill.style.width = `${humidity}%`; 
            } 
        } 
    } 
 
    async function getCurrentWeather(lat, lon) { 
        try { 
            const [weatherRes, placeName] = 
                await Promise.all([ 
                    fetch( 
                        `${WEATHER_API}?lat=${lat}&lon=${lon}` 
                    ), 
                    reverseGeocode(lat, lon) 
                ]); 
 
            if (!weatherRes.ok) { 
                throw new Error( 
                    "Backend request failed" 
                ); 
            } 
 
            const data = await weatherRes.json(); 
 
            if (data.error) { 
                throw new Error(data.error); 
            } 
 
            data.__lat = lat; 
            data.__lon = lon; 
 
            populateCurrentWeather( 
                data, 
                placeName 
            ); 
 
        } catch (error) { 
            console.error( 
                "Current weather error:", 
                error 
            ); 
 
            setText( 
                "heroDesc", 
                "Couldn't load live weather right now — try again shortly." 
            ); 
        } 
    } 
 
    /* ============================================================ 
       AI RISK PREDICTION FOR CURRENT LOCATION 
       ============================================================ */ 
 
    function slugifyPoint(placeName) { 
        if (!placeName) { 
            return "current_location_center"; 
        } 
 
        const slug = placeName 
            .toLowerCase() 
            .trim() 
            .replace(/[^a-z0-9]+/g, "_") 
            .replace(/^_+|_+$/g, ""); 
 
        return slug 
            ? `${slug}_center` 
            : "current_location_center"; 
    } 
 
    function riskPresentation(label) { 
        switch ((label || "").toLowerCase()) { 
 
            case "normal": 
                return { 
                    icon: "✅", 
                    tag: "NORMAL", 
                    tone: "low" 
                }; 
 
            case "watch": 
                return { 
                    icon: "👀", 
                    tag: "WATCH", 
                    tone: "moderate" 
                }; 
 
            case "warning": 
                return { 
                    icon: "⚠️", 
                    tag: "WARNING", 
                    tone: "high" 
                }; 
 
            case "severe": 
            case "danger": 
                return { 
                    icon: "🚨", 
                    tag: "SEVERE", 
                    tone: "high" 
                }; 
 
            default: 
                return { 
                    icon: "🤖", 
                    tag: (label || "UNKNOWN").toUpperCase(), 
                    tone: "moderate" 
                }; 
        } 
    } 
 
    function populateAIPrediction(data) { 
        console.log( 
            "AI prediction data:", 
            data 
        ); 
 
        const { 
            point_name, 
            risk_score, 
            label 
        } = data; 
 
        const { 
            icon, 
            tag, 
            tone 
        } = riskPresentation(label); 
 
        const pct = round( 
            (risk_score || 0) * 100, 
            1 
        ); 
 
        setText( 
            "aiPointName", 
            point_name 
        ); 
 
        setText( 
            "aiRiskLabel", 
            tag 
        ); 
 
        setText( 
            "aiRiskIcon", 
            icon 
        ); 
 
        setText( 
            "aiRiskScore", 
            pct !== undefined 
                ? `${pct}%` 
                : undefined 
        ); 
 
        const box = 
            document.getElementById( 
                "aiRiskBox" 
            ); 
 
        if (box) { 
            box.dataset.tone = tone; 
            box.style.display = "flex"; 
        } 
 
        const bar = 
            document.getElementById( 
                "aiRiskFill" 
            ); 
 
        if (bar && pct !== undefined) { 
            bar.style.width = 
                `${Math.min(pct, 100)}%`; 
        } 
    } 
 
    async function getAIPrediction( 
        lat, 
        lon, 
        placeName 
    ) { 
        try { 
            const point = 
                slugifyPoint(placeName); 
 
            const url = 
                `${AI_PREDICT_API}?lat=${lat}&lon=${lon}` + 
                `&point=${encodeURIComponent(point)}`; 
 
            const res = 
                await fetch(url); 
 
            if (!res.ok) { 
                throw new Error( 
                    "AI prediction request failed" 
                ); 
            } 
 
            const data = 
                await res.json(); 
 
            if (data.error) { 
                throw new Error(data.error); 
            } 
 
            populateAIPrediction(data); 
 
        } catch (error) { 
 
            console.error( 
                "AI prediction error:", 
                error 
            ); 
 
            const box = 
                document.getElementById( 
                    "aiRiskBox" 
                ); 
 
            if (box) { 
                box.style.display = "none"; 
            } 
        } 
    } 
 
    /* ============================================================ 
       HOURLY + DAILY FORECAST 
       ============================================================ */ 
 
    async function getForecastData(lat, lon) { 
        try { 
 
            const url = 
                `${OPEN_METEO_FORECAST}?latitude=${lat}&longitude=${lon}` + 
                `&hourly=temperature_2m,precipitation_probability,weathercode,cloud_cover` + 
                `&daily=weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset` + 
                `&timezone=auto&forecast_days=7`; 
 
            const res = 
                await fetch(url); 
 
            if (!res.ok) { 
                throw new Error( 
                    "Forecast request failed" 
                ); 
            } 
 
            const data = 
                await res.json(); 
 
            console.log( 
                "Forecast data:", 
                data 
            ); 
 
            populateHourly(data); 
            populateDaily(data); 
            populateAlertAndCloud(data); 
            populateAstronomy(data); 
 
        } catch (error) { 
 
            console.error( 
                "Forecast error:", 
                error 
            ); 
 
            const hourly = 
                document.getElementById( 
                    "hourlyWeather" 
                ); 
 
            if (hourly) { 
                hourly.innerHTML = 
                    '<p class="history-empty">Hourly forecast unavailable right now.</p>'; 
            } 
 
            const grid = 
                document.getElementById( 
                    "forecastGrid" 
                ); 
 
            if (grid) { 
                grid.innerHTML = 
                    '<p class="history-empty">7-day forecast unavailable right now.</p>'; 
            } 
        } 
    } 
 
    function findCurrentHourIndex(times) { 
        const now = new Date(); 
 
        for ( 
            let i = 0; 
            i < times.length; 
            i++ 
        ) { 
            if ( 
                new Date(times[i]) >= now 
            ) { 
                return i; 
            } 
        } 
 
        return 0; 
    } 
 
    function populateHourly(data) { 
 
        const container = 
            document.getElementById( 
                "hourlyWeather" 
            ); 
 
        if ( 
            !container || 
            !data.hourly 
        ) { 
            return; 
        } 
 
        const { 
            time, 
            temperature_2m, 
            weathercode 
        } = data.hourly; 
 
        const startIdx = 
            findCurrentHourIndex(time); 
 
        const slice = 
            time.slice( 
                startIdx, 
                startIdx + 24 
            ); 
 
        container.innerHTML = 
            slice 
                .map((t, i) => { 
 
                    const idx = 
                        startIdx + i; 
 
                    const temp = 
                        round( 
                            temperature_2m[idx] 
                        ); 
 
                    const [icon] = 
                        codeInfo( 
                            weathercode[idx] 
                        ); 
 
                    const isRainy = 
                        weathercode[idx] >= 51 && 
                        weathercode[idx] < 90; 
 
                    const label = 
                        i === 0 
                            ? "Now" 
                            : formatHour( 
                                  new Date(t) 
                              ); 
 
                    return ` 
                        <div class="hour${isRainy ? " rainy" : ""}"> 
                            <p>${label}</p> 
                            <span class="ic">${icon}</span> 
                            <h3>${temp}°</h3> 
                        </div> 
                    `; 
                }) 
                .join(""); 
    } 
 
    function populateDaily(data) { 
 
        const grid = 
            document.getElementById( 
                "forecastGrid" 
            ); 
 
        if ( 
            !grid || 
            !data.daily 
        ) { 
            return; 
        } 
 
        const { 
            time, 
            weathercode, 
            temperature_2m_max, 
            temperature_2m_min 
        } = data.daily; 
 
        grid.innerHTML = 
            time 
                .map((t, i) => { 
 
                    const [ 
                        icon, 
                        cond 
                    ] = 
                        codeInfo( 
                            weathercode[i] 
                        ); 
 
                    const dname = 
                        i === 0 
                            ? "TODAY" 
                            : new Date(t) 
                                  .toLocaleDateString( 
                                      undefined, 
                                      { 
                                          weekday: 
                                              "short" 
                                      } 
                                  ) 
                                  .toUpperCase(); 
 
                    const hi = 
                        round( 
                            temperature_2m_max[i] 
                        ); 
 
                    const lo = 
                        round( 
                            temperature_2m_min[i] 
                        ); 
 
                    return ` 
                        <div 
                            class="day-card reveal-up" 
                            style="--i:${i + 1}" 
                        > 
                            <div class="dname"> 
                                ${dname} 
                            </div> 
 
                            <span class="ic"> 
                                ${icon} 
                            </span> 
 
                            <div> 
                                <span class="hi"> 
                                    ${hi}° 
                                </span> 
 
                                <span class="lo"> 
                                    ${lo}° 
                                </span> 
                            </div> 
 
                            <div class="cond"> 
                                ${cond} 
                            </div> 
                        </div> 
                    `; 
                }) 
                .join(""); 
    } 
 
    /* ============================================================ 
       RAIN ALERT BANNER (ALWAYS VISIBLE) 
       ============================================================ 
       Previously this only set box.style.display = "flex" when 
       the rain probability was >= 70%, and "none" otherwise — 
       so the banner disappeared entirely whenever there was no 
       meaningful rain risk. It now always shows, with a tone 
       (low / moderate / high) that controls its color via CSS 
       (see the .alert[data-tone="..."] rules in index.html). 
       ============================================================ */ 
 
    function populateAlertAndCloud(data) { 
 
        if (!data.hourly) { 
            return; 
        } 
 
        const { 
            time, 
            precipitation_probability, 
            cloud_cover 
        } = data.hourly; 
 
        const startIdx = 
            findCurrentHourIndex(time); 
 
        const cloud = 
            round( 
                cloud_cover[startIdx] 
            ); 
 
        setText( 
            "curCloud", 
            cloud !== undefined 
                ? `${cloud}%` 
                : undefined 
        ); 
 
        const box = 
            document.getElementById( 
                "alertBox" 
            ); 
 
        let rainIdx = -1; 
 
        for ( 
            let i = startIdx; 
            i < 
            Math.min( 
                startIdx + 12, 
                precipitation_probability.length 
            ); 
            i++ 
        ) { 
 
            if ( 
                precipitation_probability[i] >= 
                50 
            ) { 
                rainIdx = i; 
                break; 
            } 
        } 
 
        /* ---- No meaningful rain risk in the next 12h ---- */ 
        if (rainIdx === -1) { 
 
            setText( 
                "rainEta", 
                "☀️ No rain expected" 
            ); 
 
            setText( 
                "rainSub", 
                "No significant rain expected in the next 12 hours." 
            ); 
 
            if (box) { 
                box.style.display = "flex"; 
                box.dataset.tone = "low"; 
 
                setText( 
                    "alertTitle", 
                    "No rain risk right now" 
                ); 
 
                setText( 
                    "alertBody", 
                    "Conditions look clear for the next 12 hours." 
                ); 
 
                setText( 
                    "riskTag", 
                    "LOW RISK" 
                ); 
            } 
 
            return; 
        } 
 
        /* ---- Rain expected somewhere in the next 12h ---- */ 
 
        const hoursAhead = 
            rainIdx - startIdx; 
 
        const prob = 
            precipitation_probability[ 
                rainIdx 
            ]; 
 
        const etaText = 
            hoursAhead === 0 
                ? "🌧️ Rain now" 
                : `🌧️ Rain in ~${hoursAhead}h`; 
 
        setText( 
            "rainEta", 
            etaText 
        ); 
 
        setText( 
            "rainSub", 
            `${prob}% chance of rain around ${formatHour( 
                new Date(time[rainIdx]) 
            )}.` 
        ); 
 
        if (box) { 
 
            box.style.display = "flex"; 
 
            const tone = 
                prob >= 70 
                    ? "high" 
                    : "moderate"; 
 
            box.dataset.tone = tone; 
 
            setText( 
                "alertTitle", 
                `Rain likely around ${formatHour( 
                    new Date(time[rainIdx]) 
                )}` 
            ); 
 
            setText( 
                "alertBody", 
                "Move outdoor equipment indoors and avoid open areas." 
            ); 
 
            setText( 
                "riskTag", 
                prob >= 85 
                    ? "HIGH RISK" 
                    : "MODERATE RISK" 
            ); 
        } 
    } 
 
    /* ============================================================ 
       ASTRONOMY 
       ============================================================ */ 
 
    function getMoonPhase(date) { 
 
        const synodic = 
            29.53058867; 
 
        const knownNewMoon = 
            Date.UTC( 
                2000, 
                0, 
                6, 
                18, 
                14 
            ); 
 
        const days = 
            ( 
                date.getTime() - 
                knownNewMoon 
            ) / 86400000; 
 
        const phase = 
            ( 
                (days % synodic) + 
                synodic 
            ) % synodic; 
 
        const illumination = 
            round( 
                ( 
                    1 - 
                    Math.cos( 
                        ( 
                            2 * 
                            Math.PI * 
                            phase 
                        ) / 
                        synodic 
                    ) 
                ) / 
                    2 * 
                    100 
            ); 
 
        const stages = [ 
            [ 
                1.84566, 
                "New Moon", 
                "🌑" 
            ], 
            [ 
                5.53699, 
                "Waxing Crescent", 
                "🌒" 
            ], 
            [ 
                9.22831, 
                "First Quarter", 
                "🌓" 
            ], 
            [ 
                12.91963, 
                "Waxing Gibbous", 
                "🌔" 
            ], 
            [ 
                16.61096, 
                "Full Moon", 
                "🌕" 
            ], 
            [ 
                20.30228, 
                "Waning Gibbous", 
                "🌖" 
            ], 
            [ 
                23.99361, 
                "Last Quarter", 
                "🌗" 
            ], 
            [ 
                27.68493, 
                "Waning Crescent", 
                "🌘" 
            ], 
            [ 
                29.53058867, 
                "New Moon", 
                "🌑" 
            ] 
        ]; 
 
        let name = 
            stages[0][1]; 
 
        let emoji = 
            stages[0][2]; 
 
        for ( 
            const [ 
                upTo, 
                label, 
                ic 
            ] 
            of stages 
        ) { 
 
            if (phase < upTo) { 
                name = label; 
                emoji = ic; 
                break; 
            } 
        } 
 
        return { 
            name, 
            emoji, 
            illumination 
        }; 
    } 
 
    function populateAstronomy(data) { 
 
        if (!data.daily) { 
            return; 
        } 
 
        const sunrise = 
            data.daily.sunrise?.[0]; 
 
        const sunset = 
            data.daily.sunset?.[0]; 
 
        if (sunrise) { 
            setText( 
                "sunriseVal", 
                formatHour( 
                    new Date(sunrise) 
                ) 
            ); 
        } 
 
        if (sunset) { 
            setText( 
                "sunsetVal", 
                formatHour( 
                    new Date(sunset) 
                ) 
            ); 
        } 
 
        if ( 
            sunrise && 
            sunset 
        ) { 
 
            const ms = 
                new Date(sunset) - 
                new Date(sunrise); 
 
            const h = 
                Math.floor( 
                    ms / 3600000 
                ); 
 
            const m = 
                Math.round( 
                    ( 
                        ms % 
                        3600000 
                    ) / 
                        60000 
                ); 
 
            setText( 
                "daylenVal", 
                `${h}h ${m}m` 
            ); 
        } 
 
        const moon = 
            getMoonPhase( 
                new Date() 
            ); 
 
        setText( 
            "moonPhaseVal", 
            moon.name 
        ); 
 
        setText( 
            "moonEmoji", 
            moon.emoji 
        ); 
 
        setText( 
            "moonPhaseTitle", 
            `${moon.name} · ${moon.illumination}% illuminated` 
        ); 
 
        setText( 
            "moonRiseSet", 
            "Moonrise/moonset times aren't available from the current data source." 
        ); 
    } 
 
    /* ============================================================ 
       HISTORICAL WEATHER 
       ============================================================ */ 
 
    async function geocodeCity(name) { 
 
        const res = 
            await fetch( 
                `${OPEN_METEO_GEOCODE}?name=${encodeURIComponent( 
                    name 
                )}&count=1` 
            ); 
 
        if (!res.ok) { 
            throw new Error( 
                "Geocoding failed" 
            ); 
        } 
 
        const data = 
            await res.json(); 
 
        if ( 
            !data.results || 
            data.results.length === 0 
        ) { 
            throw new Error( 
                `Couldn't find a location matching "${name}"` 
            ); 
        } 
 
        const r = 
            data.results[0]; 
 
        return { 
            lat: r.latitude, 
            lon: r.longitude, 
            label: 
                `${r.name}, ${ 
                    r.country || "" 
                }`.trim() 
        }; 
    } 
 
    async function fetchHistory() { 
 
        const dateVal = 
            document.getElementById( 
                "histDate" 
            ).value; 
 
        const cityInput = 
            document.getElementById( 
                "histCity" 
            ).value.trim(); 
 
        const output = 
            document.getElementById( 
                "historyOutput" 
            ); 
 
        if (!dateVal) { 
 
            output.innerHTML = 
                '<p class="history-empty">Please choose a date first.</p>'; 
 
            return; 
        } 
 
        output.innerHTML = 
            '<p class="history-empty">Looking up historical weather…</p>'; 
 
        try { 
 
            let coords; 
            let label; 
 
            if (cityInput) { 
 
                const geo = 
                    await geocodeCity( 
                        cityInput 
                    ); 
 
                coords = { 
                    lat: geo.lat, 
                    lon: geo.lon 
                }; 
 
                label = 
                    geo.label; 
 
            } else if ( 
                lastKnownCoords 
            ) { 
 
                coords = 
                    lastKnownCoords; 
 
                label = 
                    "your current location"; 
 
            } else { 
 
                throw new Error( 
                    "Enter a location, or allow location access on this page." 
                ); 
            } 
 
            const url = 
                `${OPEN_METEO_ARCHIVE}?latitude=${coords.lat}&longitude=${coords.lon}` + 
                `&start_date=${dateVal}&end_date=${dateVal}` + 
                `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max` + 
                `&timezone=auto`; 
 
            const res = 
                await fetch(url); 
 
            if (!res.ok) { 
                throw new Error( 
                    "Historical data request failed" 
                ); 
            } 
 
            const data = 
                await res.json(); 
 
            console.log( 
                "Historical data:", 
                data 
            ); 
 
            if ( 
                !data.daily || 
                data.daily.time.length === 0 || 
                data.daily.temperature_2m_max[0] === null 
            ) { 
 
                output.innerHTML = 
                    '<p class="history-empty">No historical data available for that date/location.</p>'; 
 
                return; 
            } 
 
            const [ 
                icon, 
                cond 
            ] = 
                codeInfo( 
                    data.daily.weathercode[0] 
                ); 
 
            const hi = 
                round( 
                    data.daily 
                        .temperature_2m_max[0] 
                ); 
 
            const lo = 
                round( 
                    data.daily 
                        .temperature_2m_min[0] 
                ); 
 
            const precip = 
                round( 
                    data.daily 
                        .precipitation_sum[0], 
                    1 
                ); 
 
            const wind = 
                round( 
                    data.daily 
                        .wind_speed_10m_max[0] 
                ); 
 
            const formatted = 
                new Date( 
                    dateVal + 
                    "T00:00:00" 
                ).toLocaleDateString( 
                    undefined, 
                    { 
                        weekday: 
                            "long", 
                        year: 
                            "numeric", 
                        month: 
                            "long", 
                        day: 
                            "numeric" 
                    } 
                ); 
 
            output.innerHTML = ` 
                <div 
                    class="section-label reveal-up" 
                    style="--i:0" 
                > 
                    Results for ${formatted} · ${label} 
                </div> 
 
                <div class="cards"> 
 
                    <div 
                        class="card reveal-up" 
                        style="--i:1" 
                    > 
                        <span class="ic"> 
                            ${icon} 
                        </span> 
 
                        <div class="label"> 
                            Condition 
                        </div> 
 
                        <div class="value"> 
                            ${cond} 
                        </div> 
                    </div> 
 
                    <div 
                        class="card reveal-up" 
                        style="--i:2" 
                    > 
                        <span class="ic"> 
                            🌡️ 
                        </span> 
 
                        <div class="label"> 
                            High / Low 
                        </div> 
 
                        <div class="value"> 
                            ${hi}° / ${lo}° 
                        </div> 
                    </div> 
 
                    <div 
                        class="card reveal-up" 
                        style="--i:3" 
                    > 
                        <span class="ic"> 
                            🌧️ 
                        </span> 
 
                        <div class="label"> 
                            Precipitation 
                        </div> 
 
                        <div class="value"> 
                            ${precip} mm 
                        </div> 
                    </div> 
 
                    <div 
                        class="card reveal-up" 
                        style="--i:4" 
                    > 
                        <span class="ic"> 
                            🌬️ 
                        </span> 
 
                        <div class="label"> 
                            Max wind 
                        </div> 
 
                        <div class="value"> 
                            ${wind} km/h 
                        </div> 
                    </div> 
 
                </div> 
            `; 
 
            playReveal(output); 
 
        } catch (error) { 
 
            console.error( 
                "History lookup error:", 
                error 
            ); 
 
            output.innerHTML = 
                `<p class="history-empty">${ 
                    error.message || 
                    "Couldn't fetch historical weather." 
                }</p>`; 
        } 
    } 
 
    window.fetchHistory = 
        fetchHistory; 
 
    /* ============================================================ 
       STARTUP / GEOLOCATION 
       ============================================================ */ 
 
    function getLocationAndWeather() { 
 
        if (!navigator.geolocation) { 
 
            console.error( 
                "Geolocation is not supported by this browser." 
            ); 
 
            setText( 
                "heroLoc", 
                "Location unavailable" 
            ); 
 
            setText( 
                "heroDesc", 
                "Your browser doesn't support geolocation." 
            ); 
 
            return; 
        } 
 
        navigator.geolocation.getCurrentPosition( 
 
            async (position) => { 
 
                const { 
                    latitude, 
                    longitude 
                } = position.coords; 
 
                console.log( 
                    `Location acquired: lat=${latitude}, lon=${longitude}` 
                ); 
 
                lastKnownCoords = { 
                    lat: latitude, 
                    lon: longitude 
                }; 
 
                getCurrentWeather( 
                    latitude, 
                    longitude 
                ); 
 
                getForecastData( 
                    latitude, 
                    longitude 
                ); 
 
                const placeName = 
                    await reverseGeocode( 
                        latitude, 
                        longitude 
                    ); 
 
                getAIPrediction( 
                    latitude, 
                    longitude, 
                    placeName 
                ); 
            }, 
 
            (error) => { 
 
                console.error( 
                    "Geolocation error:", 
                    error.message 
                ); 
 
                setText( 
                    "heroLoc", 
                    "Location permission denied" 
                ); 
 
                setText( 
                    "heroDesc", 
                    "Enable location access to see live weather for where you are." 
                ); 
 
                const hourly = 
                    document.getElementById( 
                        "hourlyWeather" 
                    ); 
 
                if (hourly) { 
                    hourly.innerHTML = 
                        '<p class="history-empty">Enable location access to see the hourly forecast.</p>'; 
                } 
 
                const grid = 
                    document.getElementById( 
                        "forecastGrid" 
                    ); 
 
                if (grid) { 
                    grid.innerHTML = 
                        '<p class="history-empty">Enable location access to see the 7-day forecast.</p>'; 
                } 
 
                const aiBox = 
                    document.getElementById( 
                        "aiRiskBox" 
                    ); 
 
                if (aiBox) { 
                    aiBox.style.display = 
                        "none"; 
                } 
            }, 
 
            { 
                enableHighAccuracy: true, 
                timeout: 10000, 
                maximumAge: 0 
            } 
        ); 
    } 
 
    /* ============================================================ 
       START EVERYTHING 
       ============================================================ */ 
 
    initRiskMap(); 
 
    getLocationAndWeather(); 
 
    })(); 
} 
