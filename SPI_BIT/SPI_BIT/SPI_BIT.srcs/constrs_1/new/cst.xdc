## ==============================================================================
## Xilinx Vivado Constraints File (`cst.xdc`) for `fpga_wrapper`
## Target Board: Real Digital Boolean Board (Xilinx Spartan-7 xc7s50csga324-1)
## ==============================================================================

## Configure unused pins behavior during bitstream generation
set_property BITSTREAM.CONFIG.UNUSEDPIN Pullnone [current_design]

## ------------------------------------------------------------------------------
## 1. System Clock (100 MHz oscillator on pin F14)
##    Used for 7-segment display time-multiplexing refresh
## ------------------------------------------------------------------------------
set_property -dict { PACKAGE_PIN F14 IOSTANDARD LVCMOS33 } [get_ports clk]
create_clock -period 10.000 -name sys_clk_pin -waveform {0.000 5.000} -add [get_ports clk]

## ------------------------------------------------------------------------------
## 2. 16 DIP Switches (`sw[15:0]`) -> SW0 to SW15 on Boolean Board
##    Connected to `sensor_data` (which populates read-only `read_reg[15:0]`)
## ------------------------------------------------------------------------------
set_property -dict { PACKAGE_PIN V2 IOSTANDARD LVCMOS33 } [get_ports { sw[0] }]
set_property -dict { PACKAGE_PIN U2 IOSTANDARD LVCMOS33 } [get_ports { sw[1] }]
set_property -dict { PACKAGE_PIN U1 IOSTANDARD LVCMOS33 } [get_ports { sw[2] }]
set_property -dict { PACKAGE_PIN T2 IOSTANDARD LVCMOS33 } [get_ports { sw[3] }]
set_property -dict { PACKAGE_PIN T1 IOSTANDARD LVCMOS33 } [get_ports { sw[4] }]
set_property -dict { PACKAGE_PIN R2 IOSTANDARD LVCMOS33 } [get_ports { sw[5] }]
set_property -dict { PACKAGE_PIN R1 IOSTANDARD LVCMOS33 } [get_ports { sw[6] }]
set_property -dict { PACKAGE_PIN P2 IOSTANDARD LVCMOS33 } [get_ports { sw[7] }]
set_property -dict { PACKAGE_PIN P1 IOSTANDARD LVCMOS33 } [get_ports { sw[8] }]
set_property -dict { PACKAGE_PIN N2 IOSTANDARD LVCMOS33 } [get_ports { sw[9] }]
set_property -dict { PACKAGE_PIN N1 IOSTANDARD LVCMOS33 } [get_ports { sw[10] }]
set_property -dict { PACKAGE_PIN M2 IOSTANDARD LVCMOS33 } [get_ports { sw[11] }]
set_property -dict { PACKAGE_PIN M1 IOSTANDARD LVCMOS33 } [get_ports { sw[12] }]
set_property -dict { PACKAGE_PIN L1 IOSTANDARD LVCMOS33 } [get_ports { sw[13] }]
set_property -dict { PACKAGE_PIN K2 IOSTANDARD LVCMOS33 } [get_ports { sw[14] }]
set_property -dict { PACKAGE_PIN K1 IOSTANDARD LVCMOS33 } [get_ports { sw[15] }]

## ------------------------------------------------------------------------------
## 3. 4-Digit Display D0 (`read_data` / `read_reg[15:0]` in Hex) - Left Display
## ------------------------------------------------------------------------------
# Anodes D0_a0 to D0_a3
set_property -dict { PACKAGE_PIN D5 IOSTANDARD LVCMOS33 } [get_ports { d0_a[0] }]
set_property -dict { PACKAGE_PIN C4 IOSTANDARD LVCMOS33 } [get_ports { d0_a[1] }]
set_property -dict { PACKAGE_PIN C7 IOSTANDARD LVCMOS33 } [get_ports { d0_a[2] }]
set_property -dict { PACKAGE_PIN A8 IOSTANDARD LVCMOS33 } [get_ports { d0_a[3] }]

# Cathodes D0_seg0 to D0_seg7 (seg0=a, seg1=b, seg2=c, seg3=d, seg4=e, seg5=f, seg6=g, seg7=dp)
set_property -dict { PACKAGE_PIN D7 IOSTANDARD LVCMOS33 } [get_ports { d0_seg[0] }]
set_property -dict { PACKAGE_PIN C5 IOSTANDARD LVCMOS33 } [get_ports { d0_seg[1] }]
set_property -dict { PACKAGE_PIN A5 IOSTANDARD LVCMOS33 } [get_ports { d0_seg[2] }]
set_property -dict { PACKAGE_PIN B7 IOSTANDARD LVCMOS33 } [get_ports { d0_seg[3] }]
set_property -dict { PACKAGE_PIN A7 IOSTANDARD LVCMOS33 } [get_ports { d0_seg[4] }]
set_property -dict { PACKAGE_PIN D6 IOSTANDARD LVCMOS33 } [get_ports { d0_seg[5] }]
set_property -dict { PACKAGE_PIN B5 IOSTANDARD LVCMOS33 } [get_ports { d0_seg[6] }]
set_property -dict { PACKAGE_PIN A6 IOSTANDARD LVCMOS33 } [get_ports { d0_seg[7] }]

