

'use strict';

let atmData = [];
let routeData = null;
let optimizedRouteData = null;
let showOptimizedRoute = true;
let clusterData = null;
let clusterCentroids = null;
let clusterModeActive = false;

const CLUSTER_COLORS = {
    0: '#3B82F6', // Blue for Truck 1
    1: '#10B981', // Green for Truck 2
    2: '#A855F7'  // Purple for Truck 3
};

const ATM_CAPACITY   = 1_000_000;
const TRUCK_CAPACITY = 5000;
const TOP_N          = 25;

let knapsackSelected = new Set();
let knapsackStats    = null;
let dispatchMode     = false;

function getStatus(cashLevel) {
    if (cashLevel < 20)    return 'CRITICAL';
    if (cashLevel < 40)    return 'HIGH';
    if (cashLevel < 60)   return 'MEDIUM';
    return 'LOW';
}

const STATUS_COLOR = {
    CRITICAL: '#EF4444',
    HIGH:     '#f97316',
    MEDIUM:   '#FACC15',
    LOW:      '#4ADE80',
};

function lerpColor(c1, c2, t) {
    const r1 = parseInt(c1.substring(1,3), 16);
    const g1 = parseInt(c1.substring(3,5), 16);
    const b1 = parseInt(c1.substring(5,7), 16);
    const r2 = parseInt(c2.substring(1,3), 16);
    const g2 = parseInt(c2.substring(3,5), 16);
    const b2 = parseInt(c2.substring(5,7), 16);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `#${(1<<24 | r<<16 | g<<8 | b).toString(16).slice(1).padStart(6, '0')}`;
}

function getInterpolatedColor(cashLevel) {
    if (cashLevel >= 60) return lerpColor('#FACC15', '#4ADE80', Math.min(1, (cashLevel - 60) / 40));
    if (cashLevel >= 40) return lerpColor('#f97316', '#FACC15', (cashLevel - 40) / 20);
    if (cashLevel >= 20) return lerpColor('#EF4444', '#f97316', (cashLevel - 20) / 20);
    return '#EF4444';
}

const STATUS_LABEL_CLASS = {
    CRITICAL: 'status-critical',
    HIGH:     'status-high',
    MEDIUM:   'status-medium',
    LOW:      'status-low',
};

async function loadATMData() {
    try {
        const resp = await fetch('/backend/output.json');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        atmData = json.atms.map(a => ({
            ...a,
            status: getStatus(a.cashLevel),
        }));
        
        try {
            const routeResp = await fetch('/backend/route.json');
            if (routeResp.ok) {
                const routeJson = await routeResp.json();
                routeData = routeJson.route || [];
            } else {
                routeData = null;
            }
        } catch (err) {
            console.warn('[ROUTE] Could not load route.json:', err.message);
            routeData = null;
        }

        try {
            const optResp = await fetch('/backend/optimized_route.json');
            if (optResp.ok) {
                const optJson = await optResp.json();
                optimizedRouteData = optJson.route || [];
            } else {
                optimizedRouteData = null;
            }
        } catch (err) {
            console.warn('[ROUTE] Could not load optimized_route.json:', err.message);
            optimizedRouteData = null;
        }

        try {
            const clusterResp = await fetch('/backend/clusters.json');
            if (clusterResp.ok) {
                const clusterJson = await clusterResp.json();
                clusterData = clusterJson.clusters || [];
                clusterCentroids = clusterJson.centroids || [];
                
                // Map cluster data to atmData for quick lookup
                const clusterMap = new Map();
                clusterData.forEach(c => clusterMap.set(c.id, c.cluster));
                atmData.forEach(atm => {
                    atm.cluster = clusterMap.has(atm.id) ? clusterMap.get(atm.id) : -1;
                });
            } else {
                clusterData = null;
                clusterCentroids = null;
            }
        } catch (err) {
            console.warn('[CLUSTER] Could not load clusters.json:', err.message);
            clusterData = null;
            clusterCentroids = null;
        }

        renderAll();
    } catch (err) {
        console.error('[ATM] Could not load output.json:', err.message);
        showLoadError();
    }
}

function showLoadError() {
    const banner = document.getElementById('load-error-banner');
    if (banner) banner.style.display = 'flex';
}

function renderAll() {
    updateSummaryCard();
    renderUrgentPanel();
    updateDonutChart();
    renderMapMarkers();
    computeKnapsack();
    renderTruckBar();
    renderDispatchTable();
    renderCashDistribution();
    renderOptimizationInsights();
}

