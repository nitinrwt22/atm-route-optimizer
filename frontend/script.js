

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

function getStatus(tte) {
    if (tte <= 2)    return 'CRITICAL';
    if (tte <= 6)    return 'HIGH';
    if (tte <= 12)   return 'MEDIUM';
    return 'LOW';
}

const STATUS_COLOR = {
    CRITICAL: '#EF4444',
    HIGH:     '#FACC15',
    MEDIUM:   '#60A5FA',
    LOW:      '#4ADE80',
};

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
            status: a.status || getStatus(a.timeToEmpty),
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
                      : atm.status === 'HIGH'     ? 'text-yellow-400'
                      : atm.status === 'MEDIUM'   ? 'text-blue-400'
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

function renderMapMarkers() {
    const canvas = document.getElementById('atm-map-canvas');
    if (!canvas) return;

    const container = canvas.parentElement;
    canvas.width  = container.clientWidth;
    canvas.height = container.clientHeight;

    draw(canvas);

    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        const mx   = e.clientX - rect.left;
        const my   = e.clientY - rect.top;
        hoveredAtm = findAtmAt(canvas, mx, my);
        draw(canvas);
        canvas.style.cursor = hoveredAtm ? 'pointer' : 'crosshair';
        renderTooltip(hoveredAtm, e.clientX, e.clientY);
    });

    canvas.addEventListener('mouseleave', () => {
        hoveredAtm = null;
        draw(canvas);
        hideTooltip();
    });

    canvas.addEventListener('click', e => {
        const rect = canvas.getBoundingClientRect();
        const mx   = e.clientX - rect.left;
        const my   = e.clientY - rect.top;
        const atm  = findAtmAt(canvas, mx, my);
        if (atm) showPopup(atm);
    });

    window.addEventListener('resize', () => {
        canvas.width  = container.clientWidth;
        canvas.height = container.clientHeight;
        draw(canvas);
    });
}

function atmToCanvas(atm, canvas) {
    const pad = 0.15; // Increased padding from 0.08 so the depot (0,0) moves away from the top-left corner UI panels
    const cx  = (pad + (atm.x / 100) * (1 - 2 * pad)) * canvas.width;
    const cy  = (pad + (atm.y / 100) * (1 - 2 * pad)) * canvas.height;
    return { cx, cy };
}

let _ringPhase = 0;
let _ringAnim  = null;

function startRingAnimation(canvas) {
    if (_ringAnim) return;
    const step = () => {
        _ringPhase = (Date.now() % 1600) / 1600;
        draw(canvas);
        _ringAnim = requestAnimationFrame(step);
    };
    _ringAnim = requestAnimationFrame(step);
}

function renderRoutePath(canvas, ctx, routeArr, color, isDashed, drawIds) {
    if (!routeArr || routeArr.length === 0) return;

    ctx.save();
    ctx.beginPath();
    
    // Depot coordinates (0, 0)
    const depot = { x: 0, y: 0 };
    const { cx: startCx, cy: startCy } = atmToCanvas(depot, canvas);
    
    ctx.moveTo(startCx, startCy);
    
    if (isDashed) {
        ctx.setLineDash([5, 5]);
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.5;
    } else {
        ctx.lineWidth = 2;
    }
    
    const points = [{cx: startCx, cy: startCy, isDepot: true}];
    for (const stop of routeArr) {
        const { cx, cy } = atmToCanvas(stop, canvas);
        ctx.lineTo(cx, cy);
        points.push({cx, cy, id: stop.id});
    }

    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = isDashed ? 0 : 10;
    ctx.stroke();
    
    ctx.restore();

    if (drawIds) drawRouteNumbers(ctx, points);
}

