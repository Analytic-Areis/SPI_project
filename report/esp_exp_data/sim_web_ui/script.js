// SPI Core Analyzer & FPGA top.v FSM Simulator Script

let pinStates = { cs: 1, clk: 0, rst: 0, miso: 0, mosi: 0 };
let buffer = [];
const maxSamples = 1000;
let isPaused = false;

// FPGA Core Simulated State
let fpgaState = {
    sensor_data: 0x2800, // 16'h2800 = 0010 1000 0000 0000
    read_reg: 0x2800,
    write_reg: 0x0028,
    fsm_state_name: "DETECT (IDLE)",
    mode: 0,
    addr: 0,
    write_len: 0,
    pass_reg: 0
};

// Zoom and Pan State
let zoomLevel = 0.25;
const minZoom = 0.15;
const maxZoom = 4.0;
let scrollOffset = 0;


// Interactive Canvas & Cursor State
let isDraggingCanvas = false;
let dragStartX = 0;
let dragStartScrollOffset = 0;
let cursorsEnabled = false;
let cursorA = null;
let cursorB = null;
let activeCursorDrag = null;

// Configuration
let clockFreq = 2.0;
let sequenceN = 23;
let csActiveVal = 0;
let recordedMiso = "";

// Background Osc Engine
let simIntervalId = null;
let simulatedSampleCount = 0;
let slideDurationMs = 50;
let lastFrameTime = performance.now();
let interpolationOffset = 0;

// DOM Elements
const numClockFreq = document.getElementById('numClockFreq');
const rngClockFreq = document.getElementById('rngClockFreq');
const numBitsN = document.getElementById('numBitsN');
const txtMosiSeq = document.getElementById('txtMosiSeq');
const lblMosiCounter = document.getElementById('lblMosiCounter');
const btnRunSequence = document.getElementById('btnRunSequence');

const fpgaSensorData = document.getElementById('fpgaSensorData');
const fpgaReadReg = document.getElementById('fpgaReadReg');
const fpgaWriteReg = document.getElementById('fpgaWriteReg');
const fpgaFsmState = document.getElementById('fpgaFsmState');

const valClkFreq = document.getElementById('telClkFreq');
const miniCS = document.getElementById('miniCS');
const miniCLK = document.getElementById('miniCLK');
const miniRST = document.getElementById('miniRST');
const miniMISO = document.getElementById('miniMISO');
const miniMOSI = document.getElementById('miniMOSI');

const canvas = document.getElementById('laCanvas');
const ctx = canvas.getContext('2d');

const zoomLevelDisplay = document.getElementById('zoomLevelDisplay');
const cursorAVal = document.getElementById('cursorAVal');
const cursorBVal = document.getElementById('cursorBVal');
const cursorDeltaVal = document.getElementById('cursorDeltaVal');
const cursorFreqVal = document.getElementById('cursorFreqVal');
const btnToggleCursors = document.getElementById('btnToggleCursors');

const selDecFormat = document.getElementById('selDecFormat');
const lblMisoDataValue = document.getElementById('lblMisoDataValue');
const statBitsCaptured = document.getElementById('statBitsCaptured');
const statClkFreq = document.getElementById('statClkFreq');
const statCaptureTime = document.getElementById('statCaptureTime');
const statTxStatus = document.getElementById('statTxStatus');

function updateFpgaUi() {
    fpgaReadReg.innerText = "0x" + fpgaState.read_reg.toString(16).toUpperCase().padStart(4, '0');
    fpgaWriteReg.innerText = "0x" + fpgaState.write_reg.toString(16).toUpperCase().padStart(4, '0');
    fpgaFsmState.innerText = fpgaState.fsm_state_name;
}