function computeKnapsack() {

    const candidates = [...atmData]
        .sort((a, b) => a.timeToEmpty - b.timeToEmpty)
        .slice(0, TOP_N);

    const n = candidates.length;

    const items = candidates.map(atm => {
        const actualCash   = (atm.cashLevel / 100) * ATM_CAPACITY;
        const refillAmount = ATM_CAPACITY - actualCash;
        const weight       = Math.max(1, Math.round(refillAmount / 1000));
        const value        = atm.timeToEmpty <= 0     ? 9999
                           : atm.timeToEmpty >= 100000 ? 1
                           : Math.round(1000 / atm.timeToEmpty);
        return { atm, actualCash, refillAmount, weight, value };
    });

    const dp = new Int32Array(TRUCK_CAPACITY + 1);
    for (let i = 0; i < n; i++) {
        const { weight, value } = items[i];
        for (let cap = TRUCK_CAPACITY; cap >= weight; cap--) {
            if (dp[cap - weight] + value > dp[cap])
                dp[cap] = dp[cap - weight] + value;
        }
    }
    const maxValue = dp[TRUCK_CAPACITY];

    const dpFull = [];
    dpFull.push(new Int32Array(TRUCK_CAPACITY + 1));
    for (let i = 0; i < n; i++) {
        const prev = dpFull[i];
        const curr = new Int32Array(prev);
        const { weight, value } = items[i];
        for (let cap = weight; cap <= TRUCK_CAPACITY; cap++) {
            if (prev[cap - weight] + value > curr[cap])
                curr[cap] = prev[cap - weight] + value;
        }
        dpFull.push(curr);
    }

    const selected = [];
    let cap = TRUCK_CAPACITY;
    for (let i = n; i >= 1; i--) {
        if (dpFull[i][cap] !== dpFull[i - 1][cap]) {
            selected.push(items[i - 1]);
            cap -= items[i - 1].weight;
        }
    }

    selected.sort((a, b) => a.atm.timeToEmpty - b.atm.timeToEmpty);

    knapsackSelected = new Set(selected.map(s => s.atm.id));
    knapsackStats = {
        selectedItems: selected,
        totalLoad:  selected.reduce((s, it) => s + it.refillAmount, 0),
        totalValue: selected.reduce((s, it) => s + it.value, 0),
        maxValue,
        truckCapacityRupees: TRUCK_CAPACITY * 1000,
    };

    const canvas = document.getElementById('atm-map-canvas');
    if (canvas) draw(canvas);
}

function updateSummaryCard() {
    const total    = atmData.length;
    const critical = atmData.filter(a => a.status === 'CRITICAL').length;
    const avgTime  = atmData.reduce((s, a) => s + Math.min(a.timeToEmpty, 9999.99), 0) / total;

    set('stat-total',    total);
    set('map-stat-total', total);
    set('stat-critical', critical);
    set('stat-avg-time', avgTime.toFixed(1) + ' hrs');
}

function renderUrgentPanel() {
    const list = document.getElementById('urgent-list');
    if (!list) return;

    const sorted = [...atmData].sort((a, b) => a.timeToEmpty - b.timeToEmpty).slice(0, 10);

    list.innerHTML = sorted.map((atm, i) => {
        const rank    = String(i + 1).padStart(2, '0');
        const tte     = Math.min(atm.timeToEmpty, 9999.99).toFixed(1);
        const cls     = STATUS_LABEL_CLASS[atm.status] || 'status-low';
        const timeCol = atm.status === 'CRITICAL' ? 'text-red-400'
                      : atm.status === 'HIGH'     ? 'text-orange-500'
                      : atm.status === 'MEDIUM'   ? 'text-yellow-400'
                      : 'text-green-400';

        return `
        <div class="urgent-item flex items-center justify-between p-3 rounded-xl
                    bg-surface-container-high bg-opacity-50
                    hover:bg-surface-container-high transition-colors
                    cursor-pointer group"
             data-atm-id="${atm.id}">
            <div class="flex items-center gap-3">
                <span class="text-xs font-bold ${timeCol}">${rank}</span>
                <div>
                    <p class="text-xs font-bold text-on-surface uppercase tracking-tight">${atm.name}</p>
                    <p class="text-[10px] text-on-surface-variant">${atm.location}</p>
                </div>
            </div>
            <div class="flex flex-col items-end gap-1">
                <span class="text-xs font-bold ${timeCol}">${tte} hrs</span>
                <span class="status-badge ${cls}">${atm.status}</span>
            </div>
        </div>`;
    }).join('');

    list.querySelectorAll('.urgent-item').forEach(el => {
        el.addEventListener('click', () => {
            const id  = parseInt(el.dataset.atmId, 10);
            const atm = atmData.find(a => a.id === id);
            if (atm) showPopup(atm);
        });
    });
}

function updateDonutChart() {
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    atmData.forEach(a => counts[a.status]++);
    const total = atmData.length;

    const pct = s => ((counts[s] / total) * 100).toFixed(0);

    setText('legend-critical', `${pct('CRITICAL')}% Critical`);
    setText('legend-high',     `${pct('HIGH')}% High`);
    setText('legend-medium',   `${pct('MEDIUM')}% Medium`);
    setText('legend-low',      `${pct('LOW')}% Low`);

    const critPct   = (counts.CRITICAL / total) * 100;
    const highPct   = (counts.HIGH     / total) * 100;
    const medPct    = (counts.MEDIUM   / total) * 100;
    const lowPct    = (counts.LOW      / total) * 100;

    setSVGArc('arc-critical', critPct, 0);
    setSVGArc('arc-high',     highPct, critPct);
    setSVGArc('arc-medium',   medPct,  critPct + highPct);
    setSVGArc('arc-low',      lowPct,  critPct + highPct + medPct);
}

function setSVGArc(id, pct, offset) {
    const el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('stroke-dasharray', `${pct.toFixed(1)}, 100`);
    el.setAttribute('stroke-dashoffset', offset === 0 ? '0' : `-${offset.toFixed(1)}`);
}

let hoveredAtm = null;

let map = null;
let atmLayerGroup = null;
let routeLayerGroup = null;
let truckLayerGroup = null;
let mapTrucks = []; // Store leaflet markers for animated trucks
let osrmCache = {};
let currentRouteRenderHash = null;

