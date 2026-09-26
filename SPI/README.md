# SPI Bus Controller — RTL Architecture & Simulation

This directory contains the register-transfer level (RTL) evolution of the Scalable SPI Bus Controller, progressing from foundational shift-register test modules to a fully integrated Clock Domain Crossing (CDC) architecture.

---

## 📁 Directory Contents

- **`32-reg-system/`**: Core Verilog source files and testbenches organized by developmental version:
  - `v1.v` & `tb_v1.v`: Baseline SPI slave receiver (shift register + command decode).
  - `v2.v` & `tb_v2.v`: Added multi-sensor address decoding and live register bank.
  - `v3.v` & `tb_v3.v`: Introduced atomic shadow register latching (snapshot controller) to prevent read race conditions.
  - `v4.v` & `tb_v4.v`: Full 32-register system supporting dynamic sensor widths, passcode soft reset, and handshake signaling.
  - `cdc-integration/`:
    - `async_fifo.v`: Dual-clock asynchronous FIFO using Gray-code pointer synchronization.
    - `system_top.v`: Top-level integration connecting the SPI bus domain (`sclk`) with the system domain (`sys_clk`).
    - `v4.v`: Slave controller instantiated inside the CDC system.
- **`QUICK_REFERENCE.md`**: Compact reference guide detailing the 3-wire protocol timing, mode opcodes, and memory address mapping.
- **`SPI_Bus_Project_Plan.html`**: Interactive roadmap and project plan dashboard.
- **`SPI_Protocol_Overview.pptx`**: PowerPoint presentation summarizing the architecture and motivation.
- **`spi_report.pdf` & `spi_presentation.pdf`**: Preliminary design report and presentation slides (July 2026 milestone).

---

## 🧪 How to Simulate

Simulate any revision using Icarus Verilog:

```bash
cd 32-reg-system

# Example: Simulate Version 4
iverilog -o tb_v4 tb_v4.v v4.v
vvp tb_v4

# View waveforms in GTKWave
gtkwave tb_v4.vcd
```