// Quick Presets
function loadPreset(presetName) {
    if (presetName === 'read_2800') {
        // Read Sensor Data 0x2800
        // Opcode '00' (READ), Addr '10000' (5 bits = 16 => read_reg), then 16 clock cycles
        // MOSI = "00" + "10000" + "1111111111111111" (Total 23 bits)
        sequenceN = 23;
        numBitsN.value = 23;
        txtMosiSeq.value = "00100001111111111111111";
        lblMosiCounter.innerText = "23 bits";
        runSequence();
    } else if (presetName === 'write_0028') {
        // Write Register 0x0028 (binary 0000 0000 0010 1000 => bits 3 and 5 are 1)
        // Opcode '01' (WRITE), Addr '00000', write_len '0101' (6 bits), Data '001010'
        // Total 2 + 5 + 4 + 6 = 17 bits
        sequenceN = 17;
        numBitsN.value = 17;
        txtMosiSeq.value = "01000000101001010";
        lblMosiCounter.innerText = "17 bits";
        runSequence();
    } else if (presetName === 'write_a000') {
        // Write A000 via alternating 01010101...
        // Opcode '01' (WRITE), Addr '0101' (5), write_len '0101' (5), Data '0101' -> A000
        sequenceN = 15;
        numBitsN.value = 15;
        txtMosiSeq.value = "010101010101010";
        lblMosiCounter.innerText = "15 bits";
        runSequence();
    }
}

function updateFreqFromRange(val) {
    clockFreq = parseFloat(val);
    numClockFreq.value = clockFreq.toFixed(1);
    valClkFreq.innerText = `${clockFreq.toFixed(1)} Hz`;
}

function updateFreqFromInput(val) {
    clockFreq = Math.max(0.5, Math.min(20, parseFloat(val) || 2.0));
    rngClockFreq.value = clockFreq;
    valClkFreq.innerText = `${clockFreq.toFixed(1)} Hz`;
}

function onNChange(val) {
    sequenceN = parseInt(val) || 8;
    lblMosiCounter.innerText = `${sequenceN} bits`;
}

function validateSeqInput(input) {
    input.value = input.value.replace(/[^01]/g, '');
    lblMosiCounter.innerText = `${input.value.length} bits`;
}

function pushSample(cs, clk, rst, miso, mosi) {
    if (buffer.length >= maxSamples) {
        buffer.shift();
    }
    buffer.push({ cs, clk, rst, miso, mosi, time: Date.now() });
    pinStates = { cs, clk, rst, miso, mosi };
    interpolationOffset += 1.0;
}

function clearBuffer() {
    buffer = [];
    cursorA = null;
    cursorB = null;
    updateCursorInfo();
}

function getXGlobal(idx, W) {
    const sampleWidth = 10 * zoomLevel;
    const animOffset = (scrollOffset === 0 && !isPaused) ? interpolationOffset : 0;
    return W - (buffer.length - 1 - idx - scrollOffset - animOffset) * sampleWidth;
}

function getIndexFromXGlobal(x, W) {
    const sampleWidth = 10 * zoomLevel;
    const animOffset = (scrollOffset === 0 && !isPaused) ? interpolationOffset : 0;
    return Math.round(buffer.length - 1 - scrollOffset - animOffset - (W - x) / sampleWidth);
}

