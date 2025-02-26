const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth - 320;
canvas.height = window.innerHeight;
let layers = [];
let currentLayer = null;
let activeTool = 'brush';
let history = [];
let redoStack = [];
let isDrawing = false;
let lastX, lastY;

function setTool(tool) {
    activeTool = tool;
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
}

function loadImage(event) {
    const file = event.target.files[0];
    const img = new Image();
    img.onload = () => {
        canvas.width = Math.min(img.width, window.innerWidth - 320);
        canvas.height = Math.min(img.height, window.innerHeight);
        addLayer(img);
    };
    img.src = URL.createObjectURL(file);
}

function addLayer(imgData, type = 'image') {
    const layer = { data: imgData, type, x: 0, y: 0, width: imgData.width, height: imgData.height, opacity: 1, blendMode: 'source-over' };
    layers.push(layer);
    currentLayer = layer;
    renderCanvas();
    updateLayersUI();
    saveState();
}

function updateLayersUI() {
    const layersDiv = document.getElementById('layers');
    layersDiv.innerHTML = '';
    layers.forEach((layer, i) => {
        const div = document.createElement('div');
        div.className = 'layer-item' + (layer === currentLayer ? ' active' : '');
        div.innerText = `Layer ${i + 1} (${layer.type})`;
        div.onclick = () => { currentLayer = layer; updateLayersUI(); updateControls(); };
        layersDiv.appendChild(div);
    });
}

function updateControls() {
    if (currentLayer) document.getElementById('opacity').value = currentLayer.opacity;
}

function updateLayer() {
    if (currentLayer) {
        currentLayer.opacity = parseFloat(document.getElementById('opacity').value);
        renderCanvas();
        saveState();
    }
}

function renderCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    layers.forEach(layer => {
        ctx.globalAlpha = layer.opacity;
        ctx.globalCompositeOperation = layer.blendMode;
        ctx.drawImage(layer.data, layer.x, layer.y, layer.width, layer.height);
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
}

function applyFilter(filterType) {
    if (!currentLayer) return;
    const imgData = ctx.getImageData(0, 0, currentLayer.width, currentLayer.height);
    const data = imgData.data;
    const brightness = parseInt(document.getElementById('brightness').value);
    const contrast = parseInt(document.getElementById('contrast').value);

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i + 1], b = data[i + 2];
        r = Math.min(255, Math.max(0, r + brightness));
        g = Math.min(255, Math.max(0, g + brightness));
        b = Math.min(255, Math.max(0, b + brightness));
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        r = Math.min(255, Math.max(0, factor * (r - 128) + 128));
        g = Math.min(255, Math.max(0, factor * (g - 128) + 128));
        b = Math.min(255, Math.max(0, factor * (b - 128) + 128));

        if (filterType === 'grayscale') r = g = b = 0.3 * r + 0.59 * g + 0.11 * b;
        if (filterType === 'invert') { r = 255 - r; g = 255 - g; b = 255 - b; }
        if (filterType === 'sepia') {
            r = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
            g = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
            b = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
        }
        if (filterType === 'blur' || filterType === 'sharpen') { /* Simplified logic */ }

        data[i] = r; data[i + 1] = g; data[i + 2] = b;
    }
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = currentLayer.width;
    tempCanvas.height = currentLayer.height;
    tempCanvas.getContext('2d').putImageData(imgData, 0, 0);
    currentLayer.data = new Image();
    currentLayer.data.src = tempCanvas.toDataURL();
    renderCanvas();
    saveState();
}

function addText() {
    const text = prompt('Enter text:') || 'Text';
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = text.length * 20;
    tempCanvas.height = 40;
    const tCtx = tempCanvas.getContext('2d');
    tCtx.font = '30px Arial';
    tCtx.fillText(text, 0, 30);
    const img = new Image();
    img.src = tempCanvas.toDataURL();
    img.onload = () => addLayer(img, 'text');
}

function addShape(type) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 100;
    tempCanvas.height = 100;
    const sCtx = tempCanvas.getContext('2d');
    sCtx.fillStyle = 'rgba(255,0,0,0.5)';
    if (type === 'rect') sCtx.fillRect(0, 0, 100, 100);
    else if (type === 'circle') {
        sCtx.beginPath();
        sCtx.arc(50, 50, 50, 0, Math.PI * 2);
        sCtx.fill();
    }
    const img = new Image();
    img.src = tempCanvas.toDataURL();
    img.onload = () => addLayer(img, 'shape');
}

function cropImage() {
    if (!currentLayer) return;
    const newWidth = currentLayer.width * 0.8;
    const newHeight = currentLayer.height * 0.8;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = newWidth;
    tempCanvas.height = newHeight;
    tempCanvas.getContext('2d').drawImage(currentLayer.data, 0, 0, newWidth, newHeight);
    currentLayer.data = new Image();
    currentLayer.data.src = tempCanvas.toDataURL();
    currentLayer.width = newWidth;
    currentLayer.height = newHeight;
    renderCanvas();
    saveState();
}

