// SPI Core Analyzer v3.0 - Client Controller Script

let pinStates = { cs: 1, clk: 0, rst: 0, miso: 0, mosi: 0 };
let buffer = [];
const maxSamples = 1000;
let eventSource = null;
let isPaused = false;

// Zoom and Pan State
let zoomLevel = 1.0;
const minZoom = 0.25;
const maxZoom = 4.0;
let scrollOffset = 0; // Offset from right-hand edge

// Interactive Canvas State
let isDraggingCanvas = false;
let dragStartX = 0;
let dragStartScrollOffset = 0;

// Cursor Measurements State
let cursorsEnabled = false;
let cursorA = null; // Buffer index
let cursorB = null; // Buffer index
let activeCursorDrag = null; // 'A' or 'B' or null

// Configuration & Target state
let simulationMode = false;
let clockMode = 'auto'; // 'auto' or 'manual'
let clockFreq = 2.0;    // default 2Hz

// Sequence State
let sequenceN = 8;
let csActiveVal = 0; // Active LOW default
let rstVal = 0;      // RST Off default
let recordedMiso = "";

// Simulated background clock state
let simIntervalId = null;
let simulatedSampleCount = 0;
let simClkState = 0;

// Smooth rolling animation state variables
let interpolationOffset = 0;
let lastFrameTime = performance.now();
let slideDurationMs = 250; // default (dynamically adjusted)

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

// Target IP Configuration
let targetIp = localStorage.getItem('esp_ip') || 
               (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? window.location.hostname : '192.168.4.1');

// DOM Elements
const espIpAddressInput = document.getElementById('espIpAddress');
const btnConnect = document.getElementById('btnConnect');
const chkSimulationMode = document.getElementById('chkSimulationMode');
const statusBadge = document.getElementById('statusBadge');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

const chkControlMode = document.getElementById('chkControlMode');
const lblControlManual = document.getElementById('lblControlManual');
const lblControlAuto = document.getElementById('lblControlAuto');
const autoClockConfig = document.getElementById('autoClockConfig');
const rngClockFreq = document.getElementById('rngClockFreq');
const numClockFreq = document.getElementById('numClockFreq');
const manualControls = document.getElementById('manualControls');

const btnCS = document.getElementById('btnCS');
const btnRST = document.getElementById('btnRST');
const btnMOSI = document.getElementById('btnMOSI');

const numBitsN = document.getElementById('numBitsN');
const selCsActive = document.getElementById('selCsActive');
const selRstLevel = document.getElementById('selRstLevel');
const txtMosiSeq = document.getElementById('txtMosiSeq');
const txtCsSeq = document.getElementById('txtCsSeq');
const txtRstSeq = document.getElementById('txtRstSeq');
const btnRunSequence = document.getElementById('btnRunSequence');

const lblMosiCounter = document.getElementById('lblMosiCounter');
const lblCsCounter = document.getElementById('lblCsCounter');
const lblRstCounter = document.getElementById('lblRstCounter');

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

// Initialize inputs
espIpAddressInput.value = targetIp;

// Canvas setup
function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
}
setupCanvas();
window.addEventListener('resize', setupCanvas);

// IP Connection logic
function toggleConnection() {
    if (eventSource) {
        disconnect();
    } else {
        connect();
    }
}

function connect() {
    targetIp = espIpAddressInput.value.trim();
    if (!targetIp) {
        alert("Please enter a valid IP address.");
        return;
    }
    localStorage.setItem('esp_ip', targetIp);

    // Disable simulation checkbox visually
    chkSimulationMode.checked = false;
    simulationMode = false;
    stopSimulatorEngine();
    
    // Hardware SSE pushes samples every 50ms
    slideDurationMs = 50;

    statusDot.className = "indicator-dot";
    statusText.innerText = "CONNECTING...";
    btnConnect.innerText = "Connecting";
    btnConnect.className = "";

    // Connect SSE Stream
    const streamUrl = `http://${targetIp}/api/stream`;
    eventSource = new EventSource(streamUrl);

    eventSource.onopen = () => {
        statusDot.className = "indicator-dot online";
        statusText.innerText = "CONNECTED";
        btnConnect.innerText = "Disconnect";
        btnConnect.className = "connected";
        // Sync setting states to board
        syncClockStateToBoard();
    };

    eventSource.onmessage = (e) => {
        if (isPaused) return;
        try {
            const data = JSON.parse(e.data);
            pinStates.cs = data.cs;
            pinStates.clk = data.clk;
            pinStates.rst = data.rst;
            pinStates.miso = data.miso;
            pinStates.mosi = data.mosi;

            pushSample(pinStates.cs, pinStates.clk, pinStates.rst, pinStates.miso, pinStates.mosi);
            updateTelemetry();
            updateGpioButtonsUI();
        } catch (err) {
            console.error("SSE parse error:", err);
        }
    };

    eventSource.onerror = (err) => {
        console.error("SSE connection error:", err);
        disconnect();
        statusText.innerText = "CONN FAILED";
        statusDot.className = "indicator-dot";
    };
}

