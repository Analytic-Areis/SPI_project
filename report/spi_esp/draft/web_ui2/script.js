// SPI Core Analyzer v2.0 - Client Controller Script
let pinStates = { cs: 1, clk: 0, rst: 0, miso: 0, mosi: 0 };
let buffer = [];
const maxSamples = 1000;
let eventSource = null;
let isPaused = false;

// Zoom and Pan State
let zoomLevel = 1.0;
const minZoom = 0.2;
const maxZoom = 5.0;
let scrollOffset = 0; // Offset in terms of samples from the right-hand edge

// Interactive Canvas State
let isDraggingCanvas = false;
let dragStartX = 0;
let dragStartScrollOffset = 0;

// Cursor Measurements State
let cursorsEnabled = false;
let cursorA = null; // Buffer index
let cursorB = null; // Buffer index
let activeCursorDrag = null; // 'A' or 'B' or null

// Hover Highlight State
let hoveredTxRange = null; // { startIdx, endIdx }

// Simulation Engine State
let simulationMode = false;
let simIntervalId = null;
let simTimeCounter = 0;
let simState = 'IDLE'; // 'IDLE' or 'TX'
let simTxByteIndex = 0;
let simBitIndex = 7;
let simClkState = 0;
let simTxMOSIBytes = [];
let simTxMISOBytes = [];
let simTxStartIdx = -1;
let simulatedSampleCount = 0;

// SPI Decoder Settings
let spiSettings = {
    mode: 0, // Mode 0 (CPOL=0, CPHA=0), Mode 1 (CPOL=0, CPHA=1), Mode 2 (CPOL=1, CPHA=0), Mode 3 (CPOL=1, CPHA=1)
    bitOrder: 'msb', // 'msb' or 'lsb'
    wordLength: 8   // 8 or 16
};

// Decoded Transactions History
let decodedTransactions = [];
let txCounter = 0;

// URL parameter helper to extract target IP if passed in (e.g. ?ip=192.168.1.100)
const urlParams = new URLSearchParams(window.location.search);
const urlIp = urlParams.get('ip');

// Target IP Configuration
let targetIp = urlIp || 
               localStorage.getItem('esp_ip') || 
               (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? window.location.hostname : '192.168.4.1');

// DOM Elements
const espIpAddressInput = document.getElementById('espIpAddress');
const btnConnect = document.getElementById('btnConnect');
const chkSimulationMode = document.getElementById('chkSimulationMode');
const statusBadge = document.getElementById('statusBadge');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

const btnCS = document.getElementById('btnCS');
const btnRST = document.getElementById('btnRST');
const btnMOSI = document.getElementById('btnMOSI');

const valClkFreq = document.getElementById('telClkFreq');
const valClkDuty = document.getElementById('telClkDuty');
const valTxCount = document.getElementById('telTxCount');

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
const decoderLogBody = document.getElementById('decoderLogBody');
const txtBurstHex = document.getElementById('txtBurstHex');

// Set target IP input field
espIpAddressInput.value = targetIp;

// Canvas setup with HDPI support
function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
}
setupCanvas();
window.addEventListener('resize', setupCanvas);

// Update configuration inputs based on saved states
function updateSpiSettings() {
    spiSettings.mode = parseInt(document.getElementById('selSpiMode').value);
    spiSettings.bitOrder = document.getElementById('selBitOrder').value;
    spiSettings.wordLength = parseInt(document.getElementById('selWordLength').value);
    
    // Reparse the buffer with new settings
    reprocessSpiDecoding();
}

// Helper to determine if a CLK edge is the active sampling edge
function isSamplingEdge(prevClk, currentClk) {
    // Mode 0: CPOL=0, CPHA=0. Clock idle LOW, sample on RISING edge (0 -> 1)
    // Mode 1: CPOL=0, CPHA=1. Clock idle LOW, sample on FALLING edge (1 -> 0)
    // Mode 2: CPOL=1, CPHA=0. Clock idle HIGH, sample on FALLING edge (1 -> 0)
    // Mode 3: CPOL=1, CPHA=1. Clock idle HIGH, sample on RISING edge (0 -> 1)
    if (spiSettings.mode === 0) return prevClk === 0 && currentClk === 1;
    if (spiSettings.mode === 1) return prevClk === 1 && currentClk === 0;
    if (spiSettings.mode === 2) return prevClk === 1 && currentClk === 0;
    if (spiSettings.mode === 3) return prevClk === 0 && currentClk === 1;
    return false;
}

