/**
 * Gesture-Controlled Canvas Application
 * Main script for MediaPipe integration and canvas drawing
 */

class GestureCanvas {
    constructor() {
        // Core elements
        this.drawingCanvas = document.getElementById('drawingCanvas');
        this.drawingCtx = this.drawingCanvas.getContext('2d');
        this.videoElement = document.getElementById('inputVideo');
        this.outputCanvas = document.getElementById('outputCanvas');
        this.outputCtx = this.outputCanvas.getContext('2d');
        
        // UI elements
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.currentToolDisplay = document.getElementById('currentTool');
        this.toolIconDisplay = document.getElementById('toolIcon');
        this.videoContainer = document.getElementById('videoContainer');
        
        // Libs and Tools
        this.hands = null;
        this.gestureDetector = new GestureDetector();
        
        // State
        this.elements = [];
        this.currentElement = null;
        this.history = [];
        this.historyIndex = -1;
        this.isDrawing = false;
        this.currentTool = 'idle';
        this.brushSize = 4;
        this.brushColor = '#1a1a1a';
        this.eraserSize = 30;
        this.panOffset = { x: 0, y: 0 };
        this.zoom = 1.0;
        this.isPanning = false;
        this.lastPanPosition = null;
        this.isZooming = false;
        this.lastZoomDist = null;
        this.cursorPosition = null;
        
        this.init();
    }

    async init() {
        this.showStatus('Initializing Camera...');
        this.setupCanvas();
        this.setupEventListeners();
        await this.initializeMediaPipe();
        await this.startCamera();
        this.hideStatus();
        this.startAnimationLoop();
    }

