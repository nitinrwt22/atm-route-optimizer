// ATM Cash Replenishment Optimizer — Time-Based Predictive Urgency Model (Min-Heap Priority Queue)

#include <iostream>
#include <fstream>
#include <iomanip>
#include <string>
#include <vector>
#include <queue>
#include <cstdlib>
#include <cmath>
#include <limits>

using namespace std;

// Fixed ATM cash capacity in rupees (₹10,00,000 = ₹10 lakh per machine)
const double ATM_CAPACITY = 1000000.0;

// ATM data structure with time-to-empty prediction field
struct ATM {
    int    id;
    string name;
    string location;
    double x, y;
    double cashLevel;
    double dailyWithdrawalRate;
    int    daysSinceRefill;
    double timeToEmpty;    // hours until ATM runs out of cash
    int    truckAssigned;
};

// 100 Realistic Indian City Area Names
const string LOCATIONS[100] = {
    "Connaught Place",    "Lajpat Nagar",       "Karol Bagh",
    "Saket",              "Dwarka Sector 10",    "Rohini Sector 3",
    "Pitampura",          "Janakpuri",           "Rajouri Garden",
    "Paschim Vihar",      "Vikaspuri",           "Uttam Nagar",
    "Tilak Nagar",        "Subhash Nagar",       "Tagore Garden",
    "Punjabi Bagh",       "Shalimar Bagh",       "Ashok Vihar",
    "Model Town",         "GTB Nagar",           "Kamla Nagar",
    "Civil Lines",        "Kashmere Gate",       "Chandni Chowk",
    "Lal Kuan",           "Sadar Bazar",         "Paharganj",
    "Kalighat",           "Chittaranjan Park",   "Malviya Nagar",
    "Greater Kailash 1",  "Greater Kailash 2",   "Hauz Khas",
    "Green Park",         "Safdarjung",           "INA Colony",
    "Defence Colony",     "Jangpura",             "Okhla Phase 1",
    "Govindpuri",         "Kalkaji",              "Nehru Place",
    "Laxmi Nagar",        "Preet Vihar",          "Vivek Vihar",
    "Shahdara",           "Dilshad Garden",       "Geeta Colony",
    "Gandhi Nagar",       "Krishna Nagar",        "Mayur Vihar 1",
    "Mayur Vihar 2",      "Patparganj",           "Vasundhara Enclave",
    "Kondli",             "Mandawali",            "Anand Vihar",
    "Karkardooma",        "Surajmal Vihar",       "Yamuna Vihar",
    "Nand Nagri",         "Seelampur",            "Gokulpuri",
    "Mustafabad",         "Sonia Vihar",          "Johri Enclave",
    "Rohtas Nagar",       "Shastri Park",         "Bhajanpura",
    "Wazirabad",          "Burari",               "Jahangirpuri",
    "Mukherjee Nagar",    "Rani Bagh",            "Peeragarhi",
    "Nangloi",            "Tikri Kalan",          "Mundka",
    "Bawana",             "Narela",               "Alipur",
    "Bakkarwala",         "Sultanpuri",           "Mangolpuri",
    "Netaji Subhash Place","Shyam Basti",         "Shakti Nagar",
    "Tis Hazari",         "Nabi Karim",           "Daryaganj",
    "Indraprastha",       "IP Extension",          "Akshardham",
    "Pandav Nagar",       "Shakarpur",            "East Vinod Nagar",
    "Vasant Kunj",        "Mehrauli",
    "Sarita Vihar",       "Jasola Vihar"
};

// cashLevel is a percentage (0–100%), but dailyWithdrawalRate is in actual rupees.
// We must convert to actual cash first so both sides of the division share the same unit.
double calculateTimeToEmpty(const ATM& atm) {
    if (atm.cashLevel <= 0.0)            return 0.0;
    if (atm.dailyWithdrawalRate <= 0.0)  return numeric_limits<double>::max();
    double actualCash = (atm.cashLevel / 100.0) * ATM_CAPACITY; // % → ₹
    double hourlyRate = atm.dailyWithdrawalRate / 24.0;
    return actualCash / hourlyRate;
}

// Min-heap comparator: ATM with smaller timeToEmpty has higher priority (runs out sooner)
struct CompareTime {
    bool operator()(const ATM& a, const ATM& b) const {
        return a.timeToEmpty > b.timeToEmpty; // smaller timeToEmpty = higher priority
    }
};

// Time-based status classification
string getStatus(double timeToEmpty) {
    if (timeToEmpty <= 2.0)       return "CRITICAL";
    else if (timeToEmpty <= 6.0)  return "HIGH    ";
    else if (timeToEmpty <= 12.0) return "MEDIUM  ";
    else                          return "LOW     ";
}

// Random double in [lo, hi]
double randDouble(double lo, double hi) {
    return lo + (static_cast<double>(rand()) / RAND_MAX) * (hi - lo);
}

// Random int in [lo, hi] inclusive
int randInt(int lo, int hi) {
    return lo + rand() % (hi - lo + 1);
}

// Save all ATM records to CSV file including timeToEmpty
void saveToFile(const vector<ATM>& atms, const string& filename) {
    ofstream out(filename);
    if (!out.is_open()) {
        cerr << "Error: Could not open " << filename << " for writing.\n";
        return;
    }

    out << "id,name,location,x,y,cashLevel,dailyWithdrawalRate,"
        << "daysSinceRefill,timeToEmpty_hrs,status\n";

    for (const ATM& a : atms) {
        out << fixed << setprecision(2);
        out << a.id                   << ","
            << a.name                 << ","
            << a.location             << ","
            << a.x                    << ","
            << a.y                    << ","
            << a.cashLevel            << ","
            << a.dailyWithdrawalRate  << ","
            << a.daysSinceRefill      << ","
            << (a.timeToEmpty >= 1e9 ? 9999.99 : a.timeToEmpty) << ","
            << getStatus(a.timeToEmpty) << "\n";
    }

    out.close();
    cout << "\n[FILE] All 100 ATM records saved to '" << filename << "'\n";
}

