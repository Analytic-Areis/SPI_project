module system_top (
    // External Sensor Interface (Domain 1) — 16-bit data
    input  wire        sensor_clk,
    input  wire        sensor_rst,
    input  wire        sensor_valid,
    input  wire [15:0] sensor_data_in,

    // SPI Interface (Domain 2)
    input  wire        Sclk,
    input  wire        rst,
    input  wire        MoSi,
    input  wire        sel,
    output wire        MiSo
);

    wire [15:0] internal_fifo_data;
    wire        internal_fifo_empty;
    wire        internal_fifo_full;
    wire        internal_fifo_rd_en;

    // Instantiate the Async FIFO (16-bit, depth 8)
    async_fifo u_fifo (
        .clk_wr(sensor_clk),
        .rst_wr(sensor_rst),
        .wr_en(sensor_valid & ~internal_fifo_full), // Only write if not full
        .data_in(sensor_data_in),
        .full(internal_fifo_full),
        
        .clk_rd(Sclk),
        .rst_rd(rst),
        .rd_en(internal_fifo_rd_en),
        .data_out(internal_fifo_data),
        .empty(internal_fifo_empty)
    );

    // Instantiate the SPI slave
    top u_spi_slave (
        .MoSi(MoSi),
        .Sclk(Sclk),
        .rst(rst),
        .sel(sel),
        .fifo_data(internal_fifo_data),
        .fifo_empty(internal_fifo_empty),
        .fifo_rd_en(internal_fifo_rd_en),
        .MiSo(MiSo)
    );

endmodule
