// ============================================================
//  ATM Cash Replenishment Optimizer
//  Course: Design and Analysis of Algorithms (DAA)
//  Description: Uses a Max-Heap Priority Queue (STL) to rank
//               100 ATMs by urgency score so replenishment
//               trucks can be dispatched optimally.
//  Time Complexity: O(n log n) — heap construction + n pops
// ============================================================

#include <iostream>
#include <fstream>
#include <iomanip>
#include <string>
#include <vector>
#include <queue>
#include <cstdlib>   // srand, rand
#include <cmath>

using namespace std;

// ============================================================
//  PART 1: ATM Data Structure
// ============================================================

struct ATM {
    int    id;
    string name;
    string location;
    double x, y;                  // city-grid coordinates [0, 100]
    double cashLevel;             // % cash remaining [0, 100]
    double dailyWithdrawalRate;   // thousands ₹ per day [500, 5000]
    int    daysSinceRefill;       // [1, 15]
    double urgencyScore;          // calculated below
    int    truckAssigned;         // -1 = unassigned
};

// ============================================================
//  100 Realistic Indian City Area Names
// ============================================================
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

// ============================================================
//  Urgency Score Formula
//  urgencyScore = (100 - cashLevel) * 0.5
//               + (dailyWithdrawalRate / 500.0) * 0.3
//               + (daysSinceRefill * 2.0) * 0.2
// ============================================================
double calculateUrgency(const ATM& atm) {
    double cashFactor     = (100.0 - atm.cashLevel) * 0.5;
    double rateFactor     = (atm.dailyWithdrawalRate / 500.0) * 0.3;
    double daysFactor     = (atm.daysSinceRefill * 2.0) * 0.2;
    return cashFactor + rateFactor + daysFactor;
}

// ============================================================
//  PART 2: Custom Comparator for Max-Heap
//  STL priority_queue is a max-heap by default with std::less,
//  but we need comparison on urgencyScore, so we write our own.
// ============================================================
struct CompareUrgency {
    // Returns true if a has LOWER priority than b
    // (so b gets popped first — higher urgency first)
    bool operator()(const ATM& a, const ATM& b) const {
        return a.urgencyScore < b.urgencyScore;
    }
};

// ============================================================
//  Helper: Determine status label from urgency score
// ============================================================
string getStatus(double score) {
    if (score > 70.0)       return "CRITICAL";
    else if (score >= 50.0) return "HIGH    ";
    else if (score >= 30.0) return "MEDIUM  ";
    else                    return "LOW     ";
}

// ============================================================
//  Helper: Random double in [lo, hi]
// ============================================================
double randDouble(double lo, double hi) {
    return lo + (static_cast<double>(rand()) / RAND_MAX) * (hi - lo);
}

// ============================================================
//  Helper: Random int in [lo, hi] inclusive
// ============================================================
int randInt(int lo, int hi) {
    return lo + rand() % (hi - lo + 1);
}

// ============================================================
//  PART 3: Save all ATM data to atm_data.txt (CSV format)
//  Format: id,name,location,x,y,cashLevel,dailyRate,daysSinceRefill,urgencyScore
// ============================================================
void saveToFile(const vector<ATM>& atms, const string& filename) {
    ofstream out(filename);
    if (!out.is_open()) {
        cerr << "Error: Could not open " << filename << " for writing.\n";
        return;
    }

    // CSV header
    out << "id,name,location,x,y,cashLevel,dailyWithdrawalRate,"
        << "daysSinceRefill,urgencyScore,status\n";

    for (const ATM& a : atms) {
        out << fixed << setprecision(2);
        out << a.id           << ","
            << a.name         << ","
            << a.location     << ","
            << a.x            << ","
            << a.y            << ","
            << a.cashLevel    << ","
            << a.dailyWithdrawalRate << ","
            << a.daysSinceRefill     << ","
            << a.urgencyScore        << ","
            << getStatus(a.urgencyScore) << "\n";
    }

    out.close();
    cout << "\n[FILE] All 100 ATM records saved to '" << filename << "'\n";
}

