#include <WiFi.h>
#include <WiFiMulti.h>
#include <Firebase_ESP_Client.h>
#include <time.h>

// ============================================================
//  WiFiMulti Object
// ============================================================
WiFiMulti wifiMulti;

// ============================================================
//  WiFi and Firebase Configuration
// ============================================================
#define FIREBASE_HOST "projectklt-default-rtdb.asia-southeast1.firebasedatabase.app"
#define API_KEY "AIzaSyD26CeYAI9zKKsXNTmXmYBa7waGWakFUa0"

// ============================================================
//  Board Configuration - BOARD 02
// ============================================================
#define BOARD_ID "esp32_node_02"
#define BOARD_NAME "ESP32 Node 02"
#define SENSOR_ID "us_02"
#define SOIL_SENSOR_ID "soil_02"

// ============================================================
//  Ultrasonic Pins - เปลี่ยนให้ต่างจากบอร์ด 01
// ============================================================
#define TRIG_PIN 4     // เปลี่ยนจาก 5 เป็น 4
#define ECHO_PIN 19    // เปลี่ยนจาก 18 เป็น 19

// ============================================================
//  Default Values
// ============================================================
#define DEFAULT_INSTALL_HEIGHT 50.0
#define DEFAULT_BANK_HEIGHT 25.0
#define MIN_DISTANCE 2.0
#define MAX_DISTANCE 500.0

// ============================================================
//  Firebase Objects
// ============================================================
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// ============================================================
//  Timing Variables
// ============================================================
unsigned long sendDataPrevMillis = 0;
unsigned long sendSensorPrevMillis = 0;
unsigned long lastWiFiCheck = 0;
unsigned long lastConfigRead = 0;
bool isFirstConnection = true;
bool wifiConnected = false;
bool configLoaded = false;

// ============================================================
//  Configuration Variables
// ============================================================
float installHeight = DEFAULT_INSTALL_HEIGHT;
float bankHeight = DEFAULT_BANK_HEIGHT;
float minDistance = MIN_DISTANCE;

// ============================================================
//  Ultrasonic Status
// ============================================================
float lastValidDistance = 0;
bool lastReadingValid = false;
int consecutiveErrors = 0;
#define MAX_CONSECUTIVE_ERRORS 5

// ============================================================
//  Read Ultrasonic Distance
// ============================================================
float readUltrasonicDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH, 50000);
  
  if (duration == 0) {
    consecutiveErrors++;
    Serial.printf("⚠️ Ultrasonic timeout (error #%d)\n", consecutiveErrors);
    
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      Serial.println("❌ Ultrasonic sensor appears to be faulty!");
      return -1.0;
    }
    
    if (lastReadingValid) {
      return lastValidDistance;
    }
    return -1.0;
  }
  
  consecutiveErrors = 0;
  float distance = duration * 0.034 / 2.0;
  
  if (distance < minDistance) {
    distance = minDistance;
  } else if (distance > MAX_DISTANCE) {
    distance = MAX_DISTANCE;
  }
  
  if (distance > installHeight + 10) {
    Serial.printf("⚠️ Distance %.1f cm exceeds install height %.1f cm\n", distance, installHeight);
    if (lastReadingValid) {
      return lastValidDistance;
    }
    return installHeight;
  }
  
  lastValidDistance = distance;
  lastReadingValid = true;
  return distance;
}

// ============================================================
//  Connect WiFi (แบบ Multi-AP)
// ============================================================
bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    return true;
  }
  
  Serial.println("🔄 Scanning and connecting to known Wi-Fi...");
  
  if (wifiMulti.run() == WL_CONNECTED) {
    Serial.println("\n✅ Wi-Fi Connected!");
    Serial.print("📶 SSID: "); Serial.println(WiFi.SSID());
    Serial.print("📶 IP Address: "); Serial.println(WiFi.localIP());
    Serial.print("📶 RSSI: "); Serial.println(WiFi.RSSI());
    wifiConnected = true;
    return true;
  } else {
    Serial.println("\n❌ Wi-Fi Connection Failed!");
    wifiConnected = false;
    return false;
  }
}

// ============================================================
//  Setup NTP
// ============================================================
void setupNTP() {
  configTime(7 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("🕐 Waiting for NTP time sync...");
  
  int attempts = 0;
  time_t now = time(nullptr);
  while (now < 8 * 3600 * 2 && attempts < 15) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
    attempts++;
  }
  
  if (now >= 8 * 3600 * 2) {
    Serial.println(" ✅ NTP Sync Success!");
    struct tm timeinfo;
    getLocalTime(&timeinfo);
    Serial.print("🕐 Current Time: ");
    Serial.println(asctime(&timeinfo));
  } else {
    Serial.println(" ⚠️ NTP Sync Timeout");
  }
}

