module slave_info_rom (
    input  [3:0] addr,
    output reg [3:0] in_width,
    output reg [3:0] out_width,
    output reg [3:0] in_start,
    output reg [3:0] out_start
);
    always @(*) begin
        case (addr)
            // Sensor 0: 3 bits (Bits 0-2)
            4'd0: begin
                in_width  = 4'd3;   out_width = 4'd3;
                in_start  = 4'd0;   out_start = 4'd0;
            end

            // Sensor 1: 3 bits (Bits 3-5)
            4'd1: begin
                in_width  = 4'd3;   out_width = 4'd3;
                in_start  = 4'd3;   out_start = 4'd3;
            end

            // Sensor 2: 3 bits (Bits 6-8)
            4'd2: begin
                in_width  = 4'd3;   out_width = 4'd3;
                in_start  = 4'd6;   out_start = 4'd6;
            end

            // Sensor 3: 3 bits (Bits 9-11)
            4'd3: begin
                in_width  = 4'd3;   out_width = 4'd3;
                in_start  = 4'd9;   out_start = 4'd9;
            end
            
            // Sensor 4: 4 bits (Bits 12-15)
            4'd5: begin
                in_width  = 4'd4;   out_width = 4'd4;
                in_start  = 4'd12;  out_start = 4'd12;
            end

            // Default fallback mapping
            default: begin
                in_width  = 4'd1;   out_width = 4'd1;
                in_start  = 4'd0;   out_start = 4'd0;
            end
        endcase
    end
endmodule

