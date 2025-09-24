let polygons = [];
let canvas, ctx;
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let minX, maxX, minY, maxY;
let layers = new Set();
let currentLayer = 'all';
let tooltip = null;

function init() {
    canvas = document.getElementById('mapCanvas');
    ctx = canvas.getContext('2d');
    
    createTooltip();
    
    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('mouseleave', hideTooltip);
    
    let isDragging = false;
    let lastX, lastY;
    
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        hideTooltip();
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            offsetX += (e.clientX - lastX) / scale;
            offsetY += (e.clientY - lastY) / scale;
            lastX = e.clientX;
            lastY = e.clientY;
            draw();
            hideTooltip();
        } else {
            handleMouseMove(e);
        }
    });
    
    canvas.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

function createTooltip() {
    tooltip = document.createElement('div');
    tooltip.id = 'polygonTooltip';
    tooltip.style.position = 'fixed';
    tooltip.style.background = '#333';
    tooltip.style.color = 'white';
    tooltip.style.padding = '8px 12px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.fontSize = '12px';
    tooltip.style.fontFamily = 'monospace';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.zIndex = '1000';
    tooltip.style.display = 'none';
    tooltip.style.whiteSpace = 'nowrap';
    tooltip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
    document.body.appendChild(tooltip);
}

function handleMouseMove(e) {
    if (!polygons.length) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / scale - offsetX;
    const mouseY = (e.clientY - rect.top) / scale - offsetY;
    
    let hoveredPolygon = null;
    
    for (let polygon of polygons) {
        if (shouldDrawPolygon(polygon) && isPointInPolygon(mouseX, mouseY, polygon)) {
            hoveredPolygon = polygon;
            break;
        }
    }
    
    if (hoveredPolygon) {
        showTooltip(e.clientX, e.clientY, hoveredPolygon);
    } else {
        hideTooltip();
    }
}

function isPointInPolygon(x, y, polygon) {
    if (!polygon.vertexes || polygon.vertexes.length < 3) return false;
    
    const vertices = polygon.vertexes;
    let inside = false;
    
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i].x;
        const yi = vertices[i].y;
        const xj = vertices[j].x;
        const yj = vertices[j].y;
        
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    
    return inside;
}

function showTooltip(x, y, polygon) {
    if (!tooltip) return;
    
    const polygonId = polygon.id || polygon.externalId || 'Unknown ID';
    const layer = polygon.layer || 'No Layer';
    
    tooltip.innerHTML = `ID: ${polygonId}<br>Layer: ${layer}`;
    tooltip.style.display = 'block';
    tooltip.style.left = (x + 10) + 'px';
    tooltip.style.top = (y - 30) + 'px';
}

function hideTooltip() {
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}
function handleWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    scale *= zoomFactor;
    draw();
    hideTooltip();
}

function visualisePolygons() {
    const input = document.getElementById('jsonInput').value.trim();
    
    if (!input) {
        alert('Please paste your JSON data first');
        return;
    }

    try {
        polygons = JSON.parse(input);
        
        if (!Array.isArray(polygons)) {
            throw new Error('Data should be an array of polygons');
        }

        calculateBounds();
        detectLayers();
        setupLayerControls();
        fitToView();
        updateInfo();
        
    } catch (error) {
        alert('Error parsing JSON: ' + error.message);
    }
}

function detectLayers() {
    layers.clear();
    
    polygons.forEach(polygon => {
        const zPos = polygon.geometry?.position?.z || 0;
        const zScale = polygon.geometry?.scale?.z || 1;
        const layerKey = `${zPos}_${zScale}`;
        layers.add(layerKey);
    });
}

function setupLayerControls() {
    const layerSelect = document.getElementById('layerSelect');
    const layerControls = document.getElementById('layerControls');
    
    layerSelect.innerHTML = '<option value="all">All Layers</option>';
    
    if (layers.size > 1) {
        Array.from(layers).sort().forEach((layer, index) => {
            const option = document.createElement('option');
            option.value = layer;
            option.textContent = `Layer ${index + 1}`;
            layerSelect.appendChild(option);
        });
        layerControls.style.display = 'flex';
    } else {
        layerControls.style.display = 'none';
    }
}

function changeLayer() {
    currentLayer = document.getElementById('layerSelect').value;
    calculateBounds();
    fitToView();
    updateInfo();
}