function disconnect() {
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
    statusDot.className = "indicator-dot";
    statusText.innerText = "DISCONNECTED";
    btnConnect.innerText = "Connect";
    btnConnect.className = "";
    updateTelemetry();
}

// Simulation Toggle
function toggleSimulationMode(enable) {
    simulationMode = enable;
    clearBuffer(); // Clear screen on mode switch
    if (simulationMode) {
        disconnect();
        statusDot.className = "indicator-dot simulating";
        statusText.innerText = "SIMULATION ACTIVE";
        btnConnect.innerText = "Connect";
        btnConnect.className = "";
        
        document.getElementById('modeHardwareLabel').style.color = 'var(--text-muted)';
        document.getElementById('modeSimulationLabel').style.color = 'var(--accent-sim)';
        
        startSimulatorEngine();
    } else {
        stopSimulatorEngine();
        document.getElementById('modeHardwareLabel').style.color = 'var(--text-secondary)';
        document.getElementById('modeSimulationLabel').style.color = 'var(--text-muted)';
        connect(); // attempt reconnection
    }
}

// Synchronize control configurations
function syncClockStateToBoard() {
    if (simulationMode || !eventSource) return;
    const freq = parseFloat(numClockFreq.value);
    const idleCs = csActiveVal === 1 ? 0 : 1;
    
    // Clock is always running automatically on the board in both modes; also sync the CS idle state
    fetch(`http://${targetIp}/api/control?auto_clk=1&freq=${freq}&cs=${idleCs}`)
        .then(r => r.json())
        .then(d => {
            // Update pinStates with response values
            pinStates.cs = d.cs;
            pinStates.rst = d.rst;
            pinStates.mosi = d.mosi;
            pinStates.clk = d.clk;
            updateGpioButtonsUI();
        })
        .catch(err => console.error("Error syncing clock state:", err));
}

// Control Mode Toggling (Manual vs Automatic)
function toggleControlMode(isAuto) {
    clockMode = isAuto ? 'auto' : 'manual';
    if (isAuto) {
        lblControlManual.classList.remove('active-clk-mode');
        lblControlAuto.classList.add('active-clk-mode');
        manualControls.classList.add('disabled-state');
    } else {
        lblControlAuto.classList.remove('active-clk-mode');
        lblControlManual.classList.add('active-clk-mode');
        manualControls.classList.remove('disabled-state');
    }
    
    // Background clock is always running automatically
    if (simulationMode) {
        startSimulatorEngine();
    } else {
        syncClockStateToBoard();
    }
}

// Synchronize sliders & text boxes for Clock Freq
function updateFreqFromRange(val) {
    numClockFreq.value = val;
    clockFreq = parseFloat(val);
    if (simulationMode) {
        startSimulatorEngine();
    } else {
        syncClockStateToBoard();
    }
}

function updateFreqFromInput(val) {
    let freq = parseFloat(val);
    if (isNaN(freq) || freq <= 0) freq = 0.1;
    if (freq > 1000) freq = 1000;
    numClockFreq.value = freq;
    
    if (freq <= 50) {
        rngClockFreq.value = freq;
    }
    clockFreq = freq;
    
    if (simulationMode) {
        startSimulatorEngine();
    } else {
        syncClockStateToBoard();
    }
}

// Manual GPIO pin control triggers
function sendManualControl(pin) {
    let nextVal = 0;
    if (pin === 'cs') nextVal = pinStates.cs === 1 ? 0 : 1;
    if (pin === 'rst') nextVal = pinStates.rst === 1 ? 0 : 1;
    if (pin === 'mosi') nextVal = pinStates.mosi === 1 ? 0 : 1;
    if (pin === 'clk') nextVal = pinStates.clk === 1 ? 0 : 1;

    if (simulationMode) {
        pinStates[pin] = nextVal;
        // Update the last sample in the buffer to show change instantly without introducing timing jitter
        if (buffer.length > 0) {
            buffer[buffer.length - 1][pin] = nextVal;
        }
        updateGpioButtonsUI();
        updateTelemetry();
    } else {
        fetch(`http://${targetIp}/api/control?${pin}=${nextVal}`)
            .then(r => r.json())
            .then(d => {
                pinStates.cs = d.cs;
                pinStates.rst = d.rst;
                pinStates.mosi = d.mosi;
                pinStates.clk = d.clk;
                updateGpioButtonsUI();
                updateTelemetry();
            })
            .catch(err => console.error("REST pin control error:", err));
    }
}