// ============================================================
//  MAIN
// ============================================================
int main() {
    // ── Seed the RNG for reproducibility ─────────────────────
    srand(42);

    // ── PART 1: Generate 100 ATMs ─────────────────────────────
    vector<ATM> atms;
    atms.reserve(100);

    for (int i = 0; i < 100; i++) {
        ATM a;
        a.id                 = i + 1;
        a.name               = "ATM_" + string(3 - to_string(i + 1).size(), '0') + to_string(i + 1);
        a.location           = LOCATIONS[i];
        a.x                  = randDouble(0.0, 100.0);
        a.y                  = randDouble(0.0, 100.0);
        a.cashLevel          = randDouble(0.0, 100.0);
        a.dailyWithdrawalRate= randDouble(500.0, 5000.0);
        a.daysSinceRefill    = randInt(1, 15);
        a.urgencyScore       = 0.0;   // will be computed next
        a.truckAssigned      = -1;
        atms.push_back(a);
    }

    // ── Calculate urgency score for every ATM ─────────────────
    for (ATM& a : atms) {
        a.urgencyScore = calculateUrgency(a);
    }

    // ── PART 2: Build Max-Heap using STL priority_queue ───────
    // priority_queue<T, Container, Comparator>
    // Max-heap: the element with the HIGHEST urgencyScore is at the top.
    priority_queue<ATM, vector<ATM>, CompareUrgency> pq;

    for (const ATM& a : atms) {
        pq.push(a);   // Each push: O(log n)
    }
    // Total heap construction: O(n log n)

    // ── Pop all ATMs in descending urgency order ───────────────
    vector<ATM> sorted;
    sorted.reserve(100);
    while (!pq.empty()) {
        sorted.push_back(pq.top());
        pq.pop();   // Each pop: O(log n)
    }
    // Total: O(n log n) for n pops

    // ── PART 3: Print Formatted Table (Top 20) ────────────────
    cout << "\n";
    cout << "╔══════════════════════════════════════════════════════════════════════════════════════════════════════╗\n";
    cout << "║           ATM CASH REPLENISHMENT OPTIMIZER — TOP 20 MOST URGENT ATMs                               ║\n";
    cout << "╚══════════════════════════════════════════════════════════════════════════════════════════════════════╝\n\n";

    // Table header
    cout << left
         << setw(5)  << "Rank"
         << setw(9)  << "ATM ID"
         << setw(26) << "Location"
         << setw(13) << "Cash Level%"
         << setw(13) << "Daily Rate"
         << setw(19) << "Days Since Refill"
         << setw(15) << "Urgency Score"
         << setw(10) << "Status"
         << "\n";
    cout << string(105, '-') << "\n";

    int criticalCount = 0, highCount = 0;
    double totalUrgency = 0.0;

    // Count across ALL 100 ATMs for aggregate stats
    for (const ATM& a : sorted) {
        totalUrgency += a.urgencyScore;
        string s = getStatus(a.urgencyScore);
        if (s.find("CRITICAL") != string::npos) criticalCount++;
        else if (s.find("HIGH") != string::npos) highCount++;
    }

    // Print top 20 rows
    for (int rank = 1; rank <= 20; rank++) {
        const ATM& a = sorted[rank - 1];
        string status = getStatus(a.urgencyScore);

        cout << left
             << setw(5)  << rank
             << setw(9)  << a.name
             << setw(26) << a.location
             << setw(13) << fixed << setprecision(1) << a.cashLevel
             << setw(13) << fixed << setprecision(0) << a.dailyWithdrawalRate
             << setw(19) << a.daysSinceRefill
             << setw(15) << fixed << setprecision(2) << a.urgencyScore
             << setw(10) << status
             << "\n";
    }

    // ── Summary Statistics ────────────────────────────────────
    cout << "\n" << string(105, '=') << "\n";
    cout << "  SUMMARY (across all 100 ATMs)\n";
    cout << string(105, '-') << "\n";
    cout << "  Total CRITICAL ATMs  : " << criticalCount << "\n";
    cout << "  Total HIGH ATMs      : " << highCount     << "\n";
    cout << "  Average Urgency Score: " << fixed << setprecision(2)
         << (totalUrgency / 100.0) << "\n";
    cout << "\n";
    cout << "  Time Complexity Note:\n";
    cout << "    • Inserting n = 100 ATMs into max-heap : O(n log n)\n";
    cout << "    • Extracting all n elements in order   : O(n log n)\n";
    cout << "    • Overall                              : O(n log n)\n";
    cout << string(105, '=') << "\n";

    // ── Save all 100 ATMs to file ─────────────────────────────
    saveToFile(sorted, "atm_data.txt");

    return 0;
}