// Reset/clear buffer data
function clearBuffer() {
    buffer = [];
    decodedTransactions = [];
    txCounter = 0;
    hoveredTxRange = null;
    cursorA = null;
    cursorB = null;
    updateCursorInfo();
    renderDecodedHistory();
    updateTelemetry();
}

// Clear protocol decoder logs manually
function clearDecoderLog() {
    decodedTransactions = [];
    renderDecodedHistory();
}

// Toggle manual buttons UI
function updateGpioButtonsUI() {
    if (pinStates.cs === 0) {
        btnCS.innerText = "LOW (Active)";
        btnCS.className = "btn-action active-low";
        miniCS.className = "mini-pin-status cs-active";
    } else {
        btnCS.innerText = "HIGH (Idle)";
        btnCS.className = "btn-action";
        miniCS.className = "mini-pin-status";
    }

    if (pinStates.rst === 1) {
        btnRST.innerText = "HIGH (Reset)";
        btnRST.className = "btn-action active-rst";
        miniRST.className = "mini-pin-status rst-active";
    } else {
        btnRST.innerText = "LOW (Run)";
        btnRST.className = "btn-action";
        miniRST.className = "mini-pin-status";
    }

    if (pinStates.mosi === 1) {
        btnMOSI.innerText = "HIGH (1)";
        btnMOSI.className = "btn-action active-high";
        miniMOSI.className = "mini-pin-status mosi-active";
    } else {
        btnMOSI.innerText = "LOW (0)";
        btnMOSI.className = "btn-action";
        miniMOSI.className = "mini-pin-status";
    }

    // Read-only indicator statuses
    miniCLK.className = pinStates.clk === 1 ? "mini-pin-status clk-active" : "mini-pin-status";
    miniMISO.className = pinStates.miso === 1 ? "mini-pin-status miso-active" : "mini-pin-status";
}

// Send GET REST control commands to ESP32
function sendControl(pin) {
    if (simulationMode) {
        // Toggle simulated pins directly
        let nextVal = 0;
        if (pin === 'cs') nextVal = pinStates.cs === 1 ? 0 : 1;
        if (pin === 'rst') nextVal = pinStates.rst === 1 ? 0 : 1;
        if (pin === 'mosi') nextVal = pinStates.mosi === 1 ? 0 : 1;
        
        pinStates[pin] = nextVal;
        updateGpioButtonsUI();
        return;
    }

    let nextVal = 0;
    if (pin === 'cs') nextVal = pinStates.cs === 1 ? 0 : 1;
    if (pin === 'rst') nextVal = pinStates.rst === 1 ? 0 : 1;
    if (pin === 'mosi') nextVal = pinStates.mosi === 1 ? 0 : 1;

    // Optimistic UI update
    pinStates[pin] = nextVal;
    updateGpioButtonsUI();

    const controlUrl = `http://${targetIp}/api/control?${pin}=${nextVal}`;
    fetch(controlUrl)
        .then(r => r.json())
        .catch(err => console.error("REST Control error:", err));
}

// Send raw hex byte stimulus
function triggerBurstHex() {
    const rawVal = txtBurstHex.value.trim();
    if (!/^[0-9A-Fa-f]{1,2}$/.test(rawVal)) {
        alert("Please enter a valid 1-byte hex value (00 to FF)");
        return;
    }
    const byteVal = parseInt(rawVal, 16);

    if (simulationMode) {
        // Simulate sending this specific byte
        startSimulatedTransaction([byteVal], [Math.floor(Math.random() * 256)]);
    } else {
        alert("The ESP32 firmware only supports static pin control APIs. Toggle Simulation Mode to test dynamic byte sending and decoding!");
    }
}