function updateGpioButtonsUI() {
    // CS
    if (pinStates.cs === 0) {
        btnCS.innerText = "LOW (Active)";
        btnCS.className = "btn-action active-cs";
    } else {
        btnCS.innerText = "HIGH (Idle)";
        btnCS.className = "btn-action";
    }

    // RST
    if (pinStates.rst === 1) {
        btnRST.innerText = "HIGH (Reset)";
        btnRST.className = "btn-action active-rst";
    } else {
        btnRST.innerText = "LOW (Run)";
        btnRST.className = "btn-action";
    }

    // MOSI
    if (pinStates.mosi === 1) {
        btnMOSI.innerText = "HIGH (1)";
        btnMOSI.className = "btn-action active-mosi";
    } else {
        btnMOSI.innerText = "LOW (0)";
        btnMOSI.className = "btn-action";
    }
}

// Sequence Generator UI management
function onNChange(val) {
    let n = parseInt(val);
    if (isNaN(n) || n < 1) n = 1;
    if (n > 128) n = 128;
    numBitsN.value = n;
    sequenceN = n;
    
    // Resize sequences
    resizeSeqInputs();
}

function onSequenceParamChange() {
    csActiveVal = parseInt(selCsActive.value);
    rstVal = parseInt(selRstLevel.value);
    
    // Reset overrides to defaults based on current settings
    resetSeqToDefault('cs');
    resetSeqToDefault('rst');

    // Update CS pin state to its idle state (opposite of CS active state)
    const nextCsVal = csActiveVal === 1 ? 0 : 1;
    pinStates.cs = nextCsVal;

    if (simulationMode) {
        updateGpioButtonsUI();
        updateTelemetry();
    } else {
        syncClockStateToBoard();
    }
}

function resizeSeqInputs() {
    // Resize MOSI
    let mosi = txtMosiSeq.value.trim().replace(/[^01]/g, '');
    if (mosi.length < sequenceN) {
        mosi = mosi.padEnd(sequenceN, '0');
    } else if (mosi.length > sequenceN) {
        mosi = mosi.substring(0, sequenceN);
    }
    txtMosiSeq.value = mosi;
    lblMosiCounter.innerText = `${mosi.length} bits`;

    // Resize CS sequence override
    let cs = txtCsSeq.value.trim().replace(/[^01]/g, '');
    if (cs.length < sequenceN) {
        cs = cs.padEnd(sequenceN, String(csActiveVal));
    } else if (cs.length > sequenceN) {
        cs = cs.substring(0, sequenceN);
    }
    txtCsSeq.value = cs;
    lblCsCounter.innerText = `${cs.length} bits`;

    // Resize RST sequence override
    let rst = txtRstSeq.value.trim().replace(/[^01]/g, '');
    if (rst.length < sequenceN) {
        rst = rst.padEnd(sequenceN, String(rstVal));
    } else if (rst.length > sequenceN) {
        rst = rst.substring(0, sequenceN);
    }
    txtRstSeq.value = rst;
    lblRstCounter.innerText = `${rst.length} bits`;
}

function resetSeqToDefault(type) {
    if (type === 'cs') {
        txtCsSeq.value = String(csActiveVal).repeat(sequenceN);
        lblCsCounter.innerText = `${sequenceN} bits`;
    } else if (type === 'rst') {
        txtRstSeq.value = String(rstVal).repeat(sequenceN);
        lblRstCounter.innerText = `${sequenceN} bits`;
    }
}

function generateRandomSeq(type) {
    let seq = "";
    for (let i = 0; i < sequenceN; i++) {
        seq += Math.random() > 0.5 ? "1" : "0";
    }
    if (type === 'mosi') {
        txtMosiSeq.value = seq;
        lblMosiCounter.innerText = `${sequenceN} bits`;
    }
}

function validateSeqInput(inputEl) {
    // Only allow 0 and 1
    let val = inputEl.value.replace(/[^01]/g, '');
    inputEl.value = val;
    
    // Update counters
    if (inputEl.id === 'txtMosiSeq') lblMosiCounter.innerText = `${val.length}/${sequenceN} bits`;
    if (inputEl.id === 'txtCsSeq') lblCsCounter.innerText = `${val.length}/${sequenceN} bits`;
    if (inputEl.id === 'txtRstSeq') lblRstCounter.innerText = `${val.length}/${sequenceN} bits`;
}

