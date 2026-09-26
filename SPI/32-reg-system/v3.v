module top (
    input MoSi,
    input Sclk,
    input rst,
    output MiSo
);
    reg [15:0] write_reg;
    reg [15:0] read_reg;
    reg [1:0] mode;
    reg [3:0] addr;         
    
    // FSM states
    localparam DETECT     = 3'd0;
    localparam READ_ADDR  = 3'd1;
    localparam SEND_DATA  = 3'd2;
    localparam WRITE_ADDR = 3'd3;
    localparam WRITE_DATA = 3'd4;

    reg [2:0] state;
    reg [2:0] next_state;
    reg [4:0] bit_count; // wide enough for dynamic-length reads

    // wrap around the 16-bit register when sending
    assign MiSo = (state == SEND_DATA) ? read_reg[(addr + bit_count) % 16] : 1'b0;

    always @(*) begin
        next_state = state;
        case (state)
            DETECT: begin
                if (bit_count == 1) begin
                    case ({mode[1], MoSi})
                        2'b00: next_state = READ_ADDR;
                        2'b01: next_state = WRITE_ADDR;
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
                if (MoSi == 1'b0) begin
                    next_state = DETECT; // master says stop
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
                if (bit_count == 3) begin
                    next_state = DETECT;
                end else begin
                    next_state = WRITE_DATA;
                end
            end

            default: begin
                next_state = DETECT;
            end
        endcase
    end

    always @(posedge Sclk or posedge rst) begin
        if (rst) begin
            state     <= DETECT;
            bit_count <= 0;
            mode      <= 2'b00;
            addr      <= 0;
            write_reg <= 16'h0000;
            read_reg  <= 16'hFFFF;
        end else begin
            state <= next_state;
            case (state)
                DETECT: begin
                    if (bit_count == 0) begin
                        mode[1]   <= MoSi;
                        bit_count <= 1;
                    end else if (bit_count == 1) begin
                        mode[0]   <= MoSi;
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
                    if (MoSi == 1'b0) begin
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
                    write_reg[(addr + bit_count) % 16] <= MoSi;
                    if (bit_count == 3) begin
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