## ------------------------------------------------------------------------------
## 4. 4-Digit Display D1 (`write_data` / `write_reg[15:0]` in Hex) - Right Display
## ------------------------------------------------------------------------------
# Anodes D1_a0 to D1_a3
set_property -dict { PACKAGE_PIN H3 IOSTANDARD LVCMOS33 } [get_ports { d1_a[0] }]
set_property -dict { PACKAGE_PIN J4 IOSTANDARD LVCMOS33 } [get_ports { d1_a[1] }]
set_property -dict { PACKAGE_PIN F3 IOSTANDARD LVCMOS33 } [get_ports { d1_a[2] }]
set_property -dict { PACKAGE_PIN E4 IOSTANDARD LVCMOS33 } [get_ports { d1_a[3] }]

# Cathodes D1_seg0 to D1_seg7 (seg0=a, seg1=b, seg2=c, seg3=d, seg4=e, seg5=f, seg6=g, seg7=dp)
set_property -dict { PACKAGE_PIN F4 IOSTANDARD LVCMOS33 } [get_ports { d1_seg[0] }]
set_property -dict { PACKAGE_PIN J3 IOSTANDARD LVCMOS33 } [get_ports { d1_seg[1] }]
set_property -dict { PACKAGE_PIN D2 IOSTANDARD LVCMOS33 } [get_ports { d1_seg[2] }]
set_property -dict { PACKAGE_PIN C2 IOSTANDARD LVCMOS33 } [get_ports { d1_seg[3] }]
set_property -dict { PACKAGE_PIN B1 IOSTANDARD LVCMOS33 } [get_ports { d1_seg[4] }]
set_property -dict { PACKAGE_PIN H4 IOSTANDARD LVCMOS33 } [get_ports { d1_seg[5] }]
set_property -dict { PACKAGE_PIN D1 IOSTANDARD LVCMOS33 } [get_ports { d1_seg[6] }]
set_property -dict { PACKAGE_PIN C1 IOSTANDARD LVCMOS33 } [get_ports { d1_seg[7] }]

## ------------------------------------------------------------------------------
## 5. SPI Signals & Core Controls (`MoSi`, `Sclk`, `rst`, `sel`, `MiSo`)
##    Replace the PMOD / GPIO header package pin placeholders below with the exact
##    pins where your SPI master is connected.
## ------------------------------------------------------------------------------
## GPIO Header Pins on Boolean Board mapped for ESP32/ESP8266 SPI Master connection:
set_property -dict { PACKAGE_PIN B13 IOSTANDARD LVCMOS33 } [get_ports sel]
set_property -dict { PACKAGE_PIN E12 IOSTANDARD LVCMOS33 } [get_ports Sclk]
set_property -dict { PACKAGE_PIN A13 IOSTANDARD LVCMOS33 } [get_ports MoSi]
set_property -dict { PACKAGE_PIN C14 IOSTANDARD LVCMOS33 } [get_ports MiSo]
set_property -dict { PACKAGE_PIN A14 IOSTANDARD LVCMOS33 } [get_ports rst]

set_property CLOCK_DEDICATED_ROUTE FALSE [get_nets Sclk_IBUF]


## ------------------------------------------------------------------------------
## ------------------------------------------------------------------------------
## 6. LED Status Monitoring (`cs`/`sel`, `Sclk`, `rst`, `MiSo`, `MoSi`, and `mode[1:0]`)
##    Mapped to onboard LEDs LED0 through LED6 on the Boolean Board
## ------------------------------------------------------------------------------
set_property -dict { PACKAGE_PIN A4 IOSTANDARD LVCMOS33 } [get_ports led_cs]
set_property -dict { PACKAGE_PIN B4 IOSTANDARD LVCMOS33 } [get_ports led_Sclk]
set_property -dict { PACKAGE_PIN A3 IOSTANDARD LVCMOS33 } [get_ports led_rst]
set_property -dict { PACKAGE_PIN B3 IOSTANDARD LVCMOS33 } [get_ports led_MiSo]
set_property -dict { PACKAGE_PIN A2 IOSTANDARD LVCMOS33 } [get_ports led_MoSi]
set_property -dict { PACKAGE_PIN E6 IOSTANDARD LVCMOS33 } [get_ports { led_mode[0] }]
set_property -dict { PACKAGE_PIN C3 IOSTANDARD LVCMOS33 } [get_ports { led_mode[1] }]

set_property CLOCK_DEDICATED_ROUTE FALSE [get_nets led_Sclk_OBUF]

## ------------------------------------------------------------------------------
## 7. FSM State Monitoring (`led_state[3:0]`) mapped to last 4 LEDs (G1, G2, F1, F2)
## ------------------------------------------------------------------------------
set_property -dict { PACKAGE_PIN G1 IOSTANDARD LVCMOS33 } [get_ports { led_state[0] }]
set_property -dict { PACKAGE_PIN G2 IOSTANDARD LVCMOS33 } [get_ports { led_state[1] }]
set_property -dict { PACKAGE_PIN F1 IOSTANDARD LVCMOS33 } [get_ports { led_state[2] }]
set_property -dict { PACKAGE_PIN F2 IOSTANDARD LVCMOS33 } [get_ports { led_state[3] }]
