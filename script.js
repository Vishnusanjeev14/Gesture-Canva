/**
 * Main application script for Gesture Canva.
 * Handles canvas drawing, gesture events, and application state.
 */

// Global state for cursor tracking
const cursor = { x: 0, y: 0, trail: [] };
const CURSOR_TRAIL_LENGTH = 8;
const CURSOR_TRAIL_FADE_MS = 250;

/**
 * Main Canvas application class
 */
class Canvas {
    constructor(canvas, gestureController) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gestureController = gestureController;

        this.elements = [];
        this.currentElement = null;
        this.isDrawing = false;
        this.activeTool = 'pointer'; // 'pointer', 'draw', 'circle', 'erase', 'pan'

        this.history = [];
        this.historyIndex = -1;

        this.panOffset = { x: 0, y: 0 };
        this.startPan = { x: 0, y: 0 };
        this.zoom = 1.0; // Future use

        // NEW: Get UI elements
        this.colorPicker = document.getElementById('colorPicker');
        this.sizeSlider = document.getElementById('sizeSlider');

        // NEW: Properties for stroke
        this.strokeColor = this.colorPicker.value;
        this.strokeWidth = parseInt(this.sizeSlider.value, 10);

        this.resizeCanvas();
        this.initListeners();
        this.saveToHistory();
        this.animate();
    }

    /**
     * Initialize all event listeners for gestures, mouse, and window
     */
    initListeners() {
        window.addEventListener('resize', () => this.resizeCanvas());

        // Gesture listeners from GestureController
        this.gestureController.on('gesture', (e) => this.handleGesture(e));
        this.gestureController.on('pointer', (e) => this.handlePointer(e));

        // Keyboard listeners
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Mouse listeners (fallback)
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseFallback(e, 'down'));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseFallback(e, 'move'));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseFallback(e, 'up'));

        // NEW: Listeners for new UI
        this.colorPicker.addEventListener('change', (e) => {
            this.strokeColor = e.target.value;
        });
        this.sizeSlider.addEventListener('input', (e) => {
            this.strokeWidth = parseInt(e.target.value, 10);
        });
    }

    /**
     * Resize the canvas to fill the window
     */
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.redraw();
    }

    /**
     * Get transformed coordinates from screen to canvas space (accounting for pan)
     * @param {number} x - Screen X coordinate
     * @param {number} y - Screen Y coordinate
     * @returns {{x: number, y: number}}
     */
    getCanvasCoords(x, y) {
        return {
            x: x - this.panOffset.x,
            y: y - this.panOffset.y
        };
    }

    /**
     * Get screen coordinates from canvas space
     * @param {number} x - Canvas X coordinate
     * @param {number} y - Canvas Y coordinate
     * @returns {{x: number, y: number}}
     */
    getScreenCoords(x, y) {
        return {
            x: x + this.panOffset.x,
            y: y + this.panOffset.y
        };
    }

    /**
     * Base element structure
     * @param {number} x - Starting X
     * @param {number} y - Starting Y
     * @returns {object}
     */
    baseElement(x, y) {
        return {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            x1: x,
            y1: y,
            x2: x,
            y2: y,
            points: [{ x, y }]
        };
    }

    /**
     * Handle incoming gesture events
     * @param {object} e - Gesture event
     */
    handleGesture(e) {
        const { gesture, pos } = e;
        const coords = this.getCanvasCoords(pos.x, pos.y);

        this.activeTool = gesture;
        updateCursor(pos, gesture); // Update visual cursor

        switch (gesture) {
            case 'draw':
            case 'circle':
            case 'erase':
                if (!this.isDrawing) {
                    this.startDrawing(coords.x, coords.y, gesture);
                } else {
                    this.updateDrawing(coords.x, coords.y);
                }
                break;
            case 'pan':
                if (!this.isDrawing) {
                    this.startPan = { x: pos.x, y: pos.y };
                    this.isDrawing = true; // Use isDrawing as a flag for panning
                } else {
                    const dx = pos.x - this.startPan.x;
                    const dy = pos.y - this.startPan.y;
                    this.panOffset.x += dx;
                    this.panOffset.y += dy;
                    this.startPan = { x: pos.x, y: pos.y };
                }
                break;
            case 'pointer':
            case 'two_hands':
                if (this.isDrawing) {
                    this.stopDrawing();
                }
                if (gesture === 'two_hands') {
                    this.clearCanvas();
                }
                break;
        }
    }

    /**
     * Handle pointer-only movement
     * @param {object} e - Pointer event
     */
    handlePointer(e) {
        if (this.isDrawing) {
            // Stop any action if hand moves but no gesture is active
            this.stopDrawing();
        }
        this.activeTool = 'pointer';
        updateCursor(e.pos, 'pointer');
    }

    /**
     * Fallback for mouse controls
     * @param {MouseEvent} e
     * @param {'down' | 'move' | 'up'} type
     */
    handleMouseFallback(e, type) {
        // Only allow mouse fallback if no hands are detected
        if (this.gestureController.isHandVisible()) return;

        this.activeTool = 'draw'; // Default mouse to draw
        const pos = { x: e.clientX, y: e.clientY };
        const coords = this.getCanvasCoords(pos.x, pos.y);
        updateCursor(pos, 'pointer'); // Show mouse as pointer

        switch (type) {
            case 'down':
                this.startDrawing(coords.x, coords.y, 'draw');
                break;
            case 'move':
                if (this.isDrawing) {
                    this.updateDrawing(coords.x, coords.y);
                }
                break;
            case 'up':
                this.stopDrawing();
                break;
        }
    }

    /**
     * Start a new drawing element
     * @param {number} x - Canvas X
     * @param {number} y - Canvas Y
     * @param {'draw' | 'circle' | 'erase'} type
     */
    startDrawing(x, y) {
        this.isDrawing = true;
        const typeMap = { 'draw': 'path', 'circle': 'circle', 'erase': 'erase' };
        const type = typeMap[this.activeTool];
        
        // NEW: Add strokeColor and strokeWidth to the element
        this.currentElement = {
            ...this.baseElement(x, y),
            type,
            strokeColor: this.strokeColor,
            strokeWidth: this.strokeWidth
        };
        
        this.elements.push(this.currentElement);
    }

    /**
     * Update the current drawing element
     * @param {number} x - Canvas X
     * @param {number} y - Canvas Y
     */
    updateDrawing(x, y) {
        if (!this.currentElement) return;

        this.currentElement.x2 = x;
        this.currentElement.y2 = y;

        if (this.currentElement.type === 'path' || this.currentElement.type === 'erase') {
            this.currentElement.points.push({ x, y });
        }
    }

    /**
     * Finalize the current drawing action
     */
    stopDrawing() {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        
        if (this.currentElement) {
            // Optimize path elements (future optimization)
            this.currentElement = null;
            this.saveToHistory();
        }
    }

    /**
     * Main animation loop, called every frame
     */
    animate() {
        this.redraw();
        updateCursorTrail();
        requestAnimationFrame(() => this.animate());
    }

    /**
     * Redraw the entire canvas
     */
    redraw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply global pan
        this.ctx.save();
        this.ctx.translate(this.panOffset.x, this.panOffset.y);

        this.elements.forEach(element => {
            this.drawElement(element);
        });

        this.ctx.restore();
    }

    /**
     * Draw a single element onto the canvas
     * @param {object} element
     */
    drawElement(element) {
        this.ctx.save();
        
        // Default drawing styles
        this.ctx.globalCompositeOperation = 'source-over';

        switch (element.type) {
            case 'path':
                // NEW: Use element's saved properties
                this.ctx.strokeStyle = element.strokeColor;
                this.ctx.lineWidth = element.strokeWidth;
                this.ctx.lineCap = 'round';
                this.ctx.lineJoin = 'round';
                
                this.ctx.beginPath();
                this.ctx.moveTo(element.points[0].x, element.points[0].y);
                for (let i = 1; i < element.points.length; i++) {
                    this.ctx.lineTo(element.points[i].x, element.points[i].y);
                }
                this.ctx.stroke();
                break;

            case 'circle':
                // NEW: Use element's saved properties
                this.ctx.strokeStyle = element.strokeColor;
                this.ctx.lineWidth = element.strokeWidth;

                this.ctx.beginPath();
                const radius = Math.sqrt(Math.pow(element.x2 - element.x1, 2) + Math.pow(element.y2 - element.y1, 2));
                this.ctx.arc(element.x1, element.y1, radius, 0, 2 * Math.PI);
                this.ctx.stroke();
                break;

            case 'erase':
                this.ctx.globalCompositeOperation = 'destination-out';
                // NEW: Use element's saved properties (size)
                this.ctx.lineWidth = element.strokeWidth;
                this.ctx.lineCap = 'round';
                this.ctx.lineJoin = 'round';
                
                this.ctx.beginPath();
                if (element.points.length > 0) {
                    this.ctx.moveTo(element.points[0].x, element.points[0].y);
                    for (let i = 1; i < element.points.length; i++) {
                        this.ctx.lineTo(element.points[i].x, element.points[i].y);
                    }
                    this.ctx.stroke();
                }
                break;
        }

        this.ctx.restore();
    }

    /**
     * Save the current state to the history buffer
     */
    saveToHistory() {
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        this.history.push(JSON.parse(JSON.stringify(this.elements)));
        this.historyIndex++;
        
        // Limit history size
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    /**
     * Undo the last action
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.elements = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
        }
    }

    /**
     * Redo the last undone action
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.elements = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
        }
    }

    /**
     * Clear the entire canvas and reset state
     */
    clearCanvas() {
        this.elements = [];
        this.currentElement = null;
        this.isDrawing = false; // 
        this.history = [];
        this.historyIndex = -1;
        this.panOffset = { x: 0, y: 0 };
        this.zoom = 1.0;
        this.saveToHistory();
    }

    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} e
     */
    handleKeyDown(e) {
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            this.undo();
        } else if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            this.redo();
        }
    }
}


