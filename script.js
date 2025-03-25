document.addEventListener("DOMContentLoaded", () => {
    const video = document.getElementById("video");
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const fileInput = document.getElementById("fileInput");
    const colorInput = document.getElementById("colorInput");
    const captureBtn = document.getElementById("captureBtn");
    const resetBtn = document.getElementById("resetBtn");
    const sensitivityInput = document.getElementById("sensitivity");
    const featherInput = document.getElementById("feather");
    const startCameraBtn = document.getElementById("startCameraBtn");
    const newPicBtn = document.getElementById("newPicBtn");
    const undoBtn = document.getElementById("undoBtn");
    const redoBtn = document.getElementById("redoBtn");
    const controls = document.getElementById("controls");

    let imgData, originalImage, stream;
    let undoStack = [];
    let redoStack = [];
    let isProcessing = false;

    startCameraBtn.addEventListener("click", () => {
        // Stop any loaded file display
        canvas.style.display = "none";
        fileInput.value = ""; // Reset file input

        // Start camera
        navigator.mediaDevices.getUserMedia({ video: true }).then(s => {
            stream = s;
            video.srcObject = stream;
            video.style.display = "block";
            captureBtn.style.display = "inline";
        }).catch(() => {
            alert("Camera not accessible. Use file upload.");
        });
    });

    captureBtn.addEventListener("click", () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        originalImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
        video.style.display = "none";
        captureBtn.style.display = "none";
        newPicBtn.style.display = "inline";
        controls.style.display = "inline";
        canvas.style.display = "block";
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    });

    newPicBtn.addEventListener("click", () => {
        startCameraBtn.click();
        newPicBtn.style.display = "none";
        canvas.style.display = "none";
    });

    fileInput.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (file) {
            // Stop the camera if active
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                stream = null;
            }
            video.style.display = "none";
            captureBtn.style.display = "none";

            // Load and display the image
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    originalImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    canvas.style.display = "block";
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    colorInput.addEventListener("input", () => {
        const color = colorInput.value;
        document.querySelector(".color-preview").style.backgroundColor = color;
    });

    resetBtn.addEventListener("click", () => {
        if (originalImage) {
            ctx.putImageData(originalImage, 0, 0);
            imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }
    });

    undoBtn.addEventListener("click", () => {
        if (undoStack.length > 0) {
            // Push current state to redo stack before undoing
            redoStack.push(imgData);
            imgData = undoStack.pop();
            ctx.putImageData(imgData, 0, 0);
        }
    });

    redoBtn.addEventListener("click", () => {
        if (redoStack.length > 0) {
            // Push current state to undo stack before redoing
            undoStack.push(imgData);
            imgData = redoStack.pop();
            ctx.putImageData(imgData, 0, 0);
        }
    });

    canvas.addEventListener("click", (event) => {
        if (isProcessing) return;
        isProcessing = true;

        if (!imgData) return;

        // Scale coordinates to match actual image size
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = Math.floor((event.clientX - rect.left) * scaleX);
        const y = Math.floor((event.clientY - rect.top) * scaleY);

        const targetColor = getPixelColor(imgData, x, y);
        const newColor = hexToRgb(colorInput.value);
        const tolerance = parseInt(sensitivityInput.value);
        const feather = parseInt(featherInput.value);

        requestAnimationFrame(() => {
            magicWandFloodFill(imgData, x, y, targetColor, newColor, tolerance, feather);
            saveStateToUndoStack();
            ctx.putImageData(imgData, 0, 0);
            isProcessing = false;
        });
    });


    function getPixelColor(imgData, x, y) {
        const index = (y * imgData.width + x) * 4;
        return imgData.data.slice(index, index + 3);
    }

    function hexToRgb(hex) {
        const bigint = parseInt(hex.slice(1), 16);
        return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
    }

    function magicWandFloodFill(imgData, x, y, targetColor, newColor, tolerance, feather) {
        const width = imgData.width;
        const height = imgData.height;
        const stack = [[x, y]];
        const visited = new Set();
        const matchColor = (color1, color2) =>
            color1.every((c, i) => Math.abs(c - color2[i]) <= tolerance);

        while (stack.length) {
            const [cx, cy] = stack.pop();
            if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
            const index = (cy * width + cx) * 4;
            const color = imgData.data.slice(index, index + 3);
            if (!matchColor(color, targetColor)) continue;

            imgData.data.set(newColor.concat(255), index);

            visited.add(`${cx},${cy}`);

            if (!visited.has(`${cx + 1},${cy}`)) stack.push([cx + 1, cy]);
            if (!visited.has(`${cx - 1},${cy}`)) stack.push([cx - 1, cy]);
            if (!visited.has(`${cx},${cy + 1}`)) stack.push([cx, cy + 1]);
            if (!visited.has(`${cx},${cy - 1}`)) stack.push([cx, cy - 1]);
        }

        visited.forEach(pos => {
            const [cx, cy] = pos.split(',').map(Number);
            const index = (cy * width + cx) * 4;
            imgData.data[index + 3] = Math.max(0, 255 - feather);
        });
    }

    function saveStateToUndoStack() {
        const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
        undoStack.push(currentState);
        // Clear redo stack when a new change is made
        redoStack = [];
    }
});

