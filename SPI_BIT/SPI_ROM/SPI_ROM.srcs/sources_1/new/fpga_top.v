// Top-level FPGA wrapper layer for the SPI_ROM project.
// This wrapper instantiates module 'top' without modifying top.v,
// while mapping out internal signals (like write_reg and read_reg)
// and driving an 8-digit time-multiplexed 7-segment hexadecimal display.

module fpga_top (
    // System Clock for 7-Segment Display time-multiplexing refresh
    input  wire        clk,

    // External SPI & control inputs
    input  wire        MoSi,
    input  wire        Sclk,
    input  wire        rst,
    input  wire        cs,
    input  wire [15:0] dip_sw,      // 16 DIP switches on FPGA providing sensor data
    
    // External SPI output
    output wire        MiSo,

    // 7-Segment Display D0 (First 4 digits, showing read_reg[15:0] in Hex)
    output reg  [3:0]  d0_a,        // Anodes D0_a3..D0_a0 (active-low)
    output reg  [7:0]  d0_seg,      // Cathodes D0_seg7..D0_seg0 (active-low: seg[7]=dp, seg[6]=g .. seg[0]=a)

    // 7-Segment Display D1 (Second 4 digits, showing write_reg[15:0] in Hex)
    output reg  [3:0]  d1_a,        // Anodes D1_a3..D1_a0 (active-low)
    output reg  [7:0]  d1_seg,      // Cathodes D1_seg7..D1_seg0 (active-low: seg[7]=dp, seg[6]=g .. seg[0]=a)

    // LED Status Outputs (mapped to FPGA LEDs for status monitoring)
    output wire        led_cs,
    output wire        led_Sclk,
    output wire        led_rst,
    output wire        led_MiSo,
    output wire        led_MoSi,
    output wire [1:0]  led_mode
);

    // Instantiate the original project module (top)
    top u_top (
        .MoSi        (MoSi),
        .Sclk        (Sclk),
        .rst         (rst),
        .cs          (cs),
        .sensor_data (dip_sw),      // Connect DIP switch inputs to top's sensor_data port
        .MiSo        (MiSo)
    );

    // Internal wires connecting to u_top registers using hierarchical references.
    // Vivado synthesis supports accessing internal registers/signals of instantiated submodules via dot notation.
    wire [15:0] write_reg;
    wire [15:0] read_reg;
    wire [1:0]  mode;

    assign write_reg = u_top.write_reg;
    assign read_reg  = u_top.read_reg;
    assign mode      = u_top.mode;

    // Mirror status/control signals to FPGA LEDs
    assign led_cs   = cs;
    assign led_Sclk = Sclk;
    assign led_rst  = rst;
    assign led_MiSo = MiSo;
    assign led_MoSi = MoSi;
    assign led_mode = mode;


    // =========================================================================
    // Dual 4-Digit Time-Multiplexed 7-Segment Hexadecimal Display Driver
    // - Display D0 shows read_reg[15:0] in Hex (Anodes D0_a3..D0_a0)
    // - Display D1 shows write_reg[15:0] in Hex (Anodes D1_a3..D1_a0)
    // =========================================================================
    
    // Free-running refresh counter: bit [16:15] cycles across 4 digits at ~763 Hz per full pass
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
    // d0_seg[7] and d1_seg[7] are the decimal points (dp), set to 1'b1 (OFF)
    always @(*) begin
        case (digit_sel)
            2'd0: begin
                d0_a   = 4'b1110; // Rightmost digit of D0 (read_reg[3:0])
                d0_seg = {1'b1, hex_to_7seg(read_reg[3:0])};
                d1_a   = 4'b1110; // Rightmost digit of D1 (write_reg[3:0])
                d1_seg = {1'b1, hex_to_7seg(write_reg[3:0])};
            end
            2'd1: begin
                d0_a   = 4'b1101; // Second digit of D0 (read_reg[7:4])
                d0_seg = {1'b1, hex_to_7seg(read_reg[7:4])};
                d1_a   = 4'b1101; // Second digit of D1 (write_reg[7:4])
                d1_seg = {1'b1, hex_to_7seg(write_reg[7:4])};
            end
            2'd2: begin
                d0_a   = 4'b1011; // Third digit of D0 (read_reg[11:8])
                d0_seg = {1'b1, hex_to_7seg(read_reg[11:8])};
                d1_a   = 4'b1011; // Third digit of D1 (write_reg[11:8])
                d1_seg = {1'b1, hex_to_7seg(write_reg[11:8])};
            end
            2'd3: begin
                d0_a   = 4'b0111; // Leftmost digit of D0 (read_reg[15:12])
                d0_seg = {1'b1, hex_to_7seg(read_reg[15:12])};
                d1_a   = 4'b0111; // Leftmost digit of D1 (write_reg[15:12])
                d1_seg = {1'b1, hex_to_7seg(write_reg[15:12])};
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
