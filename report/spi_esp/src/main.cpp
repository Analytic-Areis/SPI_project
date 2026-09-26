#include <Arduino.h>
#include <WiFi.h>

// Pin definitions
#define MOSI_PIN 23
#define CLK_PIN  18
#define RST_PIN  19
#define CS_PIN   5
#define MISO_PIN 25  // Input only, safe

// WiFi Credentials
const char* ssid     = "Loading..";
const char* password = "12345678";

// Live pin state tracking
volatile bool cs_val   = true;   // Active-low, starts HIGH (idle)
volatile bool rst_val  = false;  // Active-high, starts LOW (run)
volatile bool mosi_val = false;  // Starts LOW (0)
volatile bool clk_val  = false;  // Toggled by auto-clock generator
volatile bool auto_clk = true;   // Automatic clock active by default
volatile double clk_freq = 0.2;  // Clock frequency in Hz
volatile unsigned long clk_half_period_ms = 2500; // Half period in ms

// Timing variables
unsigned long lastClkToggle = 0;
unsigned long lastSampleTime = 0;

// HTTP Server variables
WiFiServer server(80);
const int MAX_CLIENTS = 4;
WiFiClient sseClients[MAX_CLIENTS];

// Helper to extract query parameters
String getQueryParam(String req, String param) {
    int idx = req.indexOf(param + "=");
    if (idx == -1) return "";
    int start = idx + param.length() + 1;
    int end = req.indexOf("&", start);
    if (end == -1) {
        end = req.indexOf(" ", start);
    }
    if (end == -1) return req.substring(start);
    return req.substring(start, end);
}

// Helper to delay accurately without causing watchdogs
void smartDelayUs(unsigned long us) {
    if (us >= 16000) {
        delay(us / 1000);
        delayMicroseconds(us % 1000);
    } else {
        delayMicroseconds(us);
    }
}