// Buffer Management
function pushSample(cs, clk, rst, miso, mosi) {
    buffer.push({
        cs: cs,
        clk: clk,
        rst: rst,
        miso: miso,
        mosi: mosi,
        time: Date.now()
    });

    if (buffer.length > maxSamples) {
        buffer.shift();
        
        // Keep scroll locked to same samples when shifted
        if (scrollOffset > 0) {
            scrollOffset = Math.max(0, scrollOffset - 1);
        }

        // Adjust cursor offsets on shift to prevent drifting out of range
        if (cursorsEnabled) {
            if (cursorA !== null) cursorA = Math.max(0, cursorA - 1);
            if (cursorB !== null) cursorB = Math.max(0, cursorB - 1);
        }
    }
    
    // Auto increment offset for smooth timeline scroll animation
    if (scrollOffset === 0 && !isPaused) {
        interpolationOffset += 1.0;
    }
}

function clearBuffer() {
    buffer = [];
    cursorA = null;
    cursorB = null;
    updateCursorInfo();
    updateTelemetry();
}

// Telemetry & States
function updateTelemetry() {
    // Set text outputs
    if (simulationMode) {
        valClkFreq.innerText = clockMode === 'auto' ? `${clockFreq.toFixed(1)} Hz` : "Manual (Pulses)";
    } else if (eventSource && eventSource.readyState === EventSource.OPEN) {
        valClkFreq.innerText = clockMode === 'auto' ? `${clockFreq.toFixed(1)} Hz` : "Manual (GPIO)";
    } else {
        valClkFreq.innerText = "-- Hz";
    }

    // Mini Indicators
    miniCS.className = pinStates.cs === csActiveVal ? "mini-pin-status cs-active" : "mini-pin-status";
    miniCLK.className = pinStates.clk === 1 ? "mini-pin-status clk-active" : "mini-pin-status";
    miniRST.className = pinStates.rst === 1 ? "mini-pin-status rst-active" : "mini-pin-status";
    miniMISO.className = pinStates.miso === 1 ? "mini-pin-status miso-active" : "mini-pin-status";
    miniMOSI.className = pinStates.mosi === 1 ? "mini-pin-status mosi-active" : "mini-pin-status";
}

// Pause stream drawing
function togglePause() {
    isPaused = !isPaused;
    document.getElementById('pauseTxt').innerText = isPaused ? "Resume Stream" : "Pause Stream";
    const btn = document.getElementById('btnPause');
    if (isPaused) {
        btn.classList.remove('text-accent');
        btn.classList.add('text-danger');
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span id="pauseTxt">Resume Stream</span>`;
    } else {
        btn.classList.add('text-accent');
        btn.classList.remove('text-danger');
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg><span id="pauseTxt">Pause Stream</span>`;
    }
}

// Run sequence transaction execution
function runSequence() {
    // Inputs
    const nVal = sequenceN;
    let mosiSeq = txtMosiSeq.value.trim();
    let csSeq = txtCsSeq.value.trim();
    let rstSeq = txtRstSeq.value.trim();
    const freq = clockFreq;
    const isCsActive = csActiveVal;

    // Check padding
    if (mosiSeq.length < nVal) mosiSeq = mosiSeq.padEnd(nVal, '0');
    if (csSeq.length < nVal) csSeq = csSeq.padEnd(nVal, String(isCsActive));
    if (rstSeq.length < nVal) rstSeq = rstSeq.padEnd(nVal, String(rstVal));

    // UI Updates
    statTxStatus.innerText = "RUNNING";
    statTxStatus.className = "stat-val running-text";
    btnRunSequence.disabled = true;
    btnRunSequence.style.opacity = 0.5;

    const startTime = Date.now();

    if (simulationMode) {
        // Run Client Simulation
        setTimeout(() => {
            // Stop background osc
            stopSimulatorEngine();

            const misoResult = executeSimulationSequence(nVal, mosiSeq, csSeq, rstSeq, freq);
            
            recordedMiso = misoResult;
            renderRecordedMiso();
            
            // Update stats
            statBitsCaptured.innerText = nVal;
            statClkFreq.innerText = `${freq.toFixed(1)} Hz`;
            statCaptureTime.innerText = `${(Date.now() - startTime)} ms`;
            statTxStatus.innerText = "SUCCESS";
            statTxStatus.className = "stat-val success-text";
            
            btnRunSequence.disabled = false;
            btnRunSequence.style.opacity = 1;

            // Restart background osc if auto mode is active
            if (simulationMode) {
                startSimulatorEngine();
            }
        }, 150);
    } else {
        // REST API Execution
        const runUrl = `http://${targetIp}/api/sequence?n=${nVal}&mosi=${mosiSeq}&cs=${csSeq}&rst=${rstSeq}&freq=${freq}&cs_active=${isCsActive}`;
        
        fetch(runUrl)
            .then(r => r.json())
            .then(data => {
                if (data.status === "ok") {
                    recordedMiso = data.miso;
                    renderRecordedMiso();
                    
                    // Display perfect visual waveform sequence locally in the buffer
                    injectSequenceWaveformIntoBuffer(nVal, mosiSeq, csSeq, rstSeq, recordedMiso, freq);

                    statBitsCaptured.innerText = nVal;
                    statClkFreq.innerText = `${freq.toFixed(1)} Hz`;
                    statCaptureTime.innerText = `${(Date.now() - startTime)} ms`;
                    statTxStatus.innerText = "SUCCESS";
                    statTxStatus.className = "stat-val success-text";
                } else {
                    statTxStatus.innerText = "ERROR";
                    statTxStatus.className = "stat-val danger-text";
                }
            })
            .catch(err => {
                console.error("Sequence REST trigger error:", err);
                statTxStatus.innerText = "FAILED";
                statTxStatus.className = "stat-val danger-text";
            })
            .finally(() => {
                btnRunSequence.disabled = false;
                btnRunSequence.style.opacity = 1;
            });
    }
}

