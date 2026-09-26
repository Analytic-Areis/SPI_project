# SPI_ROM Project Report Data

This folder contains the essential source files for the `SPI_ROM` project, an advanced SPI slave module that dynamically looks up transaction properties (like register widths and offsets) from an internal ROM. This folder provides everything required to generate a comprehensive report or documentation on the module's design.

## Files Included

1. **`top.v`**: The core logic file, which includes:
   - **`slave_info_rom`**: A small ROM module that stores configurations for various memory addresses (e.g., `in_width`, `out_width`, `in_start`, `out_start`).
   - **`top` (SPI Slave Controller)**: The FSM handling SPI communications. It queries the `slave_info_rom` to determine how many bits to expect/send for a given address and what part of the internal registers to access.
   - A password-protected reset feature (`RESET_PASSWORD` state) to securely clear registers.
   - A `WHO_AM_I_STATE` that returns an 8-bit configurable sensor ID over SPI (using opcode `2'b11`).

2. **`fpga_top.v`**: The FPGA top-level wrapper module. Features include:
   - Instantiation of the `top` SPI slave module.
   - A time-multiplexed driver for an 8-digit (dual 4-digit) 7-segment display showing the current state of read and write registers in hexadecimal format.
   - Status LEDs for monitoring internal FSM states, SPI control signals (CS, MOSI, MISO, SCLK), and reset status.

3. **`cst.xdc`**: The Xilinx Design Constraints (XDC) file containing the physical pin mappings and timing constraints for the target FPGA board.

## AI Instructions for Report Generation
When generating a report for this project, consider focusing on:
- The architecture of separating transaction metadata into a dedicated ROM (`slave_info_rom`) and how it enables dynamic/variable-width SPI transactions.
- The FSM design handling variable-length data phases using the ROM's `in_width` and `out_width` outputs.
- The implementation details of the password-protected reset logic.
- The new `WHO_AM_I` state that allows identifying the sensor dynamically.
- The time-multiplexed 7-segment display logic in `fpga_top.v`.
