`timescale 1ns / 1ps

module tb_v3;

    reg Sclk;
    reg rst;
    reg MoSi;
    wire MiSo;

    // Instantiate UUT
    top uut (
        .MoSi(MoSi),
        .Sclk(Sclk),
        .rst(rst),
        .MiSo(MiSo)
    );

    // Clock generation (10MHz -> 100ns period)
    always begin
        #50 Sclk = ~Sclk;
    end

    // Task to send a single bit on MoSi
    task send_bit(input bit_val);
        begin
            MoSi = bit_val;
            @(posedge Sclk);
            #1;
        end
    endtask

    // Task to perform a 4-bit write operation (Mode 01)
    task write_reg_4bits(input [3:0] address, input [3:0] data_val);
        integer i;
        begin
            $display("[TB] Writing: addr = %d, data = %b", address, data_val);
            send_bit(0); // Mode 01
            send_bit(1);
            for (i = 3; i >= 0; i = i - 1) begin
                send_bit(address[i]);
            end
            for (i = 0; i < 4; i = i + 1) begin
                send_bit(data_val[i]);
            end
        end
    endtask

    // Task to perform a dynamic length read operation (Mode 00)
    task read_reg_dynamic(input [3:0] address, input integer read_len, output reg [15:0] read_val);
        integer i;
        begin
            $display("[TB] Reading: addr = %d, dynamic length = %d", address, read_len);
            read_val = 0;
            send_bit(0); // Mode 00
            send_bit(0);
            for (i = 3; i >= 0; i = i - 1) begin
                send_bit(address[i]);
            end
            for (i = 0; i < read_len; i = i + 1) begin
                // Drive MoSi = 1 to continue, MoSi = 0 on last bit to stop
                MoSi = (i == read_len - 1) ? 1'b0 : 1'b1;
                #10;
                read_val[i] = MiSo;
                @(posedge Sclk);
                #1;
            end
            MoSi = 0;
        end
    endtask

    initial begin
        MoSi = 0;
        Sclk = 0;
        rst = 1;

        $dumpfile("tb_v3.vcd");
        $dumpvars(0, tb_v3);

        #100;
        rst = 0;
        #50;

        $display("=================================================================");
        $display("[START] Verification of Dynamic SPI Register System (v3)");
        $display("=================================================================\n");

        // Test 1: Write 4-bit value '4'b1011' starting at address 5
        write_reg_4bits(4'd5, 4'b1011);
        if (uut.write_reg[8:5] === 4'b1011) begin
            $display("[PASS] Test 1: Write to address 5 successful!");
        end else begin
            $display("[FAIL] Test 1: Write to address 5 failed! write_reg[8:5] = %b", uut.write_reg[8:5]);
        end

        // Force custom read_reg value for testing reads
        uut.read_reg = 16'h5A3C; // 0101_1010_0011_1100
        $display("[TB] Forced read_reg to %h", uut.read_reg);

        // Test 2: Read dynamic length of 4 bits from address 4
        // read_reg is 0101_1010_0011_1100.
        // indices 4,5,6,7 are 4'b0011.
        begin : test_2
            reg [15:0] val;
            read_reg_dynamic(4'd4, 4, val);
            if (val[3:0] === 4'b0011) begin
                $display("[PASS] Test 2: Dynamic 4-bit read successful! Got %b", val[3:0]);
            end else begin
                $display("[FAIL] Test 2: Dynamic 4-bit read failed! Got %b", val[3:0]);
            end
        end

        // Test 3: Read dynamic length of 8 bits from address 4
        // indices 4 to 11 are 4'b1010_0011.
        begin : test_3
            reg [15:0] val;
            read_reg_dynamic(4'd4, 8, val);
            if (val[7:0] === 8'b1010_0011) begin
                $display("[PASS] Test 3: Dynamic 8-bit read successful! Got %b", val[7:0]);
            end else begin
                $display("[FAIL] Test 3: Dynamic 8-bit read failed! Got %b", val[7:0]);
            end
        end

        // Test 4: Read dynamic length of 2 bits from address 15 (wrapping test)
        // indices 15, 0 of 0101_1010_0011_1100 -> {read_reg[0], read_reg[15]} = 2'b00.
        begin : test_4
            reg [15:0] val;
            read_reg_dynamic(4'd15, 2, val);
            if (val[1:0] === 2'b00) begin
                $display("[PASS] Test 4: Wrapping dynamic 2-bit read successful! Got %b", val[1:0]);
            end else begin
                $display("[FAIL] Test 4: Wrapping dynamic 2-bit read failed! Got %b", val[1:0]);
            end
        end

        #200;
        $display("\n=================================================================");
        $display("[DONE] Verification finished successfully.");
        $display("=================================================================");
        $finish;
    end

endmodule
