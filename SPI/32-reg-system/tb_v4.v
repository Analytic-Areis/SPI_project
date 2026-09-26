`include "v4.v"
`timescale 1ns / 1ps

module tb_v4;

    reg  MoSi;
    reg  Sclk;
    reg  rst;
    reg  sel;
    reg [7:0] sensor_data;
    wire MiSo;

    top dut (
        .MoSi(MoSi),
        .Sclk(Sclk),
        .rst(rst),
        .sel(sel),
        .sensor_data(sensor_data),
        .MiSo(MiSo)
    );

    // Continuous clock generation
    initial Sclk = 0;
    always #10 Sclk = ~Sclk;

    // Monitor internal state safely 1ns after posedge
    always @(posedge Sclk) #1
        $display("t=%0t | MoSi=%b MiSo=%b sel=%b | st=%0d bc=%0d addr=%0d wlen=%0d mode=%b | sys=%b",
                 $time, MoSi, MiSo, sel, dut.state, dut.bit_count, dut.addr, dut.write_len, dut.mode, dut.sys_reg);

    initial begin
        $dumpfile("tb_v4.vcd");
        $dumpvars(0, tb_v4);

        sensor_data = 8'hFF;
        MoSi = 0;
        rst  = 1;
        sel  = 1;
        #100;
        rst  = 0;
        sel  = 0;

        // =============================================
        //  TEST 1: Read 8 bits from addr 8 (upper byte)
        // =============================================
        $display("\n--- TEST 1: READ addr=8, 8 bits (upper byte, expect all 1s) ---");

        @(negedge Sclk); #1 MoSi = 0;   // mode[1]
        @(negedge Sclk); #1 MoSi = 0;   // mode[0] → READ_ADDR

        // addr = 8 = 4'b1000
        @(negedge Sclk); #1 MoSi = 1;
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 0;

        $display("  >> reading 8 bits (MiSo values below):");
        repeat(8) begin
            @(negedge Sclk); #1 MoSi = 1;
        end

        // stop reading
        @(negedge Sclk); #1 MoSi = 0;
        @(posedge Sclk); #1;

        // =============================================
        //  TEST 2: Write 0xA5 to addr 0 (lower byte)
        // =============================================
        $display("\n--- TEST 2: WRITE 0xA5 to addr=0 ---");

        // mode = 01 (write)
        @(negedge Sclk); #1 MoSi = 0;   // mode[1]
        @(negedge Sclk); #1 MoSi = 1;   // mode[0] → WRITE_ADDR

        // addr = 0 = 4'b0000
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 0;

        // write_len = 7 = 4'b0111
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 1;
        @(negedge Sclk); #1 MoSi = 1;
        @(negedge Sclk); #1 MoSi = 1;

        // data: 0xA5 LSB-first → 1,0,1,0,0,1,0,1
        @(negedge Sclk); #1 MoSi = 1;   
        @(negedge Sclk); #1 MoSi = 0;   
        @(negedge Sclk); #1 MoSi = 1;   
        @(negedge Sclk); #1 MoSi = 0;   
        @(negedge Sclk); #1 MoSi = 0;   
        @(negedge Sclk); #1 MoSi = 1;   
        @(negedge Sclk); #1 MoSi = 0;   
        @(negedge Sclk); #1 MoSi = 1;   
        @(posedge Sclk); #1;
        $display("  >> sys_reg should now be 0xFFA5 = %b", dut.sys_reg);

        // =============================================
        //  TEST 3: Read back 8 bits from addr 0
        // =============================================
        $display("\n--- TEST 3: READ addr=0, 8 bits (expect 10100101) ---");

        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 0;

        // addr = 0
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 0;

        $display("  >> reading 8 bits:");
        repeat(8) begin
            @(negedge Sclk); #1 MoSi = 1;
        end

        @(negedge Sclk); #1 MoSi = 0;
        @(posedge Sclk); #1;

        // =============================================
        //  TEST 4: Try writing 0xBB to addr 8 (Blocked)
        // =============================================
        $display("\n--- TEST 4: WRITE 0xBB to addr=8 (should be blocked) ---");

        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 1;

        // addr = 8
        @(negedge Sclk); #1 MoSi = 1;
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 0;

        // write_len = 7
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 1;
        @(negedge Sclk); #1 MoSi = 1;
        @(negedge Sclk); #1 MoSi = 1;

        // data: 0xBB LSB-first
        @(negedge Sclk); #1 MoSi = 1;
        @(negedge Sclk); #1 MoSi = 1;
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 1;
        @(negedge Sclk); #1 MoSi = 1;
        @(negedge Sclk); #1 MoSi = 1;
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 1;
        
        @(posedge Sclk); #1;
        $display("  >> sys_reg should still be 0xFFA5 = %b", dut.sys_reg);

        // =============================================
        //  TEST 5: Read addr 8 to confirm upper byte unchanged
        // =============================================
        $display("\n--- TEST 5: READ addr=8, 8 bits (expect all 1s still) ---");

        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 0;

        @(negedge Sclk); #1 MoSi = 1;
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 0;

        $display("  >> reading 8 bits:");
        repeat(8) begin
            @(negedge Sclk); #1 MoSi = 1;
        end

        @(negedge Sclk); #1 MoSi = 0;
        @(posedge Sclk); #1;

        // =============================================
        //  TEST 6: Select Line Off/On State Reset
        // =============================================
        $display("\n--- TEST 6: Select Line Off/On State Reset ---");
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 1;
        
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 0;
        
        // write_len = 7
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 1;
        @(negedge Sclk); #1 MoSi = 1;
        @(negedge Sclk); #1 MoSi = 1;
        
        @(posedge Sclk); #1;
        $display("  >> Current state: %0d (expected 5 - WRITE_DATA)", dut.state);
        
        sel = 1; // Turn off select line
        @(posedge Sclk); #1;
        $display("  >> Select turned off. State: %0d (expected 0 - DETECT), MiSo: %b (expected z)", dut.state, MiSo);
        
        sel = 0; // Turn on select line
        #1;
        $display("  >> Select turned on. State: %0d (expected 0 - DETECT)", dut.state);

        // =============================================
        //  TEST 7: Soft Reset (Correct Password)
        // =============================================
        $display("\n--- TEST 7: Soft Reset (Correct Password) ---");
        @(negedge Sclk); #1 MoSi = 1;   // mode[1]
        @(negedge Sclk); #1 MoSi = 0;   // mode[0] → SOFT_RESET
        
        // Send password: 11001100
        @(negedge Sclk); #1 MoSi = 1;
        @(negedge Sclk); #1 MoSi = 1;
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 1;
        @(negedge Sclk); #1 MoSi = 1;
        @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 0;

        @(posedge Sclk); #1;
        $display("  >> After Soft Reset, sys_reg is %b (expected 1111111100000000)", dut.sys_reg);

        // Clean FSM state boundary
        sel = 1;
        @(posedge Sclk);
        #1;
        sel = 0;
        MoSi = 0;
        #1;

        // =============================================
        //  TEST 8: Soft Reset (Wrong Password)
        // =============================================
        $display("\n--- TEST 8: Soft Reset (Wrong Password) ---");
        // Re-write data to test modification protection
        @(negedge Sclk); #1 MoSi = 0;   
        @(negedge Sclk); #1 MoSi = 1;   
        // addr = 0
        @(negedge Sclk); #1 MoSi = 0; @(negedge Sclk); #1 MoSi = 0; @(negedge Sclk); #1 MoSi = 0; @(negedge Sclk); #1 MoSi = 0;
        // len = 7
        @(negedge Sclk); #1 MoSi = 0; @(negedge Sclk); #1 MoSi = 1; @(negedge Sclk); #1 MoSi = 1; @(negedge Sclk); #1 MoSi = 1;
        // data = 0xA5
        @(negedge Sclk); #1 MoSi = 1; @(negedge Sclk); #1 MoSi = 0; @(negedge Sclk); #1 MoSi = 1; @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 0; @(negedge Sclk); #1 MoSi = 1; @(negedge Sclk); #1 MoSi = 0; @(negedge Sclk); #1 MoSi = 1;
        @(posedge Sclk); #1;
        $display("  >> sys_reg modified to %b", dut.sys_reg);

        // Send wrong password
        @(negedge Sclk); #1 MoSi = 1;   
        @(negedge Sclk); #1 MoSi = 0;   
        
        @(negedge Sclk); #1 MoSi = 1; @(negedge Sclk); #1 MoSi = 1; @(negedge Sclk); #1 MoSi = 0; @(negedge Sclk); #1 MoSi = 0;
        @(negedge Sclk); #1 MoSi = 1; @(negedge Sclk); #1 MoSi = 1; @(negedge Sclk); #1 MoSi = 0; @(negedge Sclk); #1 MoSi = 1; // wrong

        @(posedge Sclk); #1;
        $display("  >> After failed Soft Reset, sys_reg is %b (expected unchanged)", dut.sys_reg);

        // Reset FSM cleanly using select line control loop
        sel = 1;
        @(posedge Sclk);
        #1;
        sel = 0;
        MoSi = 0;
        #1;

        // =============================================
        //  TEST 9: WHOAMI (Mode 11)
        // =============================================
        $display("\n--- TEST 9: WHOAMI (Mode 11) ---");
        @(negedge Sclk); #1 MoSi = 1;
        @(negedge Sclk); #1 MoSi = 1;
        
        // Wait for FSM to step inside WHOAMI state and process negedge MISO logic
        @(posedge Sclk); // FSM transitions to WHOAMI state
        @(posedge Sclk); #1; 
        
        // Sample bits exactly 1ns post-posedge to give the negedge assignments plenty of time
        $display("  >> WHOAMI bit 0: MiSo = %b (expected 0)", MiSo); @(posedge Sclk); #1;
        $display("  >> WHOAMI bit 1: MiSo = %b (expected 1)", MiSo); @(posedge Sclk); #1;
        $display("  >> WHOAMI bit 2: MiSo = %b (expected 1)", MiSo); @(posedge Sclk); #1;
        $display("  >> WHOAMI bit 3: MiSo = %b (expected 1)", MiSo); 

        // Clear out cleanly to DETECT
        sel = 1;
        @(posedge Sclk);
        #1;
        sel = 0;
        MoSi = 0;
        #1;

        // =============================================
        //  TEST 10: Sensor Data Update and Latching
        // =============================================
        $display("\n--- TEST 10: Sensor Data Update and Latching ---");
        sensor_data = 8'h55;
        $display("  >> Sensor data changed to 8'h55. sys_reg[15:8] is %h (expected 8'hFF)", dut.sys_reg[15:8]);

        @(negedge Sclk); #1 MoSi = 0;   
        @(negedge Sclk); #1 MoSi = 0;   
        
        @(posedge Sclk); #1;
        $display("  >> Toggled read mode. State is %0d. sys_reg[15:8] is %h (expected 8'h55)", dut.state, dut.sys_reg[15:8]);

        sensor_data = 8'hAA;
        $display("  >> Sensor data changed mid-read to 8'hAA. sys_reg[15:8] is %h (expected 8'h55)", dut.sys_reg[15:8]);

        // Finish out the state engine loops cleanly
        sel = 1; #20;
        $display("\n--- ALL TESTS DONE ---");
        $finish;
    end

endmodule