// Client-side transaction simulation
function executeSimulationSequence(n, mosi, cs, rst, freq) {
    let misoResult = "";
    
    // De-assert CS before we start
    const idleCs = csActiveVal === 1 ? 0 : 1;
    pushSample(idleCs, 0, rstVal, 0, 0);

    // Number of samples per bit cycle
    // Period T = 1000 / freq ms.
    // At 50ms per sample, samples per period = T / 50 = 20 / freq.
    // Half period samples = 10 / freq.
    let halfPeriodSamples = Math.round(10.0 / freq);
    if (halfPeriodSamples < 1) halfPeriodSamples = 1;
    const samplesPerBit = halfPeriodSamples * 2;

    for (let i = 0; i < n; i++) {
        const mosiBit = parseInt(mosi[i]);
        const csBit = parseInt(cs[i]);
        const rstBit = parseInt(rst[i]);

        // MISO is always 0 in simulation mode as requested
        misoResult += "0";

        // Push samples for the LOW half of the clock cycle
        for (let s = 0; s < halfPeriodSamples; s++) {
            pushSample(csBit, 0, rstBit, 0, mosiBit);
        }
        // Push samples for the HIGH half of the clock cycle
        for (let s = 0; s < halfPeriodSamples; s++) {
            pushSample(csBit, 1, rstBit, 0, mosiBit);
        }
    }

    // End transaction
    pushSample(idleCs, 0, rstVal, 0, 0);
    return misoResult;
}

// Inject sequence into visual buffer for high resolution display in hardware mode
function injectSequenceWaveformIntoBuffer(n, mosi, cs, rst, miso, freq) {
    // Number of samples per bit cycle
    let halfPeriodSamples = Math.round(10.0 / freq);
    if (halfPeriodSamples < 1) halfPeriodSamples = 1;
    const samplesPerBit = halfPeriodSamples * 2;
    const totalSamplesToInject = n * samplesPerBit + 2;

    // Discard oldest to fit
    for (let i = 0; i < totalSamplesToInject; i++) {
        if (buffer.length > 0) buffer.shift();
    }

    const idleCs = csActiveVal === 1 ? 0 : 1;
    
    // Prefix
    buffer.push({ cs: idleCs, clk: 0, rst: rstVal, miso: 0, mosi: 0, time: Date.now() - (totalSamplesToInject * 50) });

    for (let i = 0; i < n; i++) {
        const mosiBit = parseInt(mosi[i]);
        const csBit = parseInt(cs[i]);
        const rstBit = parseInt(rst[i]);
        const misoBit = parseInt(miso[i]);

        const sampleTime = Date.now() - (n - i) * (samplesPerBit * 50);

        // Push LOW half
        for (let s = 0; s < halfPeriodSamples; s++) {
            buffer.push({
                cs: csBit,
                clk: 0,
                rst: rstBit,
                miso: misoBit,
                mosi: mosiBit,
                time: sampleTime + s * 50
            });
        }
        // Push HIGH half
        for (let s = 0; s < halfPeriodSamples; s++) {
            buffer.push({
                cs: csBit,
                clk: 1,
                rst: rstBit,
                miso: misoBit,
                mosi: mosiBit,
                time: sampleTime + (halfPeriodSamples + s) * 50
            });
        }
    }

    // Suffix
    buffer.push({ cs: idleCs, clk: 0, rst: rstVal, miso: 0, mosi: 0, time: Date.now() });

    // Enable cursors automatically covering the sequence area
    if (buffer.length >= totalSamplesToInject + 2) {
        cursorsEnabled = true;
        cursorA = buffer.length - totalSamplesToInject;
        cursorB = buffer.length - 1;
        btnToggleCursors.className = "toolbar-btn btn-cursor-toggle active";
        btnToggleCursors.innerText = "Disable Cursors";
        updateCursorInfo();
    }
}

