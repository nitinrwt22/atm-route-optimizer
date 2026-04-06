#include <iostream>
#include <fstream>
#include <vector>
#include <cmath>
#include <string>
#include <cstdlib>
#include <ctime>
#include <iomanip>

using namespace std;

// Each ATM contains: id, x coordinate, y coordinate
struct ATM {
    int id;
    double x;
    double y;
    int cluster; // assigned cluster ID
};

struct Centroid {
    double x;
    double y;
};

// Distance formula: Euclidean distance.
double calculateDistance(double x1, double y1, double x2, double y2) {
    return sqrt(pow(x2 - x1, 2) + pow(y2 - y1, 2));
}

// Assign each ATM to nearest centroid.
bool assignCluster(vector<ATM>& atms, const vector<Centroid>& centroids) {
    bool changed = false;
    for (auto& atm : atms) {
        double min_dist = -1;
        int best_cluster = -1;
        for (int i = 0; i < centroids.size(); ++i) {
            double dist = calculateDistance(atm.x, atm.y, centroids[i].x, centroids[i].y);
            if (min_dist == -1 || dist < min_dist) {
                min_dist = dist;
                best_cluster = i;
            }
        }
        if (atm.cluster != best_cluster) {
            atm.cluster = best_cluster;
            changed = true;
        }
    }
    return changed;
}

// Update centroid as mean of cluster points.
void updateCentroids(const vector<ATM>& atms, vector<Centroid>& centroids) {
    vector<int> counts(centroids.size(), 0);
    vector<double> sum_x(centroids.size(), 0.0);
    vector<double> sum_y(centroids.size(), 0.0);

    for (const auto& atm : atms) {
        if (atm.cluster >= 0 && atm.cluster < (int)centroids.size()) {
            counts[atm.cluster]++;
            sum_x[atm.cluster] += atm.x;
            sum_y[atm.cluster] += atm.y;
        }
    }

    // Mean of cluster points
    for (int i = 0; i < centroids.size(); ++i) {
        if (counts[i] > 0) {
            centroids[i].x = sum_x[i] / counts[i];
            centroids[i].y = sum_y[i] / counts[i];
        }
    }
}

// Repeat until centroids stabilize.
void runKMeans(vector<ATM>& atms, vector<Centroid>& centroids) {
    bool changed = true;
    int iterations = 0;
    while (changed && iterations < 1000) {
        changed = assignCluster(atms, centroids);
        if (changed) {
            updateCentroids(atms, centroids);
        }
        iterations++;
    }
    cout << "K-Means converged in " << iterations << " iterations.\n";
}

// Read ATM coordinates from JSON file
vector<ATM> parseJSON(const string& filename) {
    vector<ATM> atms;
    ifstream in(filename);
    if (!in.is_open()) {
        cerr << "[ERROR] Could not open '" << filename << "'\n";
        return atms;
    }

    string line;
    while (getline(in, line)) {
        if (line.find("\"id\"") != string::npos) {
            ATM pt;
            pt.cluster = -1; // unassigned
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
            atms.push_back(pt);
        }
    }
    in.close();
    return atms;
}

// Output clusters.json and centroid coordinates
void writeClustersJSON(const string& filename, const vector<ATM>& atms, const vector<Centroid>& centroids) {
    ofstream out(filename);
    if (out.is_open()) {
        out << "{\n";
        
        // Write centroids
        out << "  \"centroids\": [\n";
        for (size_t i = 0; i < centroids.size(); ++i) {
            out << "    { \"cluster\": " << i << ", \"x\": " << fixed << setprecision(2) << centroids[i].x << ", \"y\": " << centroids[i].y << " }";
            if (i < centroids.size() - 1) out << ",";
            out << "\n";
        }
        out << "  ],\n";

        // Write clusters
        out << "  \"clusters\": [\n";
        for (size_t i = 0; i < atms.size(); ++i) {
            out << "    { \"id\": " << atms[i].id << ", \"cluster\": " << atms[i].cluster << " }";
            if (i < atms.size() - 1) out << ",";
            out << "\n";
        }
        out << "  ]\n";
        
        out << "}\n";
        out.close();
        cout << "[SUCCESS] Wrote clusters and centroids to " << filename << "\n";
    } else {
        cerr << "[ERROR] Failed to write " << filename << "\n";
    }
}

int main(int argc, char* argv[]) {
    // Read from output.json by default (or passed via command line)
    string inputFile = "output.json";
    if (argc > 1) {
        inputFile = argv[1];
    }
    
    vector<ATM> atms = parseJSON(inputFile);
    if (atms.empty()) {
        cerr << "No ATMs found in " << inputFile << ".\n";
        return 1;
    }

    // Choose k = 3 clusters
    int k = 3;
    if (k > (int)atms.size()) {
        k = atms.size(); // Edge case if less than 3 ATMs
    }

    vector<Centroid> centroids(k);
    srand(time(0));
    
    // Initialize 3 random centroids by picking distinct random ATMs
    vector<int> chosen_indices;
    for (int i = 0; i < k; ++i) {
        int r;
        bool unique;
        do {
            r = rand() % atms.size();
            unique = true;
            for (int idx : chosen_indices) {
                if (idx == r) {
                    unique = false;
                    break;
                }
            }
        } while (!unique);
        
        chosen_indices.push_back(r);
        centroids[i].x = atms[r].x;
        centroids[i].y = atms[r].y;
    }

    // Run K-Means Clustering algorithm
    runKMeans(atms, centroids);
    
    // Output clusters.json
    writeClustersJSON("clusters.json", atms, centroids);

    return 0;
}