module top #(
    // Configurable 0-indexed sensor number for this device
    parameter SENSOR_ID = 8'd9
)(
    input MoSi,
    input Sclk,
    input rst,
    input cs,
    input [15:0] sensor_data,
    output MiSo
);
    reg [15:0] write_reg;
    reg [15:0] read_reg;
    reg [1:0] mode;
    reg [3:0] addr;        
    reg [3:0] reset_password;
    
    localparam DETECT          = 3'd0;
    localparam READ_ADDR       = 3'd1;
    localparam SEND_DATA       = 3'd2;
    localparam WRITE_ADDR      = 3'd3;
    localparam WRITE_DATA      = 3'd4;
    localparam RESET_PASSWORD  = 3'd5;
    localparam WHO_AM_I_STATE  = 3'd6; // <--- New state for opcode 11
    localparam RESET_CODE      = 4'b1111;

    reg [2:0] state;
    reg [2:0] next_state;
    reg [4:0] bit_count; // Tracks dynamic transfer length

    wire [3:0] rom_in_width;
    wire reset_match;
    wire [3:0] rom_out_width;
    wire [3:0] rom_in_start;
    wire [3:0] rom_out_start;
    wire [7:0] who_am_i_id; // Internal wire for the sensor ID

    assign who_am_i_id = SENSOR_ID;

    slave_info_rom u_rom (
        .addr      (addr),
        .in_width  (rom_in_width),
        .out_width (rom_out_width),
        .in_start  (rom_in_start),
        .out_start (rom_out_start)
    );

    assign reset_match = cs && (state == RESET_PASSWORD) && (bit_count == 3) &&
                         ({reset_password[2:0], MoSi} == RESET_CODE);
                         
    // Multiplex MiSo output based on current state (SEND_DATA vs WHO_AM_I)
    assign MiSo = (cs && (state == SEND_DATA))      ? read_reg[(rom_out_start + bit_count) & 4'b1111] : 
                  (cs && (state == WHO_AM_I_STATE)) ? who_am_i_id[bit_count] : 1'b0;

    always @(*) begin
        next_state = state;
        case (state)
            DETECT: begin
                if (bit_count == 1) begin
                    case ({mode[1], MoSi})
                        2'b00: next_state = READ_ADDR;
                        2'b01: next_state = WRITE_ADDR;
                        2'b10: next_state = RESET_PASSWORD;
                        2'b11: next_state = WHO_AM_I_STATE; // <--- Handles opcode 2'b11
                        default: next_state = DETECT;
                    endcase
                end else begin
                    next_state = DETECT;
                end
            end

            READ_ADDR: begin
                if (bit_count == 3) begin
                    next_state = SEND_DATA;
                end else begin
                    next_state = READ_ADDR;
                end
            end

            SEND_DATA: begin
                if (bit_count == rom_out_width - 1'b1) begin
                    next_state = DETECT;
                end else begin
                    next_state = SEND_DATA;
                end
            end

            WRITE_ADDR: begin
                if (bit_count == 3) begin
                    next_state = WRITE_DATA;
                end else begin
                    next_state = WRITE_ADDR;
                end
            end

            WRITE_DATA: begin
                if (bit_count == rom_in_width - 1'b1) begin
                    next_state = DETECT;
                end else begin
                    next_state = WRITE_DATA;
                end
            end

            RESET_PASSWORD: begin
                if (bit_count == 3) begin
                    next_state = DETECT;
                end else begin
                    next_state = RESET_PASSWORD;
                end
            end

            WHO_AM_I_STATE: begin
                // Transfers 8-bit ID (indexes 0 to 7)
                if (bit_count == 5'd7) begin
                    next_state = DETECT;
                end else begin
                    next_state = WHO_AM_I_STATE;
                end
            end

            default: begin
                next_state = DETECT;
            end
        endcase
        
        if (!cs) begin
            next_state = DETECT;
        end
    end

    always @(posedge Sclk or posedge rst) begin
        if (rst) begin
            state     <= DETECT;
            bit_count <= 0;
            mode      <= 2'b00;
            addr      <= 0;
            write_reg <= 16'h0000;
            read_reg  <= 16'hffff;
            reset_password <= 4'b0000;
        end else if (!cs) begin
            state     <= DETECT;
            bit_count <= 0;
            mode      <= 2'b00;
            addr      <= 0;
            reset_password <= 4'b0000;
        end else if (reset_match) begin
            state          <= DETECT;
            bit_count      <= 0;
            mode           <= 2'b00;
            addr           <= 0;
            write_reg      <= 16'h0000;
            read_reg       <= 16'h0000;
            reset_password <= 4'b0000;
        end else begin
            state <= next_state;
            case (state)
                DETECT: begin
                    if (bit_count == 0) begin
                        mode[1]   <= MoSi;
                        bit_count <= 1;
                    end else if (bit_count == 1) begin
                        mode[0]   <= MoSi;
                        if ({mode[1], MoSi} == 2'b00) begin
                            read_reg <= sensor_data;
                        end
                        reset_password <= 4'b0000;
                        bit_count <= 0;
                    end
                end

                READ_ADDR: begin
                    addr <= (addr << 1) | MoSi;
                    if (bit_count == 3) begin
                        bit_count <= 0;
                    end else begin
                        bit_count <= bit_count + 1'b1;
                    end
                end

                SEND_DATA: begin
                    if (bit_count == rom_out_width - 1'b1) begin
                        bit_count <= 0;
                    end else begin
                        bit_count <= bit_count + 1'b1;
                    end
                end

                WRITE_ADDR: begin
                    addr <= (addr << 1) | MoSi;
                    if (bit_count == 3) begin
                        bit_count <= 0;
                    end else begin
                        bit_count <= bit_count + 1'b1;
                    end
                end

                WRITE_DATA: begin
                    write_reg[(rom_in_start + bit_count) & 4'b1111] <= MoSi;
                    if (bit_count == rom_in_width - 1'b1) begin
                        bit_count <= 0;
                    end else begin
                        bit_count <= bit_count + 1'b1;
                    end
                end

                RESET_PASSWORD: begin
                    reset_password <= {reset_password[2:0], MoSi};
                    bit_count <= (bit_count == 3) ? 0 : bit_count + 1'b1;
                end

                WHO_AM_I_STATE: begin
                    if (bit_count == 5'd7) begin // 8 bits transfer
                        bit_count <= 0;
                    end else begin
                        bit_count <= bit_count + 1'b1;
                    end
                end

                default: bit_count <= 0;
            endcase
        end
    end
endmodule