// FPGA top.v Behavioral FSM Simulation Engine
function simulateTopVerilogSequence(n, mosiSeq) {
    let misoResult = "";
    
    let state = "DETECT";
    let mode = 0; // 2 bits
    let addr = 0; // 5 bits
    let write_len = 0; // 4 bits
    let bit_count = 0;
    
    let read_reg = fpgaState.sensor_data; // 16'h2800
    let write_reg = fpgaState.write_reg;
    
    const idleCs = csActiveVal === 1 ? 0 : 1;
    pushSample(idleCs, 0, 0, 0, 0);

    let halfPeriodSamples = Math.round(10.0 / clockFreq);
    if (halfPeriodSamples < 1) halfPeriodSamples = 1;

    for (let i = 0; i < n; i++) {
        const mosiBit = parseInt(mosiSeq[i]) || 0;
        let misoBit = 0;

        // FSM Logic matching top.v
        if (state === "DETECT") {
            if (bit_count === 0) {
                mode = (mode & 0x01) | (mosiBit << 1);
                bit_count = 1;
                fpgaState.fsm_state_name = "DETECT (Bit 0)";
            } else {
                mode = (mode & 0x02) | mosiBit;
                bit_count = 0;
                
                if (mode === 0) { // 2'b00 => READ_ADDR
                    state = "READ_ADDR";
                    read_reg = fpgaState.sensor_data;
                    fpgaState.fsm_state_name = "READ_ADDR";
                } else if (mode === 1) { // 2'b01 => WRITE_ADDR
                    state = "WRITE_ADDR";
                    fpgaState.fsm_state_name = "WRITE_ADDR";
                } else if (mode === 2) { // 2'b10 => SOFT_RESET
                    state = "SOFT_RESET";
                    fpgaState.fsm_state_name = "SOFT_RESET";
                } else if (mode === 3) { // 2'b11 => WHOAMI
                    state = "WHOAMI";
                    fpgaState.fsm_state_name = "WHOAMI";
                }
            }
        }
        else if (state === "READ_ADDR") {
            addr = ((addr << 1) | mosiBit) & 0x1F;
            if (bit_count === 4) { // 5 address bits (0..4)
                bit_count = 0;
                state = "SEND_DATA";
                fpgaState.fsm_state_name = "SEND_DATA";
            } else {
                bit_count++;
            }
        }
        else if (state === "SEND_DATA") {
            // Compute read_idx = (addr + bit_count) % 32
            // In top.v: if read_idx[4] == 1'b0 => write_reg[read_idx[3:0]], else read_reg[read_idx[3:0]]
            let read_idx = (addr + bit_count) % 32;
            let bitIdx = read_idx % 16;
            
            if (read_idx < 16) {
                misoBit = (write_reg >> bitIdx) & 0x01;
            } else {
                misoBit = (read_reg >> bitIdx) & 0x01;
            }

            if (mosiBit === 0 && bit_count > 0) {
                state = "DONE";
                fpgaState.fsm_state_name = "DONE";
                bit_count = 0;
            } else {
                bit_count++;
            }
        }
        else if (state === "WRITE_ADDR") {
            addr = ((addr << 1) | mosiBit) & 0x0F;
            if (bit_count === 3) { // 4 address bits
                bit_count = 0;
                state = "WRITE_LEN";
                fpgaState.fsm_state_name = "WRITE_LEN";
            } else {
                bit_count++;
            }
        }
        else if (state === "WRITE_LEN") {
            write_len = ((write_len << 1) | mosiBit) & 0x0F;
            if (bit_count === 3) {
                bit_count = 0;
                state = "WRITE_DATA";
                fpgaState.fsm_state_name = "WRITE_DATA";
            } else {
                bit_count++;
            }
        }
        else if (state === "WRITE_DATA") {
            let write_idx = (addr + bit_count) % 16;
            if (mosiBit === 1) {
                write_reg |= (1 << write_idx);
            } else {
                write_reg &= ~(1 << write_idx);
            }
            
            if (bit_count >= write_len) {
                bit_count = 0;
                state = "DONE";
                fpgaState.fsm_state_name = "DONE";
            } else {
                bit_count++;
            }
        }
        else if (state === "WHOAMI") {
            let slave_id = 0x07; // 4'b0111
            let bitPos = 3 - (bit_count % 4);
            misoBit = (slave_id >> bitPos) & 0x01;
            if (bit_count === 3) {
                bit_count = 0;
                state = "DONE";
                fpgaState.fsm_state_name = "DONE";
            } else {
                bit_count++;
            }
        }

        misoResult += misoBit.toString();

        // Push LOW clock half
        for (let s = 0; s < halfPeriodSamples; s++) {
            pushSample(csActiveVal, 0, 0, misoBit, mosiBit);
        }
        // Push HIGH clock half
        for (let s = 0; s < halfPeriodSamples; s++) {
            pushSample(csActiveVal, 1, 0, misoBit, mosiBit);
        }
    }

    fpgaState.read_reg = read_reg;
    fpgaState.write_reg = write_reg;
    updateFpgaUi();

    pushSample(idleCs, 0, 0, 0, 0);

    // Auto setup measurement cursors over transaction
    cursorsEnabled = true;
    cursorA = Math.max(0, buffer.length - (n * halfPeriodSamples * 2 + 1));
    cursorB = buffer.length - 1;
    btnToggleCursors.className = "toolbar-btn btn-cursor-toggle active";
    btnToggleCursors.innerText = "Disable Cursors";
    updateCursorInfo();

    return misoResult;
}