function rotateImage() {
    if (!currentLayer) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = currentLayer.height;
    tempCanvas.height = currentLayer.width;
    const tCtx = tempCanvas.getContext('2d');
    tCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tCtx.rotate(Math.PI / 2);
    tCtx.drawImage(currentLayer.data, -currentLayer.width / 2, -currentLayer.height / 2);
    currentLayer.data = new Image();
    currentLayer.data.src = tempCanvas.toDataURL();
    [currentLayer.width, currentLayer.height] = [currentLayer.height, currentLayer.width];
    renderCanvas();
    saveState();
}

function flipImage() {
    if (!currentLayer) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = currentLayer.width;
    tempCanvas.height = currentLayer.height;
    const tCtx = tempCanvas.getContext('2d');
    tCtx.scale(-1, 1);
    tCtx.drawImage(currentLayer.data, -currentLayer.width, 0);
    currentLayer.data = new Image();
    currentLayer.data.src = tempCanvas.toDataURL();
    renderCanvas();
    saveState();
}

canvas.addEventListener('mousedown', (e) => {
    if (!currentLayer || !['brush', 'eraser', 'clone', 'heal', 'smudge', 'dodge', 'burn', 'sponge'].includes(activeTool)) return;
    isDrawing = true;
    lastX = e.offsetX;
    lastY = e.offsetY;
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing || !currentLayer) return;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.strokeStyle = activeTool === 'brush' ? '#000' : activeTool === 'dodge' ? '#fff' : '#000';
    ctx.lineWidth = 5;
    if (activeTool === 'clone' || activeTool === 'heal' || activeTool === 'smudge' || activeTool === 'burn' || activeTool === 'sponge') {
        ctx.globalAlpha = 0.2;
    }
    ctx.stroke();
    lastX = e.offsetX;
    lastY = e.offsetY;
    renderCanvas();
});

canvas.addEventListener('mouseup', () => {
    if (isDrawing) saveState();
    isDrawing = false;
    ctx.globalAlpha = 1;
});

function saveState() {
    history.push(canvas.toDataURL());
    redoStack = [];
}

function undo() {
    if (history.length > 1) {
        redoStack.push(history.pop());
        const img = new Image();
        img.src = history[history.length - 1];
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            layers = [{ data: img, x: 0, y: 0, width: canvas.width, height: canvas.height, opacity: 1, blendMode: 'source-over' }];
            currentLayer = layers[0];
            updateLayersUI();
        };
    }
}

function redo() {
    if (redoStack.length > 0) {
        history.push(redoStack.pop());
        const img = new Image();
        img.src = history[history.length - 1];
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            layers = [{ data: img, x: 0, y: 0, width: canvas.width, height: canvas.height, opacity: 1, blendMode: 'source-over' }];
            currentLayer = layers[0];
            updateLayersUI();
        };
    }
}

function downloadImage() {
    const link = document.createElement('a');
    link.download = 'edited-image.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function toggleTheme() {
    document.body.classList.toggle('light');
}

// Placeholder Functions for Additional Tools
function perspectiveTransform() { alert('Perspective Transform coming soon!'); saveState(); }
function resizeImage() { alert('Resize coming soon!'); saveState(); }
function adjustBrightness() { applyFilter(); }
function adjustContrast() { applyFilter(); }
function adjustSaturation() { alert('Saturation adjustment coming soon!'); saveState(); }
function adjustHue() { alert('Hue adjustment coming soon!'); saveState(); }
function addNoise() { alert('Noise effect coming soon!'); saveState(); }
function posterize() { alert('Posterize effect coming soon!'); saveState(); }
function emboss() { alert('Emboss effect coming soon!'); saveState(); }
function edgeDetect() { alert('Edge Detect coming soon!'); saveState(); }
function oilPaint() { alert('Oil Paint effect coming soon!'); saveState(); }
function solarize() { alert('Solarize effect coming soon!'); saveState(); }
function vignette() { alert('Vignette effect coming soon!'); saveState(); }
function pixelate() { alert('Pixelate effect coming soon!'); saveState(); }
function distort() { alert('Distort effect coming soon!'); saveState(); }
function warp() { alert('Warp effect coming soon!'); saveState(); }
function zoom() { alert('Zoom coming soon!'); saveState(); }
function pan() { alert('Pan coming soon!'); saveState(); }
function colorPicker() { alert('Color Picker coming soon!'); saveState(); }
function magicWand() { alert('Magic Wand coming soon!'); saveState(); }
function lasso() { alert('Lasso coming soon!'); saveState(); }
function move() { alert('Move coming soon!'); saveState(); }
function fill() { alert('Fill coming soon!'); saveState(); }
function gradient() { alert('Gradient coming soon!'); saveState(); }
function pattern() { alert('Pattern coming soon!'); saveState(); }
function stamp() { alert('Stamp coming soon!'); saveState(); }

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth - 320;
    canvas.height = window.innerHeight;
    renderCanvas();
});
