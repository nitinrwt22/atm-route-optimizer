#include <iostream>
#include <fstream>
#include <vector>
#include <cmath>
#include <string>
#include <iomanip>

using namespace std;

struct Point {
    int id;
    double x;
    double y;
};

// Distance formula: distance = sqrt((x2-x1)^2 + (y2-y1)^2)
double calculateDistance(const Point& a, const Point& b) {
    return sqrt(pow(b.x - a.x, 2) + pow(b.y - a.y, 2));
}

// Calculate total route distance
double calculateTotalRouteDistance(const vector<Point>& route) {
    double totalDistance = 0.0;
    for (size_t i = 0; i < route.size() - 1; ++i) {
        totalDistance += calculateDistance(route[i], route[i+1]);
    }
    return totalDistance;
}

// Swap path segments using 2-Opt
vector<Point> twoOptSwap(const vector<Point>& route, int i, int k) {
    vector<Point> newRoute;
    newRoute.reserve(route.size());
    
    // 1. Take route[0] to route[i-1] and add them in order to new_route
    for (int c = 0; c <= i - 1; ++c) {
        newRoute.push_back(route[c]);
    }
    
    // 2. Take route[i] to route[k] and add them in reverse order to new_route
    for (int c = k; c >= i; --c) {
        newRoute.push_back(route[c]);
    }
    
    // 3. Take route[k+1] to end and add them in order to new_route
    for (int c = k + 1; c < (int)route.size(); ++c) {
        newRoute.push_back(route[c]);
    }
    
    return newRoute;
}

// Optimize route using 2-Opt algorithm
void optimizeRoute(vector<Point>& route) {
    bool improvement = true;
    double bestDistance = calculateTotalRouteDistance(route);
    
    while (improvement) {
        improvement = false;
        // Preserve the depot as starting node by starting i from 1
        for (int i = 1; i < (int)route.size() - 1; ++i) {
            for (int k = i + 1; k < (int)route.size(); ++k) {
                vector<Point> newRoute = twoOptSwap(route, i, k);
                double newDistance = calculateTotalRouteDistance(newRoute);
                
                // Swap path segments if new distance is shorter
                if (newDistance < bestDistance) {
                    route = newRoute;
                    bestDistance = newDistance;
                    improvement = true;
                }
            }
        }
    }
}

// Read route data from route.json
vector<Point> parseJSON(const string& filename) {
    vector<Point> route;
    ifstream in(filename);
    if (!in.is_open()) {
        cerr << "[ERROR] Could not open '" << filename << "'\n";
        return route;
    }

    string line;
    while (getline(in, line)) {
        if (line.find("\"id\"") != string::npos) {
            Point pt;
            size_t pos = line.find("\"id\"");
            if (pos != string::npos) {
                pos = line.find(':', pos);
                pt.id = stoi(line.substr(pos + 1));
            }
            pos = line.find("\"x\"");
            if (pos != string::npos) {
                pos = line.find(':', pos);
                pt.x = stod(line.substr(pos + 1));
            }
            pos = line.find("\"y\"");
            if (pos != string::npos) {
                pos = line.find(':', pos);
                pt.y = stod(line.substr(pos + 1));
            }
            route.push_back(pt);
        }
    }
    in.close();
    return route;
}

// Generate optimized route JSON
void writeOptimizedJSON(const string& filename, const vector<Point>& route, double totalDistance) {
    ofstream out(filename);
    if (out.is_open()) {
        out << "{\n";
        out << "\"route\":[\n";
        for (size_t i = 0; i < route.size(); ++i) {
            out << "  { \"id\":" << route[i].id 
                << ",\"x\":" << fixed << setprecision(2) << route[i].x 
                << ",\"y\":" << route[i].y << " }";
            if (i < route.size() - 1) out << ",\n";
            else out << "\n";
        }
        out << "],\n";
        out << "\"totalDistance\": " << fixed << setprecision(2) << totalDistance << "\n";
        out << "}\n";
        out.close();
    } else {
        cerr << "[ERROR] Failed to write " << filename << "\n";
    }
}

int main() {
    string inputFile = "route.json";
    vector<Point> route = parseJSON(inputFile);
    
    if (route.empty()) {
        cerr << "No route found. Please generate route.json first.\n";
        return 1;
    }

    double initialDistance = calculateTotalRouteDistance(route);
    
    // Optimize route
    optimizeRoute(route);
    
    double finalDistance = calculateTotalRouteDistance(route);
    double improvement = 0.0;
    if (initialDistance > 0) {
        improvement = ((initialDistance - finalDistance) / initialDistance) * 100.0;
    }
    
    // Print results
    cout << fixed << setprecision(2);
    cout << "distance before optimization: " << initialDistance << "\n";
    cout << "distance after optimization: " << finalDistance << "\n";
    cout << "improvement percentage: " << improvement << "%\n";
    
    // Write output to optimized_route.json
    writeOptimizedJSON("optimized_route.json", route, finalDistance);
    
    return 0;
}