function drawRouteNumbers(ctx, points) {
    ctx.save();
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    for (let i = 1; i < points.length; i++) {
        const pt = points[i];
        
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.arc(pt.cx + 10, pt.cy - 10, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#00f2ff";
        ctx.stroke();
        
        ctx.fillStyle = "#00f2ff";
        ctx.fillText(i, pt.cx + 10, pt.cy - 10);
    }
    
    const depotPt = points[0];
    ctx.fillStyle = "#00f2ff";
    ctx.beginPath();
    ctx.arc(depotPt.cx, depotPt.cy, 8, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#000000";
    ctx.fillText("D", depotPt.cx, depotPt.cy);
    
    ctx.restore();
}

function stopRingAnimation(canvas) {
    if (_ringAnim) { cancelAnimationFrame(_ringAnim); _ringAnim = null; }
    draw(canvas);
}

function draw(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (routeData && routeData.length > 0) {
        if (showOptimizedRoute && optimizedRouteData && optimizedRouteData.length > 0) {
            // Draw optimized route in solid cyan
            renderRoutePath(canvas, ctx, optimizedRouteData, '#00f2ff', false, true);
        } else {
            // Draw original nearest neighbor route in solid orange
            renderRoutePath(canvas, ctx, routeData, '#f97316', false, true);
        }
    }

    atmData.forEach(atm => {
        const { cx, cy } = atmToCanvas(atm, canvas);
        let color = STATUS_COLOR[atm.status] || '#4ADE80';
        
        if (clusterModeActive && atm.cluster !== undefined && atm.cluster >= 0) {
            color = CLUSTER_COLORS[atm.cluster] || color;
        }

        const isHovered  = hoveredAtm && hoveredAtm.id === atm.id;
        const isSelected = knapsackSelected.has(atm.id);

        if (dispatchMode && !isSelected && !isHovered) {
            ctx.globalAlpha = 0.18;
        } else {
            ctx.globalAlpha = 1;
        }

        const r = isHovered ? 8 : (atm.status === 'CRITICAL' ? 7 : 5);

        ctx.shadowColor = dispatchMode && isSelected ? '#00f2ff' : color;
        ctx.shadowBlur  = isHovered ? 20
                        : (dispatchMode && isSelected) ? 22
                        : (atm.status === 'CRITICAL' ? 14 : 8);

        if (dispatchMode && isSelected) {
            const phase  = (Math.sin(_ringPhase * Math.PI * 2) + 1) / 2;
            const ringR  = r + 6 + phase * 6;
            const alpha  = 0.7 - phase * 0.5;
            ctx.beginPath();
            ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 242, 255, ${alpha})`;
            ctx.lineWidth   = 2;
            ctx.shadowColor = '#00f2ff';
            ctx.shadowBlur  = 10;
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.beginPath();
            ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 242, 255, 0.6)';
            ctx.lineWidth   = 1.5;
            ctx.stroke();
        }

        if (atm.status === 'CRITICAL') {
            ctx.beginPath();
            ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
            ctx.strokeStyle = color + '60';
            ctx.lineWidth   = 2;
            ctx.stroke();
        }

        ctx.shadowColor = dispatchMode && isSelected ? '#00f2ff' : color;
        ctx.shadowBlur  = isHovered ? 20
                        : (dispatchMode && isSelected) ? 18
                        : (atm.status === 'CRITICAL' ? 14 : 8);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = dispatchMode && isSelected ? '#00f2ff' : color;
        ctx.fill();

        ctx.shadowBlur  = 0;
        ctx.globalAlpha = 1;
    });

    if (clusterModeActive && clusterCentroids) {
        clusterCentroids.forEach((centroid, i) => {
            const { cx, cy } = atmToCanvas(centroid, canvas);
            const color = CLUSTER_COLORS[centroid.cluster] || '#FFFFFF';
            
            ctx.shadowColor = color;
            ctx.shadowBlur = 15;
            
            ctx.beginPath();
            ctx.arc(cx, cy, 12, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#FFFFFF';
            ctx.stroke();
            
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Draw label background
            const label = `Truck ${i + 1}`;
            const textWidth = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.beginPath();
            ctx.roundRect(cx - textWidth/2 - 4, cy - 30, textWidth + 8, 16, 4);
            ctx.fill();
            
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(label, cx, cy - 22);
        });
    }
}

function findAtmAt(canvas, mx, my) {
    for (const atm of atmData) {
        const { cx, cy } = atmToCanvas(atm, canvas);
        const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);
        if (dist <= 12) return atm;
    }
    return null;
}

function renderTooltip(atm, px, py) {
    let tip = document.getElementById('map-tooltip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'map-tooltip';
        tip.className = 'map-tooltip';
        document.body.appendChild(tip);
    }
    if (!atm) { tip.style.display = 'none'; return; }

    const tte = Math.min(atm.timeToEmpty, 9999.99).toFixed(1);
    tip.innerHTML = `
        <strong>${atm.name}</strong> — <span class="${STATUS_LABEL_CLASS[atm.status]}">${atm.status}</span><br>
        <span class="tip-loc">${atm.location}</span><br>
        Cash: ${atm.cashLevel.toFixed(1)}% &nbsp;|&nbsp; Time Left: ${tte} hrs
    `;
    tip.style.display = 'block';
    tip.style.left    = (px + 14) + 'px';
    tip.style.top     = (py - 10) + 'px';
}

function hideTooltip() {
    const tip = document.getElementById('map-tooltip');
    if (tip) tip.style.display = 'none';
}

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
        if (dispatchLabel) dispatchLabel.textContent = dispatchMode ? 'ON' : 'OFF';

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
                        : atm.status === 'HIGH'     ? 'text-yellow-400'
                        : atm.status === 'MEDIUM'   ? 'text-blue-400'
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
        
        const canvas = document.getElementById('atm-map-canvas');
        if (canvas) draw(canvas);
    });
}

document.addEventListener('DOMContentLoaded', loadATMData);