function runSequence() {
    const nVal = sequenceN;
    let mosiSeq = txtMosiSeq.value.trim();
    if (mosiSeq.length < nVal) mosiSeq = mosiSeq.padEnd(nVal, '0');

    statTxStatus.innerText = "RUNNING";
    statTxStatus.className = "stat-val running-text";
    btnRunSequence.disabled = true;

    const startTime = Date.now();

    setTimeout(() => {
        const misoResult = simulateTopVerilogSequence(nVal, mosiSeq);
        recordedMiso = misoResult;
        renderRecordedMiso();

        statBitsCaptured.innerText = nVal;
        statClkFreq.innerText = `${clockFreq.toFixed(1)} Hz`;
        statCaptureTime.innerText = `${Date.now() - startTime} ms`;
        statTxStatus.innerText = "SUCCESS";
        statTxStatus.className = "stat-val success-text";

        btnRunSequence.disabled = false;
    }, 100);
}

function renderRecordedMiso() {
    const format = selDecFormat.value;
    const banner = document.querySelector('.miso-output-banner');
    
    if (!recordedMiso) {
        lblMisoDataValue.innerText = "[No capture run yet]";
        banner.classList.remove('recorded-active');
        return;
    }

    banner.classList.add('recorded-active');

    if (format === 'raw') {
        lblMisoDataValue.innerText = recordedMiso;
    } else if (format === 'hex') {
        let hexStr = "";
        for (let i = 0; i < recordedMiso.length; i += 4) {
            const chunk = recordedMiso.substring(i, i + 4);
            const val = parseInt(chunk, 2);
            hexStr += val.toString(16).toUpperCase();
        }
        lblMisoDataValue.innerText = "0x" + hexStr;
    }
}

// Canvas Waveform Drawer
const channels = [
    { name: 'cs', label: 'CS', color: '#00e5ff' },
    { name: 'clk', label: 'CLK', color: '#39ff14' },
    { name: 'rst', label: 'RST', color: '#ff073a' },
    { name: 'miso', label: 'MISO', color: '#ffd700' },
    { name: 'mosi', label: 'MOSI', color: '#bd00ff' }
];