// Save JSON output for visualization
void saveToJSON(vector<ATM>& atms, vector<int>& route) {
    ofstream file("output.json");

    file << "{\n";
    file << "  \"atms\": [\n";

    for (int i = 0; i < (int)atms.size(); i++) {
        file << "    {";
        file << "\"id\": "         << atms[i].id           << ", ";
        file << "\"name\": \""     << atms[i].name         << "\", ";
        file << "\"location\": \"" << atms[i].location     << "\", ";
        file << "\"x\": "          << atms[i].x            << ", ";
        file << "\"y\": "          << atms[i].y            << ", ";
        file << "\"cashLevel\": "  << atms[i].cashLevel    << ", ";
        file << "\"timeToEmpty\": "<< (atms[i].timeToEmpty >= 1e9 ? 9999.99 : atms[i].timeToEmpty) << ", ";
        file << "\"days\": "       << atms[i].daysSinceRefill;
        file << "}";
        if (i != (int)atms.size() - 1) file << ",";
        file << "\n";
    }

    file << "  ],\n";
    file << "  \"route\": [";
    for (int i = 0; i < (int)route.size(); i++) {
        file << route[i];
        if (i != (int)route.size() - 1) file << ",";
    }
    file << "]\n";
    file << "}\n";

    file.close();
}

int main() {
    srand(42);

    // Generate 100 ATMs with random data
    vector<ATM> atms;
    atms.reserve(100);

    for (int i = 0; i < 100; i++) {
        ATM a;
        a.id                  = i + 1;
        a.name                = "ATM_" + string(3 - to_string(i + 1).size(), '0') + to_string(i + 1);
        a.location            = LOCATIONS[i];
        a.x                   = randDouble(0.0, 100.0);
        a.y                   = randDouble(0.0, 100.0);
        a.cashLevel           = randDouble(0.0, 100.0);
        a.dailyWithdrawalRate = randDouble(500.0, 5000.0);
        a.daysSinceRefill     = randInt(1, 15);
        a.timeToEmpty         = 0.0;
        a.truckAssigned       = -1;
        atms.push_back(a);
    }

    // Compute timeToEmpty for every ATM
    for (ATM& a : atms) {
        a.timeToEmpty = calculateTimeToEmpty(a);
    }

    // Build Min-Heap (ATM with smallest timeToEmpty = highest priority)
    priority_queue<ATM, vector<ATM>, CompareTime> pq;
    for (const ATM& a : atms) {
        pq.push(a);
    }

    // Extract all ATMs in ascending timeToEmpty order (most urgent first)
    vector<ATM> sorted;
    sorted.reserve(100);
    while (!pq.empty()) {
        sorted.push_back(pq.top());
        pq.pop();
    }

    // Print formatted table header
    cout << "\n";
    cout << "╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗\n";
    cout << "║        ATM CASH REPLENISHMENT OPTIMIZER — TOP 20 MOST URGENT ATMs (Time-to-Empty Model)                    ║\n";
    cout << "╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝\n\n";

    cout << left
         << setw(5)  << "Rank"
         << setw(9)  << "ATM ID"
         << setw(26) << "Location"
         << setw(13) << "Cash Level%"
         << setw(13) << "Daily Rate"
         << setw(19) << "Days Since Refill"
         << setw(16) << "Time Left (hrs)"
         << setw(10) << "Status"
         << "\n";
    cout << string(111, '-') << "\n";

    int criticalCount = 0, highCount = 0;

    // Count across all 100 ATMs for aggregate stats
    for (const ATM& a : sorted) {
        string s = getStatus(a.timeToEmpty);
        if (s.find("CRITICAL") != string::npos) criticalCount++;
        else if (s.find("HIGH") != string::npos) highCount++;
    }

    // Print top 20 rows
    for (int rank = 1; rank <= 20; rank++) {
        const ATM& a = sorted[rank - 1];
        string status = getStatus(a.timeToEmpty);
        double display_tte = (a.timeToEmpty >= 1e9) ? 9999.99 : a.timeToEmpty;

        cout << left
             << setw(5)  << rank
             << setw(9)  << a.name
             << setw(26) << a.location
             << setw(13) << fixed << setprecision(1) << a.cashLevel
             << setw(13) << fixed << setprecision(0) << a.dailyWithdrawalRate
             << setw(19) << a.daysSinceRefill
             << setw(16) << fixed << setprecision(2) << display_tte
             << setw(10) << status
             << "\n";
    }

    vector<int> route;
    for (auto& atm : atms) route.push_back(atm.id);

    // Summary statistics
    cout << "\n" << string(111, '=') << "\n";
    cout << "  SUMMARY (across all 100 ATMs)\n";
    cout << string(111, '-') << "\n";
    cout << "  Total CRITICAL ATMs (≤ 2 hrs)  : " << criticalCount << "\n";
    cout << "  Total HIGH ATMs    (≤ 6 hrs)   : " << highCount     << "\n";
    cout << "\n";
    cout << "  Time Complexity Note:\n";
    cout << "    • Inserting n = 100 ATMs into min-heap : O(n log n)\n";
    cout << "    • Extracting all n elements in order   : O(n log n)\n";
    cout << "    • Overall                              : O(n log n)\n";
    cout << string(111, '=') << "\n";

    saveToFile(sorted, "atm_data.txt");
    saveToJSON(atms, route);
    return 0;
}
