// Decoupled logic analyzer script
let pinStates = { cs: 1, clk: 0, rst: 0, miso: 0, mosi: 0 };
let buffer = [];
const maxSamples = 300;
let eventSource = null;
let isPaused = false;
let scrollOffset = 0;
let targetIp = localStorage.getItem('esp_ip') || '172.20.10.2';

// Elements
const espIpInput = document.getElementById('espIp');
const btnConnect = document.getElementById('btnConnect');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

const btnCS = document.getElementById('btnCS');
const btnRST = document.getElementById('btnRST');
const btnMOSI = document.getElementById('btnMOSI');

const valCS = document.getElementById('valCS');
const valCLK = document.getElementById('valCLK');
const valRST = document.getElementById('valRST');
const valMISO = document.getElementById('valMISO');
const valMOSI = document.getElementById('valMOSI');

const canvas = document.getElementById('laCanvas');
const ctx = canvas.getContext('2d');

// Initialize IP Input
espIpInput.value = targetIp;

// Canvas scaling
function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
}
setupCanvas();
window.addEventListener('resize', setupCanvas);

// Update button classes and texts based on current state
function updateUIState() {
    if (pinStates.cs === 0) {
        btnCS.innerText = "LOW (Active)";
        btnCS.className = "btn-toggle active-low";
        valCS.innerText = "0";
    } else {
        btnCS.innerText = "HIGH (Idle)";
        btnCS.className = "btn-toggle";
        valCS.innerText = "1";
    }

    if (pinStates.rst === 1) {
        btnRST.innerText = "HIGH (Reset)";
        btnRST.className = "btn-toggle active-rst";
        valRST.innerText = "1";
    } else {
        btnRST.innerText = "LOW (Run)";
        btnRST.className = "btn-toggle";
        valRST.innerText = "0";
    }

    if (pinStates.mosi === 1) {
        btnMOSI.innerText = "HIGH (1)";
        btnMOSI.className = "btn-toggle active-high";
        valMOSI.innerText = "1";
    } else {
        btnMOSI.innerText = "LOW (0)";
        btnMOSI.className = "btn-toggle";
        valMOSI.innerText = "0";
    }

    valCLK.innerText = pinStates.clk;
    valMISO.innerText = pinStates.miso;
}

// Send GET Request to ESP32 API
function sendControl(pin) {
    let nextVal = 0;
    if (pin === 'cs') nextVal = pinStates.cs === 1 ? 0 : 1;
    if (pin === 'rst') nextVal = pinStates.rst === 1 ? 0 : 1;
    if (pin === 'mosi') nextVal = pinStates.mosi === 1 ? 0 : 1;
    
    // Optimistic update
    pinStates[pin] = nextVal;
    updateUIState();

    const url = `http://${targetIp}/api/control?${pin}=${nextVal}`;
    fetch(url)
        .then(r => r.json())
        .catch(e => console.error("Control API error:", e));
}

function togglePause() {
    isPaused = !isPaused;
    document.getElementById('pauseTxt').innerText = isPaused ? "Resume" : "Pause";
}

function clearBuffer() {
    buffer = [];
}

// Waveform channels
const channels = [
    { name: 'cs', label: 'CS', color: '#00f0ff' },
    { name: 'clk', label: 'CLK', color: '#39ff14' },
    { name: 'rst', label: 'RST', color: '#ff073a' },
    { name: 'miso', label: 'MISO', color: '#ffff00' },
    { name: 'mosi', label: 'MOSI', color: '#bd00ff' }
];

// Rendering loop
function draw() {
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, W, H);

    const numCh = channels.length;
    const chH = H / numCh;
    const waveH = chH - 32;

    // Draw row separators
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i < numCh; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * chH);
        ctx.lineTo(W, i * chH);
        ctx.stroke();
    }

    // Grid lines scrolling
    const gridSpacing = 40;
    const offset = scrollOffset % gridSpacing;
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    for (let x = W - offset; x > 0; x -= gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
    }
    ctx.setLineDash([]); // Reset

    // Draw waveforms
    if (buffer.length > 1) {
        const sampleWidth = (W - 80) / maxSamples;
        
        channels.forEach((ch, idx) => {
            const yCenter = idx * chH + chH/2;
            const yHigh = yCenter - waveH/2;
            const yLow = yCenter + waveH/2;
            
            ctx.strokeStyle = ch.color;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 6;
            ctx.shadowColor = ch.color;

            ctx.beginPath();
            
            const startX = W;
            let x = startX;
            let lastY = buffer[buffer.length - 1][ch.name] === 1 ? yHigh : yLow;
            ctx.moveTo(x, lastY);

            for (let sIdx = buffer.length - 1; sIdx >= 0; sIdx--) {
                const val = buffer[sIdx][ch.name];
                const targetY = val === 1 ? yHigh : yLow;
                
                ctx.lineTo(x, targetY);
                x -= sampleWidth;
                ctx.lineTo(x, targetY);
                
                if (x < 80) break;
            }
            ctx.stroke();
            ctx.shadowBlur = 0; // Reset
        });
    }

    // Left label panel mask
    ctx.fillStyle = 'rgba(11, 15, 25, 0.95)';
    ctx.fillRect(0, 0, 80, H);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, 0);
    ctx.lineTo(80, H);
    ctx.stroke();

    // Channel names
    ctx.font = 'bold 12px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    channels.forEach((ch, idx) => {
        ctx.fillStyle = ch.color;
        ctx.fillText(ch.label, 40, idx * chH + chH/2);
    });

    requestAnimationFrame(draw);
}

// Server-Sent Events (SSE) Stream Connection
function startSSE() {
    if (eventSource) {
        eventSource.close();
    }

    const streamUrl = `http://${targetIp}/api/stream`;
    console.log("Connecting to SSE stream:", streamUrl);
    eventSource = new EventSource(streamUrl);

    eventSource.onopen = () => {
        statusDot.className = "status-dot connected";
        statusText.innerText = "LIVE";
        btnConnect.innerText = "Disconnect";
        btnConnect.className = "connected";
    };

    eventSource.onerror = (e) => {
        statusDot.className = "status-dot";
        statusText.innerText = "DISCONNECTED";
        btnConnect.innerText = "Connect";
        btnConnect.className = "";
        console.error("SSE connection error. Retrying in 3s...", e);
        eventSource.close();
    };

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            pinStates = data;
            updateUIState();

            if (!isPaused) {
                buffer.push(data);
                if (buffer.length > maxSamples) {
                    buffer.shift();
                }
                const canvasWidth = canvas.getBoundingClientRect().width;
                scrollOffset += ((canvasWidth - 80) / maxSamples);
            }
        } catch (e) {
            console.error("Failed to parse SSE JSON data:", e);
        }
    };
}

function toggleConnection() {
    if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
        // Disconnect
        eventSource.close();
        statusDot.className = "status-dot";
        statusText.innerText = "DISCONNECTED";
        btnConnect.innerText = "Connect";
        btnConnect.className = "";
        console.log("Disconnected manually.");
    } else {
        // Connect
        targetIp = espIpInput.value.trim();
        localStorage.setItem('esp_ip', targetIp);
        startSSE();
    }
}

// Initial setup
startSSE();
requestAnimationFrame(draw);