// ============================================================
//  Setup Firebase
// ============================================================
void setupFirebase() {
  config.api_key = API_KEY;
  config.database_url = FIREBASE_HOST;
  config.signer.test_mode = true;
  config.timeout.serverResponse = 10 * 1000;
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  
  Serial.println("🔥 Firebase Initialized (Test Mode)");
}

// ============================================================
//  Load Config from Firebase
// ============================================================
void loadConfigFromFirebase() {
  if (!Firebase.ready()) {
    Serial.println("⚠️ Firebase not ready, cannot load config");
    return;
  }
  
  Serial.println("📥 Loading configuration from Firebase...");
  
  String configPath = String("/device_configs/") + SENSOR_ID;
  
  if (Firebase.RTDB.getFloat(&fbdo, configPath + "/installHeight")) {
    if (fbdo.dataType() == "float") {
      float newHeight = fbdo.floatData();
      if (newHeight >= 5.0 && newHeight <= 500.0) {
        installHeight = newHeight;
        Serial.printf("✅ Install Height loaded: %.1f cm\n", installHeight);
        configLoaded = true;
      } else {
        installHeight = DEFAULT_INSTALL_HEIGHT;
      }
    }
  }
  
  if (Firebase.RTDB.getFloat(&fbdo, configPath + "/bankHeight")) {
    if (fbdo.dataType() == "float") {
      float newBank = fbdo.floatData();
      if (newBank >= 0 && newBank <= installHeight) {
        bankHeight = newBank;
        Serial.printf("✅ Bank Height loaded: %.1f cm\n", bankHeight);
      }
    }
  }
  
  if (Firebase.RTDB.getFloat(&fbdo, configPath + "/minDistance")) {
    if (fbdo.dataType() == "float") {
      float newMin = fbdo.floatData();
      if (newMin >= 0.5 && newMin <= 10.0) {
        minDistance = newMin;
        Serial.printf("✅ Min Distance loaded: %.1f cm\n", minDistance);
      }
    }
  }
  
  Serial.println("📋 Current configuration:");
  Serial.printf("   - Install Height: %.1f cm\n", installHeight);
  Serial.printf("   - Bank Height: %.1f cm\n", bankHeight);
  Serial.printf("   - Min Distance: %.1f cm\n", minDistance);
}

// ============================================================
//  Send Heartbeat (BOARD 02)
// ============================================================
void sendHeartbeat() {
  if (!Firebase.ready()) {
    Serial.println("⚠️ Firebase not ready, skipping heartbeat");
    return;
  }
  
  FirebaseJson json;
  String boardPath = String("/device_configs/") + BOARD_ID;
  
  if (isFirstConnection) {
    json.set("status", "online");
    json.set("type", "board");
    json.set("name", BOARD_NAME);
    json.set("enabled", true);
    json.set("onlineSince/.sv", "timestamp");
    json.set("lastSeen/.sv", "timestamp");
    json.set("wifi_rssi", WiFi.RSSI());
    json.set("ip", WiFi.localIP().toString());
    json.set("mac", WiFi.macAddress());
    json.set("install_height", installHeight);
    json.set("bank_height", bankHeight);
    json.set("min_distance", minDistance);
    
    if (Firebase.RTDB.updateNode(&fbdo, boardPath, &json)) {
      Serial.printf("✅ Board %s Identity Initialized\n", BOARD_ID);
      isFirstConnection = false;
    } else {
      Serial.println("❌ Init failed: " + fbdo.errorReason());
    }
  } else {
    json.set("lastSeen/.sv", "timestamp");
    json.set("wifi_rssi", WiFi.RSSI());
    json.set("install_height", installHeight);
    json.set("bank_height", bankHeight);
    
    if (Firebase.RTDB.updateNode(&fbdo, boardPath, &json)) {
      Serial.printf("🟢 Heartbeat Sent (%s) | RSSI: %d\n", BOARD_ID, WiFi.RSSI());
    } else {
      Serial.println("❌ Heartbeat failed: " + fbdo.errorReason());
    }
  }
}