function initMap() {
    if (map) return;
    
    // Initialize map centered at Depot (New Delhi - Connaught Place)
    map = L.map('leaflet-map', {
        zoomControl: false // customized placement
    }).setView([28.63, 77.21], 12);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // CartoDB Dark Matter tile layer for cyberpunk aesthetic
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap & CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    atmLayerGroup = L.layerGroup().addTo(map);
    routeLayerGroup = L.layerGroup().addTo(map);
    truckLayerGroup = L.layerGroup().addTo(map);

    // Initial Depot Marker setup
    const depotIcon = L.divIcon({
        className: 'truck-leaflet-marker',
        html: `<div style="color: #00f2ff; font-size: 10px;">D</div>`,
        iconSize: [20, 20]
    });
    L.marker([28.63, 77.21], {icon: depotIcon, zIndexOffset: 1000}).addTo(map)
        .bindTooltip("Depot (Connaught Place)", {direction: "top"});
}

function renderMapMarkers() {
    if (!document.getElementById('leaflet-map')) return;
    if (!map) initMap();
    
    atmLayerGroup.clearLayers();
    
    // 1. Draw Routes (Hash protected against 1s interval rate limits)
    const baseRoute = (showOptimizedRoute && optimizedRouteData && optimizedRouteData.length > 0) ? optimizedRouteData : (routeData || []);
    const hashData = baseRoute.map(r => r.id).join('-') + `_${clusterModeActive}_${showOptimizedRoute}`;
    
    if (currentRouteRenderHash !== hashData && baseRoute.length > 0) {
        routeLayerGroup.clearLayers();
        currentRouteRenderHash = hashData;
        
        let hasClusteredRoute = false;
        const colors = ['#3B82F6', '#10B981', '#A855F7'];
        
        for (let i = 0; i < 3; i++) {
            const clusterRoute = baseRoute.filter(stop => {
                const atm = atmData.find(a => a.id === stop.id);
                return (atm && atm.cluster === i) || (stop.id === 0);
            });
            
            if (clusterRoute.length > 1) { // Needs at least Depot + 1 Target
                drawLeafletRoute(clusterRoute, colors[i], i);
                hasClusteredRoute = true;
            }
        }
        
        if (!hasClusteredRoute) {
            const singleColor = showOptimizedRoute ? '#00f2ff' : '#f97316';
            drawLeafletRoute(baseRoute, singleColor, -1);
        }
    }
    
    // 2. Draw ATMs
    atmData.forEach(atm => {
        let color = getInterpolatedColor(atm.cashLevel);
        if (clusterModeActive && atm.cluster !== undefined && atm.cluster >= 0) {
            color = CLUSTER_COLORS[atm.cluster] || color;
        }

        const isSelected = knapsackSelected.has(atm.id);
        const opacity = (dispatchMode && !isSelected) ? 0.3 : 1;
        const radius = atm.status === 'CRITICAL' ? 7 : 5;
        
        const circleParams = {
            radius: dispatchMode && isSelected ? 8 : radius,
            color: dispatchMode && isSelected ? '#00f2ff' : color,
            weight: atm.status === 'CRITICAL' ? 2 : 1,
            fillColor: dispatchMode && isSelected ? '#00f2ff' : color,
            fillOpacity: opacity,
            opacity: opacity
        };

        const marker = L.circleMarker([atm.y, atm.x], circleParams);
        
        const tte = Math.min(atm.timeToEmpty, 9999.99).toFixed(1);
        const tooltipHtml = `
            <strong>${atm.name}</strong> — <span class="${STATUS_LABEL_CLASS[atm.status]}">${atm.status}</span><br>
            <span class="tip-loc" style="color:var(--on-surface-variant);font-size:10px;">${atm.location}</span><br>
            Cash: ${atm.cashLevel.toFixed(1)}% &nbsp;|&nbsp; Time Left: ${tte} hrs`;
            
        marker.bindTooltip(tooltipHtml, { direction: 'top' });
        marker.on('click', () => showPopup(atm));
        
        atmLayerGroup.addLayer(marker);

        // Add glow ring for selected/critical
        if (dispatchMode && isSelected || atm.status === 'CRITICAL') {
             L.circleMarker([atm.y, atm.x], {
                radius: dispatchMode && isSelected ? 12 : 10,
                color: dispatchMode && isSelected ? '#00f2ff' : color,
                weight: 1.5,
                fillColor: 'transparent',
                opacity: 0.6
            }).addTo(atmLayerGroup);
        }
    });

    // 3. Draw Centroids
    if (clusterModeActive && clusterCentroids) {
        clusterCentroids.forEach((centroid, i) => {
            const color = CLUSTER_COLORS[centroid.cluster] || '#FFFFFF';
            const html = `<div style="background-color:rgba(0,0,0,0.7);color:white;padding:2px 6px;border-radius:4px;border:2px solid ${color};white-space:nowrap;">Truck ${i + 1}</div>`;
            const icon = L.divIcon({ className: 'custom-centroid', html: html, iconSize: [50, 20] });
            L.marker([centroid.y, centroid.x], {icon: icon}).addTo(atmLayerGroup);
        });
    }

    // 4. Update Animated Trucks
    if (typeof trucks !== 'undefined' && trucks) {
        // Clear old ones
        truckLayerGroup.clearLayers();
        mapTrucks = [];
        
        trucks.forEach((t, idx) => {
            if (t.route && t.route.length > 0) { // Keep drawn even when paused
                const icon = L.divIcon({
                    className: 'truck-leaflet-marker',
                    html: `T${idx + 1}`,
                    iconSize: [20, 20]
                });
                // Note: t.y is lat, t.x is lnt in reality.
                const marker = L.marker([t.y, t.x], {icon: icon, zIndexOffset: 2000}).addTo(truckLayerGroup);
                marker.truckId = idx;
                mapTrucks.push(marker);
            }
        });
    }
}

