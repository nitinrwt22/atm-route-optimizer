# ATM Route Optimizer 🚚💸

An intelligent cash replenishment platform that monitors, prioritizes, and optimizes ATM cash deliveries. It features a fast C++ backend for data generation and optimization algorithms (Priority Queue & 0/1 Knapsack), paired with a dynamic, beautiful, glassmorphic frontend dashboard.

## Features ✨
- **Real-Time ATM Monitoring:** Simulates a fleet of ATMs by tracking `cashLevel`, `dailyWithdrawalRate`, and exact predictive **Time to Empty (hrs)**.
- **Priority Queue Backlog:** The C++ backend efficiently ranks ATMs from most critical (emptying soonest) to most healthy using a custom Min-Heap (Priority Queue).
- **Smart Dispatch (Knapsack Algorithm):** Calculates the optimal mix of ATMs to refill given a finite truck capacity (₹50 Lakh), maximizing utility and preventing critical ATMs from running dry using a 1-D Dynamic Programming approach.
- **Glassmorphic Dashboard:** A completely custom UI built with Vanilla HTML/CSS/JS.
  - **Live Canvas Map:** Intelligent glowing markers, custom tooltips, and real-time status updates directly painted on an HTML5 canvas.
  - **Donut & Bar Charts:** Real-time distributions of the ATM fleet health and status (Critical, High, Medium, Low).
  - **Top Urgent Panel & Modals:** At-a-glance lists showing ATMs that need immediate attention with detailed cash level breakdown popups.

## Tech Stack 🛠️
- **Backend Algorithms:** C++17 (0/1 DP Knapsack, Custom Structs, Priority Queues)
- **Frontend / UI:** Vanilla HTML5, CSS3, JavaScript, Tailwind CSS (via CDN)
- **Server:** Python 3 HTTP Server (for local JSON data delivery)

## How to Run 🚀

### 1. Compile & Run the Backend
The backend generates the `output.json` data consumed by the frontend. You can run either model:

**Option A: Priority Queue Generation**
```bash
g++ backend/priority_queue.cpp -std=c++17 -o backend/pq_runner
./backend/pq_runner
```

**Option B: Knapsack Dispatch Generation**
```bash
g++ backend/knapsack.cpp -std=c++17 -o backend/knapsack_runner
./backend/knapsack_runner
```

### 2. Serve the Frontend Dashboard
To ensure the `output.json` file is loaded correctly by the browser without CORS errors, serve the project using a local Python web server from the project's root directory:

```bash
python3 -m http.server 8000
```

### 3. View the UI
Open your browser and navigate to:
[http://localhost:8000/frontend/](http://localhost:8000/frontend/)

## Future Enhancements 🔮

### 1️⃣ Multi-Truck Optimization (Vehicle Routing Problem)
Currently, the system assumes one truck with limited capacity. In real-world scenarios, banks deploy multiple cash vans.
- **Enhancement:** Extend system to support multiple trucks, divide ATMs among trucks using optimization techniques, and solve the Vehicle Routing Problem (VRP) using clustering and routing algorithms to reduce total travel distance and operational cost.
- **Impact:** Makes the system scalable for large metropolitan areas with 1000+ ATMs.

### 2️⃣ K-Means Clustering for Geographic Grouping
ATMs naturally form geographic clusters based on their coordinates.
- **Enhancement:** Apply K-Means clustering to divide ATMs into zones and assign each cluster to a specific truck, improving efficiency by reducing cross-city travel.
- **Benefit:** Minimizes travel time and effectively balances workloads across the cash transport fleet.

### 3️⃣ Route Optimization (Travelling Salesman Problem)
After optimal ATMs have been selected via the knapsack algorithm, the system needs the fastest route to visit all of them.
- **Enhancement:** Implement TSP algorithms such as Nearest Neighbor, 2-Opt improvement, or Dynamic Programming (Held-Karp) and visualize the optimized point-to-point route on the map canvas.
- **Benefit:** Radically reduces fuel cost, logistics complexity, and total delivery turnaround time.

### 4️⃣ Real-Time Data Integration
Currently, ATM depletion states and transactions are simulated dynamically.
- **Enhancement:** Integrate live, real-time ATM transaction datastreams by connecting with live banking APIs.
- **Benefit:** Keeps the priority queue and dispatch constraints continuously updated, enabling a reactive and adaptive replenishment cycle.

---
**Recent Work & Updates:**
- Upgraded urgency model to use accurate `timeToEmpty` predictions rather than generic urgency scoring.
- Refactored frontend to dynamically fetch data from the standalone C++ backend.
- Implemented an interactive Dispatch Mode toggle that maps optimal routes dynamically.
- Developed real-time SVG rings, map pulse animations, and animated CSS progression charts.
