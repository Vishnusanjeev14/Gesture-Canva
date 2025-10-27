# 🎨 Gesture Canva

Gesture Canva is a "no-touch" digital whiteboard application that uses your webcam to translate hand gestures into drawing commands. Built with JavaScript and Mediapipe, it allows you to draw, erase, pan, and more, all through intuitive hand movements.

## ✨ Features

* **Gesture-Based Tools:** Switch between tools just by changing your hand shape.
* **Smooth Drawing:** Creates clean, vector-based lines.
* **Pan & Zoom:** Move around your infinite canvas with ease.
* **Undo/Redo:** Full history support (also available via `Ctrl+Z` / `Ctrl+Y`).
* **Smart Cursor:** A color-coded, fading trail shows you exactly what your hand is doing.

## 🚀 How to Run

1.  **Install Dependencies:**
    * You must have **Python 3** installed.
    * Install the required Python library (Mediapipe):
        ```bash
        pip install mediapipe
        ```

2.  **Start the Server:**
    * From the project's main folder, run the simple Python web server:
        ```bash
        python server.py
        ```

3.  **Open the App:**
    * Open your web browser (Chrome is recommended) and go to:
        [http://localhost:8000](http://localhost:8000)
    * Allow the browser to access your webcam.

## 🖐️ Gesture Controls

| Gesture | Icon | Action | Description |
| :--- | :--- | :--- | :--- |
| **One Finger** | ☝️ | **Pointer/Cursor** | Moves a cursor on the screen but does not draw. |
| **Pinch** | 🤏 | **Draw** | Draws smooth freehand lines on the canvas. |
| **Two Fingers** | ✌️ | **Circle** | Draws a circle from the center out. |
| **Open Palm** | ✋ | **Erase** | Erases any lines or shapes it touches. |
| **Fist** | ✊ | **Pan/Move** | "Grabs" the canvas to move it around. |
| **Both Hands** | 🤚🤚 | **Clear All** | Clears the entire canvas. |