    setupCanvas() {
        const resizeCanvas = () => {
            this.drawingCanvas.width = window.innerWidth;
            this.drawingCanvas.height = window.innerHeight;
            this.drawingCtx.lineCap = 'round';
            this.drawingCtx.lineJoin = 'round';
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        this.outputCanvas.width = 240;
        this.outputCanvas.height = 180;
    }

    setupEventListeners() {
        document.getElementById('saveBtn').addEventListener('click', () => this.saveCanvas());
        document.getElementById('resetBtn').addEventListener('click', () => this.clearCanvas());
        document.getElementById('hideCamera').addEventListener('click', () => this.toggleCamera());
        document.getElementById('smoothenBtn').addEventListener('click', () => this.smoothenAllElements());
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey) {
                if (e.key === 'z') this.undo();
                if (e.key === 'y') this.redo();
            }
        });
    }

    startAnimationLoop() {
        const animate = () => {
            this.renderAllElements();
            this.drawLiveFeedback();
            requestAnimationFrame(animate);
        };
        animate();
    }

    renderAllElements() {
        this.drawingCtx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
        this.drawingCtx.save();
        this.drawingCtx.translate(this.panOffset.x, this.panOffset.y);
        this.drawingCtx.scale(this.zoom, this.zoom);
        
        for (const element of this.elements) {
            this.renderElement(element);
        }
        if (this.currentElement) {
            this.renderElement(this.currentElement);
        }
        
        this.drawingCtx.restore();
    }

    renderElement(element) {
        if (element.type === 'freedraw' || element.type === 'erase') {
            this.drawingCtx.strokeStyle = element.color;
            this.drawingCtx.lineWidth = element.strokeWidth;
            this.drawingCtx.globalCompositeOperation = element.type === 'erase' ? 'destination-out' : 'source-over';
            
            if (element.points && element.points.length > 1) {
                this.drawingCtx.beginPath();
                this.drawingCtx.moveTo(element.points[0].x, element.points[0].y);
                for (let i = 1; i < element.points.length; i++) {
                    this.drawingCtx.lineTo(element.points[i].x, element.points[i].y);
                }
                this.drawingCtx.stroke();
            }
        }
    }

    async initializeMediaPipe() {
        this.hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
        this.hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.5 });
        this.hands.onResults((results) => this.onHandResults(results));
    }
    
    async startCamera() {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        this.videoElement.srcObject = stream;
        this.videoElement.onloadeddata = () => {
            this.videoElement.play();
            requestAnimationFrame(() => this.processVideoFrame());
        };
    }

    async processVideoFrame() {
        await this.hands.send({ image: this.videoElement });
        requestAnimationFrame(() => this.processVideoFrame());
    }

    onHandResults(results) {
        this.outputCtx.save();
        this.outputCtx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);
        this.outputCtx.scale(-1, 1);
        this.outputCtx.translate(-this.outputCanvas.width, 0);
        this.outputCtx.drawImage(results.image, 0, 0, this.outputCanvas.width, this.outputCanvas.height);
        
        let gestureResult = null;
        this.cursorPosition = null;

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            for (const landmarks of results.multiHandLandmarks) {
                drawConnectors(this.outputCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
            }
            const primaryHand = results.multiHandLandmarks[0];
            gestureResult = this.gestureDetector.detectGesture(primaryHand, results.multiHandLandmarks.length);
            
            if (gestureResult.tool === 'zoom' && results.multiHandLandmarks.length === 2) {
                const dist = this.gestureDetector.getTwoHandDistance(results.multiHandLandmarks[0], results.multiHandLandmarks[1]);
                this.handleZoom(dist * this.drawingCanvas.width);
            } else if (gestureResult.tool === 'pan') {
                this.cursorPosition = this.gestureDetector.getPalmCenter(primaryHand, this.drawingCanvas);
                this.handlePan(this.cursorPosition);
            } else {
                this.cursorPosition = this.gestureDetector.getDrawingPosition(primaryHand, this.drawingCanvas);
                this.handleGesture(gestureResult, this.cursorPosition);
            }
        } else {
            gestureResult = this.gestureDetector.detectGesture(null);
            this.handleGesture(gestureResult, null);
        }
        this.outputCtx.restore();
        this.updateCurrentTool(gestureResult);
    }

    updateCurrentTool(gestureResult) {
        if (gestureResult.tool !== this.currentTool) {
            this.currentTool = gestureResult.tool;
            this.currentToolDisplay.textContent = gestureResult.name;
            this.toolIconDisplay.textContent = gestureResult.icon;
            
            this.drawingCanvas.className = 'drawing-canvas';
            if (gestureResult.tool === 'pan') {
                this.drawingCanvas.classList.add('panning');
            }
        }
    }

    handleGesture(gestureResult, position) {
        this.isZooming = false;
        this.isPanning = false;

        switch (gestureResult.tool) {
            case 'pointer':
                this.finishDrawing();
                break;
            case 'draw':
                this.handleDraw(this.screenToWorld(position));
                break;
            case 'erase':
                this.handleErase(this.screenToWorld(position));
                break;
            case 'clear':
                this.clearCanvas();
                break;
            case 'idle':
                this.finishDrawing();
                break;
        }
    }

    drawLiveFeedback() {
        if (!this.cursorPosition) return;
        this.drawingCtx.save();
        this.drawingCtx.setTransform(1, 0, 0, 1, 0, 0);
        let size = 8;
        let color = '#8E8E93';
        if (this.currentTool === 'draw') {
            size = this.brushSize * this.zoom * 1.5;
            color = '#007AFF';
        } else if (this.currentTool === 'erase') {
            size = this.eraserSize * this.zoom;
            color = '#FF3B30';
        }
        if (['pointer', 'draw', 'erase'].includes(this.currentTool)) {
            this.drawingCtx.beginPath();
            this.drawingCtx.arc(this.cursorPosition.x, this.cursorPosition.y, size, 0, 2 * Math.PI);
            this.drawingCtx.fillStyle = color;
            this.drawingCtx.fill();
        }
        this.drawingCtx.restore();
    }
    
    handleDraw(worldPos) {
        if (!worldPos) { this.finishDrawing(); return; }
        if (!this.isDrawing) this.startDrawing(worldPos, 'freedraw');
        else this.continueDrawing(worldPos);
    }
    handleErase(worldPos) {
        if (!worldPos) { this.finishDrawing(); return; }
        if (!this.isDrawing) this.startDrawing(worldPos, 'erase');
        else this.continueDrawing(worldPos);
    }
    startDrawing(worldPos, type) {
        this.isDrawing = true;
        this.currentElement = { type, points: [worldPos], color: this.brushColor, strokeWidth: type === 'erase' ? this.eraserSize : this.brushSize, id: Date.now() };
    }
    continueDrawing(worldPos) {
        if (!this.isDrawing || !this.currentElement) return;
        this.currentElement.points.push(worldPos);
    }
    finishDrawing() {
        if (this.isDrawing && this.currentElement) {
            if (this.currentElement.points.length > 1) this.addElement(this.currentElement);
            this.currentElement = null;
            this.isDrawing = false;
        }
    }

    handlePan(position) {
        if (!this.isPanning) {
            this.isPanning = true;
            this.lastPanPosition = position;
            return;
        }
        this.panOffset.x += position.x - this.lastPanPosition.x;
        this.panOffset.y += position.y - this.lastPanPosition.y;
        this.lastPanPosition = position;
    }
    handleZoom(dist) {
        if (!this.isZooming) {
            this.isZooming = true;
            this.lastZoomDist = dist;
            return;
        }
        const zoomFactor = dist / this.lastZoomDist;
        this.zoom *= zoomFactor;
        this.lastZoomDist = dist;
    }

    // --- Handwriting Smoothing (triggered by button) ---
    smoothenAllElements() {
        if (this.elements.length === 0) return;
        this.elements = this.elements.map(element => {
            if (element.type === 'freedraw' && element.points.length > 5) {
                return { ...element, points: this.smoothenPath(element.points) };
            }
            return element;
        });
        this.saveToHistory();
        this.showStatus('Handwriting Smoothened!');
        setTimeout(() => this.hideStatus(), 800);
    }
    
    smoothenPath(points) {
        if (points.length < 3) return points;
        const simplifiedPoints = this.simplifyPath(points, 1.5);
        return this.createSpline(simplifiedPoints);
    }

    simplifyPath(points, tolerance) {
        if (points.length < 3) return points;
        let dmax = 0, index = 0;
        const end = points.length - 1;
        for (let i = 1; i < end; i++) {
            const d = this.perpendicularDistance(points[i], points[0], points[end]);
            if (d > dmax) { index = i; dmax = d; }
        }
        if (dmax > tolerance) {
            const res1 = this.simplifyPath(points.slice(0, index + 1), tolerance);
            const res2 = this.simplifyPath(points.slice(index), tolerance);
            return res1.slice(0, -1).concat(res2);
        } else {
            return [points[0], points[end]];
        }
    }

    perpendicularDistance(p, p1, p2) {
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        if (dx === 0 && dy === 0) return Math.hypot(p.x - p1.x, p.y - p1.y);
        return Math.abs(dy * p.x - dx * p.y + p2.x * p1.y - p2.y * p1.x) / Math.hypot(dx, dy);
    }

    createSpline(points, tension = 0.5, segments = 12) {
        const result = [];
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = i > 0 ? points[i - 1] : points[i];
            const p1 = points[i], p2 = points[i + 1];
            const p3 = i < points.length - 2 ? points[i + 2] : p2;
            for (let t = 0; t <= segments; t++) {
                const tn = t / segments, t2 = tn * tn, t3 = t2 * tn;
                const c1 = -tension * t3 + 2 * tension * t2 - tension * tn;
                const c2 = (2 - tension) * t3 + (tension - 3) * t2 + 1;
                const c3 = (tension - 2) * t3 + (3 - 2 * tension) * t2 + tension * tn;
                const c4 = tension * t3 - tension * t2;
                result.push({ x: c1 * p0.x + c2 * p1.x + c3 * p2.x + c4 * p3.x, y: c1 * p0.y + c2 * p1.y + c3 * p2.y + c4 * p3.y });
            }
        }
        return result;
    }
    
    // --- Utility Functions ---
    screenToWorld(p) {
        if (!p) return null;
        return { x: (p.x - this.panOffset.x) / this.zoom, y: (p.y - this.panOffset.y) / this.zoom };
    }
    clearCanvas() {
        this.elements = [];
        this.currentElement = null;
        this.isDrawing = false;
        this.history = [];
        this.historyIndex = -1;
        this.panOffset = { x: 0, y: 0 };
        this.zoom = 1.0;
        this.saveToHistory();
    }
    saveCanvas() {
        const link = document.createElement('a');
        link.download = `gesture-canvas-${Date.now()}.png`;
        link.href = this.drawingCanvas.toDataURL();
        link.click();
    }
    toggleCamera() {
        this.videoContainer.classList.toggle('hidden');
    }
    showStatus(message) { this.statusText.textContent = message; this.statusIndicator.classList.add('show'); }
    hideStatus() { this.statusIndicator.classList.remove('show'); }
    addElement(element) { this.elements.push(element); this.saveToHistory(); }
    saveToHistory() { this.history = this.history.slice(0, this.historyIndex + 1); this.history.push(JSON.parse(JSON.stringify(this.elements))); this.historyIndex++; }
    undo() { if (this.historyIndex > 0) { this.historyIndex--; this.elements = JSON.parse(JSON.stringify(this.history[this.historyIndex])); } else { this.clearCanvas(); } }
    redo() { if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.elements = JSON.parse(JSON.stringify(this.history[this.historyIndex])); } }
}

document.addEventListener('DOMContentLoaded', () => {
    window.gestureCanvas = new GestureCanvas();
});
