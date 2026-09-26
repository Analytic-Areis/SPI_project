`timescale 1ns / 1ps

module tb_v2;

    // Inputs
    reg MoSi;
    reg Sclk;
    reg rst;

    // Outputs
    wire MiSo;

    // Instantiate the Unit Under Test (UUT)
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

    // Task to send a single bit on MoSi synchronized with Sclk
    task send_bit(input bit_val);
        begin
            MoSi = bit_val;
            @(posedge Sclk);
            #1; // small delay after edge to ensure stable setup/hold
        end
    endtask

    // Task to perform a 4-bit write operation (Mode 01)
    task write_reg_4bits(input [3:0] address, input [3:0] data_val);
        begin
            $display("[TB] Starting WRITE: addr = %d, data = %b", address, data_val);
            // Mode is 01
            send_bit(0);
            send_bit(1);
            
            // Address is 4 bits (MSB first)
            send_bit(address[3]);
            send_bit(address[2]);
            send_bit(address[1]);
            send_bit(address[0]);
            
            // Data bits (LSB-first, i.e., bit 0 to bit 3)
            send_bit(data_val[0]);
            send_bit(data_val[1]);
            send_bit(data_val[2]);
            send_bit(data_val[3]);
        end
    endtask

    // Task to perform a 4-bit read operation (Mode 00)
    task read_reg_4bits(input [3:0] address, output [3:0] read_val);
        begin
            $display("[TB] Starting READ: addr = %d", address);
            // Mode is 00
            send_bit(0);
            send_bit(0);
            
            // Address is 4 bits (MSB first)
            send_bit(address[3]);
            send_bit(address[2]);
            send_bit(address[1]);
            send_bit(address[0]);
            
            // Sample 4 bits of data over 4 clock cycles
            #10;
            read_val[0] = MiSo;
            @(posedge Sclk);
            #1;
            
            #10;
            read_val[1] = MiSo;
            @(posedge Sclk);
            #1;
            
            #10;
            read_val[2] = MiSo;
            @(posedge Sclk);
            #1;
            
            #10;
            read_val[3] = MiSo;
            @(posedge Sclk);
            #1;
            
            $display("[TB] MiSo sampled: %b", read_val);
        end
    endtask

    initial begin
        // Initialize Inputs
        MoSi = 0;
        Sclk = 0;
        rst = 1;

        // Open VCD file for GTKWave
        $dumpfile("tb_v2.vcd");
        $dumpvars(0, tb_v2);

        // Wait 100 ns for global reset to finish
        #100;
        rst = 0;
        #50;
        
        $display("[TB] Reset deasserted. Initial write_reg = %h, read_reg = %h", uut.write_reg, uut.read_reg);
        
        // Test 1: Write 4-bit value '4'b1010' to address 4
        write_reg_4bits(4'd4, 4'b1010);
        if (uut.write_reg[7:4] === 4'b1010) begin
            $display("[PASS] Test 1: Write to address 4 successful! write_reg[7:4] = %b", uut.write_reg[7:4]);
        end else begin
            $display("[FAIL] Test 1: Write to address 4 failed! write_reg[7:4] = %b", uut.write_reg[7:4]);
        end

        // Test 2: Write 4-bit value '4'b0110' to address 8 (overlapping wrapping check)
        write_reg_4bits(4'd8, 4'b0110);
        if (uut.write_reg[11:8] === 4'b0110) begin
            $display("[PASS] Test 2: Write to address 8 successful! write_reg[11:8] = %b", uut.write_reg[11:8]);
        end else begin
            $display("[FAIL] Test 2: Write to address 8 failed! write_reg[11:8] = %b", uut.write_reg[11:8]);
        end

        // Test 3: Write 4-bit value with index wrapping (addr = 14)
        // This will write bits at 14, 15, 0, and 1.
        write_reg_4bits(4'd14, 4'b1101);
        if ({uut.write_reg[1:0], uut.write_reg[15:14]} === 4'b1101) begin
            $display("[PASS] Test 3: Wrapping write to address 14 successful! write_reg[1:0] = %b, write_reg[15:14] = %b", uut.write_reg[1:0], uut.write_reg[15:14]);
        end else begin
            $display("[FAIL] Test 3: Wrapping write to address 14 failed! write_reg = %b", uut.write_reg);
        end

        // Initialize read_reg to a custom value to test reading
        uut.read_reg = 16'h5A3C; // 0101_1010_0011_1100
        $display("[TB] Forced read_reg to %h", uut.read_reg);

        // Test 4: Read from address 4 (expecting read_reg[7:4] = 4'b0011)
        begin : test_4
            reg [3:0] r_val;
            read_reg_4bits(4'd4, r_val);
            if (r_val === 4'b0011) begin
                $display("[PASS] Test 4: Read address 4 successful! Value: %b", r_val);
            end else begin
                $display("[FAIL] Test 4: Read address 4 failed! Expected 0011, got %b", r_val);
            end
        end

        // Test 5: Read from address 14 (wrapping read)
        // Should return read_reg[1], read_reg[0], read_reg[15], read_reg[14]
        // read_reg is 0101_1010_0011_1100.
        // read_reg[15:14] = 2'b01. read_reg[1:0] = 2'b00.
        // Expected value: {read_reg[1], read_reg[0], read_reg[15], read_reg[14]} = 4'b00_01 = 4'b0001
        begin : test_5
            reg [3:0] r_val;
            read_reg_4bits(4'd14, r_val);
            if (r_val === 4'b0001) begin
                $display("[PASS] Test 5: Wrapping read address 14 successful! Value: %b", r_val);
            end else begin
                $display("[FAIL] Test 5: Wrapping read address 14 failed! Expected 0001, got %b", r_val);
            end
        end

        // Test 6: Invalid mode check (e.g. sending 2'b10)
        $display("[TB] Sending invalid mode 10 to check robustness...");
        send_bit(1);
        send_bit(0);
        #10;
        if (uut.state === 3'd0) begin
            $display("[PASS] Test 6: Invalid mode did not trigger transition. State: %d", uut.state);
        end else begin
            $display("[FAIL] Test 6: Invalid mode triggered transition! State: %d", uut.state);
        end

        #200;
        $display("[TB] Simulation finished.");
        $finish;
    end

endmodule
