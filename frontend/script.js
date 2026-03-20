// ATM Cash Replenishment Optimizer — Frontend Integration
// Loads output.json from the C++ backend and drives the entire UI dynamically.

'use strict';

// ─── Global State ───────────────────────────────────────────────────────────
let atmData = [];

// ─── Status Helpers ──────────────────────────────────────────────────────────
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

// ─── Data Loading ────────────────────────────────────────────────────────────
async function loadATMData() {
    try {
        const resp = await fetch('/backend/output.json');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        atmData = json.atms.map(a => ({
            ...a,
            status: a.status || getStatus(a.timeToEmpty),
        }));
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

// ─── Render Everything ───────────────────────────────────────────────────────
function renderAll() {
    updateSummaryCard();
    renderUrgentPanel();
    updateDonutChart();
    renderMapMarkers();
}

// ─── 1. Summary Card ─────────────────────────────────────────────────────────
function updateSummaryCard() {
    const total    = atmData.length;
    const critical = atmData.filter(a => a.status === 'CRITICAL').length;
    const avgTime  = atmData.reduce((s, a) => s + Math.min(a.timeToEmpty, 9999.99), 0) / total;

    set('stat-total',    total);
    set('map-stat-total', total);
    set('stat-critical', critical);
    set('stat-avg-time', avgTime.toFixed(1) + ' hrs');
}

// ─── 2. Top Urgent Panel ─────────────────────────────────────────────────────
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

    // Make list items clickable → open popup
    list.querySelectorAll('.urgent-item').forEach(el => {
        el.addEventListener('click', () => {
            const id  = parseInt(el.dataset.atmId, 10);
            const atm = atmData.find(a => a.id === id);
            if (atm) showPopup(atm);
        });
    });
}

// ─── 3. Donut Chart ──────────────────────────────────────────────────────────
function updateDonutChart() {
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    atmData.forEach(a => counts[a.status]++);
    const total = atmData.length;

    const pct = s => ((counts[s] / total) * 100).toFixed(0);

    // Update legend text
    setText('legend-critical', `${pct('CRITICAL')}% Critical`);
    setText('legend-high',     `${pct('HIGH')}% High`);
    setText('legend-medium',   `${pct('MEDIUM')}% Medium`);
    setText('legend-low',      `${pct('LOW')}% Low`);

    // Update SVG arcs — each arc uses stroke-dasharray="pct, 100"
    // stacked with stroke-dashoffset to place them consecutively
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

// ─── 4. Map Canvas Markers ───────────────────────────────────────────────────
let hoveredAtm = null;

function renderMapMarkers() {
    const canvas = document.getElementById('atm-map-canvas');
    if (!canvas) return;

    const container = canvas.parentElement;
    canvas.width  = container.clientWidth;
    canvas.height = container.clientHeight;

    draw(canvas);

    // Handle hover / click
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

    // Redraw on resize
    window.addEventListener('resize', () => {
        canvas.width  = container.clientWidth;
        canvas.height = container.clientHeight;
        draw(canvas);
    });
}

function atmToCanvas(atm, canvas) {
    // Pad 8% from edges so markers aren't clipped
    const pad = 0.08;
    const cx  = (pad + (atm.x / 100) * (1 - 2 * pad)) * canvas.width;
    const cy  = (pad + (atm.y / 100) * (1 - 2 * pad)) * canvas.height;
    return { cx, cy };
}

function draw(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    atmData.forEach(atm => {
        const { cx, cy } = atmToCanvas(atm, canvas);
        const color = STATUS_COLOR[atm.status] || '#4ADE80';
        const isHovered = hoveredAtm && hoveredAtm.id === atm.id;
        const r = isHovered ? 8 : (atm.status === 'CRITICAL' ? 7 : 5);

        // Glow
        ctx.shadowColor = color;
        ctx.shadowBlur  = isHovered ? 20 : (atm.status === 'CRITICAL' ? 14 : 8);

        // Outer ring for critical
        if (atm.status === 'CRITICAL') {
            ctx.beginPath();
            ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
            ctx.strokeStyle = color + '60';
            ctx.lineWidth   = 2;
            ctx.stroke();
        }

        // Dot
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.shadowBlur = 0;
    });
}

function findAtmAt(canvas, mx, my) {
    for (const atm of atmData) {
        const { cx, cy } = atmToCanvas(atm, canvas);
        const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);
        if (dist <= 12) return atm;
    }
    return null;
}

// ─── Map Tooltip ─────────────────────────────────────────────────────────────
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

// ─── 5. Popup Modal ───────────────────────────────────────────────────────────
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

    // Cash bar
    const bar = document.getElementById('popup-cash-bar');
    if (bar) {
        bar.style.width      = Math.min(atm.cashLevel, 100) + '%';
        bar.style.background = color;
    }

    popup.classList.remove('hidden');
    popup.classList.add('flex');

    // Close on overlay click
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

// ─── Util ─────────────────────────────────────────────────────────────────────
function set(id, val)     { const el = document.getElementById(id); if (el) el.textContent = val; }
function setText(id, val) { set(id, val); }

// ─── Simulation Clock ────────────────────────────────────────────────────────
function updateClock() {
    const now = new Date();
    const t   = [now.getHours(), now.getMinutes(), now.getSeconds()]
                .map(n => String(n).padStart(2, '0')).join(':');
    set('simulation-clock', t);
}
setInterval(updateClock, 1000);
updateClock();

// ─── Sidebar Toggle ───────────────────────────────────────────────────────────
const sidebarToggle = document.getElementById('sidebar-toggle');
const desktopSidebar = document.getElementById('desktop-sidebar');
const layoutWrapper  = document.getElementById('layout-wrapper');
if (sidebarToggle && desktopSidebar && layoutWrapper) {
    sidebarToggle.addEventListener('click', () => {
        desktopSidebar.classList.toggle('-translate-x-full');
        layoutWrapper.classList.toggle('md:pl-64');
    });
}

// ─── Theme Toggle ────────────────────────────────────────────────────────────
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
    });
}

// ─── Run Optimization Button ─────────────────────────────────────────────────
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

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', loadATMData);