// ============================================================
//  Send Sensor Data (BOARD 02)
// ============================================================
void sendSensorData(float distance, float soilValue) {
  if (!Firebase.ready()) {
    Serial.println("⚠️ Firebase not ready, skipping sensor data");
    return;
  }
  
  float waterLevel = 0;
  float rawDistance = distance;
  String statusText = "normal";
  bool sensorError = false;
  
  if (distance < 0) {
    rawDistance = -1.0;
    waterLevel = -1.0;
    statusText = "no_signal";
    sensorError = true;
    Serial.println("⚠️ No signal from ultrasonic sensor");
  } else {
    waterLevel = installHeight - distance;
    if (waterLevel < 0) waterLevel = 0;
    
    if (bankHeight > 0) {
      float percent = (waterLevel / bankHeight) * 100.0;
      if (percent >= 100.0) statusText = "flood";
      else if (percent >= 80.0) statusText = "warning";
      else if (percent >= 60.0) statusText = "high";
      else if (percent >= 40.0) statusText = "normal";
      else if (percent >= 20.0) statusText = "low";
      else statusText = "very_low";
    }
  }
  
  FirebaseJson sensorJson;
  sensorJson.set(SENSOR_ID, rawDistance);
  sensorJson.set(SOIL_SENSOR_ID, soilValue);
  sensorJson.set("water_level", waterLevel);
  sensorJson.set("timestamp/.sv", "timestamp");
  sensorJson.set("install_height", installHeight);
  sensorJson.set("bank_height", bankHeight);
  sensorJson.set("status", statusText);
  sensorJson.set("sensor_error", sensorError);
  sensorJson.set("online", true);
  sensorJson.set("board_id", BOARD_ID);
  sensorJson.set("wifi_rssi", WiFi.RSSI());
  
  String path = String("/sensors/") + BOARD_ID;
  
  if (Firebase.RTDB.updateNode(&fbdo, path, &sensorJson)) {
    Serial.println("📤 Sensor data sent to " + path);
    Serial.printf("   📊 %s = %.1f cm\n", SENSOR_ID, rawDistance);
    Serial.printf("   💧 water_level = %.1f cm\n", waterLevel);
    Serial.printf("   📌 status = %s\n", statusText.c_str());
    Serial.printf("   📶 wifi_rssi = %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println("❌ Send failed: " + fbdo.errorReason());
  }
  
  if (!sensorError && distance > 0) {
    time_t now = time(nullptr);
    struct tm timeinfo;
    getLocalTime(&timeinfo);
    
    char historyPath[150];
    strftime(historyPath, sizeof(historyPath), "/sensors/history/%Y-%m-%d_%H:%M:%S", &timeinfo);
    
    FirebaseJson historyJson;
    historyJson.set(SENSOR_ID, rawDistance);
    historyJson.set(SOIL_SENSOR_ID, soilValue);
    historyJson.set("water_level", waterLevel);
    historyJson.set("install_height", installHeight);
    historyJson.set("bank_height", bankHeight);
    historyJson.set("status", statusText);
    historyJson.set("board_id", BOARD_ID);
    historyJson.set("timestamp/.sv", "timestamp");
    historyJson.set("wifi_rssi", WiFi.RSSI());
    
    if (Firebase.RTDB.setJSON(&fbdo, historyPath, &historyJson)) {
      Serial.print("📝 History data saved to: ");
      Serial.println(historyPath);
    } else {
      Serial.println("⚠️ History save failed: " + fbdo.errorReason());
    }
  }
}

// ============================================================
//  Test Ultrasonic
// ============================================================
void testUltrasonic() {
  Serial.println("🔧 Testing Ultrasonic Sensor...");
  for (int i = 0; i < 5; i++) {
    float dist = readUltrasonicDistance();
    if (dist > 0) {
      Serial.printf("  Test %d: %.1f cm\n", i + 1, dist);
    } else {
      Serial.printf("  Test %d: ERROR (no signal)\n", i + 1);
    }
    delay(500);
  }
  Serial.println("✅ Ultrasonic test complete");
}

// ============================================================
//  Setup
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("========================================");
  Serial.printf("🌊 %s - Water Level Monitoring System\n", BOARD_ID);
  Serial.println("========================================");
  Serial.println("🔧 Initializing...");
  
  // ============================================================
  //  🔧 เพิ่ม Wi-Fi เข้าไปใน WiFiMulti
  // ============================================================
  wifiMulti.addAP("RACHAPON_2.4G", "0939361353");
  wifiMulti.addAP("Maeket_2.4G", "06092536");
  Serial.println("📶 Added 2 Wi-Fi networks to scan list");
  
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);
  
  Serial.printf("📡 TRIG_PIN: %d | ECHO_PIN: %d\n", TRIG_PIN, ECHO_PIN);
  Serial.printf("📏 Default Install Height: %.1f cm\n", DEFAULT_INSTALL_HEIGHT);
  Serial.printf("📏 Default Bank Height: %.1f cm\n", DEFAULT_BANK_HEIGHT);
  Serial.printf("🆔 Board ID: %s\n", BOARD_ID);
  Serial.printf("📌 Sensor ID: %s\n", SENSOR_ID);
  
  connectWiFi();
  
  if (wifiConnected) {
    setupNTP();
  }
  
  setupFirebase();
  
  if (wifiConnected) {
    delay(2000);
    loadConfigFromFirebase();
  }
  
  testUltrasonic();
  
  Serial.println("✅ System Ready!");
  Serial.printf("🆔 %s is running...\n", BOARD_ID);
  Serial.println("========================================");
}

