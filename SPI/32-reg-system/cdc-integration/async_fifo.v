// ============================================================================
// Asynchronous FIFO with Gray Code Clock Domain Crossing
// Data Width : 16 bits
// Depth      : 8 entries (3-bit address, 4-bit pointer for full/empty)
// Based on Clifford Cummings' SNUG 2002 safe CDC methodology
// ============================================================================
module async_fifo (
    // Write Domain (Sensor)
    input  wire        clk_wr,
    input  wire        rst_wr,
    input  wire        wr_en,
    input  wire [15:0] data_in,
    output wire        full,

    // Read Domain (SPI)
    input  wire        clk_rd,
    input  wire        rst_rd,
    input  wire        rd_en,
    output wire [15:0] data_out,
    output wire        empty
);

    // ---- Parameters ----
    localparam ADDR_WIDTH = 3;           // log2(depth) = log2(8)
    localparam DEPTH      = 1 << ADDR_WIDTH; // 8

    // ---- Dual-Port RAM ----
    reg [15:0] mem [0:DEPTH-1];

    // ---- Write-domain pointers (binary & Gray) ----
    reg [ADDR_WIDTH:0] wr_bin, wr_gray;  // 4-bit (extra MSB for full/empty)

    // ---- Read-domain pointers (binary & Gray) ----
    reg [ADDR_WIDTH:0] rd_bin, rd_gray;

    // ---- Synchroniser registers (2-stage flip-flop) ----
    // Write Gray pointer synchronised into read domain
    reg [ADDR_WIDTH:0] wr_gray_rd_meta, wr_gray_rd_sync;
    // Read Gray pointer synchronised into write domain
    reg [ADDR_WIDTH:0] rd_gray_wr_meta, rd_gray_wr_sync;

    // ---- Address wires (lower bits of binary pointers) ----
    wire [ADDR_WIDTH-1:0] wr_addr = wr_bin[ADDR_WIDTH-1:0];
    wire [ADDR_WIDTH-1:0] rd_addr = rd_bin[ADDR_WIDTH-1:0];

    // ---- Next-value wires ----
    wire [ADDR_WIDTH:0] wr_bin_next  = wr_bin + (wr_en & ~full);
    wire [ADDR_WIDTH:0] wr_gray_next = (wr_bin_next >> 1) ^ wr_bin_next;

    wire [ADDR_WIDTH:0] rd_bin_next  = rd_bin + (rd_en & ~empty);
    wire [ADDR_WIDTH:0] rd_gray_next = (rd_bin_next >> 1) ^ rd_bin_next;

    // ====================================================================
    // Write Domain Logic (clk_wr)
    // ====================================================================

    // RAM write
    always @(posedge clk_wr) begin
        if (wr_en & ~full)
            mem[wr_addr] <= data_in;
    end

    // Write pointer update
    always @(posedge clk_wr or posedge rst_wr) begin
        if (rst_wr) begin
            wr_bin  <= 0;
            wr_gray <= 0;
        end else begin
            wr_bin  <= wr_bin_next;
            wr_gray <= wr_gray_next;
        end
    end

    // Synchronise rd_gray into write domain (for full flag)
    always @(posedge clk_wr or posedge rst_wr) begin
        if (rst_wr) begin
            rd_gray_wr_meta <= 0;
            rd_gray_wr_sync <= 0;
        end else begin
            rd_gray_wr_meta <= rd_gray;       // stage 1
            rd_gray_wr_sync <= rd_gray_wr_meta; // stage 2
        end
    end

    // ====================================================================
    // Read Domain Logic (clk_rd)
    // ====================================================================

    // RAM read (combinational — data available same cycle as rd_en)
    assign data_out = mem[rd_addr];

    // Read pointer update
    always @(posedge clk_rd or posedge rst_rd) begin
        if (rst_rd) begin
            rd_bin  <= 0;
            rd_gray <= 0;
        end else begin
            rd_bin  <= rd_bin_next;
            rd_gray <= rd_gray_next;
        end
    end

    // Synchronise wr_gray into read domain (for empty flag)
    always @(posedge clk_rd or posedge rst_rd) begin
        if (rst_rd) begin
            wr_gray_rd_meta <= 0;
            wr_gray_rd_sync <= 0;
        end else begin
            wr_gray_rd_meta <= wr_gray;        // stage 1
            wr_gray_rd_sync <= wr_gray_rd_meta; // stage 2
        end
    end

    // ====================================================================
    // Flag Generation
    // ====================================================================

    // EMPTY: generated in READ domain
    // FIFO is empty when rd_gray equals the synchronised wr_gray
    assign empty = (rd_gray == wr_gray_rd_sync);

    // FULL: generated in WRITE domain
    // FIFO is full when the top two bits of wr_gray are the inverse of
    // the synchronised rd_gray, and the remaining bits match.
    assign full = (wr_gray == {~rd_gray_wr_sync[ADDR_WIDTH:ADDR_WIDTH-1],
                                rd_gray_wr_sync[ADDR_WIDTH-2:0]});

endmodule
