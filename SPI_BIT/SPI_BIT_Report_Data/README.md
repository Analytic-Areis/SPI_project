# SPI_BIT Project Report Data

This folder contains the essential source files for the `SPI_BIT` project, which implements a custom SPI slave module with extended functionalities. This folder provides everything required to generate a comprehensive report or documentation on the module's architecture and design.

## Files Included

1. **`top.v`**: The core SPI slave logic. Features include:
   - Command decoding for reading, writing, soft reset, and a "WHOAMI" (ID read) instruction.
   - Dynamic transfer lengths for SPI write operations (`WRITE_LEN`).
   - State machine handling the transaction protocol (Detect, Address Phase, Data Phase, etc.).
   - Dual-register map structure: a 16-bit read-only register (fed by `sensor_data`) and a 16-bit writeable register.

2. **`fpga_wrapper.v`**: The FPGA top-level wrapper module. Features include:
   - Instantiation of the `top` SPI slave module.
   - An 18-bit free-running counter used for time-multiplexing 7-segment displays.
   - Dual 4-digit hexadecimal 7-segment display drivers to visually display the contents of the `read_reg` and `write_reg` simultaneously.
   - Status indicators mapped to onboard LEDs (e.g., active state, mode, chip select).

3. **`cst.xdc`**: The Xilinx Design Constraints (XDC) file containing the physical pin mappings and timing constraints for the target FPGA board.

## AI Instructions for Report Generation
When generating a report for this project, consider focusing on:
- The finite state machine (FSM) implemented in `top.v` for handling SPI transactions.
- The use of dynamic length decoding for writes.
- The time-multiplexing logic in `fpga_wrapper.v` for driving the dual 7-segment displays.
- Hardware mapping and constraints based on `cst.xdc`.
