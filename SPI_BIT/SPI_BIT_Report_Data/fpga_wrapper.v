`timescale 1ns / 1ps

module fpga_wrapper (
    // System Clock for 7-Segment Display time-multiplexing refresh (100 MHz on Boolean board)
    input  wire        clk,

    // Core inputs/outputs for SPI_BIT project
    input  wire        MoSi,
    input  wire        Sclk,
    input  wire        rst,
    input  wire        sel,
    input  wire [15:0] sw,          // 16 FPGA DIP switches providing sensor data
    output wire        MiSo,

    // 7-Segment Display D0 (First 4 digits: showing read-only read_reg[15:0] / sensor_data in Hex)
    output reg  [3:0]  d0_a,        // Anodes D0_a3..D0_a0 (active-low)
    output reg  [7:0]  d0_seg,      // Cathodes D0_seg7..D0_seg0 (active-low: seg[7]=dp, seg[6]=g .. seg[0]=a)

    // 7-Segment Display D1 (Second 4 digits: showing writable write_reg[15:0] / MoSi data in Hex)
    output reg  [3:0]  d1_a,        // Anodes D1_a3..D1_a0 (active-low)
    output reg  [7:0]  d1_seg,      // Cathodes D1_seg7..D1_seg0 (active-low: seg[7]=dp, seg[6]=g .. seg[0]=a)

    // LED Status Monitoring Outputs (mapped to onboard LEDs)
    output wire        led_cs,      // LED0 (Chip Select status)
    output wire        led_Sclk,    // LED1 (SPI Clock status)
    output wire        led_rst,     // LED2 (Reset status)
    output wire        led_MiSo,    // LED3 (MISO status)
    output wire        led_MoSi,    // LED4 (MOSI status)
    output wire [1:0]  led_mode,    // LED5 and LED6 (u_top.mode[1:0] register)
    output wire [3:0]  led_state    // LED12 through LED15 (FSM state: F2, F1, G2, G1)
);

    // Instantiate the top module
    top u_top (
        .MoSi        (MoSi),
        .Sclk        (Sclk),
        .rst         (rst),
        .sel         (sel),
        .sensor_data (sw),
        .MiSo        (MiSo)
    );

    // Internal observation wires mapped from internal registers of `top` (for simulation/debug)
    wire [15:0] read_reg_out  = u_top.read_reg;
    wire [15:0] write_reg_out = u_top.write_reg;
    wire [1:0]  mode_out      = u_top.mode;
    wire [3:0]  state_out     = u_top.state;
    wire [4:0]  addr_out      = u_top.addr;
    wire [3:0]  write_len_out = u_top.write_len;
    wire [3:0]  pass_reg_out  = u_top.pass_reg;
    wire        led_sel       = sel;

    // Mirror SPI status and internal mode to FPGA LEDs
    assign led_cs   = sel;
    assign led_Sclk = Sclk;
    assign led_rst  = rst;
    assign led_MiSo = MiSo;
    assign led_MoSi  = MoSi;
    // Latch mode and state so they stay visibly lit on FPGA LEDs after SPI transaction finishes
    reg [1:0] latched_mode;
    reg [3:0] latched_state;
    
    always @(posedge clk or posedge rst) begin
        if (rst) begin
            latched_mode  <= 2'b00;
            latched_state <= 4'd0;
        end else if (!sel && u_top.state != 4'd0 && u_top.state != 4'd8) begin
            // Hold the last active transaction state (ignore idle/DONE states)
            latched_mode  <= u_top.mode;
            latched_state <= u_top.state;
        end
    end

    assign led_mode  = latched_mode;
    assign led_state = latched_state;

    // Access separated Read-Only (read_reg) and Writable (write_reg) registers
    wire [15:0] read_data  = u_top.read_reg;   // Sensor Data / Read-Only Region
    wire [15:0] write_data = u_top.write_reg;  // MoSi Input / Writable Region

    // =========================================================================
    // Dual 4-Digit Time-Multiplexed Hexadecimal 7-Segment Display Driver
    // - Display D0 shows read_data[15:0]  (read_reg[15:0]) across 4 digits
    // - Display D1 shows write_data[15:0] (write_reg[15:0]) across 4 digits
    // =========================================================================
    
    // Refresh counter: bits [16:15] cycle across 4 digits at ~763 Hz with 100 MHz clk
    reg [17:0] refresh_counter;
    always @(posedge clk or posedge rst) begin
        if (rst)
            refresh_counter <= 18'd0;
        else
            refresh_counter <= refresh_counter + 1'b1;
    end

    wire [1:0] digit_sel = refresh_counter[16:15];

    // Hexadecimal to 7-Segment Decoder helper (Active-Low: 0 = Segment ON, 1 = Segment OFF)
    function [6:0] hex_to_7seg;
        input [3:0] nibble;
        begin
            case (nibble)
                4'h0: hex_to_7seg = 7'b1000000;
                4'h1: hex_to_7seg = 7'b1111001;
                4'h2: hex_to_7seg = 7'b0100100;
                4'h3: hex_to_7seg = 7'b0110000;
                4'h4: hex_to_7seg = 7'b0011001;
                4'h5: hex_to_7seg = 7'b0010010;
                4'h6: hex_to_7seg = 7'b0000010;
                4'h7: hex_to_7seg = 7'b1111000;
                4'h8: hex_to_7seg = 7'b0000000;
                4'h9: hex_to_7seg = 7'b0010000;
                4'hA: hex_to_7seg = 7'b0001000;
                4'hB: hex_to_7seg = 7'b0000011;
                4'hC: hex_to_7seg = 7'b1000110;
                4'hD: hex_to_7seg = 7'b0100001;
                4'hE: hex_to_7seg = 7'b0000110;
                4'hF: hex_to_7seg = 7'b0001110;
                default: hex_to_7seg = 7'b1111111;
            endcase
        end
    endfunction

    // Time-multiplex both 4-digit displays simultaneously
    // seg[7] is the decimal point (dp), set to 1'b1 (OFF)
    always @(*) begin
        case (digit_sel)
            2'd0: begin
                // Rightmost digit [3:0]
                d0_a   = 4'b1110;
                d0_seg = {1'b1, hex_to_7seg(read_data[3:0])};
                d1_a   = 4'b1110;
                d1_seg = {1'b1, hex_to_7seg(write_data[3:0])};
            end
            2'd1: begin
                // Second digit [7:4]
                d0_a   = 4'b1101;
                d0_seg = {1'b1, hex_to_7seg(read_data[7:4])};
                d1_a   = 4'b1101;
                d1_seg = {1'b1, hex_to_7seg(write_data[7:4])};
            end
            2'd2: begin
                // Third digit [11:8]
                d0_a   = 4'b1011;
                d0_seg = {1'b1, hex_to_7seg(read_data[11:8])};
                d1_a   = 4'b1011;
                d1_seg = {1'b1, hex_to_7seg(write_data[11:8])};
            end
            2'd3: begin
                // Leftmost digit [15:12]
                d0_a   = 4'b0111;
                d0_seg = {1'b1, hex_to_7seg(read_data[15:12])};
                d1_a   = 4'b0111;
                d1_seg = {1'b1, hex_to_7seg(write_data[15:12])};
            end
            default: begin
                d0_a   = 4'b1111;
                d0_seg = 8'b11111111;
                d1_a   = 4'b1111;
                d1_seg = 8'b11111111;
            end
        endcase
    end

endmodule
