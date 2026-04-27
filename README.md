<div align="center">

<img src="assets/header.svg" alt="ATM Route Optimizer Banner" width="100%"/>

### *An intelligent cash replenishment platform optimizing logistics with C++ algorithms and a dynamic dashboard.*

**A high-performance C++ backend utilizing Priority Queues, DP Knapsack, K-Means, and TSP algorithms to route cash delivery vans, paired with a glassmorphic HTML5 Canvas visualization frontend.**  

---

![Backend](https://img.shields.io/badge/Backend-C%2B%2B17-00599C?style=for-the-badge&logo=c%2B%2B)
![Frontend](https://img.shields.io/badge/Frontend-HTML5_Canvas%20%2B%20JS-E34F26?style=for-the-badge&logo=html5)
![Status](https://img.shields.io/badge/Status-Active-brightgreen?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Linux-lightgrey?style=for-the-badge&logo=apple)

</div>

---

## 📖 Table of Contents

- [✨ Features](#-features)
- [🧱 Tech Stack](#-tech-stack)
- [🏗️ System Architecture](#%EF%B8%8F-system-architecture)
- [🔄 System Flowchart](#-system-flowchart)
- [💎 Why ATM Route Optimizer is Unique](#-why-atm-route-optimizer-is-unique)
- [⚖️ Comparison with Existing Tools](#%EF%B8%8F-comparison-with-existing-tools)
- [🎯 Use Cases](#-use-cases)
- [🚀 Installation & Setup](#-installation--setup)
- [📁 Project Structure](#-project-structure)
- [📸 Screenshots](#-screenshots)
- [🔭 Future Improvements](#-future-improvements)
- [👨‍💻 Author](#-author)

---

## ✨ Features

### 📡 Real-Time ATM Monitoring
- **Predictive Analytics:** Accurately forecasts **Time to Empty (hrs)** based on dynamic `cashLevel` and `dailyWithdrawalRate`.
- **Status Classification:** Automatically categorizes ATMs into 🔴 Critical, 🟠 High, 🟡 Medium, and 🔵 Low urgency statuses.

### ⚖️ Priority Queue Ranking
- **Min-Heap Implementation:** Efficiently ranks the entire fleet from most critical to healthiest using a custom C++ Priority Queue.
- **Urgency Scoring:** Ensures ATMs nearest to depletion are prioritized instantly.

### 🎒 Smart Dispatch (Knapsack DP)
- **1-D Dynamic Programming:** Maximizes the utility of a finite truck capacity (e.g. ₹50 Lakh) while preventing critical ATMs from running dry.
- **Optimal Selection:** Weighs refill amount vs. urgency score to select the absolute best mix of ATMs per dispatch.

### 🗺️ Geographic Grouping & Routing
- **K-Means Clustering:** Groups ATMs regionally to divide labor efficiently among multiple cash vans.
- **TSP Routing Algorithms:** Uses Nearest Neighbor and 2-Opt optimizations to calculate the shortest path, minimizing fuel and transit time.

### 🖥️ Glassmorphic Dashboard Visualization
- **HTML5 Canvas Map:** Plots ATMs via spatial mathematics with glowing markers, dynamic tooltips, and real-time status pulses.
- **Live Metrics:** Renders Donut & Bar charts reflecting the entire fleet's current health distribution.
- **Dispatch Overlay:** Draws the optimized C++ route directly over the mapped ATMs.

---

## 🧱 Tech Stack

### ⚙️ Backend Algorithms — C++17

| Component | File(s) | Algorithm / Structure | Purpose |
|---|---|---|---|
| Urgency Ranking | `priority_queue.cpp` | Min-Heap Priority Queue | Sorts ATMs by "Time to Empty" in O(N log N) |
| Fleet Dispatching | `knapsack.cpp` | DP 0/1 Knapsack (1-D array) | Solves capacity constraints in O(N * W) |
| Geographic Grouping | `4_kmeans.cpp` | K-Means Clustering | Groups ATMs by coordinates into zones |
| Fast Routing | `2_tsp_nearest.cpp` | Nearest Neighbor (Greedy) | Initial fast route approximation O(N²) |
| Optimized Routing | `3_tsp_2opt.cpp` | 2-Opt Swap Algorithm | Iteratively refines TSP route to reduce distance |

### 🎨 Frontend Dashboard — Web

| Layer | Technology |
|---|---|
| Core Layout | Vanilla HTML5 & CSS3 |
| Styling Framework | Tailwind CSS (via CDN) for rapid glassmorphism |
| Map & Graphics | HTML5 `<canvas>` API (custom rendering) |
| Interactivity | Vanilla JavaScript (ES6) |
| Data Fetching | Native `fetch()` API reading backend JSON |
| Local Server | Python 3 `http.server` (bypasses CORS restrictions) |

---

## 🏗️ System Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                     C++ Optimization Engine                      │
│                                                                  │
│  1. Simulated ATM State     2. Urgency Sort                      │
│  ┌──────────────────┐       ┌────────────────────────┐           │
│  │ Random Gen / CSV ├──────►│ Priority Queue (Heap)  │           │
│  └──────────────────┘       └──────────┬─────────────┘           │
│                                        │                         │
│                                        ▼                         │
│  4. Route & Cluster         3. Selection Constraint              │
│  ┌──────────────────┐       ┌────────────────────────┐           │
│  │ K-Means + TSP    │◄──────┤ 0/1 Knapsack (DP)      │           │
│  │ (2-Opt / Greedy) │       │ (Capacity: ₹50 Lakh)   │           │
│  └──────────┬───────┘       └────────────────────────┘           │
│             │                                                    │
│             ▼                                                    │
│  ┌────────────────────────────────────────────────────┐          │
│  │ JSON Serializer: output.json, optimized_route.json │          │
│  └────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Python Local HTTP Server                      │
│    (python3 -m http.server 8000) serves JSON + Frontend UI       │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                Glassmorphic UI Dashboard (Browser)               │
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────┐            │
│  │ HTML5 Canvas │ │ Metric Cards │ │  Fleet Charts  │            │
│  │  Live Map    │ │ (Top Urgent) │ │ (Donut/Bar)    │            │
│  └──────────────┘ └──────────────┘ └────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 System Flowchart

```text
  ╔══════════════════════════════╗
  ║       1. Run C++ Backend     ║
  ║  (Generates output.json &    ║
  ║   optimized_route.json)      ║
  ╚══════════════╤═══════════════╝
                 │
                 ▼
  ╔══════════════════════════════╗
  ║    2. Start Python Server    ║
  ║ (python3 -m http.server 8000)║
  ╚══════════════╤═══════════════╝
                 │
                 ▼
  ╔══════════════════════════════╗
  ║    3. Open Web Dashboard     ║
  ║  (Browser: localhost:8000)   ║
  ╚══════════════╤═══════════════╝
                 │
                 ▼
  ╔══════════════════════════════════════════╗
  ║        4. JavaScript Dashboard Logic     ║
  ║                                          ║
  ║  • Fetch output.json                     ║
  ║  • Render Canvas ATM Markers             ║
  ║  • Populate Urgent ATMs Panel            ║
  ║  • Draw TSP Route Line (Dispatch Mode)   ║
  ║  • Update Global Health Charts           ║
  ╚══════════════════════════════════════════╝
```

---

## 💎 Why ATM Route Optimizer is Unique

While standard delivery apps just use Google Maps APIs, this project builds the core optimization math from scratch:

| Trait | What It Means |
|---|---|
| 🔩 **Pure C++ Engine** | The core logistics engine runs blazingly fast in C++17, manipulating thousands of nodes instantly. |
| 🧮 **Algorithmic Depth** | It doesn't just sort a list. It combines Min-Heaps (urgency), DP (capacity constraints), and TSP heuristics (travel efficiency) into one pipeline. |
| 🖼️ **Zero-Dependency Canvas** | The map is not a Leaflet or Google Maps embed; it's pure mathematics plotted on an HTML5 `<canvas>` with custom glowing SVG logic. |
| 🔮 **Predictive, Not Reactive** | It calculates the exact "Time to Empty" based on withdrawal velocity, preventing downtime *before* it happens. |
| 🎨 **Glassmorphism UI** | Moves past basic Bootstrap designs with modern, blurred, translucent UI panels overlaying a sleek dark map. |

---

## ⚖️ Comparison with Existing Tools

| Feature | ATM Optimizer | Standard Logistics CRM | Basic Google Maps Route |
|---|:---:|:---:|:---:|
| Predicts depletion before it happens | ✅ | ❌ | ❌ |
| Enforces strict van capacity limits (DP) | ✅ | ⚠️ Partial | ❌ |
| Re-orders stops by urgency, not just distance | ✅ | ❌ | ❌ |
| Custom C++ core for massive scale | ✅ | ❌ (Usually Web-based) | ❌ |
| K-Means zone clustering for multiple vans | ✅ | ⚠️ Premium feature | ❌ |
| Open-source & Extensible | ✅ | ❌ | ❌ |

---

## 🎯 Use Cases

| Scenario | Application |
|---|---|
| 🏦 **Banking & Cash Logistics** | Automate daily cash van dispatch routines, ensuring zero ATM downtime while minimizing fuel costs. |
| 📦 **Vending Machine Restocking** | Easily adapt the codebase to monitor and restock vending machines based on sales velocity and truck size. |
| 🎓 **Algorithm Showcase** | A perfect real-world visualization of classic CS algorithms: Knapsack, Priority Queues, K-Means, and TSP. |
| 🚚 **General Delivery Fleets** | Use the clustering and TSP modules to optimize any node-based delivery system. |

---

## 🚀 Installation & Setup

### Prerequisites
- `g++` compiler (C++17 support)
- `Python 3` (for local HTTP server)
- Modern Web Browser (Chrome/Firefox/Safari)

---

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/nitinrwt22/atm-route-optimizer.git
cd atm-route-optimizer
```

### 2️⃣ Run the C++ Backend Algorithms
The backend consists of several modules. You must generate the data before opening the UI.

**Generate ATM data & rank via Priority Queue:**
```bash
g++ backend/priority_queue.cpp -std=c++17 -o backend/pq_runner
./backend/pq_runner
```

**Run DP Knapsack Dispatch Selection:**
```bash
g++ backend/knapsack.cpp -std=c++17 -o backend/knapsack_runner
./backend/knapsack_runner
```

**Generate Optimized Routes (TSP / K-Means):**
```bash
g++ backend/3_tsp_2opt.cpp -std=c++17 -o backend/2opt_runner
./backend/2opt_runner
```

### 3️⃣ Serve the Dashboard
To prevent browser CORS errors when reading local JSON files, start a local Python server in the project root:
```bash
python3 -m http.server 8000
```

### 4️⃣ Open the Dashboard
Navigate your browser to:
**[http://localhost:8000/frontend/](http://localhost:8000/frontend/)**

---

## 📁 Project Structure

```text
atm-route-optimizer/
│
├── backend/                      # C++ Algorithms Engine
│   ├── priority_queue.cpp        # Min-Heap urgency ranking
│   ├── knapsack.cpp              # DP 0/1 capacity constraint optimization
│   ├── 2_tsp_nearest.cpp         # Nearest Neighbor greedy routing
│   ├── 3_tsp_2opt.cpp            # 2-Opt routing optimization
│   ├── 4_kmeans.cpp              # K-Means multi-van geographic clustering
│   └── output.json / *.json      # Data generated for the frontend
│
├── frontend/                     # HTML/JS Visualization Dashboard
│   ├── index.html                # App layout, glass panels, canvas container
│   ├── style.css                 # Custom CSS variables, glassmorphism, animations
│   ├── script.js                 # Canvas logic, data fetching, chart updates
│   └── map-bg.jpg                # Dashboard background layer
│
├── assets/                       # Images and branding files
│   └── header.svg                # Custom repository header graphic
│
└── README.md                     # This documentation file
```

---

## 📸 Screenshots

> *Replace placeholders with actual project screenshots.*

### 🖥️ Dashboard Overview
> Glassmorphic dashboard showing the live HTML5 map, glowing ATM markers, and real-time donut charts of fleet health.
>
> 📷 `screenshots/dashboard.png`

### 🗺️ Route Optimization (Dispatch Mode)
> Map view with lines drawn between the selected subset of ATMs, representing the calculated TSP route.
>
> 📷 `screenshots/dispatch_route.png`

### 🚨 Top Urgent Panel
> Sidebar showing the specific ATMs marked "Critical", sorted by exactly how many hours until they empty.
>
> 📷 `screenshots/urgent_panel.png`

---

## 🔭 Future Improvements

| Feature | Description |
|---|---|
| 📡 **Live Banking API Integration** | Replace simulated ATM withdrawals with a real WebSocket feed of transaction data. |
| 🚚 **Multi-Vehicle Routing (CVRP)** | Fully integrate the K-Means logic into the UI to display multiple colored truck routes simultaneously. |
| 📱 **Mobile Driver App** | Create a separate mobile view for the van driver showing step-by-step navigation instructions. |
| 📊 **Historical Analytics** | Store daily runs in a database (e.g., PostgreSQL) to track efficiency gains over time. |

---

## 👨‍💻 Author

<div align="center">

**Nitin Rawat**  
*Computer Science Student · Systems & Full-Stack Developer*

[![GitHub](https://img.shields.io/badge/GitHub-nitinrwt22-181717?style=for-the-badge&logo=github)](https://github.com/nitinrwt22)

> *"Optimizing logistics, one algorithm at a time."*

</div>

---

<div align="center">

**⭐ Star this repo if you found it useful!**

*ATM Route Optimizer — Intelligent monitoring. Smart dispatching. Optimal routing.*

</div>