// Display Captured MISO details
function renderRecordedMiso() {
    const format = selDecFormat.value;
    const banner = document.querySelector('.miso-output-banner');
    
    if (!recordedMiso) {
        lblMisoDataValue.innerText = "[No capture run yet. Click 'Run Sequence' to capture data]";
        banner.classList.remove('recorded-active');
        return;
    }

    banner.classList.add('recorded-active');

    if (format === 'raw') {
        lblMisoDataValue.innerText = recordedMiso;
    } else if (format === 'hex') {
        // Group bits into 8-bit chunks and convert to Hex
        let hexStr = "";
        for (let i = 0; i < recordedMiso.length; i += 8) {
            const chunk = recordedMiso.substring(i, i + 8);
            const val = parseInt(chunk, 2);
            hexStr += "0x" + val.toString(16).toUpperCase().padStart(2, '0') + " ";
        }
        lblMisoDataValue.innerText = hexStr.trim() || "0x00";
    } else if (format === 'ascii') {
        // Group bits into 8-bit chunks and convert to ASCII
        let asciiStr = "";
        for (let i = 0; i < recordedMiso.length; i += 8) {
            const chunk = recordedMiso.substring(i, i + 8);
            const val = parseInt(chunk, 2);
            if (val >= 32 && val <= 126) {
                asciiStr += String.fromCharCode(val);
            } else {
                asciiStr += ".";
            }
        }
        lblMisoDataValue.innerText = asciiStr || ".";
    }
}

// Cursors Helper
function toggleCursors() {
    cursorsEnabled = !cursorsEnabled;
    btnToggleCursors.className = cursorsEnabled ? "toolbar-btn btn-cursor-toggle active" : "toolbar-btn btn-cursor-toggle";
    btnToggleCursors.innerText = cursorsEnabled ? "Disable Cursors" : "Enable Cursors";
    
    if (cursorsEnabled && buffer.length > 10) {
        cursorA = Math.floor(buffer.length * 0.35);
        cursorB = Math.floor(buffer.length * 0.65);
    } else {
        cursorA = null;
        cursorB = null;
    }
    updateCursorInfo();
}

function updateCursorInfo() {
    if (!cursorsEnabled || cursorA === null || cursorB === null || buffer.length === 0) {
        cursorAVal.innerText = "Disabled";
        cursorBVal.innerText = "Disabled";
        cursorDeltaVal.innerText = "--";
        cursorFreqVal.innerText = "--";
        return;
    }

    const tA = buffer[cursorA].time;
    const tB = buffer[cursorB].time;
    const deltaMs = Math.abs(tB - tA);
    const deltaSec = deltaMs / 1000;

    cursorAVal.innerText = `${formatTimestamp(tA)}`;
    cursorBVal.innerText = `${formatTimestamp(tB)}`;
    
    if (deltaMs < 1) {
        cursorDeltaVal.innerText = `${(deltaMs * 1000).toFixed(0)} μs`;
    } else if (deltaMs < 1000) {
        cursorDeltaVal.innerText = `${deltaMs.toFixed(1)} ms`;
    } else {
        cursorDeltaVal.innerText = `${deltaSec.toFixed(2)} s`;
    }

    if (deltaSec > 0) {
        const freq = 1 / deltaSec;
        if (freq < 1) {
            cursorFreqVal.innerText = `${freq.toFixed(2)} Hz`;
        } else if (freq < 1000) {
            cursorFreqVal.innerText = `${freq.toFixed(1)} Hz`;
        } else if (freq < 1000000) {
            cursorFreqVal.innerText = `${(freq/1000).toFixed(1)} kHz`;
        } else {
            cursorFreqVal.innerText = `${(freq/1000000).toFixed(2)} MHz`;
        }
    } else {
        cursorFreqVal.innerText = "--";
    }
}

function formatTimestamp(timeMs) {
    const d = new Date(timeMs);
    const timeStr = d.toTimeString().split(' ')[0];
    const ms = String(timeMs % 1000).padStart(3, '0');
    return `${timeStr}.${ms}`;
}

// Waveform Canvas Zoom & Scroll
function limitScrollOffset() {
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const sampleWidth = 10 * zoomLevel;
    const maxVisibleSamples = Math.floor((W - 95) / sampleWidth);
    const maxOffset = Math.max(0, buffer.length - maxVisibleSamples);
    
    scrollOffset = Math.min(maxOffset, Math.max(0, scrollOffset));
}

