# 🎨 Gesture Canva

Gesture Canva is a "no-touch" digital whiteboard application that uses your webcam to translate hand gestures into drawing commands. Built with JavaScript and Mediapipe, it allows you to draw, erase, pan, and zoom, all through intuitive hand movements.

## ✨ Features

Based on the code, this application supports:

* **Gesture-Based Tools:** Draw, erase, pan, and zoom just by changing your hand shape.
* **Live Tool Feedback:** The UI (video and gesture panels) changes color to match your active tool (e..g., blue for draw, red for erase).
* **Pan & Zoom:** Move around and scale your infinite canvas.
* **Color & Size Controls:** Use the UI buttons to change your brush color and size.
* **Handwriting Smoothing:** A "Smoothen" button to clean up your freehand lines using a spline algorithm.
* **Undo/Redo:** Full history support, also available via `Ctrl+Z` / `Ctrl+Y`.
* **Save:** Save your creation as a PNG file.

## 🚀 How to Run

This is a fully client-side application. It **does not require** any Python libraries like `mediapipe` to be installed. The Mediapipe library is loaded from a CDN (a web link).

It only needs to be run from a simple local web server so the browser can load all the files (`.js`, `.css`) correctly.

1.  **Open a terminal** in the project's main folder (where `index.html` is located).

2.  **Start a simple web server.** If you have Python 3, run:
    ```bash
    python3 -m http.server 8000
    ```
    (If `python3` doesn't work, try `python -m http.server 8000`)

3.  **Open the App:**
    Open your web browser (Chrome is recommended) and go to:
    [http://localhost:8000](http://localhost:8000)

4.  **Allow** the browser to access your webcam when prompted.

## 🖐️ Gesture Controls

This is the list of gestures implemented in `gestures.js`:

| Gesture | Icon | Action | Description |
| :--- | :--- | :--- | :--- |
| **Pointer** | ☝️ | **Cursor** | Index finger only. Moves the cursor on the screen but does not draw. |
| **Draw** | 🤏 | **Draw** | Pinch thumb and index finger. Draws freehand lines on the canvas. |
| **Pan/Move** | ✊ | **Pan** | A closed fist. "Grabs" the canvas to move it around. |
| **Erase** | ✋ | **Erase** | An open hand (4+ fingers). Erases any lines it touches. |
| **Clear All** | 🤚 | **Clear** | A full open hand (all 5 fingers extended). Clears the entire canvas. |
| **Zoom** | 🙌 | **Zoom** | Two hands detected. Move hands apart or together to zoom in and out. |