// Stream Pause toggle
function togglePause() {
    isPaused = !isPaused;
    document.getElementById('pauseTxt').innerText = isPaused ? "Resume Stream" : "Pause Stream";
    const btn = document.getElementById('btnPause');
    if (isPaused) {
        btn.classList.remove('text-accent');
        btn.classList.add('text-danger');
    } else {
        btn.classList.add('text-accent');
        btn.classList.remove('text-danger');
    }
}

// Real-time protocol decoding scanner over the entire buffer
function reprocessSpiDecoding() {
    decodedTransactions = [];
    let inTransaction = false;
    let localTxCounter = 0;
    let activeTx = null;
    let prevClk = null;

    for (let i = 0; i < buffer.length; i++) {
        const s = buffer[i];
        
        if (s.cs === 0) {
            // CS asserted (LOW)
            if (!inTransaction) {
                inTransaction = true;
                localTxCounter++;
                activeTx = {
                    txNum: localTxCounter,
                    timestamp: formatTimestamp(s.time),
                    mosiBits: [],
                    misoBits: [],
                    startIdx: i,
                    endIdx: i
                };
            }
            
            activeTx.endIdx = i;

            // Check for clock sampling edges
            if (prevClk !== null && isSamplingEdge(prevClk, s.clk)) {
                activeTx.mosiBits.push(s.mosi);
                activeTx.misoBits.push(s.miso);
            }
        } else {
            // CS deasserted (HIGH)
            if (inTransaction) {
                inTransaction = false;
                processCompletedTransaction(activeTx);
                activeTx = null;
            }
        }
        prevClk = s.clk;
    }

    // If still in transaction at the end of the buffer, process current partial data
    if (inTransaction && activeTx) {
        processCompletedTransaction(activeTx);
    }

    txCounter = localTxCounter;
    renderDecodedHistory();
    updateTelemetry();
}

// Convert collected bits into formatted bytes
function processCompletedTransaction(tx) {
    const mosiBytes = bitsToBytes(tx.mosiBits);
    const misoBytes = bitsToBytes(tx.misoBits);
    
    decodedTransactions.push({
        txNum: tx.txNum,
        timestamp: tx.timestamp,
        mosiBytes: mosiBytes,
        misoBytes: misoBytes,
        startIdx: tx.startIdx,
        endIdx: tx.endIdx
    });
}

function bitsToBytes(bits) {
    const bytes = [];
    const size = spiSettings.wordLength;
    const isMsb = spiSettings.bitOrder === 'msb';

    for (let i = 0; i < bits.length; i += size) {
        const chunk = bits.slice(i, i + size);
        if (chunk.length < size) break; // Incomplete word, discard

        let val = 0;
        for (let b = 0; b < size; b++) {
            const bit = chunk[b];
            if (isMsb) {
                // MSB first
                val |= (bit << (size - 1 - b));
            } else {
                // LSB first
                val |= (bit << b);
            }
        }
        bytes.push(val);
    }
    return bytes;
}

// Format raw timestamps nicely
function formatTimestamp(timeMs) {
    const d = new Date(timeMs);
    const timeStr = d.toTimeString().split(' ')[0];
    const ms = String(timeMs % 1000).padStart(3, '0');
    return `${timeStr}.${ms}`;
}