// ============================================================
//  Loop
// ============================================================
void loop() {
  // --- Check WiFi every 5 seconds ---
  if (millis() - lastWiFiCheck > 5000) {
    lastWiFiCheck = millis();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("⚠️ WiFi disconnected! Attempting to reconnect...");
      connectWiFi();
    }
  }
  
  // --- If WiFi not connected, wait and retry ---
  if (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    return;
  }
  
  // --- Firebase Ready Check ---
  if (!Firebase.ready()) {
    Serial.println("⚠️ Firebase not ready, re-initializing...");
    Firebase.begin(&config, &auth);
    delay(1000);
    return;
  }
  
  // ============================================================
  //  0. Load config from Firebase every 60 seconds
  // ============================================================
  if (millis() - lastConfigRead > 60000 || lastConfigRead == 0) {
    lastConfigRead = millis();
    loadConfigFromFirebase();
  }
  
  // ============================================================
  //  1. Heartbeat (every 20 seconds)
  // ============================================================
  if (millis() - sendDataPrevMillis > 20000 || sendDataPrevMillis == 0) {
    sendDataPrevMillis = millis();
    sendHeartbeat();
  }
  
  // ============================================================
  //  2. Read and send sensor data (every 10 seconds)
  // ============================================================
  if (millis() - sendSensorPrevMillis > 10000) {
    sendSensorPrevMillis = millis();
    
    float distanceValue = readUltrasonicDistance();
    float soilValue = 65.0 + (random(-5, 5) / 10.0);
    
    Serial.println("----------------------------------------");
    Serial.printf("🆔 %s\n", BOARD_ID);
    Serial.printf("📏 Current Config: Install=%.1f, Bank=%.1f cm\n", installHeight, bankHeight);
    
    if (distanceValue < 0) {
      Serial.println("❌ Ultrasonic: NO SIGNAL (sensor error)");
    } else {
      Serial.printf("📊 Ultrasonic Distance (%s): %.1f cm\n", SENSOR_ID, distanceValue);
      
      float waterLevel = installHeight - distanceValue;
      if (waterLevel < 0) waterLevel = 0;
      
      Serial.printf("💧 Water Level: %.1f cm\n", waterLevel);
      
      if (bankHeight > 0) {
        float percent = (waterLevel / bankHeight) * 100.0;
        Serial.printf("📊 Water Level: %.1f%% of bank height\n", percent);
        
        if (percent >= 100.0) {
          Serial.println("🌊 STATUS: FLOOD! (น้ำล้นตลิ่ง!)");
        } else if (percent >= 80.0) {
          Serial.println("⚠️ STATUS: WARNING (ใกล้ตลิ่งมาก)");
        } else if (percent >= 60.0) {
          Serial.println("📈 STATUS: HIGH (ระดับน้ำสูง)");
        } else if (percent >= 40.0) {
          Serial.println("📊 STATUS: NORMAL (ระดับน้ำปานกลาง)");
        } else if (percent >= 20.0) {
          Serial.println("📉 STATUS: LOW (ระดับน้ำต่ำ)");
        } else {
          Serial.println("📉 STATUS: VERY LOW (ระดับน้ำต่ำมาก)");
        }
      }
    }
    Serial.printf("📶 WiFi RSSI: %d dBm\n", WiFi.RSSI());
    Serial.printf("📶 WiFi SSID: %s\n", WiFi.SSID().c_str());
    Serial.println("----------------------------------------");
    
    sendSensorData(distanceValue, soilValue);
  }
  
  delay(100);
}