function adjustZoom(factor) {
    const oldZoom = zoomLevel;
    zoomLevel = Math.min(maxZoom, Math.max(minZoom, zoomLevel * factor));
    zoomLevelDisplay.innerText = `${Math.round(zoomLevel * 100)}%`;
    
    scrollOffset = Math.round(scrollOffset * (zoomLevel / oldZoom));
    limitScrollOffset();
}

function resetZoomAndScroll() {
    zoomLevel = 1.0;
    scrollOffset = 0;
    zoomLevelDisplay.innerText = "100%";
}

// High Fidelity Canvas Waveform Drawer
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

    // Smooth rolling animation offset decay
    const now = performance.now();
    const dt = now - lastFrameTime;
    lastFrameTime = now;

    if (interpolationOffset > 0 && !isPaused) {
        interpolationOffset -= dt / slideDurationMs;
        if (interpolationOffset < 0) {
            interpolationOffset = 0;
        }
    }

    // Reset background
    ctx.fillStyle = '#03060f';
    ctx.fillRect(0, 0, W, H);

    const numCh = channels.length;
    const chH = H / numCh;
    const waveH = chH - 34;
    const sampleWidth = 10 * zoomLevel;
    
    limitScrollOffset();

    function getX(idx) {
        return getXGlobal(idx, W);
    }

    function getIndexFromX(x) {
        return getIndexFromXGlobal(x, W);
    }

    // Horizontal separators
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 1; i < numCh; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * chH);
        ctx.lineTo(W, i * chH);
        ctx.stroke();
    }

    // Dotted Grid ticks
    const gridSpacing = 40 * zoomLevel;
    const startPixel = W - ((scrollOffset * sampleWidth) % gridSpacing);
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
    for (let x = startPixel; x > 95; x -= gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
    }
    ctx.setLineDash([]); // Reset line dash

    // Draw signals
    if (buffer.length > 1) {
        channels.forEach((ch, chIdx) => {
            const yCenter = chIdx * chH + chH / 2;
            const yHigh = yCenter - waveH / 2;
            const yLow = yCenter + waveH / 2;

            ctx.strokeStyle = ch.color;
            ctx.lineWidth = 2.5;

            // Pulse shadow glow
            ctx.shadowBlur = 6;
            ctx.shadowColor = ch.color;

            let startIdx = getIndexFromX(95) - 1;
            let endIdx = getIndexFromX(W) + 1;
            
            startIdx = Math.max(0, startIdx);
            endIdx = Math.min(buffer.length - 1, endIdx);

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
                    const prevX = getX(i - 1);
                    const prevY = buffer[i - 1][ch.name] === 1 ? yHigh : yLow;
                    
                    // Draw square transitions
                    ctx.lineTo(x, prevY);
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();

            // Gradient Fills below High status
            ctx.shadowBlur = 0; // disable shadow for fill
            ctx.fillStyle = hexToRgbA(ch.color, 0.06);
            
            ctx.beginPath();
            let fillStarted = false;
            let fillStartX = 95;

            for (let i = startIdx; i <= endIdx; i++) {
                const s = buffer[i];
                const val = s[ch.name];
                const x = getX(i);

                if (val === 1) {
                    if (!fillStarted) {
                        fillStartX = Math.max(95, x);
                        ctx.moveTo(fillStartX, yLow);
                        ctx.lineTo(fillStartX, yHigh);
                        fillStarted = true;
                    }
                    ctx.lineTo(x, yHigh);
                } else {
                    if (fillStarted) {
                        ctx.lineTo(x, yHigh);
                        ctx.lineTo(x, yLow);
                        ctx.closePath();
                        ctx.fill();
                        ctx.beginPath();
                        fillStarted = false;
                    }
                }
            }
            
            if (fillStarted) {
                const lastX = Math.min(W, getX(endIdx));
                ctx.lineTo(lastX, yHigh);
                ctx.lineTo(lastX, yLow);
                ctx.closePath();
                ctx.fill();
            }
        });
    }

    // Draw Cursors
    if (cursorsEnabled && cursorA !== null && cursorB !== null) {
        const xA = getX(cursorA);
        const xB = getX(cursorB);

        // A (Pink)
        if (xA >= 95 && xA <= W) {
            ctx.strokeStyle = '#ff007f';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(xA, 0); ctx.lineTo(xA, H);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = '#ff007f';
            ctx.beginPath();
            ctx.moveTo(xA - 7, 0); ctx.lineTo(xA + 7, 0); ctx.lineTo(xA, 8);
            ctx.closePath();
            ctx.fill();
            ctx.font = 'bold 9px var(--font-sans)';
            ctx.fillText('A', xA - 3, 17);
        }

        // B (Blue)
        if (xB >= 95 && xB <= W) {
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(xB, 0); ctx.lineTo(xB, H);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = '#00f0ff';
            ctx.beginPath();
            ctx.moveTo(xB - 7, 0); ctx.lineTo(xB + 7, 0); ctx.lineTo(xB, 8);
            ctx.closePath();
            ctx.fill();
            ctx.font = 'bold 9px var(--font-sans)';
            ctx.fillText('B', xB - 3, 17);
        }
    }

    // Sidebar Channel Name Badges
    ctx.fillStyle = 'rgba(12, 18, 30, 0.96)';
    ctx.fillRect(0, 0, 95, H);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(95, 0);
    ctx.lineTo(95, H);
    ctx.stroke();

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

