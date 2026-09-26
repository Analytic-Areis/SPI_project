# =========================================================================
# Vivado Master Constraints File (cst.xdc)
# Target FPGA Part: xc7s50csga324-1 (Xilinx Spartan-7 50T / Boolean Board)
# =========================================================================

# Configure unused pins behavior during bitstream generation
set_property BITSTREAM.CONFIG.UNUSEDPIN Pullnone [current_design]

# -------------------------------------------------------------------------
# 1. System Clock (100 MHz oscillator)
# -------------------------------------------------------------------------
set_property PACKAGE_PIN F14 [get_ports clk]
set_property IOSTANDARD LVCMOS33 [get_ports clk]
set_property CLOCK_DEDICATED_ROUTE FALSE [get_nets clk_IBUF]
create_clock -period 10.000 -name sys_clk_pin -waveform {0.000 5.000} -add [get_ports clk]

# -------------------------------------------------------------------------
# 2. 16 DIP Switches (dip_sw[15:0]) -> SW0 to SW15
# -------------------------------------------------------------------------
set_property PACKAGE_PIN V2 [get_ports {dip_sw[0]}]
set_property PACKAGE_PIN U2 [get_ports {dip_sw[1]}]
set_property PACKAGE_PIN U1 [get_ports {dip_sw[2]}]
set_property PACKAGE_PIN T2 [get_ports {dip_sw[3]}]
set_property PACKAGE_PIN T1 [get_ports {dip_sw[4]}]
set_property PACKAGE_PIN R2 [get_ports {dip_sw[5]}]
set_property PACKAGE_PIN R1 [get_ports {dip_sw[6]}]
set_property PACKAGE_PIN P2 [get_ports {dip_sw[7]}]
set_property PACKAGE_PIN P1 [get_ports {dip_sw[8]}]
set_property PACKAGE_PIN N2 [get_ports {dip_sw[9]}]
set_property PACKAGE_PIN N1 [get_ports {dip_sw[10]}]
set_property PACKAGE_PIN M2 [get_ports {dip_sw[11]}]
set_property PACKAGE_PIN M1 [get_ports {dip_sw[12]}]
set_property PACKAGE_PIN L1 [get_ports {dip_sw[13]}]
set_property PACKAGE_PIN K2 [get_ports {dip_sw[14]}]
set_property PACKAGE_PIN K1 [get_ports {dip_sw[15]}]

set_property IOSTANDARD LVCMOS33 [get_ports {dip_sw[*]}]

# -------------------------------------------------------------------------
# 3. 4-Digit Display D0 (read_reg[15:0] in Hex) - Anodes & Cathodes
# -------------------------------------------------------------------------
# Anodes D0_a0 to D0_a3
set_property PACKAGE_PIN D5 [get_ports {d0_a[0]}]
set_property PACKAGE_PIN C4 [get_ports {d0_a[1]}]
set_property PACKAGE_PIN C7 [get_ports {d0_a[2]}]
set_property PACKAGE_PIN A8 [get_ports {d0_a[3]}]
set_property IOSTANDARD LVCMOS33 [get_ports {d0_a[*]}]

# Cathodes D0_seg0 to D0_seg7 (seg0=a, seg1=b, seg2=c, seg3=d, seg4=e, seg5=f, seg6=g, seg7=dp)
set_property PACKAGE_PIN D7 [get_ports {d0_seg[0]}]
set_property PACKAGE_PIN C5 [get_ports {d0_seg[1]}]
set_property PACKAGE_PIN A5 [get_ports {d0_seg[2]}]
set_property PACKAGE_PIN B7 [get_ports {d0_seg[3]}]
set_property PACKAGE_PIN A7 [get_ports {d0_seg[4]}]
set_property PACKAGE_PIN D6 [get_ports {d0_seg[5]}]
set_property PACKAGE_PIN B5 [get_ports {d0_seg[6]}]
set_property PACKAGE_PIN A6 [get_ports {d0_seg[7]}]
set_property IOSTANDARD LVCMOS33 [get_ports {d0_seg[*]}]