// --- Cursor ---

const cursorDot = document.getElementById('cursor-dot');
const cursorTrail = document.getElementById('cursor-trail');
let trailPoints = [];

const CURSOR_COLORS = {
    pointer: '#8E8E93', // Gray
    draw: '#007AFF',    // Blue
    circle: '#34C759',  // Green
    erase: '#FF3B30',   // Red
    pan: '#FF9500',     // Orange
    two_hands: 'transparent'
};

/**
 * Update the visual cursor's position and color
 * @param {{x: number, y: number}} pos - Screen coordinates
 * @param {string} tool - Active tool name
 */
function updateCursor(pos, tool) {
    cursor.x = pos.x;
    cursor.y = pos.y;
    
    const color = CURSOR_COLORS[tool] || CURSOR_COLORS.pointer;
    cursorDot.style.backgroundColor = color;
    cursorTrail.style.backgroundColor = color;
    
    // Add to trail
    trailPoints.push({ x: pos.x, y: pos.y, time: Date.now() });
    
    // Update dot position
    cursorDot.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    
    // Manage trail length
    if (trailPoints.length > CURSOR_TRAIL_LENGTH) {
        trailPoints.shift();
    }
}

/**
 * Animate the fading cursor trail
 */
function updateCursorTrail() {
    const now = Date.now();
    trailPoints = trailPoints.filter(p => now - p.time < CURSOR_TRAIL_FADE_MS);

    if (trailPoints.length < 2) {
        cursorTrail.style.opacity = 0;
        return;
    }

    const lastPoint = trailPoints[trailPoints.length - 1];
    const firstPoint = trailPoints[0];
    
    const dx = lastPoint.x - firstPoint.x;
    const dy = lastPoint.y - firstPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const opacity = 1 - (now - lastPoint.time) / CURSOR_TRAIL_FADE_MS;

    cursorTrail.style.width = `${distance}px`;
    cursorTrail.style.opacity = opacity * 0.5; // Make trail fainter
    cursorTrail.style.transform = `translate(${firstPoint.x}px, ${firstPoint.y}px) rotate(${angle}deg)`;
}


// --- Initialization ---

window.onload = () => {
    const canvasEl = document.getElementById('canvas');
    const videoEl = document.getElementById('webcam');

    // Setup Gesture Controller
    const gestureController = new GestureController(videoEl);
    gestureController.start();

    // Setup Canvas App
    new Canvas(canvasEl, gestureController);
};