function getPolygonLayer(polygon) {
    const zPos = polygon.geometry?.position?.z || 0;
    const zScale = polygon.geometry?.scale?.z || 1;
    return `${zPos}_${zScale}`;
}

function shouldDrawPolygon(polygon) {
    if (currentLayer === 'all') return true;
    return getPolygonLayer(polygon) === currentLayer;
}
function calculateBounds() {
    if (polygons.length === 0) return;

    minX = Infinity;
    maxX = -Infinity;
    minY = Infinity;
    maxY = -Infinity;

    polygons.forEach(polygon => {
        if (polygon.vertexes && shouldDrawPolygon(polygon)) {
            polygon.vertexes.forEach(vertex => {
                minX = Math.min(minX, vertex.x);
                maxX = Math.max(maxX, vertex.x);
                minY = Math.min(minY, vertex.y);
                maxY = Math.max(maxY, vertex.y);
            });
        }
    });

    if (minX === Infinity) {
        minX = maxX = minY = maxY = 0;
    }
}

function fitToView() {
    if (polygons.length === 0) return;

    const padding = 100;
    const canvasWidth = canvas.width - padding * 2;
    const canvasHeight = canvas.height - padding * 2;
    
    const dataWidth = maxX - minX;
    const dataHeight = maxY - minY;
    
    if (dataWidth === 0 || dataHeight === 0) return;
    
    scale = Math.min(canvasWidth / dataWidth, canvasHeight / dataHeight) * 0.8;
    
    offsetX = (canvas.width / 2 / scale) - (minX + dataWidth / 2);
    offsetY = (canvas.height / 2 / scale) - (minY + dataHeight / 2);
    
    draw();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(offsetX, offsetY);
    
    drawGrid();
    
    polygons.forEach((polygon, index) => {
        if (shouldDrawPolygon(polygon)) {
            drawPolygon(polygon, index);
        }
    });
    
    ctx.restore();
}

function drawGrid() {
    if (scale < 0.2) return;
    
    ctx.strokeStyle = '#f5f5f5';
    ctx.lineWidth = 1 / scale;
    
    const gridSize = scale > 1 ? 50 : 100;
    const startX = Math.floor((minX - offsetX) / gridSize) * gridSize;
    const endX = Math.ceil((maxX - offsetX) / gridSize) * gridSize;
    const startY = Math.floor((minY - offsetY) / gridSize) * gridSize;
    const endY = Math.ceil((maxY - offsetY) / gridSize) * gridSize;
    
    for (let x = startX; x <= endX; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
    }
    
    for (let y = startY; y <= endY; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
    }
}

function drawPolygon(polygon, index) {
    if (!polygon.vertexes || polygon.vertexes.length === 0) return;

    const vertices = polygon.vertexes;
    
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    
    for (let i = 1; i < vertices.length; i++) {
        ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    ctx.closePath();
    
    const colour = polygon.material?.color || generateColour(index);
    ctx.fillStyle = colour + '20';
    ctx.fill();
    
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2 / scale;
    ctx.stroke();
    
    if (polygon.layer && scale > 0.2) {
        const centreX = vertices.reduce((sum, v) => sum + v.x, 0) / vertices.length;
        const centreY = vertices.reduce((sum, v) => sum + v.y, 0) / vertices.length;
        
        ctx.fillStyle = '#333';
        ctx.font = `${14/scale}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(polygon.layer, centreX, centreY);
    }
}

function generateColour(index) {
    const colours = [
        '#007aff', '#34c759', '#ff9500', '#ff3b30', '#af52de',
        '#5ac8fa', '#ffcc00', '#ff2d92', '#30d158', '#64d2ff'
    ];
    return colours[index % colours.length];
}

function updateInfo() {
    const info = document.getElementById('info');
    const visiblePolygons = polygons.filter(shouldDrawPolygon).length;
    const layerText = currentLayer === 'all' ? `${layers.size} layers` : 'single layer';
    info.textContent = `${visiblePolygons}/${polygons.length} polygons | ${layerText} | ${minX.toFixed(0)},${minY.toFixed(0)} to ${maxX.toFixed(0)},${maxY.toFixed(0)} | ${scale.toFixed(2)}x`;
}

function zoomIn() {
    scale *= 1.2;
    draw();
    updateInfo();
}

function zoomOut() {
    scale /= 1.2;
    draw();
    updateInfo();
}

function resetView() {
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    draw();
    updateInfo();
}

window.onload = init;
