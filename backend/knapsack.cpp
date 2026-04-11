

#include <algorithm>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <limits>
#include <sstream>
#include <string>
#include <vector>

using namespace std;

const double ATM_CAPACITY = 1000000.0;
const int TRUCK_CAPACITY = 80000;
const int TOP_N = 100;

struct ATM {
  int id;
  string name;
  string location;
  double x, y;
  double cashLevel;
  double dailyWithdrawalRate;
  int daysSinceRefill;
  double timeToEmpty;
  double actualCash;
  double refillAmount;
  int weight;
  int value;
};

bool parseLine(const string &line, ATM &atm) {
  stringstream ss(line);
  string token;
  vector<string> fields;
  while (getline(ss, token, ','))
    fields.push_back(token);
  if (fields.size() < 10)
    return false;

  atm.id = stoi(fields[0]);
  atm.name = fields[1];
  atm.location = fields[2];
  atm.x = stod(fields[3]);
  atm.y = stod(fields[4]);

  atm.cashLevel = stod(fields[5]);
  atm.dailyWithdrawalRate = stod(fields[6]);
  atm.daysSinceRefill = stoi(fields[7]);
  atm.timeToEmpty = stod(fields[8]);
  return true;
}

vector<ATM> loadATMs(const string &filename) {
  ifstream in(filename);
  if (!in.is_open()) {
    cerr << "Error: Cannot open " << filename << "\n";
    return {};
  }

  string line;
  getline(in, line);

  vector<ATM> atms;
  while (getline(in, line)) {
    if (line.empty())
      continue;
    ATM a;
    if (!parseLine(line, a))
      continue;

    a.actualCash = (a.cashLevel / 100.0) * ATM_CAPACITY;
    a.refillAmount = ATM_CAPACITY - a.actualCash;

    a.weight = max(1, static_cast<int>(a.refillAmount / 1000.0));

    if (a.timeToEmpty <= 0.0)
      a.value = 9999;
    else if (a.timeToEmpty >= 100000.0)
      a.value = 1;
    else
      a.value = static_cast<int>(1000.0 / a.timeToEmpty);

    atms.push_back(a);
  }
  in.close();

  sort(atms.begin(), atms.end(), [](const ATM &a, const ATM &b) {
    return a.timeToEmpty < b.timeToEmpty;
  });

  if ((int)atms.size() > TOP_N)
    atms.resize(TOP_N);
  return atms;
}

int knapsack(const vector<ATM> &atms, vector<vector<int>> &dp) {
  int n = atms.size();

  dp.assign(n + 1, vector<int>(TRUCK_CAPACITY + 1, 0));

  for (int i = 1; i <= n; i++) {
    int w = atms[i - 1].weight;
    int v = atms[i - 1].value;
    for (int cap = 0; cap <= TRUCK_CAPACITY; cap++) {
      dp[i][cap] = dp[i - 1][cap];
      if (cap >= w)
        dp[i][cap] = max(dp[i][cap], dp[i - 1][cap - w] + v);
    }
  }
  return dp[n][TRUCK_CAPACITY];
}

vector<int> backtrack(const vector<ATM> &atms, const vector<vector<int>> &dp) {
  int n = atms.size();
  int cap = TRUCK_CAPACITY;
  vector<int> selected;

  for (int i = n; i >= 1; i--) {
    if (dp[i][cap] != dp[i - 1][cap]) {
      selected.push_back(i - 1);
      cap -= atms[i - 1].weight;
    }
  }
  return selected;
}

void saveOutput(const vector<ATM> &atms, const vector<int> &selected,
                double totalLoad, int totalValue) {
  ofstream out("knapsack_output.txt");
  out << "Selected ATMs for Truck Dispatch\n";
  out << string(40, '=') << "\n";
  for (int idx : selected)
    out << atms[idx].name << " | " << atms[idx].location << " | Refill: ₹"
        << fixed << setprecision(0) << atms[idx].refillAmount
        << " | TimeLeft: " << setprecision(2) << atms[idx].timeToEmpty
        << " hrs\n";
  out << string(40, '-') << "\n";
  out << "Total Load    : ₹" << fixed << setprecision(2) << totalLoad / 100000.0
      << " lakh\n";
  out << "Total Urgency : " << totalValue << "\n";
  out.close();
  cout << "\n[FILE] Results saved to 'knapsack_output.txt'\n";

  ofstream jsonOut("selected_atms.json");
  if (jsonOut.is_open()) {
    jsonOut << "[\n";
    for (size_t i = 0; i < selected.size(); i++) {
        const ATM& a = atms[selected[i]];
        jsonOut << "  { \"id\": " << a.id 
                << ", \"name\": \"" << a.name 
                << "\", \"x\": " << a.x 
                << ", \"y\": " << a.y 
                << ", \"urgency score\": " << a.value << " }";
        if (i < selected.size() - 1) jsonOut << ",";
        jsonOut << "\n";
    }
    jsonOut << "]\n";
    jsonOut.close();
    cout << "[FILE] Results successfully exported to 'selected_atms.json'\n";
  }
}

int main() {

  vector<ATM> atms = loadATMs("atm_data.txt");
  if (atms.empty()) {
    cerr << "No ATMs loaded. Run priority_queue first to generate "
            "atm_data.txt.\n";
    return 1;
  }

  int n = atms.size();
  cout << "\n[INFO] Loaded " << n << " ATMs (top " << TOP_N
       << " most urgent)\n";

  vector<vector<int>> dp;
  int maxValue = knapsack(atms, dp);

  vector<int> selected = backtrack(atms, dp);

  double totalLoad = 0.0;
  int totalValue = 0;
  for (int idx : selected) {
    totalLoad += atms[idx].refillAmount;
    totalValue += atms[idx].value;
  }

  cout << "\n";
  cout << "╔═══════════════════════════════════════════════════════════════════"
          "═══════════╗\n";
  cout << "║          ATM KNAPSACK OPTIMIZER — SELECTED ATMs FOR TRUCK "
          "DISPATCH          ║\n";
  cout << "╚═══════════════════════════════════════════════════════════════════"
          "═══════════╝\n\n";

  cout << left << setw(10) << "ATM ID" << setw(26) << "Location" << setw(20)
       << "Refill Amount (₹)" << setw(18) << "Time Left (hrs)" << setw(10)
       << "Urgency"
       << "\n";
  cout << string(82, '-') << "\n";

  for (int idx : selected) {
    const ATM &a = atms[idx];
    cout << left << setw(10) << a.name << setw(26) << a.location << setw(20)
         << fixed << setprecision(0) << a.refillAmount << setw(18) << fixed
         << setprecision(2) << a.timeToEmpty << setw(10) << a.value << "\n";
  }

  cout << "\n" << string(82, '=') << "\n";
  cout << "  ATMs Selected     : " << selected.size() << " / " << n << "\n";
  cout << "  Total Load        : ₹" << fixed << setprecision(2)
       << totalLoad / 100000.0 << " lakh"
       << "  (Truck Capacity: ₹50 lakh)\n";
  cout << "  Total Urgency     : " << totalValue << "\n";
  cout << "  Max Possible Value: " << maxValue << "\n";
  cout << string(82, '=') << "\n";

  saveOutput(atms, selected, totalLoad, totalValue);
  return 0;
}