async function drawLeafletRoute(routeArr, color, truckId) {
    if (!routeArr || routeArr.length === 0) return;
    
    const latLngs = [];
    const pointsList = []; 
    
    // Depot
    latLngs.push([28.63, 77.21]);
    pointsList.push({ id: 0, lat: 28.63, lng: 77.21 });
    
    for (const stop of routeArr) {
        const atm = atmData.find(a => a.id === stop.id);
        if (atm) {
            latLngs.push([atm.y, atm.x]);
            pointsList.push({ id: stop.id, lat: atm.y, lng: atm.x});
        }
    }
    
    const cacheKey = pointsList.map(p => p.id).join('-');
    let leafCoords = [];
    
    if (osrmCache[cacheKey]) {
        leafCoords = osrmCache[cacheKey];
    } else {
        const coordsStr = pointsList.map(p => `${p.lng},${p.lat}`).join(';');
        try {
            const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`);
            const data = await res.json();
            if (data.routes && data.routes[0]) {
                const routeGeom = data.routes[0].geometry.coordinates;
                leafCoords = routeGeom.map(pt => [pt[1], pt[0]]);
                osrmCache[cacheKey] = leafCoords;
            } else {
                leafCoords = latLngs; 
            }
        } catch(err) {
            console.error('OSRM fail', err);
            leafCoords = latLngs; 
        }
    }
    
    L.polyline(leafCoords, {
        color: color,
        weight: 3,
        opacity: 0.8
    }).addTo(routeLayerGroup);
    
    // Draw Route step numbers
    for (let i = 1; i < pointsList.length; i++) {
        const pt = pointsList[i];
        const icon = L.divIcon({
            className: 'truck-leaflet-marker',
            html: `<div style="background:#1e293b;width:14px;height:14px;border-radius:50%;color:${color};display:flex;align-items:center;justify-content:center;font-size:8px;">${i}</div>`,
            iconSize: [14, 14]
        });
        L.marker([pt.lat, pt.lng], {icon: icon, zIndexOffset: 800}).addTo(routeLayerGroup);
    }
    
    if (truckId !== undefined && typeof trucks !== 'undefined' && truckId >= 0 && truckId < trucks.length) {
        const truck = trucks[truckId];
        if (truck) {
            truck.detailedPath = leafCoords;
            truck.pathIndex = 0;
        }
    } else if (truckId === -1 && typeof trucks !== 'undefined') {
        // Fallback unified route overrides truck 0 path if single route rendering
        if (trucks[0]) {
            trucks[0].detailedPath = leafCoords;
            trucks[0].pathIndex = 0;
        }
    }
}

// Obsolete stubs for canvas animation compatibility
function startRingAnimation(c) {}
function stopRingAnimation(c) {}
function draw(c) {}

function showPopup(atm) {
    const popup = document.getElementById('atm-popup');
    if (!popup) return;

    const tte       = Math.min(atm.timeToEmpty, 9999.99);
    const statusCls = STATUS_LABEL_CLASS[atm.status] || 'status-low';
    const color     = STATUS_COLOR[atm.status];

    set('popup-name',     atm.name);
    set('popup-location', atm.location);
    set('popup-cash',     atm.cashLevel.toFixed(2) + '%');
    set('popup-rate',     '₹' + (atm.dailyWithdrawalRate || 0).toFixed(0) + ' / day');
    set('popup-tte',      tte.toFixed(2) + ' hrs');

    const badge = document.getElementById('popup-status');
    if (badge) {
        badge.textContent  = atm.status;
        badge.className    = `status-badge ${statusCls}`;
    }

    const bar = document.getElementById('popup-cash-bar');
    if (bar) {
        bar.style.width      = Math.min(atm.cashLevel, 100) + '%';
        bar.style.background = color;
    }

    popup.classList.remove('hidden');
    popup.classList.add('flex');

    popup.addEventListener('click', e => {
        if (e.target === popup) hidePopup();
    }, { once: true });
}

function hidePopup() {
    const popup = document.getElementById('atm-popup');
    if (!popup) return;
    popup.classList.add('hidden');
    popup.classList.remove('flex');
}

function set(id, val)     { const el = document.getElementById(id); if (el) el.textContent = val; }
function setText(id, val) { set(id, val); }

function updateClock() {
    const now = new Date();
    const t   = [now.getHours(), now.getMinutes(), now.getSeconds()]
                .map(n => String(n).padStart(2, '0')).join(':');
    set('simulation-clock', t);
}
setInterval(updateClock, 1000);
updateClock();

const sidebarToggle = document.getElementById('sidebar-toggle');
const desktopSidebar = document.getElementById('desktop-sidebar');
const layoutWrapper  = document.getElementById('layout-wrapper');
if (sidebarToggle && desktopSidebar && layoutWrapper) {
    sidebarToggle.addEventListener('click', () => {
        desktopSidebar.classList.toggle('-translate-x-full');
        layoutWrapper.classList.toggle('md:pl-64');
    });
}

const runBtn = document.getElementById('run-optimization-btn');
if (runBtn) {
    runBtn.addEventListener('click', async () => {
        runBtn.textContent = 'Refreshing…';
        runBtn.disabled    = true;
        await loadATMData();
        runBtn.textContent = 'Run Optimization';
        runBtn.disabled    = false;
    });
}

const dispatchToggle = document.getElementById('dispatch-mode-toggle');
const dispatchLabel  = document.getElementById('dispatch-mode-label');
if (dispatchToggle) {
    dispatchToggle.addEventListener('click', () => {
        dispatchMode = !dispatchMode;
        dispatchToggle.classList.toggle('active', dispatchMode);
        if (dispatchLabel) dispatchLabel.textContent = dispatchMode ? 'Dispatch: ON' : 'Dispatch: OFF';

        const canvas = document.getElementById('atm-map-canvas');
        if (canvas) {
            if (dispatchMode) startRingAnimation(canvas);
            else              stopRingAnimation(canvas);
        }

        document.querySelectorAll('#dispatch-tbody tr[data-atm-id]').forEach(row => {
            row.classList.toggle('dispatch-row-selected', dispatchMode);
        });
    });
}

function renderTruckBar() {
    if (!knapsackStats) return;
    const { selectedItems, totalLoad, truckCapacityRupees } = knapsackStats;

    const pct = Math.min((totalLoad / truckCapacityRupees) * 100, 100);
    const fill      = document.getElementById('truck-bar-fill');
    const loadLabel = document.getElementById('truck-load-label');
    const pctPill   = document.getElementById('truck-pct-pill');

    if (loadLabel) loadLabel.textContent = `₹${(totalLoad / 100000).toFixed(2)} lakh / ₹50 lakh`;
    if (pctPill)   pctPill.textContent   = `${pct.toFixed(1)}%`;

    if (!fill) return;

    setTimeout(() => { fill.style.width = pct + '%'; }, 80);

    const totalWeight = selectedItems.reduce((s, it) => s + it.weight, 0);
    fill.innerHTML = selectedItems.map(it => {
        const blockPct = totalWeight > 0 ? (it.weight / totalWeight) * 100 : 0;
        const color    = STATUS_COLOR[it.atm.status] || '#4ADE80';
        const tip      = `${it.atm.name} · ${it.atm.location} · ₹${(it.refillAmount / 100000).toFixed(1)}L · ${it.atm.timeToEmpty.toFixed(1)}h left`;
        return `<div class="truck-atm-block"
                     style="width:${blockPct}%; background:${color}44; border-color:${color}55;"
                     data-tip="${tip}"></div>`;
    }).join('');

    let tip = document.getElementById('truck-tooltip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id        = 'truck-tooltip';
        tip.className = 'truck-tooltip';
        document.body.appendChild(tip);
    }

    fill.querySelectorAll('.truck-atm-block').forEach(block => {
        block.addEventListener('mouseenter', () => {
            tip.textContent  = block.dataset.tip;
            tip.style.display = 'block';
        });
        block.addEventListener('mousemove', e => {
            tip.style.left = (e.clientX + 14) + 'px';
            tip.style.top  = (e.clientY - 36) + 'px';
        });
        block.addEventListener('mouseleave', () => {
            tip.style.display = 'none';
        });
    });
}

function renderDispatchTable() {
    const tbody       = document.getElementById('dispatch-tbody');
    const tfoot       = document.getElementById('dispatch-tfoot');
    const badge       = document.getElementById('dispatch-count-badge');
    const footLoad    = document.getElementById('foot-load');
    const footUrgency = document.getElementById('foot-urgency');
    if (!tbody || !knapsackStats) return;

    const { selectedItems, totalLoad, totalValue } = knapsackStats;
    if (badge) badge.textContent = `${selectedItems.length} ATMs`;

    tbody.innerHTML = selectedItems.map((it, i) => {
        const atm       = it.atm;
        const cls       = STATUS_LABEL_CLASS[atm.status] || 'status-low';
        const timeColor = atm.status === 'CRITICAL' ? 'text-red-400'
                        : atm.status === 'HIGH'     ? 'text-orange-500'
                        : atm.status === 'MEDIUM'   ? 'text-yellow-400'
                        : 'text-green-400';
        const tte  = Math.min(atm.timeToEmpty, 9999.99).toFixed(2);
        const rank = String(i + 1).padStart(2, '0');

        return `<tr data-atm-id="${atm.id}" class="cursor-pointer"
                    onclick="showPopup(atmData.find(a=>a.id===${atm.id}))">
            <td class="font-black ${timeColor} w-8">${rank}</td>
            <td class="font-bold uppercase tracking-tight">${atm.name}</td>
            <td class="text-on-surface-variant">${atm.location}</td>
            <td class="font-bold text-primary-fixed-dim">₹${(it.refillAmount / 100000).toFixed(2)}L</td>
            <td class="font-bold ${timeColor}">${tte} hrs</td>
            <td class="text-on-surface-variant">${it.value}</td>
            <td><span class="status-badge ${cls}">${atm.status}</span></td>
        </tr>`;
    }).join('');

    if (footLoad)    footLoad.textContent    = `₹${(totalLoad / 100000).toFixed(2)}L total`;
    if (footUrgency) footUrgency.textContent = `${totalValue} pts`;
    if (tfoot)       tfoot.classList.remove('hidden');
}

function renderCashDistribution() {
    const chart      = document.getElementById('cash-dist-chart');
    const avgEl      = document.getElementById('stat-avg-cash');
    const lowCashEl  = document.getElementById('stat-low-cash');
    if (!chart || !atmData.length) return;

    const buckets = [
        { label: '0–10%',   min: 0,  max: 10,  color: '#EF4444' },
        { label: '10–25%',  min: 10, max: 25,  color: '#FACC15' },
        { label: '25–50%',  min: 25, max: 50,  color: '#60A5FA' },
        { label: '50–75%',  min: 50, max: 75,  color: '#a78bfa' },
        { label: '75–100%', min: 75, max: 101, color: '#4ADE80' },
    ];

    buckets.forEach(b => {
        b.count = atmData.filter(a => {
            const cl = Math.min(a.cashLevel, 100);
            return cl >= b.min && cl < b.max;
        }).length;
    });

    const maxCount = Math.max(...buckets.map(b => b.count), 1);

    const avgCash  = atmData.reduce((s, a) => s + Math.min(a.cashLevel, 100), 0) / atmData.length;
    const lowCount = atmData.filter(a => a.cashLevel < 25).length;
    if (avgEl)     avgEl.textContent     = avgCash.toFixed(1) + '%';
    if (lowCashEl) lowCashEl.textContent = lowCount + ' ATMs';

    chart.innerHTML = buckets.map(b => {
        const heightPct = ((b.count / maxCount) * 100).toFixed(1);
        const tip       = `${b.label}: ${b.count} ATM${b.count !== 1 ? 's' : ''}`;
        return `
        <div class="flex-1 flex flex-col items-center justify-end h-full group relative">
            <span class="text-[10px] font-black mb-1 transition-opacity opacity-0 group-hover:opacity-100"
                  style="color:${b.color}">${b.count}</span>
            <div class="cash-dist-bar w-full rounded-t cursor-pointer transition-all duration-700"
                 style="height:0%; background:${b.color}22; border-top: 2px solid ${b.color}88;"
                 data-target="${heightPct}"
                 data-tip="${tip}"
                 title="${tip}"></div>
        </div>`;
    }).join('');

    requestAnimationFrame(() => {
        chart.querySelectorAll('.cash-dist-bar').forEach(bar => {
            setTimeout(() => {
                bar.style.height = bar.dataset.target + '%';
                bar.style.background = bar.style.borderTopColor.replace('88', '33');
            }, 100);
        });
    });

    let tip = document.getElementById('truck-tooltip');
    chart.querySelectorAll('.cash-dist-bar').forEach(bar => {
        bar.addEventListener('mouseenter', () => {
            if (tip) { tip.textContent = bar.dataset.tip; tip.style.display = 'block'; }
        });
        bar.addEventListener('mousemove', e => {
            if (tip) { tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY - 36) + 'px'; }
        });
        bar.addEventListener('mouseleave', () => {
            if (tip) tip.style.display = 'none';
        });
    });
}

const routeToggleBtn = document.getElementById('route-toggle-btn');
const routeToggleLabel = document.getElementById('route-toggle-label');
const routeToggleIcon = document.getElementById('route-toggle-icon');

if (routeToggleBtn) {
    routeToggleBtn.addEventListener('click', () => {
        showOptimizedRoute = !showOptimizedRoute;
        if (routeToggleLabel) {
            routeToggleLabel.textContent = showOptimizedRoute ? '2-Opt: ON' : 'Nearest: ON';
            routeToggleLabel.className = `text-[10px] uppercase font-bold tracking-widest hidden md:inline ${showOptimizedRoute ? 'text-primary-container' : 'text-orange-400'}`;
        }
        if (routeToggleIcon) {
            routeToggleIcon.className = `material-symbols-outlined text-sm ${showOptimizedRoute ? 'text-on-surface' : 'text-orange-400'}`;
        }
        
        const canvas = document.getElementById('atm-map-canvas');
        if (canvas) draw(canvas);
    });
}

const clusterToggleBtn = document.getElementById('cluster-toggle-btn');
const clusterToggleLabel = document.getElementById('cluster-toggle-label');
const clusterToggleIcon = document.getElementById('cluster-toggle-icon');
const urgencyLegend = document.getElementById('urgency-legend');
const clusterLegend = document.getElementById('cluster-legend');

if (clusterToggleBtn) {
    clusterToggleBtn.addEventListener('click', () => {
        clusterModeActive = !clusterModeActive;
        if (clusterToggleLabel) {
            clusterToggleLabel.textContent = clusterModeActive ? 'Clusters: ON' : 'Clusters: OFF';
            clusterToggleLabel.className = `text-[10px] uppercase font-bold tracking-widest hidden md:inline ${clusterModeActive ? 'text-primary-container' : 'text-on-surface-variant'}`;
        }
        if (clusterToggleIcon) {
            clusterToggleIcon.className = `material-symbols-outlined text-sm ${clusterModeActive ? 'text-primary-container' : 'text-on-surface'}`;
        }
        
        if (urgencyLegend && clusterLegend) {
            if (clusterModeActive) {
                urgencyLegend.classList.add('hidden');
                clusterLegend.classList.remove('hidden');
            } else {
                urgencyLegend.classList.remove('hidden');
                clusterLegend.classList.add('hidden');
            }
        }
        
        if (canvas) draw(canvas);
    });
}

function calculateRouteDistance(r) {
    if (!r || r.length < 2) return 0;
    let dist = 0;
    for (let i = 0; i < r.length - 1; i++) {
        dist += Math.sqrt(Math.pow(r[i].x - r[i + 1].x, 2) + Math.pow(r[i].y - r[i + 1].y, 2));
    }
    return dist;
}

function renderOptimizationInsights() {
    // 1. Route Optimization Performance
    if (routeData && routeData.length >= 2) {
        const nnDist = calculateRouteDistance(routeData);
        let optDist = nnDist;
        if (optimizedRouteData) {
            optDist = optimizedRouteData.totalDistance || calculateRouteDistance(optimizedRouteData);
        }
        const imp = nnDist > 0 ? ((nnDist - optDist) / nnDist) * 100 : 0;
        
        set('insight-route-nn', nnDist.toFixed(1) + ' km');
        set('insight-route-opt', optDist.toFixed(1) + ' km');
        set('insight-route-imp', imp.toFixed(1) + '%');
    }

    // 2. Capacity Utilization
    if (knapsackStats) {
        const { totalLoad, truckCapacityRupees } = knapsackStats;
        const totalLoadLakhs = totalLoad / 100_000;
        const maxLakhs = truckCapacityRupees / 100_000;
        const pct = Math.min((totalLoad / truckCapacityRupees) * 100, 100);
        
        set('insight-capacity-text', `₹${totalLoadLakhs.toFixed(1)}L / ₹${maxLakhs.toFixed(0)}L`);
        set('insight-capacity-pct', `${pct.toFixed(1)}%`);
        
        const capBar = document.getElementById('insight-capacity-bar');
        if (capBar) {
            setTimeout(() => { capBar.style.width = pct + '%'; }, 100);
        }
    }

    // 3. Cluster Distribution
    const clustersContainer = document.getElementById('insight-clusters-container');
    if (clustersContainer && clusterData && clusterData.length > 0) {
        const counts = {};
        let totalAssigned = 0;
        clusterData.forEach(c => {
            counts[c.cluster] = (counts[c.cluster] || 0) + 1;
            totalAssigned++;
        });
        
        // Convert to array and sort by cluster ID
        const clusterKeys = Object.keys(counts).map(Number).sort((a,b)=>a-b);
        
        clustersContainer.innerHTML = clusterKeys.map((k, idx) => {
            const count = counts[k];
            const color = CLUSTER_COLORS[k] || '#FFFFFF';
            const truckNum = idx + 1;
            return `
                <div class="flex items-center justify-between group/row">
                    <div class="flex items-center gap-2">
                        <span class="w-3 h-3 rounded box-border" style="background-color: ${color}40; border: 1px solid ${color}; shadow: 0 0 5px ${color}"></span>
                        <span class="text-[10px] uppercase font-bold text-on-surface-variant transition-colors" style="color: ${color}80">Truck ${truckNum} Zone</span>
                    </div>
                    <span class="text-sm font-bold text-on-surface">${count} ATMs</span>
                </div>
            `;
        }).join('');
    } else if (clustersContainer) {
        clustersContainer.innerHTML = '<div class="text-[10px] text-on-surface-variant/50">Turn ON clusters to view zones</div>';
    }

    // 4. Urgency Distribution Summary
    if (atmData && atmData.length > 0) {
        const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
        atmData.forEach(a => counts[a.status]++);
        
        set('insight-urgency-critical', counts.CRITICAL);
        set('insight-urgency-high', counts.HIGH);
        set('insight-urgency-medium', counts.MEDIUM);
        set('insight-urgency-low', counts.LOW);
    }
}

let simulationRunning = false;
let simulationTime = 0;
let simulationSpeed = 1;
let simulationInterval = null;
let originalATMData = null;

let trucks = [];
let truckAnimFrame = null;

function initializeTrucks() {
    trucks = [];
    const colors = ['#3B82F6', '#10B981', '#A855F7'];
    for (let i = 0; i < 3; i++) {
        trucks.push({
            id: i,
            x: 77.21,
            y: 28.63,
            currentRouteIndex: 0,
            active: false,
            color: colors[i],
            route: []
        });
    }
}

function assignRoutesToTrucks() {
    let baseRoute = [];
    if (showOptimizedRoute && optimizedRouteData && optimizedRouteData.length > 0) {
        baseRoute = optimizedRouteData;
    } else if (routeData && routeData.length > 0) {
        baseRoute = routeData;
    }
    
    trucks.forEach((t, i) => {
        t.route = baseRoute.filter(stop => {
            const atm = atmData.find(a => a.id === stop.id);
            return atm && atm.cluster === i;
        }).map(stop => {
            // Guard against backend changes where route arrays lack coordinates
            if (stop.x !== undefined && stop.y !== undefined) return stop;
            const atm = atmData.find(a => a.id === stop.id);
            return { id: stop.id, x: atm.x, y: atm.y };
        });
    });
}

function updateTruckPositions() {
    trucks.forEach(t => {
        if (!t.active || !t.detailedPath || t.detailedPath.length === 0) return;
        if (t.pathIndex === undefined) t.pathIndex = 0;
        
        if (t.pathIndex >= t.detailedPath.length) {
            t.active = false;
            return;
        }
        
        // node is [lat, lng]
        let targetLat = t.detailedPath[t.pathIndex][0];
        let targetLng = t.detailedPath[t.pathIndex][1];
        
        const safeSpeed = (!isNaN(simulationSpeed) && simulationSpeed > 0) ? simulationSpeed : 1;
        const speedFactor = safeSpeed * 0.0003; // fixed geographic degrees per frame
        
        const currentLng = isNaN(t.x) ? 77.21 : t.x;
        const currentLat = isNaN(t.y) ? 28.63 : t.y;
        
        const dx = targetLng - currentLng;
        const dy = targetLat - currentLat;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist <= speedFactor) {
            t.x = targetLng;
            t.y = targetLat;
            t.pathIndex++;
        } else {
            t.x = currentLng + (dx/dist) * speedFactor;
            t.y = currentLat + (dy/dist) * speedFactor;
        }
        
        // Update Leaflet Truck Marker
        if (typeof mapTrucks !== 'undefined' && mapTrucks.length > 0) {
            const marker = mapTrucks.find(m => m.truckId === t.id);
            if (marker) marker.setLatLng([t.y, t.x]);
        }
        
        // Check arrival at intended ATM stop
        if (t.currentRouteIndex < t.route.length) {
            let stopX = t.route[t.currentRouteIndex].x || 77.21;
            let stopY = t.route[t.currentRouteIndex].y || 28.63;
            let distToStop = Math.sqrt((stopX - t.x)**2 + (stopY - t.y)**2);
            // Ultra-fine threshold since OSRM snaps to physical roads
            if (distToStop < 0.003) {
                const atmId = t.route[t.currentRouteIndex].id;
                if (atmId > 0) refillATM(atmId);
                t.currentRouteIndex++;
            }
        } else {
            // Check Depot Return Condition
            let distToStop = Math.sqrt((77.21 - t.x)**2 + (28.63 - t.y)**2);
            if (distToStop < 0.003) {
                 t.active = false; // complete
            }
        }
    });
}

function refillATM(atmId) {
    const atm = atmData.find(a => a.id === atmId);
    if (atm) {
        atm.cashLevel = 100;
        atm.status = getStatus(atm.cashLevel);
        const hourlyRate = (atm.dailyWithdrawalRate || 0) / 24;
        const actualCash = ATM_CAPACITY;
        atm.timeToEmpty = hourlyRate > 0 ? actualCash / hourlyRate : 9999;
    }
}

function startTruckAnimation() {
    if (!truckAnimFrame) {
        animateTruckStep();
    }
}

function animateTruckStep() {
    if (simulationRunning) {
        const anyActive = trucks.some(t => t.active);
        if (anyActive) {
            updateTruckPositions();
            const canvas = document.getElementById('atm-map-canvas');
            if (canvas) draw(canvas);
        }
    }
    truckAnimFrame = requestAnimationFrame(animateTruckStep);
}

function startSimulation() {
    if (simulationRunning) return;
    
    if (!originalATMData) {
        originalATMData = JSON.parse(JSON.stringify(atmData));
    }
    
    if (!trucks || trucks.length === 0) {
        initializeTrucks();
    }
    assignRoutesToTrucks();
    trucks.forEach(t => t.active = true);
    startTruckAnimation();
    
    simulationRunning = true;
    simulationInterval = setInterval(() => {
        updateATMValues();
    }, 1000);
}

function pauseSimulation() {
    if (!simulationRunning) return;
    simulationRunning = false;
    clearInterval(simulationInterval);
    trucks.forEach(t => t.active = false);
}

function resetSimulation() {
    if (simulationInterval) clearInterval(simulationInterval);
    simulationRunning = false;
    
    initializeTrucks();
    if (truckAnimFrame) {
        cancelAnimationFrame(truckAnimFrame);
        truckAnimFrame = null;
    }
    
    // Force route regeneration to inject cached OSRM paths onto new truck instances
    if (typeof currentRouteRenderHash !== 'undefined') {
        currentRouteRenderHash = null;
    }
    
    if (originalATMData) {
        atmData = JSON.parse(JSON.stringify(originalATMData));
        renderAll();
    }
}

function updateATMValues() {
    atmData.forEach(atm => {
        const hourlyRate = (atm.dailyWithdrawalRate || 0) / 24;
        atm.cashLevel -= hourlyRate * simulationSpeed * 0.01;
        
        if (atm.cashLevel < 0) {
            atm.cashLevel = 0;
        }
        
        const actualCash = (atm.cashLevel / 100) * ATM_CAPACITY;
        if (hourlyRate > 0) {
            atm.timeToEmpty = actualCash / hourlyRate;
        } else {
            atm.timeToEmpty = 9999;
        }
        
        if (atm.cashLevel === 0) atm.timeToEmpty = 0;
        
        atm.status = getStatus(atm.cashLevel);
    });
    
    renderAll();
}

document.addEventListener('DOMContentLoaded', () => {
    loadATMData();
    
    const startBtn = document.getElementById('startSimulationBtn');
    const pauseBtn = document.getElementById('pauseSimulationBtn');
    const resetBtn = document.getElementById('resetSimulationBtn');
    const speedSel = document.getElementById('speedControl');
    
    if (startBtn) startBtn.addEventListener('click', startSimulation);
    if (pauseBtn) pauseBtn.addEventListener('click', pauseSimulation);
    if (resetBtn) resetBtn.addEventListener('click', resetSimulation);
    if (speedSel) {
        speedSel.addEventListener('change', (e) => {
            simulationSpeed = parseInt(e.target.value, 10);
        });
    }
});
// Tab Switching Logic
function switchTab(tabId) {
    // Hide all tabs
    document.getElementById('tab-dashboard').classList.add('hidden');
    document.getElementById('tab-map').classList.add('hidden');
    
    // Show target tab
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    
    // Update active nav state for desktop
    const desktopTabs = document.querySelectorAll('.nav-tab-desktop');
    if (desktopTabs.length > 0) {
        desktopTabs.forEach(tab => tab.classList.remove('nav-active'));
        const index = tabId === 'dashboard' ? 0 : 1;
        desktopTabs[index].classList.add('nav-active');
    }
    
    // Update active nav state for mobile
    const mobileTabs = document.querySelectorAll('.nav-tab-mobile');
    if (mobileTabs.length > 0) {
        mobileTabs.forEach(tab => {
            tab.classList.remove('text-primary-container');
            tab.classList.add('text-on-surface');
        });
        const index = tabId === 'dashboard' ? 0 : 1;
        mobileTabs[index].classList.remove('text-on-surface');
        mobileTabs[index].classList.add('text-primary-container');
    }
    
    // Trigger invalidateSize to fix leaflet map loading when it was previously display:none
    if (tabId === 'map') {
        setTimeout(() => {
            if (typeof map !== 'undefined' && map) {
                map.invalidateSize();
            }
        }, 50);
    }
}

// Initial active state for mobile
const initMobileTabs = document.querySelectorAll('.nav-tab-mobile');
if (initMobileTabs.length > 0) {
    initMobileTabs[0].classList.remove('text-on-surface');
    initMobileTabs[0].classList.add('text-primary-container');
}
