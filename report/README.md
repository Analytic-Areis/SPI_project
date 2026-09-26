# Project Publications, Hardware Verification & Experimental Data

This directory contains the academic publications, conference presentations, physical hardware oscilloscope captures, ESP32 master firmware, and the standalone simulation dashboard.

---

## 📁 Directory Structure

```
report/
├── README.md                  # This documentation index
├── spi_report.pdf             # Comprehensive IEEE conference paper (PDF)
├── spi_report.tex             # LaTeX source of the IEEE conference paper
├── images_description.md      # Detailed breakdown of test images & the A000 phenomenon
│
├── images/                    # Physical hardware photos & oscilloscope captures
│   ├── setup.jpeg             # Physical test bench setup
│   ├── 10Mclk-whoami.jpeg     # WHO_AM_I transaction @ 10 MHz SPI clock
│   ├── 50khz_clk-whoami.jpeg  # WHO_AM_I transaction @ 50 kHz SPI clock
│   ├── 50khz_clk_read_sensor_A.jpeg# Sensor read transaction @ 50 kHz
│   ├── 0000.jpg & A000.jpg    # 7-Segment display before & after 010101... write
│   ├── asking_read_MOSI.png   # Scope capture of MOSI read command
│   ├── reciving_read_MISO.png # Scope capture of MISO read data
│   ├── write-1.png, write-2.png# Scope captures of write command sequences
│   └── sim_*.png              # Web UI simulation dashboard screenshots
│
├── ppt/                       # Final Conference Presentation Slides
│   ├── spi_presentation.pdf   # 20-slide technical presentation (PDF)
│   └── spi_presentation.tex   # LaTeX Beamer source code
│
├── spi_esp/                   # ESP32 Master Firmware (PlatformIO)
│   ├── platformio.ini         # PlatformIO target configuration (ESP32 DevKit v1)
│   ├── src/main.cpp           # C++ bit-banging master with HTTP REST & SSE streaming
│   └── web_ui3/               # Responsive dark-mode web control panel
│
└── esp_exp_data/              # Experiment Package & Web Simulator
    ├── README.md              # Experiment package index
    ├── esp_experiment_report.md# Full technical analysis with timing diagrams
    ├── src/main.cpp           # Reference ESP32 firmware
    ├── verilog/top.v          # Reference Verilog slave module
    └── sim_web_ui/            # Standalone browser-based FSM logic analyzer
        ├── index.html         # Interactive UI dashboard
        ├── script.js          # Behavioral Verilog FSM & Canvas waveform engine
        └── style.css          # CSS styling
```

---

## 🌐 Running the Standalone Simulation Web UI

You can interactively simulate the SPI transactions and view live digital waveforms without needing hardware:

```bash
cd esp_exp_data/sim_web_ui
python3 -m http.server 8085
```
Open **[http://localhost:8085](http://localhost:8085)** in your browser and use the experiment presets:
- **Preset 1 (`READ 0x2800`)**: Simulates sensor read command, records `0x2800` on MISO.
- **Preset 2 (`WRITE 0x0028`)**: Updates `write_reg` to `0x0028`.
- **Preset 3 (`WRITE 0xA000`)**: Simulates the alternating `01010101...` bit sequence.