document.getElementById("downloadBtn").addEventListener("click", () => {
    const canvas = document.getElementById("canvas");

    if (canvas.style.display !== "none" && canvas.width > 0 && canvas.height > 0) {
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = "edited-image.png";
        link.click();
    } else {
        alert("No image to download.");
    }
});

/* Color Palette */

function generateHousePaintPalette(numColors, baseColor, contrastMode, lightMode) {
    function adjustHue(hue, offset) {
        return (hue + offset) % 360;
    }

    function randomMutedColor() {
        let hue = Math.floor(Math.random() * 360);
        let saturation = contrastMode === "high" ? 50 : 20;  // Higher saturation for high contrast
        let lightness = lightMode === "light" ? Math.floor(Math.random() * 20) + 70 : Math.floor(Math.random() * 20) + 30;
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    let palette = [];
    let baseHue = parseInt(baseColor.slice(1), 16) % 360; // Extract hue from hex

    for (let i = 0; i < numColors; i++) {
        let offset = (i * (contrastMode === "high" ? 45 : 15)) % 120;
        let newHue = adjustHue(baseHue, offset);
        let newLightness = lightMode === "light" ? Math.floor(Math.random() * 20) + 70 : Math.floor(Math.random() * 20) + 30;
        let newSaturation = contrastMode === "high" ? 50 : 20;
        let newColor = `hsl(${newHue}, ${newSaturation}%, ${newLightness}%)`;

        palette.push(newColor);
    }

    return palette;
}

function hslToHex(hsl) {
    let [h, s, l] = hsl.match(/\d+/g).map(Number);
    s /= 100;
    l /= 100;

    let c = (1 - Math.abs(2 * l - 1)) * s;
    let x = c * (1 - Math.abs((h / 60) % 2 - 1));
    let m = l - c / 2;
    let r = 0, g = 0, b = 0;

    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
}

function generateAndShowPalette() {
    const numColors = parseInt(document.getElementById('colorCount').value);
    const baseColor = document.getElementById('colorInput').value;
    const contrastMode = document.getElementById('contrastMode').value;
    const lightMode = document.getElementById('lightMode').value;

    const palette = generateHousePaintPalette(numColors, baseColor, contrastMode, lightMode);
    const paletteContainer = document.getElementById('paletteContainer');

    paletteContainer.innerHTML = ''; // Clear previous colors

    palette.forEach(color => {
        const colorBox = document.createElement('div');
        colorBox.classList.add('color-box');
        colorBox.style.backgroundColor = color;
        const hexCode = hslToHex(color);
        colorBox.innerHTML = `<span>${hexCode}</span>`;
        colorBox.style.color = lightMode === "light" ? "#333" : "#fff"; // Adapt text color for visibility
        paletteContainer.appendChild(colorBox);
    });
}