function hexToRgbA(hex, alpha){
    let c;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        c= hex.substring(1).split('');
        if(c.length== 3){
            c= [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c= '0x' + c.join('');
        return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
    }
    return 'rgba(255,255,255,0.1)';
}

// Drag & zoom operations
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const W = rect.width;
    
    if (cursorsEnabled && cursorA !== null && cursorB !== null) {
        const xA = getXGlobal(cursorA, W);
        const xB = getXGlobal(cursorB, W);

        if (Math.abs(x - xA) < 12) {
            activeCursorDrag = 'A';
            return;
        }
        if (Math.abs(x - xB) < 12) {
            activeCursorDrag = 'B';
            return;
        }
    }

    if (x > 95) {
        isDraggingCanvas = true;
        dragStartX = e.clientX;
        dragStartScrollOffset = scrollOffset;
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const W = rect.width;

    let showResizeCursor = false;
    if (cursorsEnabled && cursorA !== null && cursorB !== null) {
        const xA = getXGlobal(cursorA, W);
        const xB = getXGlobal(cursorB, W);
        if (Math.abs(x - xA) < 12 || Math.abs(x - xB) < 12) {
            showResizeCursor = true;
        }
    }
    
    canvas.style.cursor = activeCursorDrag ? 'ew-resize' : (showResizeCursor ? 'ew-resize' : (isDraggingCanvas ? 'grabbing' : 'grab'));

    if (activeCursorDrag && buffer.length > 0) {
        let index = getIndexFromXGlobal(x, W);
        index = Math.max(0, Math.min(buffer.length - 1, index));

        if (activeCursorDrag === 'A') {
            cursorA = index;
        } else {
            cursorB = index;
        }
        updateCursorInfo();
        return;
    }

    if (isDraggingCanvas) {
        const dx = e.clientX - dragStartX;
        const sampleWidth = 10 * zoomLevel;
        scrollOffset = dragStartScrollOffset + Math.round(dx / sampleWidth);
        limitScrollOffset();
    }
});

window.addEventListener('mouseup', () => {
    isDraggingCanvas = false;
    activeCursorDrag = null;
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    adjustZoom(factor);
});

// Simulator Engine
function startSimulatorEngine() {
    stopSimulatorEngine();

    simulatedSampleCount = 0;
    
    // Always tick at 50ms (20Hz) to match hardware SSE sampling rate
    const tickMs = 50;
    slideDurationMs = 50;

    simIntervalId = setInterval(() => {
        simulatedSampleCount++;

        // Base states
        let sample = {
            cs: pinStates.cs,
            clk: 0,
            rst: pinStates.rst,
            miso: 0,
            mosi: pinStates.mosi,
            time: Date.now()
        };

        // Oscillate clock automatically at clockFreq
        // T_period = 1000 / clockFreq ms.
        // Samples per period = T_period / 50 = 20 / clockFreq.
        const samplesPerPeriod = 20.0 / clockFreq;
        const phase = (simulatedSampleCount % samplesPerPeriod) / samplesPerPeriod;
        
        // 50% duty cycle CLK
        sample.clk = phase >= 0.5 ? 1 : 0;
        pinStates.clk = sample.clk;

        pinStates.cs = sample.cs;
        pinStates.rst = sample.rst;
        pinStates.miso = sample.miso;
        pinStates.mosi = sample.mosi;

        pushSample(sample.cs, sample.clk, sample.rst, sample.miso, sample.mosi);
        updateTelemetry();
        updateGpioButtonsUI();
    }, tickMs);
}

function stopSimulatorEngine() {
    if (simIntervalId) {
        clearInterval(simIntervalId);
        simIntervalId = null;
    }
}

// Initial start setup
onNChange(8);
onSequenceParamChange();
toggleSimulationMode(true); // Default to simulation mode for smooth immediate usage
draw();