// Helper function to handle clients and routing
void handleNewClient(WiFiClient client) {
    unsigned long timeout = millis() + 200;
    while (client.connected() && !client.available() && millis() < timeout) {
        delay(1);
    }
    
    if (!client.available()) {
        client.stop();
        return;
    }
    
    String req = client.readStringUntil('\r');
    client.flush();
    
    if (req.indexOf("GET / ") >= 0 || req.indexOf("GET /index.html") >= 0) {
        // Send a tiny, lightweight HTML response directing to open local UI
        String ipStr = WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
        
        client.println("HTTP/1.1 200 OK");
        client.println("Content-Type: text/html");
        client.println("Connection: close");
        client.println();
        client.println("<!DOCTYPE html><html>");
        client.println("<head><title>SPI Analyzer Backend</title></head>");
        client.println("<body style=\"font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:50px 20px;background:#0b0f19;color:#f8fafc;\">");
        client.println("<div style=\"max-width:500px;margin:0 auto;background:rgba(22,28,45,0.6);border:1px solid rgba(255,255,255,0.08);padding:30px;border-radius:16px;\">");
        client.println("<h2 style=\"color:#00f0ff;margin-bottom:15px;\">SPI Core Analyzer is Running</h2>");
        client.println("<p style=\"color:#94a3b8;font-size:1.05rem;line-height:1.6;\">The ESP32 backend is running successfully.</p>");
        client.println("<p style=\"color:#94a3b8;font-size:1.05rem;line-height:1.6;\">Please open the local <strong>web_ui2/index.html</strong> file in your browser and connect to: <br>");
        client.println("<code style=\"display:inline-block;margin-top:10px;padding:8px 16px;background:rgba(0,0,0,0.3);border-radius:8px;color:#39ff14;font-size:1.2rem;\">" + ipStr + "</code></p>");
        client.println("</div></body></html>");
        client.stop();
    } 
    else if (req.indexOf("GET /api/control") >= 0) {
        String csStr = getQueryParam(req, "cs");
        String rstStr = getQueryParam(req, "rst");
        String mosiStr = getQueryParam(req, "mosi");
        String clkStr = getQueryParam(req, "clk");
        String autoClkStr = getQueryParam(req, "auto_clk");
        String freqStr = getQueryParam(req, "freq");
        
        if (csStr != "") {
            cs_val = (csStr == "1");
            digitalWrite(CS_PIN, cs_val ? HIGH : LOW);
        }
        if (rstStr != "") {
            rst_val = (rstStr == "1");
            digitalWrite(RST_PIN, rst_val ? HIGH : LOW);
        }
        if (mosiStr != "") {
            mosi_val = (mosiStr == "1");
            digitalWrite(MOSI_PIN, mosi_val ? HIGH : LOW);
        }
        if (clkStr != "") {
            clk_val = (clkStr == "1");
            digitalWrite(CLK_PIN, clk_val ? HIGH : LOW);
        }
        if (autoClkStr != "") {
            auto_clk = (autoClkStr == "1");
        }
        if (freqStr != "") {
            double freqVal = freqStr.toFloat();
            if (freqVal > 0) {
                clk_freq = freqVal;
                clk_half_period_ms = (unsigned long)(500.0 / clk_freq);
                if (clk_half_period_ms < 1) clk_half_period_ms = 1;
            }
        }
        
        client.println("HTTP/1.1 200 OK");
        client.println("Content-Type: application/json");
        client.println("Access-Control-Allow-Origin: *");
        client.println("Connection: close");
        client.println();
        client.println("{\"status\":\"ok\",\"cs\":" + String(cs_val ? 1 : 0) + 
                       ",\"rst\":" + String(rst_val ? 1 : 0) + 
                       ",\"mosi\":" + String(mosi_val ? 1 : 0) + 
                       ",\"clk\":" + String(clk_val ? 1 : 0) + 
                       ",\"auto_clk\":" + String(auto_clk ? 1 : 0) + 
                       ",\"freq\":" + String(clk_freq) + "}");
        client.stop();
    } 
    else if (req.indexOf("GET /api/sequence") >= 0) {
        String nStr = getQueryParam(req, "n");
        String mosiSeq = getQueryParam(req, "mosi");
        String csSeq = getQueryParam(req, "cs");
        String rstSeq = getQueryParam(req, "rst");
        String csActiveStr = getQueryParam(req, "cs_active");
        String freqStr = getQueryParam(req, "freq");
        
        int n = nStr.toInt();
        bool cs_active = (csActiveStr == "1");
        double freq = freqStr.toFloat();
        if (freq <= 0) freq = 1.0; // fallback
        
        // Disable auto clock during sequence
        bool old_auto_clk = auto_clk;
        auto_clk = false;
        
        // Initialize lines to default active state
        digitalWrite(CS_PIN, cs_active ? HIGH : LOW);
        cs_val = cs_active;
        
        // Prepare clock period
        // Half cycle is 500000 / freq microseconds.
        unsigned long half_period_us = (unsigned long)(500000.0 / freq);
        
        String misoSeq = "";
        
        // Start with CLK at idle state (LOW)
        clk_val = false;
        digitalWrite(CLK_PIN, LOW);
        smartDelayUs(half_period_us);
        
        for (int i = 0; i < n; i++) {
            // Get current MOSI bit
            bool mosi_bit = false;
            if (i < mosiSeq.length()) {
                mosi_bit = (mosiSeq.charAt(i) == '1');
            }
            digitalWrite(MOSI_PIN, mosi_bit ? HIGH : LOW);
            mosi_val = mosi_bit;
            
            // Get current CS bit
            bool cs_bit = cs_active;
            if (i < csSeq.length()) {
                cs_bit = (csSeq.charAt(i) == '1');
            }
            digitalWrite(CS_PIN, cs_bit ? HIGH : LOW);
            cs_val = cs_bit;
            
            // Get current RST bit
            bool rst_bit = false;
            if (i < rstSeq.length()) {
                rst_bit = (rstSeq.charAt(i) == '1');
            }
            digitalWrite(RST_PIN, rst_bit ? HIGH : LOW);
            rst_val = rst_bit;
            
            // Wait half of the low cycle before rising edge
            smartDelayUs(half_period_us / 2);
            
            // Clock goes HIGH (rising edge)
            clk_val = true;
            digitalWrite(CLK_PIN, HIGH);
            
            // Wait at HIGH state
            smartDelayUs(half_period_us);
            
            // Clock goes LOW (falling edge / neg edge)
            clk_val = false;
            digitalWrite(CLK_PIN, LOW);
            
            // Sample MISO at negative edge
            bool miso_bit = digitalRead(MISO_PIN);
            misoSeq += (miso_bit ? "1" : "0");
            
            // Wait half of the low cycle after negative edge
            smartDelayUs(half_period_us / 2);
        }
        
        // Deassert CS (Idle state is opposite of active state)
        digitalWrite(CS_PIN, cs_active ? LOW : HIGH);
        cs_val = !cs_active;
        
        // Restore auto clk state
        auto_clk = old_auto_clk;
        
        client.println("HTTP/1.1 200 OK");
        client.println("Content-Type: application/json");
        client.println("Access-Control-Allow-Origin: *");
        client.println("Connection: close");
        client.println();
        client.println("{\"status\":\"ok\",\"miso\":\"" + misoSeq + "\"}");
        client.stop();
    } 
    else if (req.indexOf("GET /api/stream") >= 0) {
        bool added = false;
        for (int i = 0; i < MAX_CLIENTS; i++) {
            if (!sseClients[i]) {
                sseClients[i] = client;
                added = true;
                break;
            }
        }
        
        if (added) {
            client.println("HTTP/1.1 200 OK");
            client.println("Content-Type: text/event-stream");
            client.println("Cache-Control: no-cache");
            client.println("Connection: keep-alive");
            client.println("Access-Control-Allow-Origin: *");
            client.println();
            client.flush();
            Serial.println("New Web Analyzer client connected via SSE.");
        } else {
            client.println("HTTP/1.1 503 Service Unavailable");
            client.println("Connection: close");
            client.println();
            client.stop();
            Serial.println("SSE client rejected: Max clients reached.");
        }
    } 
    else {
        client.println("HTTP/1.1 404 Not Found");
        client.println("Connection: close");
        client.println();
        client.stop();
    }
}