# -------------------------------------------------------------------------
# 4. 4-Digit Display D1 (write_reg[15:0] in Hex) - Anodes & Cathodes
# -------------------------------------------------------------------------
# Anodes D1_a0 to D1_a3
set_property PACKAGE_PIN H3 [get_ports {d1_a[0]}]
set_property PACKAGE_PIN J4 [get_ports {d1_a[1]}]
set_property PACKAGE_PIN F3 [get_ports {d1_a[2]}]
set_property PACKAGE_PIN E4 [get_ports {d1_a[3]}]
set_property IOSTANDARD LVCMOS33 [get_ports {d1_a[*]}]

# Cathodes D1_seg0 to D1_seg7 (seg0=a, seg1=b, seg2=c, seg3=d, seg4=e, seg5=f, seg6=g, seg7=dp)
set_property PACKAGE_PIN F4 [get_ports {d1_seg[0]}]
set_property PACKAGE_PIN J3 [get_ports {d1_seg[1]}]
set_property PACKAGE_PIN D2 [get_ports {d1_seg[2]}]
set_property PACKAGE_PIN C2 [get_ports {d1_seg[3]}]
set_property PACKAGE_PIN B1 [get_ports {d1_seg[4]}]
set_property PACKAGE_PIN H4 [get_ports {d1_seg[5]}]
set_property PACKAGE_PIN D1 [get_ports {d1_seg[6]}]
set_property PACKAGE_PIN C1 [get_ports {d1_seg[7]}]
set_property IOSTANDARD LVCMOS33 [get_ports {d1_seg[*]}]

# -------------------------------------------------------------------------
# 5. LED Status Monitoring (cs, Sclk, rst, MiSo, MoSi, and mode[1:0])
#    Mapped to LEDs LED0 through LED6 on the FPGA board
# -------------------------------------------------------------------------
set_property PACKAGE_PIN A4 [get_ports led_cs]
set_property PACKAGE_PIN B4 [get_ports led_Sclk]
set_property PACKAGE_PIN A3 [get_ports led_rst]
set_property PACKAGE_PIN B3 [get_ports led_MiSo]
set_property PACKAGE_PIN A2 [get_ports led_MoSi]
set_property PACKAGE_PIN E6 [get_ports {led_mode[0]}]
set_property PACKAGE_PIN C3 [get_ports {led_mode[1]}]

set_property IOSTANDARD LVCMOS33 [get_ports led_cs]
set_property IOSTANDARD LVCMOS33 [get_ports led_Sclk]
set_property IOSTANDARD LVCMOS33 [get_ports led_rst]
set_property IOSTANDARD LVCMOS33 [get_ports led_MiSo]
set_property IOSTANDARD LVCMOS33 [get_ports led_MoSi]
set_property IOSTANDARD LVCMOS33 [get_ports {led_mode[*]}]

# -------------------------------------------------------------------------
# 6. External SPI & Control Pins (MoSi, Sclk, rst, cs, MiSo)
#    NOTE: Replace the package pin numbers below with the physical PMOD / GPIO header
#    pins or buttons where your external SPI master (microcontroller / programmer) connects.
# -------------------------------------------------------------------------
# Example using PMOD Header A / Buttons:
set_property PACKAGE_PIN B13 [get_ports cs]
set_property PACKAGE_PIN E12 [get_ports Sclk]
set_property PACKAGE_PIN A13 [get_ports MoSi]
set_property PACKAGE_PIN C14 [get_ports MiSo]
set_property PACKAGE_PIN A14  [get_ports rst]

set_property IOSTANDARD LVCMOS33 [get_ports cs]
set_property IOSTANDARD LVCMOS33 [get_ports Sclk]
set_property CLOCK_DEDICATED_ROUTE FALSE [get_nets Sclk_IBUF]
set_property CLOCK_DEDICATED_ROUTE FALSE [get_nets led_Sclk_OBUF]
set_property IOSTANDARD LVCMOS33 [get_ports MoSi]
set_property IOSTANDARD LVCMOS33 [get_ports MiSo]
set_property IOSTANDARD LVCMOS33 [get_ports rst]
