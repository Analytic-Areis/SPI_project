module top (
    input  MoSi,
    input  Sclk,
    input  rst,
    input  sel,
    input  [15:0] sensor_data,
    output MiSo
);

    reg [15:0] read_reg;  // 15:0 read-only (sensor_data)
    reg [15:0] write_reg; // 15:0 writable via SPI
    reg [1:0] mode;
    reg [4:0] addr;
    reg [3:0] write_len;
    reg [3:0] pass_reg;

    parameter DETECT     = 4'd0;
    parameter READ_ADDR  = 4'd1;
    parameter SEND_DATA  = 4'd2;
    parameter WRITE_ADDR = 4'd3;
    parameter WRITE_LEN  = 4'd4;
    parameter WRITE_DATA = 4'd5;
    parameter SOFT_RESET = 4'd6;
    parameter WHOAMI     = 4'd7;
    parameter DONE       = 4'd8;

    reg [3:0] state, next_state;
    reg [4:0] bit_count;

    wire [4:0] read_idx = (addr + bit_count) % 32;
    wire [3:0] write_idx = (addr + bit_count) % 16;
    wire [3:0] slave_id = 4'b0111;
    wire whoami_bit = slave_id[3 - bit_count[1:0]];

    reg miso_reg;
    assign MiSo = (sel == 1'b0) ? miso_reg : 1'bz;

    always @(negedge Sclk or posedge rst) begin
        if (rst) begin
            miso_reg <= 1'b0;
        end else begin
            if (sel) begin
                miso_reg <= 1'b0;
            end else begin
                if (state == SEND_DATA) begin
                    miso_reg <= (read_idx[4] == 1'b0) ? write_reg[read_idx[3:0]] : read_reg[read_idx[3:0]];
                end else if (state == WHOAMI) begin
                    miso_reg <= whoami_bit;
                end else begin
                    miso_reg <= 1'b0;
                end
            end
        end
    end

    // next-state logic
    always @(*) begin
        next_state = state;
        case (state)
            DETECT: begin
                if (bit_count == 1) begin
                    case ({mode[1], MoSi})
                        2'b00:   next_state = READ_ADDR;
                        2'b01:   next_state = WRITE_ADDR;
                        2'b10:   next_state = SOFT_RESET;
                        2'b11:   next_state = WHOAMI;
                    endcase
                end
            end
            READ_ADDR:  if (bit_count == 4) next_state = SEND_DATA;
            SEND_DATA:  if (MoSi == 1'b0)  next_state = DONE;   
            WRITE_ADDR: if (bit_count == 4) next_state = WRITE_LEN;
            WRITE_LEN:  if (bit_count == 3) next_state = WRITE_DATA;
            WRITE_DATA: if (bit_count == write_len) next_state = DONE;
            SOFT_RESET: if (bit_count == 3) next_state = DONE;
            WHOAMI:     if (bit_count == 3) next_state = DONE;
            DONE:       next_state = DONE;
            default:    next_state = DETECT;
        endcase
    end

    always @(posedge Sclk or posedge rst) begin
        if (rst) begin
            state <= DETECT;
            bit_count <= 0;
            mode <= 2'b00;
            addr <= 0;
            write_len <= 0;
            read_reg <= 16'hFFFF;
            write_reg <= 16'h0000;
            pass_reg <= 0;
        end else begin
            if (sel) begin
                state <= DETECT;
                bit_count <= 0;
                mode <= 2'b00;
                addr <= 0;
                write_len <= 0;
                pass_reg <= 0;
            end else begin
                state <= next_state;
                case (state)
                DETECT: begin
                    if (bit_count == 0) begin
                        mode[1]   <= MoSi;
                        bit_count <= 1;
                    end else begin
                        mode[0]   <= MoSi;
                        bit_count <= 0;
                        if ({mode[1], MoSi} == 2'b00) begin
                            read_reg <= sensor_data;
                        end else if ({mode[1], MoSi} == 2'b10) begin
                            pass_reg <= 0;
                        end
                    end
                end

                READ_ADDR: begin
                    addr <= (addr << 1) | MoSi;
                    bit_count <= (bit_count == 4) ? 0 : bit_count + 1'b1;
                end

                SEND_DATA: begin
                    bit_count <= (MoSi == 1'b0) ? 0 : bit_count + 1'b1;
                end

                WRITE_ADDR: begin
                    addr <= (addr << 1) | MoSi;
                    bit_count <= (bit_count == 4) ? 0 : bit_count + 1'b1;
                end

                WRITE_LEN: begin
                    write_len <= (write_len << 1) | MoSi;
                    bit_count <= (bit_count == 3) ? 0 : bit_count + 1'b1;
                end

                // only 15:0 is writable
                WRITE_DATA: begin
                    if (addr < 16)
                        write_reg[write_idx] <= MoSi;
                    bit_count <= (bit_count == write_len) ? 0 : bit_count + 1'b1;
                end

                SOFT_RESET: begin
                    pass_reg <= (pass_reg << 1) | MoSi;
                    if (bit_count == 3) begin
                        bit_count <= 0;
                        if (((pass_reg << 1) | MoSi) == 4'b1010) begin
                            read_reg  <= 16'hFFFF;
                            write_reg <= 16'h0000;
                            mode      <= 2'b00;
                            addr      <= 0;
                            write_len <= 0;
                        end else begin
                            mode      <= 2'b00;
                            addr      <= 0;
                            write_len <= 0;
                        end
                    end else begin
                        bit_count <= bit_count + 1'b1;
                    end
                end

                WHOAMI: begin
                    bit_count <= (bit_count == 3) ? 0 : bit_count + 1'b1;
                end

                DONE: begin
                    bit_count <= 0;
                end

                default: bit_count <= 0;
            endcase
        end
    end
end
endmodule