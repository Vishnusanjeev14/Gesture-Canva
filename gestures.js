/**
 * Gesture Recognition System for Canvas Drawing
 * Detects hand gestures and maps them to drawing tools - With Pan & Zoom
 */

class GestureDetector {
    constructor() {
        this.currentGesture = 'idle';
        this.currentTool = 'idle';
        this.stabilityThreshold = 300;
        this.gestureHistory = [];
        this.historySize = 4;
        
        this.gestureMap = {
            'pointer': { icon: '☝️', name: 'Cursor', description: 'Index finger to move cursor' },
            'draw': { icon: '🤏', name: 'Draw', description: 'Pinch thumb and index to draw' },
            'erase': { icon: '✋', name: 'Erase', description: 'Open hand to erase' },
            'pan': { icon: '✊', name: 'Pan', description: 'Fist to move the canvas' },
            'zoom': { icon: '🙌', name: 'Zoom', description: 'Two hands to zoom' },
            'clear': { icon: '🤚', name: 'Clear All', description: 'Both hands open' },
            'idle': { icon: '🤷', name: 'Idle', description: 'No gesture' }
        };
    }

    detectGesture(landmarks, handCount = 1) {
        if (!landmarks) return this.getGestureResult('idle');
        const fingerStates = this.getFingerStates(landmarks);
        let gestureResult;

        if (handCount === 2) {
            gestureResult = this.getGestureResult('zoom');
        } else {
            gestureResult = this.classifySingleHandGesture(fingerStates, landmarks);
        }
        
        return this.applyStabilityFilter(gestureResult);
    }

    classifySingleHandGesture(fingerStates, landmarks) {
        const [thumb, index, middle, ring, pinky] = fingerStates;
        const extendedCount = fingerStates.filter(Boolean).length;
        
        const pinchDistance = this.getPinchDistance(landmarks);
        if (pinchDistance < 0.04 && !middle && !ring && !pinky) {
            return this.getGestureResult('draw');
        }
        if (index && !middle && !ring && !pinky) {
            return this.getGestureResult('pointer');
        }
        if (extendedCount === 0 || (extendedCount === 1 && thumb)) {
            return this.getGestureResult('pan');
        }
        if (extendedCount >= 4) {
            const allOpen = fingerStates.every(f => f);
            return this.getGestureResult(allOpen ? 'clear' : 'erase');
        }
        return this.getGestureResult('idle');
    }
    
    getPinchDistance(landmarks) {
        return Math.hypot(landmarks[4].x - landmarks[8].x, landmarks[4].y - landmarks[8].y);
    }
    
    getTwoHandDistance(hand1, hand2) {
        const p1 = hand1[8]; // Index finger tip of hand 1
        const p2 = hand2[8]; // Index finger tip of hand 2
        return Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }

    getFingerStates(landmarks) {
        const fingerTips = [4, 8, 12, 16, 20];
        const fingerPIPs = [3, 6, 10, 14, 18];
        const states = [];
        states.push(Math.hypot(landmarks[4].x - landmarks[3].x, landmarks[4].y - landmarks[3].y) > 0.04);
        for (let i = 1; i < 5; i++) {
            states.push(landmarks[fingerTips[i]].y < landmarks[fingerPIPs[i]].y);
        }
        return states;
    }
    
    applyStabilityFilter(gestureResult) {
        this.gestureHistory.push(gestureResult.gesture);
        if (this.gestureHistory.length > this.historySize) this.gestureHistory.shift();
        const isConsistent = this.gestureHistory.filter(g => g === gestureResult.gesture).length >= 3;
        if (isConsistent && gestureResult.gesture !== this.currentGesture) {
            this.currentGesture = gestureResult.gesture;
        }
        return this.getGestureResult(this.currentGesture);
    }

    getGestureResult(gesture) {
        const details = this.gestureMap[gesture] || this.gestureMap['idle'];
        return { gesture, tool: gesture, ...details };
    }

    landmarkToCanvas(landmark, canvasSize) {
        return { x: (1 - landmark.x) * canvasSize.width, y: landmark.y * canvasSize.height };
    }

    getDrawingPosition(landmarks, canvasSize) {
        if (!landmarks) return null;
        return this.landmarkToCanvas(landmarks[8], canvasSize); // Index finger tip
    }

    getPalmCenter(landmarks, canvasSize) {
        if (!landmarks) return null;
        const center = { x: landmarks[9].x, y: landmarks[9].y }; // Middle finger base
        return this.landmarkToCanvas(center, canvasSize);
    }
}

window.GestureDetector = GestureDetector;