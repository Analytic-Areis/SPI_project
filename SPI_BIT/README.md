# SPI FPGA Hardware Implementations (Xilinx Vivado)

This directory contains the FPGA hardware implementations, Xilinx Vivado projects, board constraint files (`cst.xdc`), and precompiled bitstreams for the Scalable SPI Bus Controller.

---

## 🏗️ Hardware Implementations

### 1. `SPI_BIT` (Dynamic Write Length)
- **Top Module**: `fpga_wrapper.v` wrapping `top.v`.
- **Features**:
  - Implements dynamic transfer lengths for write operations via `WRITE_LEN`.
  - Supports 16-bit register map with passcode-protected soft reset.
  - Features a dual 4-digit hexadecimal 7-segment display driver with an 18-bit time-multiplexing counter to display `read_reg` and `write_reg` simultaneously.
  - Onboard status LED indicators mapped to transaction state, mode, and chip select.
- **Constraints**: `cst.xdc` contains physical pin assignments and I/O standard definitions.

### 2. `SPI_ROM` (ROM-Based Heterogeneous Sensor Lookup)
- **Top Module**: `fpga_top.v` wrapping `top.v`.
- **Features**:
  - Employs an on-chip ROM lookup table (`slave_info_rom`) mapping 4-bit sensor addresses to heterogeneous input/output widths and bit offsets.
  - Implements `WHO_AM_I_STATE` (opcode `2'b11`) returning an 8-bit configurable sensor ID parameter (`SENSOR_ID = 8'd9`).
  - Successfully verified in hardware against the alternating bit write sequence (`01010101...` -> `16'hA000`).

---

## 📁 Directory Structure

```
SPI_BIT/
├── README.md                  # This hardware documentation
├── bitstreams/                # Precompiled FPGA bitstream files (.bit)
│   ├── fpga_wrapper.bit       # Bitstream for SPI_BIT implementation
│   └── fpga_top.bit           # Bitstream for SPI_ROM implementation
│
├── SPI_BIT/                   # Xilinx Vivado Project for SPI_BIT
│   ├── SPI_BIT.xpr            # Project file (open in Vivado)
│   └── SPI_BIT.srcs/          # Constraints and Verilog sources
│
├── SPI_ROM/                   # Xilinx Vivado Project for SPI_ROM
│   ├── SPI_ROM.xpr            # Project file (open in Vivado)
│   └── SPI_ROM.srcs/          # Constraints and Verilog sources
│
├── SPI_BIT_Report_Data/       # Standalone source package (top.v, fpga_wrapper.v, cst.xdc)
└── SPI_ROM_Report_Data/       # Standalone source package (top.v, fpga_top.v, cst.xdc)
```

---

## ⚡ Flashing the FPGA

To flash the FPGA directly using Vivado Hardware Manager without recompiling:

```tcl
open_hw_manager
connect_hw_server
open_hw_target

# Program SPI_ROM:
set_property PROGRAM.FILE {bitstreams/fpga_top.bit} [current_hw_device]
program_hw_devices [current_hw_device]
```

To open and modify the project in Vivado:
```bash
vivado SPI_ROM/SPI_ROM.xpr &
```