void setup() {
    Serial.begin(115200);
    delay(100);
    
    Serial.println("\nInitializing SPI Pin configurations...");
    pinMode(CS_PIN, OUTPUT);
    pinMode(CLK_PIN, OUTPUT);
    pinMode(RST_PIN, OUTPUT);
    pinMode(MOSI_PIN, OUTPUT);
    pinMode(MISO_PIN, INPUT);
    
    digitalWrite(CS_PIN, cs_val ? HIGH : LOW);
    digitalWrite(CLK_PIN, clk_val ? HIGH : LOW);
    digitalWrite(RST_PIN, rst_val ? HIGH : LOW);
    digitalWrite(MOSI_PIN, mosi_val ? HIGH : LOW);
    
    Serial.printf("Connecting to SSID: %s ", ssid);
    WiFi.begin(ssid, password);
    
    int attempt = 0;
    while (WiFi.status() != WL_CONNECTED && attempt < 30) {
        delay(500);
        Serial.print(".");
        attempt++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi connected successfully!");
        Serial.print("Local IP Address: http://");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("\nWiFi connection failed! Starting AP mode fallback...");
        WiFi.softAP("ESP32-SPI-Control", "12345678");
        Serial.print("Access Point IP: http://");
        Serial.println(WiFi.softAPIP());
    }
    
    server.begin();
    Serial.println("HTTP Server started on port 80.");
    
    lastClkToggle = millis();
    lastSampleTime = millis();
}

void loop() {
    WiFiClient newClient = server.available();
    if (newClient) {
        handleNewClient(newClient);
    }
    
    unsigned long now = millis();
    
    if (auto_clk && (now - lastClkToggle >= clk_half_period_ms)) {
        lastClkToggle = now;
        clk_val = !clk_val;
        digitalWrite(CLK_PIN, clk_val ? HIGH : LOW);
    }
    
    if (now - lastSampleTime >= 50) {
        lastSampleTime = now;
        
        bool currentMiso = digitalRead(MISO_PIN);
        
        String sseMsg = "data: {\"cs\":" + String(cs_val ? 1 : 0) + 
                        ",\"clk\":" + String(clk_val ? 1 : 0) + 
                        ",\"rst\":" + String(rst_val ? 1 : 0) + 
                        ",\"miso\":" + String(currentMiso ? 1 : 0) + 
                        ",\"mosi\":" + String(mosi_val ? 1 : 0) + "}\n\n";
        
        for (int i = 0; i < MAX_CLIENTS; i++) {
            if (sseClients[i]) {
                if (sseClients[i].connected()) {
                    sseClients[i].print(sseMsg);
                } else {
                    sseClients[i].stop();
                    sseClients[i] = WiFiClient();
                    Serial.println("SSE Client disconnected.");
                }
            }
        }
    }
}