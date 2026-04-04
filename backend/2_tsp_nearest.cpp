#include <iostream>
#include <fstream>
#include <vector>
#include <cmath>
#include <string>
#include <iomanip>
#include <limits>

using namespace std;

struct ATMNode {
    int id;
    string name;
    double x;
    double y;
    int urgency;
};

// Function prototypes to solve the Traveling Salesman Problem using Nearest Neighbor
double calculateDistance(double x1, double y1, double x2, double y2);
int findNearestATM(double currentX, double currentY, const vector<ATMNode>& atms, const vector<bool>& visited);
void generateRoute(const vector<ATMNode>& atms);

double calculateDistance(double x1, double y1, double x2, double y2) {
    return sqrt(pow(x2 - x1, 2) + pow(y2 - y1, 2));
}

int findNearestATM(double currentX, double currentY, const vector<ATMNode>& atms, const vector<bool>& visited) {
    int nearestIndex = -1;
    double minDistance = numeric_limits<double>::max();
    
    for (size_t i = 0; i < atms.size(); ++i) {
        if (!visited[i]) {
            double dist = calculateDistance(currentX, currentY, atms[i].x, atms[i].y);
            if (dist < minDistance) {
                minDistance = dist;
                nearestIndex = i;
            }
        }
    }
    
    return nearestIndex;
}

void generateRoute(const vector<ATMNode>& atms) {
    int n = atms.size();
    vector<bool> visited(n, false);
    vector<int> routeOrder;
    
    double currentX = 0.0;
    double currentY = 0.0;
    double totalDistance = 0.0;
    
    cout << "\nStarting from depot (0, 0)\n";
    cout << string(60, '-') << "\n";
    
    for (int step = 0; step < n; ++step) {
        int nextIndex = findNearestATM(currentX, currentY, atms, visited);
        
        if (nextIndex != -1) {
            visited[nextIndex] = true;
            routeOrder.push_back(nextIndex);
            
            double dist = calculateDistance(currentX, currentY, atms[nextIndex].x, atms[nextIndex].y);
            totalDistance += dist;
            currentX = atms[nextIndex].x;
            currentY = atms[nextIndex].y;
            
            cout << left << "Visited " << setw(15) << atms[nextIndex].name 
                 << " (ID: " << setw(3) << atms[nextIndex].id << ") "
                 << "at (" << fixed << setprecision(2) << atms[nextIndex].x << ", " 
                 << atms[nextIndex].y << ") "
                 << "| Dist: " << dist << "\n";
        }
    }
    
    cout << string(60, '-') << "\n";
    cout << "Total Distance Travelled: " << fixed << setprecision(2) << totalDistance << "\n";
    cout << "Visiting Order (IDs): ";
    for (size_t i = 0; i < routeOrder.size(); ++i) {
        cout << atms[routeOrder[i]].id << (i < routeOrder.size() - 1 ? " -> " : "");
    }
    cout << "\n";
    
    // Export route.json
    ofstream out("route.json");
    if (out.is_open()) {
        out << "{\n";
        out << "\"route\":[\n";
        for (size_t i = 0; i < routeOrder.size(); ++i) {
            int idx = routeOrder[i];
            out << "  { \"id\":" << atms[idx].id 
                << ", \"x\":" << fixed << setprecision(2) << atms[idx].x 
                << ", \"y\":" << atms[idx].y << " }";
            if (i < routeOrder.size() - 1) out << ",\n";
            else out << "\n";
        }
        out << "]\n";
        out << "}\n";
        out.close();
        cout << "\n[SUCCESS] Route correctly exported to route.json\n";
    } else {
        cerr << "\n[ERROR] Failed to write route.json\n";
    }
}

// A straightforward string parsing function designed to safely read basic JSON format
// without requiring external dependencies like nlohmann/json.
vector<ATMNode> parseJSON(const string& filename) {
    vector<ATMNode> atms;
    ifstream in(filename);
    if (!in.is_open()) {
        cerr << "[ERROR] Could not open '" << filename << "'\n";
        return atms;
    }

    string line;
    while (getline(in, line)) {
        if (line.find("\"id\"") != string::npos) {
            ATMNode atm;
            
            size_t pos = line.find("\"id\"");
            if (pos != string::npos) {
                pos = line.find(':', pos);
                atm.id = stoi(line.substr(pos + 1));
            }

            pos = line.find("\"name\"");
            if (pos != string::npos) {
                size_t startQuote = line.find('"', pos + 6);
                size_t endQuote = line.find('"', startQuote + 1);
                if(startQuote != string::npos && endQuote != string::npos)
                    atm.name = line.substr(startQuote + 1, endQuote - startQuote - 1);
            }

            pos = line.find("\"x\"");
            if (pos != string::npos) {
                pos = line.find(':', pos);
                atm.x = stod(line.substr(pos + 1));
            }

            pos = line.find("\"y\"");
            if (pos != string::npos) {
                pos = line.find(':', pos);
                atm.y = stod(line.substr(pos + 1));
            }
            
            pos = line.find("\"urgency\"");
            if (pos != string::npos && line.find("\"urgency score\"") == string::npos) {
                pos = line.find(':', pos);
                atm.urgency = stoi(line.substr(pos + 1));
            } else {
                pos = line.find("\"urgency score\"");
                if (pos != string::npos) {
                    pos = line.find(':', pos);
                    atm.urgency = stoi(line.substr(pos + 1));
                } else {
                    atm.urgency = 0; // Default if neither is found
                }
            }

            atms.push_back(atm);
        }
    }
    in.close();
    return atms;
}

int main(int argc, char* argv[]) {
    string inputFile = "selected_atms.json"; // default filename as per instructions implicitly
    if (argc > 1) {
        inputFile = argv[1];
    }
    
    cout << "Loading selected ATMs from " << inputFile << "...\n";
    vector<ATMNode> atms = parseJSON(inputFile);
    
    if (atms.empty()) {
        cerr << "[ERROR] No ATMs loaded. Please make sure the JSON file exists and contains properly formatted ATM objects.\n";
        return 1;
    }
    
    cout << "Successfully loaded " << atms.size() << " ATMs.\n";
    
    generateRoute(atms);
    return 0;
}