function draw() {
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;

    const now = performance.now();
    const dt = now - lastFrameTime;
    lastFrameTime = now;

    if (interpolationOffset > 0 && !isPaused) {
        interpolationOffset -= dt / slideDurationMs;
        if (interpolationOffset < 0) interpolationOffset = 0;
    }

    ctx.fillStyle = '#03060f';
    ctx.fillRect(0, 0, W, H);

    const numCh = channels.length;
    const chH = H / numCh;
    const waveH = chH - 30;
    
    // Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 1; i < numCh; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * chH); ctx.lineTo(W, i * chH);
        ctx.stroke();
    }

    function getX(idx) { return getXGlobal(idx, W); }
    function getIndexFromX(x) { return getIndexFromXGlobal(x, W); }

    if (buffer.length > 1) {
        channels.forEach((ch, chIdx) => {
            const yCenter = chIdx * chH + chH / 2;
            const yHigh = yCenter - waveH / 2;
            const yLow = yCenter + waveH / 2;

            ctx.strokeStyle = ch.color;
            ctx.lineWidth = 2.5;
            ctx.shadowBlur = 6;
            ctx.shadowColor = ch.color;

            let startIdx = Math.max(0, getIndexFromX(95) - 1);
            let endIdx = Math.min(buffer.length - 1, getIndexFromX(W) + 1);

            ctx.beginPath();
            let first = true;

            for (let i = startIdx; i <= endIdx; i++) {
                const s = buffer[i];
                const val = s[ch.name];
                const x = getX(i);
                const y = val === 1 ? yHigh : yLow;

                if (first) {
                    ctx.moveTo(x, y);
                    first = false;
                } else {
                    const prevY = buffer[i - 1][ch.name] === 1 ? yHigh : yLow;
                    ctx.lineTo(x, prevY);
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        });
    }

    // Cursors
    if (cursorsEnabled && cursorA !== null && cursorB !== null) {
        const xA = getX(cursorA);
        const xB = getX(cursorB);

        if (xA >= 95 && xA <= W) {
            ctx.strokeStyle = '#ff007f'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(xA, 0); ctx.lineTo(xA, H); ctx.stroke();
            ctx.setLineDash([]);
        }
        if (xB >= 95 && xB <= W) {
            ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(xB, 0); ctx.lineTo(xB, H); ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    // Sidebar Channels
    ctx.fillStyle = 'rgba(12, 18, 30, 0.96)';
    ctx.fillRect(0, 0, 95, H);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(95, 0); ctx.lineTo(95, H); ctx.stroke();

    ctx.font = 'bold 11px var(--font-mono)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    channels.forEach((ch, idx) => {
        ctx.fillStyle = ch.color;
        ctx.fillText(ch.label.toUpperCase(), 16, idx * chH + chH / 2 - 3);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = '9px var(--font-sans)';
        let valStr = pinStates[ch.name] !== undefined ? String(pinStates[ch.name]) : "-";
        ctx.fillText(`val: ${valStr}`, 16, idx * chH + chH / 2 + 10);
        ctx.font = 'bold 11px var(--font-mono)';
    });

    requestAnimationFrame(draw);
}

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function togglePause() {
    isPaused = !isPaused;
    document.getElementById('pauseTxt').innerText = isPaused ? "Resume Stream" : "Pause Stream";
}

function toggleCursors() {
    cursorsEnabled = !cursorsEnabled;
    btnToggleCursors.innerText = cursorsEnabled ? "Disable Cursors" : "Enable Cursors";
    if (cursorsEnabled && buffer.length > 10) {
        cursorA = Math.floor(buffer.length * 0.2);
        cursorB = Math.floor(buffer.length * 0.8);
    } else {
        cursorA = null; cursorB = null;
    }
    updateCursorInfo();
}

function updateCursorInfo() {
    if (!cursorsEnabled || cursorA === null || cursorB === null || buffer.length === 0) {
        cursorAVal.innerText = "Disabled"; cursorBVal.innerText = "Disabled";
        cursorDeltaVal.innerText = "--"; cursorFreqVal.innerText = "--";
        return;
    }
    const tA = buffer[cursorA].time;
    const tB = buffer[cursorB].time;
    const deltaMs = Math.abs(tB - tA);
    cursorAVal.innerText = `${cursorA}`;
    cursorBVal.innerText = `${cursorB}`;
    cursorDeltaVal.innerText = `${deltaMs} ms`;
    if (deltaMs > 0) cursorFreqVal.innerText = `${(1000 / deltaMs).toFixed(1)} Hz`;
}

function adjustZoom(factor) {
    zoomLevel = Math.min(maxZoom, Math.max(minZoom, zoomLevel * factor));
    zoomLevelDisplay.innerText = `${Math.round(zoomLevel * 100)}%`;
}

function resetZoomAndScroll() {
    zoomLevel = 0.25; scrollOffset = 0;
    zoomLevelDisplay.innerText = "25%";
}


// Initial Preset Load & Start
loadPreset('read_2800');
draw();
