# ESP32 & FPGA SPI ROM Experiment Package (`esp_exp_data`)

This directory contains the complete experiment documentation, simulation web interface, physical oscilloscope captures, and simulated UI screenshots for the SPI ROM control experiment.

## Directory Structure

```
esp_exp_data/
├── README.md                      # Directory index & guide
├── esp_experiment_report.md        # Comprehensive technical report with diagrams & bit breakdowns
├── sim_web_ui/                    # Standalone FPGA top.v FSM Simulation Web UI
│   ├── index.html                 # Interactive Web UI dashboard
│   ├── script.js                  # top.v Verilog FSM simulator & Canvas logic analyzer
│   └── style.css                  # Modern dark-mode styling
├── src/
│   └── main.cpp                   # ESP32 C++ firmware (bit-banging, HTTP REST, SSE stream)
├── verilog/
│   └── top.v                      # FPGA Verilog SPI Slave top module & FSM
└── (images stored centrally in ../images/)
```

## How to Run the Simulation Web UI Locally

1. Open a terminal inside `esp_exp_data/sim_web_ui/`.
2. Start a local HTTP server:
   ```bash
   python3 -m http.server 8085
   ```
3. Open your web browser and navigate to:
   [http://localhost:8085](http://localhost:8085)
4. Use the **Experiment Presets** buttons on the left panel to simulate READ (`0x2800`), WRITE (`0x0028`), and WRITE (`0xA000`) transactions directly in your browser.
