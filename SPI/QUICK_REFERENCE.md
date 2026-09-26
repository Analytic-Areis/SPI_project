# SPI Bus Controller — Quick Reference

## 🎯 Project Summary

Replace traditional multi-wire SPI (4 wires per slave) with a **shared 3-wire serial bus** using:
- **1-bit DATA_IN** (MCU → System)
- **1-bit DATA_OUT** (System → MCU)
- **CLK** (System clock)
- **CS_N** (Chip select, active-low)

## 📡 Protocol Format

```
| CLK 1-2 | CLK 3-10        | CLK 11-14           |
|---------|-----------------|---------------------|
| MODE    | ADDRESS (8-bit) | DATA (4-bit burst)  |
| (2-bit) | MSB first       | Read: on DATA_OUT   |
|         |                 | Write: on DATA_IN   |
```

### Mode Codes
| Mode | Operation | Total Clocks | Side Effect |
|------|-----------|-------------|-------------|
| `00` | **READ**  | 14          | 🔒 Snapshot all sensor outputs |
| `01` | **WRITE** | 14          | Update sensor inputs |
| `10` | **RESET** | 2           | Clear all registers |
| `11` | Reserved  | —           | NOP |

## 🗺️ Memory Map (per sensor = 9 addresses)

```
Sensor 0: 0x00-0x04 (Input, 5 regs)  |  0x05-0x08 (Output, 4 regs 🔒)
Sensor 1: 0x09-0x0D (Input, 5 regs)  |  0x0E-0x11 (Output, 4 regs 🔒)
Sensor 2: 0x12-0x16 (Input, 5 regs)  |  0x17-0x1A (Output, 4 regs 🔒)
...
Max 28 sensors in 256 addresses
```

## 🔒 Snapshot Mechanism

1. Sensors continuously update **live registers**
2. When READ mode (`00`) is detected → **snapshot_en** asserts
3. All sensor output values are latched into **shadow registers**
4. Reads come from shadow (frozen) — prevents mid-read corruption
5. Shadow stays frozen until the next READ command

## 🏗️ Module Hierarchy

```
spi_bus_top
├── fsm_controller        — State machine (IDLE→MODE→ADDR→DATA)
├── shift_register        — Serial ↔ Parallel conversion
├── address_decoder       — 8-bit addr → sensor + register mapping
├── register_file         — 256 × 1-bit storage array
├── snapshot_controller   — Shadow register latch logic
└── sensor_interface      — Parallel bus to physical sensors
```

## 🔄 FSM States

```
IDLE → RECV_MODE(2 clk) → decode:
  ├─ 00 → snapshot → RECV_ADDR(8 clk) → READ_DATA(4 clk) → IDLE
  ├─ 01 → RECV_ADDR(8 clk) → WRITE_DATA(4 clk) → IDLE
  └─ 10 → RESET_ALL → IDLE
```

## 📅 5-Phase Roadmap

| Phase | Focus | Duration | Key Deliverables |
|-------|-------|----------|-----------------|
| 1 | Verilog Basics + Shift Register | Week 1-2 | `shift_register.v` + testbench |
| 2 | FSM + Address Decoder | Week 3-4 | `fsm_controller.v` + `address_decoder.v` |
| 3 | Register File + Snapshot | Week 5-6 | `register_file.v` + `snapshot_controller.v` |
| 4 | Integration + System Test | Week 7-8 | `spi_bus_top.v` + full testbench |
| 5 | FPGA Synthesis + Demo | Week 9-10 | Working hardware demo |

## 🛠️ Tools

- **Simulator**: Icarus Verilog (`iverilog`) — free, open source
- **Waveforms**: GTKWave — view VCD files
- **FPGA**: Vivado (Xilinx) or Quartus (Intel) — free editions available
- **MCU**: Arduino/STM32 for bit-banging the serial protocol

## 📁 File Structure

```
SPI_Bus_Controller/
├── docs/          — Documentation
├── rtl/           — Synthesizable Verilog modules
├── tb/            — Testbenches + mock sensor
├── sim/           — Makefile + VCD outputs
└── synth/         — FPGA constraints + scripts
```
