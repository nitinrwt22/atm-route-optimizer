// ATM Cash Replenishment Optimizer - Frontend Script
// Add interactive functionality here

// Example: Update simulation clock
function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const clockEl = document.getElementById('simulation-clock');
    if (clockEl) {
        clockEl.textContent = `${hours}:${minutes}:${seconds}`;
    }
}

// Update clock every second
setInterval(updateClock, 1000);
updateClock();

// Sidebar Toggle Logic
const sidebarToggle = document.getElementById('sidebar-toggle');
const desktopSidebar = document.getElementById('desktop-sidebar');
const layoutWrapper = document.getElementById('layout-wrapper');

if (sidebarToggle && desktopSidebar && layoutWrapper) {
    sidebarToggle.addEventListener('click', () => {
        // Toggle the sidebar off-screen
        desktopSidebar.classList.toggle('-translate-x-full');
        // Remove the padding on the layout wrapper so main content expands
        layoutWrapper.classList.toggle('md:pl-64');
    });
}

// Theme Toggle Logic
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
    });
}