`timescale 1ns / 1ps

module tb_top;

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

    // Task to perform a write operation (Mode 01)
    task write_reg_bit(input [3:0] address, input data_val);
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
            
            // Data bit
            send_bit(data_val);
        end
    endtask

    // Task to perform a read operation (Mode 00)
    task read_reg_bit(input [3:0] address, output read_val);
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
            
            // At this point, we enter SEND_DATA state.
            // During this cycle, MiSo outputs read_reg[address].
            // We sample it before the clock edge.
            #10;
            read_val = MiSo;
            $display("[TB] MiSo sampled: %b (Expected: %b)", read_val, uut.read_reg[address]);
            
            // Wait for the clock edge that transitions back to DETECT
            @(posedge Sclk);
            #1;
        end
    endtask

    initial begin
        // Initialize Inputs
        MoSi = 0;
        Sclk = 0;
        rst = 1;

        // Open VCD file for GTKWave
        $dumpfile("tb_top.vcd");
        $dumpvars(0, tb_top);

        // Wait 100 ns for global reset to finish
        #100;
        rst = 0;
        #50;
        
        $display("[TB] Reset deasserted. Initial write_reg = %h, read_reg = %h", uut.write_reg, uut.read_reg);
        
        // Test 1: Write '1' to address 5
        write_reg_bit(4'd5, 1'b1);
        if (uut.write_reg[5] === 1'b1) begin
            $display("[PASS] Test 1: Write to address 5 successful!");
        end else begin
            $display("[FAIL] Test 1: Write to address 5 failed! write_reg = %h", uut.write_reg);
        end

        // Test 2: Write '0' to address 5 (clear it)
        write_reg_bit(4'd5, 1'b0);
        if (uut.write_reg[5] === 1'b0) begin
            $display("[PASS] Test 2: Clear address 5 successful!");
        end else begin
            $display("[FAIL] Test 2: Clear address 5 failed! write_reg = %h", uut.write_reg);
        end

        // Test 3: Write '1' to address 12
        write_reg_bit(4'd12, 1'b1);
        if (uut.write_reg[12] === 1'b1) begin
            $display("[PASS] Test 3: Write to address 12 successful!");
        end else begin
            $display("[FAIL] Test 3: Write to address 12 failed! write_reg = %h", uut.write_reg);
        end

        // Initialize read_reg to a custom value to test reading
        uut.read_reg = 16'hA5A5; // 1010_0101_1010_0101
        $display("[TB] Forced read_reg to %h", uut.read_reg);

        // Test 4: Read from address 0 (expecting 1'b1)
        begin : test_4
            reg r_val;
            read_reg_bit(4'd0, r_val);
            if (r_val === 1'b1) begin
                $display("[PASS] Test 4: Read address 0 successful!");
            end else begin
                $display("[FAIL] Test 4: Read address 0 failed! Expected 1, got %b", r_val);
            end
        end

        // Test 5: Read from address 1 (expecting 1'b0)
        begin : test_5
            reg r_val;
            read_reg_bit(4'd1, r_val);
            if (r_val === 1'b0) begin
                $display("[PASS] Test 5: Read address 1 successful!");
            end else begin
                $display("[FAIL] Test 5: Read address 1 failed! Expected 0, got %b", r_val);
            end
        end

        // Test 6: Invalid mode check (e.g. sending 2'b10)
        $display("[TB] Sending invalid mode 10 to check robustness...");
        send_bit(1);
        send_bit(0);
        // At this point FSM should still be in DETECT because 2'b10 is invalid mode.
        // We will send some dummy bits and check that state stays DETECT (3'd0).
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