// Render the decoded transactions to the UI table
function renderDecodedHistory() {
    const format = selDecFormat.value;
    
    if (decodedTransactions.length === 0) {
        decoderLogBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="4">No transactions captured. Ensure CS line is asserted (LOW) to record transaction packets.</td>
            </tr>`;
        return;
    }

    let html = "";
    decodedTransactions.forEach(tx => {
        const mosiStr = formatPayload(tx.mosiBytes, format);
        const misoStr = formatPayload(tx.misoBytes, format);
        
        // Check if this row is currently hovered to draw highlighting
        const isHovered = hoveredTxRange && 
                         hoveredTxRange.startIdx === tx.startIdx && 
                         hoveredTxRange.endIdx === tx.endIdx;
        const rowClass = isHovered ? "class='active-row-highlight'" : "";

        html += `
            <tr ${rowClass} 
                onmouseenter="setTxHighlight(${tx.startIdx}, ${tx.endIdx})" 
                onmouseleave="clearTxHighlight()">
                <td class="tx-num">#${tx.txNum}</td>
                <td>${tx.timestamp}</td>
                <td class="payload-hex">${mosiStr}</td>
                <td class="payload-hex">${misoStr}</td>
            </tr>`;
    });

    decoderLogBody.innerHTML = html;
}

function formatPayload(bytes, format) {
    if (bytes.length === 0) return "<span style='color: var(--text-muted)'>[No Clock Cycles]</span>";

    return bytes.map(b => {
        if (format === 'hex') {
            return '0x' + b.toString(16).toUpperCase().padStart(2, '0');
        } else if (format === 'dec') {
            return b.toString(10);
        } else if (format === 'bin') {
            return b.toString(2).padStart(spiSettings.wordLength, '0');
        } else if (format === 'ascii') {
            // Display printable characters, else dot
            return (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
        }
    }).join(format === 'ascii' ? '' : ' ');
}

// Highlighting connection between table and logic canvas
function setTxHighlight(startIdx, endIdx) {
    hoveredTxRange = { startIdx, endIdx };
}

function clearTxHighlight() {
    hoveredTxRange = null;
}

// Adjust Zoom Levels
function adjustZoom(factor) {
    const oldZoom = zoomLevel;
    zoomLevel = Math.min(maxZoom, Math.max(minZoom, zoomLevel * factor));
    zoomLevelDisplay.innerText = `${Math.round(zoomLevel * 100)}%`;
    
    // Readjust scrollOffset so that zooming stays centered approximately
    scrollOffset = Math.round(scrollOffset * (zoomLevel / oldZoom));
    limitScrollOffset();
}

function resetZoomAndScroll() {
    zoomLevel = 1.0;
    scrollOffset = 0;
    zoomLevelDisplay.innerText = "100%";
}

// Telemetry calculation
function updateTelemetry() {
    valTxCount.innerText = txCounter;

    if (buffer.length < 5) {
        valClkFreq.innerText = "-- Hz";
        valClkDuty.innerText = "-- %";
        return;
    }

    // Estimate clock frequency from transitions
    let clkTransitions = [];
    for (let i = 1; i < buffer.length; i++) {
        if (buffer[i-1].clk !== buffer[i].clk) {
            clkTransitions.push({
                idx: i,
                time: buffer[i].time,
                val: buffer[i].clk
            });
        }
    }

    if (clkTransitions.length >= 4) {
        // Measure average period between rising edges
        let periods = [];
        let highDurations = [];
        
        for (let i = 2; i < clkTransitions.length; i++) {
            const current = clkTransitions[i];
            const prev = clkTransitions[i-1];
            
            // Period is duration between same edges (e.g. rising to rising or falling to falling)
            // But we can approximate active cycle durations:
            const duration = current.time - prev.time;
            
            if (prev.val === 1) {
                // High duration
                highDurations.push(duration);
            }
            
            if (i >= 3) {
                // Two half periods = full period
                const fullPeriod = (current.time - clkTransitions[i-2].time);
                periods.push(fullPeriod);
            }
        }

        const avgPeriod = periods.reduce((a,b)=>a+b, 0) / periods.length; // in ms
        const avgHigh = highDurations.reduce((a,b)=>a+b, 0) / highDurations.length;

        if (avgPeriod > 0) {
            const freq = 1000 / avgPeriod; // conversion to Hz
            
            if (freq < 1) {
                valClkFreq.innerText = `${freq.toFixed(2)} Hz`;
            } else if (freq < 1000) {
                valClkFreq.innerText = `${freq.toFixed(1)} Hz`;
            } else {
                valClkFreq.innerText = `${(freq/1000).toFixed(2)} kHz`;
            }

            const duty = (avgHigh / (avgPeriod / 2)) * 50; // simple percentage approximation
            valClkDuty.innerText = `${Math.min(100, Math.max(0, duty)).toFixed(0)}%`;
        }
    } else {
        valClkFreq.innerText = "-- Hz";
        valClkDuty.innerText = "-- %";
    }
}

// Cursor measurement helper
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

// Canvas viewport scrolling boundaries
function limitScrollOffset() {
    const W = canvas.getBoundingClientRect().width;
    const sampleWidth = 8 * zoomLevel;
    const maxVisibleSamples = Math.floor((W - 90) / sampleWidth);
    const maxOffset = Math.max(0, buffer.length - maxVisibleSamples);
    
    scrollOffset = Math.min(maxOffset, Math.max(0, scrollOffset));
}

// Draw logic analyzer waveforms
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

    // Clear Canvas
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, W, H);

    const numCh = channels.length;
    const chH = H / numCh;
    const waveH = chH - 32;

    const sampleWidth = 8 * zoomLevel;
    limitScrollOffset();

    // Map function to translate buffer indices to screen X coordinates
    function getX(idx) {
        // We draw from right side backwards.
        // scrollOffset offsets the view backwards.
        return W - (buffer.length - 1 - idx - scrollOffset) * sampleWidth;
    }

    // Map screen X coordinate back to buffer index
    function getIndexFromX(x) {
        return Math.round(buffer.length - 1 - scrollOffset - (W - x) / sampleWidth);
    }

    // Draw horizontal grid lines / separators
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i < numCh; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * chH);
        ctx.lineTo(W, i * chH);
        ctx.stroke();
    }

    // Draw vertical dotted grid lines scrolling with timeline
    const gridSpacing = 50 * zoomLevel;
    const startPixel = W - ((scrollOffset * sampleWidth) % gridSpacing);
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    for (let x = startPixel; x > 90; x -= gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
    }
    ctx.setLineDash([]); // Reset line dash

    // Draw Transaction Hover Highlight Band
    if (hoveredTxRange && buffer.length > 0) {
        const startX = Math.max(90, getX(hoveredTxRange.startIdx));
        const endX = Math.min(W, getX(hoveredTxRange.endIdx));
        
        if (startX < W && endX > 90) {
            ctx.fillStyle = 'rgba(0, 240, 255, 0.07)';
            ctx.fillRect(startX, 0, endX - startX, H);
            
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(startX, 0); ctx.lineTo(startX, H);
            ctx.moveTo(endX, 0); ctx.lineTo(endX, H);
            ctx.stroke();
        }
    }

    // Draw Waveforms
    if (buffer.length > 1) {
        channels.forEach((ch, chIdx) => {
            const yCenter = chIdx * chH + chH / 2;
            const yHigh = yCenter - waveH / 2;
            const yLow = yCenter + waveH / 2;

            ctx.strokeStyle = ch.color;
            ctx.lineWidth = 2;

            // Apply soft glow shadow
            ctx.shadowBlur = 6;
            ctx.shadowColor = ch.color;

            // Find visible range of samples
            let startIdx = getIndexFromX(90) - 1;
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
                    
                    // Draw step (square wave transition edge)
                    ctx.lineTo(x, prevY);
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();

            // Draw translucent color fill under high logic levels for premium UI look
            ctx.shadowBlur = 0; // Disable shadow for fills
            ctx.fillStyle = hexToRgbA(ch.color, 0.05);
            
            ctx.beginPath();
            let fillStarted = false;
            let fillStartX = 90;

            for (let i = startIdx; i <= endIdx; i++) {
                const s = buffer[i];
                const val = s[ch.name];
                const x = getX(i);

                if (val === 1) {
                    if (!fillStarted) {
                        fillStartX = Math.max(90, x);
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

    // Draw Measurement Cursors
    if (cursorsEnabled && cursorA !== null && cursorB !== null) {
        const xA = getX(cursorA);
        const xB = getX(cursorB);

        // Draw Cursor A (Pink)
        if (xA >= 90 && xA <= W) {
            ctx.strokeStyle = '#ff007f';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(xA, 0); ctx.lineTo(xA, H);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw Cursor handle A
            ctx.fillStyle = '#ff007f';
            ctx.beginPath();
            ctx.moveTo(xA - 7, 0); ctx.lineTo(xA + 7, 0); ctx.lineTo(xA, 8);
            ctx.closePath();
            ctx.fill();
            ctx.font = 'bold 9px var(--font-sans)';
            ctx.fillText('A', xA - 3, 17);
        }

        // Draw Cursor B (Blue)
        if (xB >= 90 && xB <= W) {
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(xB, 0); ctx.lineTo(xB, H);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw Cursor handle B
            ctx.fillStyle = '#00f0ff';
            ctx.beginPath();
            ctx.moveTo(xB - 7, 0); ctx.lineTo(xB + 7, 0); ctx.lineTo(xB, 8);
            ctx.closePath();
            ctx.fill();
            ctx.font = 'bold 9px var(--font-sans)';
            ctx.fillText('B', xB - 3, 17);
        }
    }

    // Left sidebar mask for channel labels
    ctx.fillStyle = 'rgba(12, 18, 33, 0.96)';
    ctx.fillRect(0, 0, 90, H);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(90, 0);
    ctx.lineTo(90, H);
    ctx.stroke();

    // Draw Channel Labels on Left
    ctx.font = 'bold 11px var(--font-mono)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    channels.forEach((ch, idx) => {
        ctx.fillStyle = ch.color;
        ctx.fillText(ch.label.toUpperCase(), 15, idx * chH + chH / 2 - 2);
        
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '9px var(--font-sans)';
        
        // Show current pin states
        let valStr = pinStates[ch.name] !== undefined ? String(pinStates[ch.name]) : "-";
        ctx.fillText(`val: ${valStr}`, 15, idx * chH + chH / 2 + 10);
        ctx.font = 'bold 11px var(--font-mono)';
    });

    requestAnimationFrame(draw);
}

// Convert Hex colors to rgba values for custom gradient traces
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

// Drag & Scroll Events on Canvas
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    // Check if clicked near Cursor A or Cursor B handles (top section)
    if (cursorsEnabled && cursorA !== null && cursorB !== null) {
        const sampleWidth = 8 * zoomLevel;
        const xA = W_offset_adjusted_x(cursorA);
        const xB = W_offset_adjusted_x(cursorB);

        if (Math.abs(x - xA) < 10) {
            activeCursorDrag = 'A';
            return;
        }
        if (Math.abs(x - xB) < 10) {
            activeCursorDrag = 'B';
            return;
        }
    }

    // Otherwise, drag/pan timeline
    if (x > 90) {
        isDraggingCanvas = true;
        dragStartX = e.clientX;
        dragStartScrollOffset = scrollOffset;
    }
});

function W_offset_adjusted_x(idx) {
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const sampleWidth = 8 * zoomLevel;
    return W - (buffer.length - 1 - idx - scrollOffset) * sampleWidth;
}

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Custom Cursor styling based on hover hotspots
    let showResizeCursor = false;
    if (cursorsEnabled && cursorA !== null && cursorB !== null) {
        const xA = W_offset_adjusted_x(cursorA);
        const xB = W_offset_adjusted_x(cursorB);
        if (Math.abs(x - xA) < 10 || Math.abs(x - xB) < 10) {
            showResizeCursor = true;
        }
    }
    canvas.style.cursor = activeCursorDrag ? 'ew-resize' : (showResizeCursor ? 'ew-resize' : (isDraggingCanvas ? 'grabbing' : 'grab'));

    if (activeCursorDrag && buffer.length > 0) {
        // Drag active cursor
        const sampleWidth = 8 * zoomLevel;
        const W = rect.width;
        let index = Math.round(buffer.length - 1 - scrollOffset - (W - x) / sampleWidth);
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
        const sampleWidth = 8 * zoomLevel;
        scrollOffset = dragStartScrollOffset + Math.round(dx / sampleWidth);
        limitScrollOffset();
    }
});

window.addEventListener('mouseup', () => {
    isDraggingCanvas = false;
    activeCursorDrag = null;
});

// Scrollwheel zooming over canvas
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
        adjustZoom(1.1); // zoom in
    } else {
        adjustZoom(0.9); // zoom out
    }
});

// Start Server-Sent Events (SSE) stream listener
function startSSE() {
    if (eventSource) {
        eventSource.close();
    }

    const streamUrl = `http://${targetIp}/api/stream`;
    console.log("Connecting to SSE stream:", streamUrl);
    eventSource = new EventSource(streamUrl);

    eventSource.onopen = () => {
        statusDot.className = "indicator-dot connected";
        statusText.innerText = "LIVE (ESP32)";
        btnConnect.innerText = "Disconnect";
        btnConnect.className = "connected";
        document.getElementById('ipConfigGroup').style.borderColor = 'rgba(16, 185, 129, 0.3)';
    };

    eventSource.onerror = (err) => {
        statusDot.className = "indicator-dot";
        statusText.innerText = "DISCONNECTED";
        btnConnect.innerText = "Connect";
        btnConnect.className = "";
        document.getElementById('ipConfigGroup').style.borderColor = 'var(--border-color)';
        console.error("SSE stream disconnected. Attempting closure.", err);
        eventSource.close();
    };

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            pinStates = data;
            
            // Append timing stamp
            data.time = Date.now();
            
            updateGpioButtonsUI();

            if (!isPaused) {
                buffer.push(data);
                if (buffer.length > maxSamples) {
                    buffer.shift();
                    // Shift cursors index references if needed
                    if (cursorA !== null) cursorA = Math.max(0, cursorA - 1);
                    if (cursorB !== null) cursorB = Math.max(0, cursorB - 1);
                }
                
                // Decode SPI protocol inside buffer
                reprocessSpiDecoding();
            }
        } catch (e) {
            console.error("Failed to parse SSE data stream:", e);
        }
    };
}

// Disconnect/connect handlers
function toggleConnection() {
    if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
        eventSource.close();
        statusDot.className = "indicator-dot";
        statusText.innerText = "DISCONNECTED";
        btnConnect.innerText = "Connect";
        btnConnect.className = "";
        console.log("Disconnected SSE manually.");
    } else {
        targetIp = espIpAddressInput.value.trim();
        localStorage.setItem('esp_ip', targetIp);
        startSSE();
    }
}

// TOGGLE SIMULATION MODE
function toggleSimulationMode(enable) {
    simulationMode = enable;
    if (simulationMode) {
        // Disconnect SSE if active
        if (eventSource) {
            eventSource.close();
        }
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
        
        toggleConnection(); // Re-establish SSE hardware connection
    }
}

// HIGH-FIDELITY SIMULATOR ENGINE
function startSimulatorEngine() {
    stopSimulatorEngine();
    clearBuffer();

    simTimeCounter = 0;
    simState = 'IDLE';
    simulatedSampleCount = 0;

    // Simulate 20Hz updates (every 50ms)
    simIntervalId = setInterval(() => {
        simTimeCounter += 50;
        simulatedSampleCount++;

        // Base Idle state values
        // Note: Clock idle depends on CPOL: Mode 2 and 3 have CPOL=1 (HIGH idle)
        const idleClk = (spiSettings.mode === 2 || spiSettings.mode === 3) ? 1 : 0;
        
        let sample = {
            cs: 1,
            clk: idleClk,
            rst: 0,
            miso: 0,
            mosi: 0,
            time: Date.now()
        };

        // Every 8 seconds (160 samples), trigger a sensor transaction
        if (simState === 'IDLE' && simulatedSampleCount % 160 === 0) {
            // Generate some dynamic mock SPI payloads
            // E.g. command byte (0x03) then high byte + low byte of mock temperature data
            const tempVal = Math.floor(22 + Math.random() * 8); // ~22 to 30 C
            const humidityVal = Math.floor(40 + Math.random() * 20); // ~40 to 60 %
            
            const mosiData = [0x03, 0x01, 0x00];
            const misoData = [0x00, tempVal, humidityVal];
            
            startSimulatedTransaction(mosiData, misoData);
        }

        // Handle Active Transaction shifts
        if (simState === 'TX') {
            sample.cs = 0;
            
            // Toggle clock line on alternate steps to create pulses
            // Step 1: Shift line values. Step 2: Sample line values
            if (simClkState === 0) {
                // Changing values on trailing edges
                simClkState = 1;
                // Clock is transitioning to active edge
                // In Mode 0 (CPOL=0, CPHA=0): active is rising edge (1)
                // In Mode 1 (CPOL=0, CPHA=1): active is falling edge (0)
                // In Mode 2 (CPOL=1, CPHA=0): active is falling edge (0)
                // In Mode 3 (CPOL=1, CPHA=1): active is rising edge (1)
                const cpol = (spiSettings.mode === 2 || spiSettings.mode === 3) ? 1 : 0;
                sample.clk = cpol === 1 ? 0 : 1; 
            } else {
                // Active sampling clock edge is falling back
                simClkState = 0;
                const cpol = (spiSettings.mode === 2 || spiSettings.mode === 3) ? 1 : 0;
                sample.clk = cpol;

                // Move bit counter
                simBitIndex--;
                if (simBitIndex < 0) {
                    simBitIndex = spiSettings.wordLength - 1;
                    simTxByteIndex++;
                }

                if (simTxByteIndex >= simTxMOSIBytes.length) {
                    // Completed simulation packet
                    simState = 'IDLE';
                }
            }

            // Write active values to MOSI/MISO pins
            if (simState === 'TX' && simTxByteIndex < simTxMOSIBytes.length) {
                const mosiByte = simTxMOSIBytes[simTxByteIndex];
                const misoByte = simTxMISOBytes[simTxByteIndex];
                const shiftOffset = (spiSettings.bitOrder === 'msb') ? simBitIndex : (spiSettings.wordLength - 1 - simBitIndex);
                
                sample.mosi = (mosiByte >> shiftOffset) & 1;
                sample.miso = (misoByte >> shiftOffset) & 1;
            }
        } else {
            // Clock generator background activity (ESP32 slow oscillator at 0.2Hz, i.e. 2.50s period = 50 samples per toggle)
            const oscPeriodSamples = 50;
            const clkVal = Math.floor(simulatedSampleCount / oscPeriodSamples) % 2;
            sample.clk = clkVal;
        }

        // Apply manually set UI stimulus to simulations
        if (simState === 'IDLE') {
            sample.cs = pinStates.cs;
            sample.mosi = pinStates.mosi;
        }
        sample.rst = pinStates.rst;

        // Propagate simulated sample to buffer
        if (!isPaused) {
            buffer.push(sample);
            if (buffer.length > maxSamples) {
                buffer.shift();
                if (cursorA !== null) cursorA = Math.max(0, cursorA - 1);
                if (cursorB !== null) cursorB = Math.max(0, cursorB - 1);
            }
            reprocessSpiDecoding();
        }

        // Live stats output
        pinStates = {
            cs: sample.cs,
            clk: sample.clk,
            rst: sample.rst,
            miso: sample.miso,
            mosi: sample.mosi
        };
        updateGpioButtonsUI();

    }, 50);
}

function startSimulatedTransaction(mosiBytes, misoBytes) {
    simState = 'TX';
    simTxByteIndex = 0;
    simBitIndex = spiSettings.wordLength - 1;
    simClkState = 0;
    simTxMOSIBytes = mosiBytes;
    simTxMISOBytes = misoBytes;
    simTxStartIdx = buffer.length;
}

function stopSimulatorEngine() {
    if (simIntervalId) {
        clearInterval(simIntervalId);
        simIntervalId = null;
    }
}

// Initial Bootstrapper
function init() {
    startSSE();
    requestAnimationFrame(draw);
}
init();
