document.addEventListener("DOMContentLoaded", () => {
    // Common wall paint colors (neutral/warm tones)
    const WALL_COLORS = [
        "#F5F5F5", "#E6E6E6", "#D6D6D6", // Whites/Grays
        "#F0EAD6", "#E6D8C3", "#D9C7B8", // Beiges
        "#D4A373", "#BC8A5F", "#A07156", // Browns
        "#E8C07D", "#D4B483", "#C1A38B", // Tans
        "#B7B7A4", "#A5A58D", "#6B705C", // Sage Greens
        "#A5A58D", "#6B705C", "#3A5A40", // Darker Greens
        "#B5838D", "#9D6B75", "#855A5F", // Muted Reds
        "#6D6875", "#5D576B", "#4D4861"  // Muted Purples
    ];

    // DOM Elements
    const video = document.getElementById("video");
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const fileInput = document.getElementById("fileInput");
    const colorInput = document.getElementById("colorInput");
    const colorFormat = document.getElementById("colorFormat");
    const captureBtn = document.getElementById("captureBtn");
    const resetBtn = document.getElementById("resetBtn");
    const sensitivityInput = document.getElementById("sensitivity");
    const featherInput = document.getElementById("feather");
    const startCameraBtn = document.getElementById("startCameraBtn");
    const newPicBtn = document.getElementById("newPicBtn");
    const undoBtn = document.getElementById("undoBtn");
    const redoBtn = document.getElementById("redoBtn");
    const downloadBtn = document.getElementById("downloadBtn");
    const generatePaletteBtn = document.getElementById("generatePaletteBtn");
    const paletteContainer = document.getElementById("paletteContainer");
    const loadingIndicator = document.querySelector(".loading");
    const paletteBase = document.getElementById("paletteBase");

    // App State
    let imgData, originalImage, stream;
    let undoStack = [];
    let redoStack = [];
    let isProcessing = false;
    let currentColorFormat = 'hex';

    // Initialize with random wall color
    colorInput.value = WALL_COLORS[Math.floor(Math.random() * WALL_COLORS.length)];

    // Initialize
    initEventListeners();
    generatePalette(); // Generate initial palette

    function initEventListeners() {
        // Image source controls
        startCameraBtn.addEventListener("click", startCamera);
        captureBtn.addEventListener("click", captureFromCamera);
        newPicBtn.addEventListener("click", resetImageSource);
        fileInput.addEventListener("change", handleFileUpload);

        // Painting controls
        colorInput.addEventListener("input", updateColorPreview);
        colorFormat.addEventListener("change", (e) => {
            currentColorFormat = e.target.value;
            updateColorPreview();
        });
        resetBtn.addEventListener("click", resetCanvas);
        undoBtn.addEventListener("click", undoAction);
        redoBtn.addEventListener("click", redoAction);
        canvas.addEventListener("click", handleCanvasClick);
        downloadBtn.addEventListener("click", downloadImage);

        // Slider controls
        document.getElementById('sensitivity').addEventListener('input', function() {
            document.getElementById('sensitivityValue').textContent = this.value;
        });
        
        document.getElementById('feather').addEventListener('input', function() {
            document.getElementById('featherValue').textContent = this.value;
        });
        
        // Transparency slider
        document.getElementById('transparency').addEventListener('input', function () {
            document.getElementById('transparencyValue').textContent = this.value + '%';
        });

        // Palette controls
        generatePaletteBtn.addEventListener("click", generatePalette);
    }

    // Camera Functions
    function startCamera() {
        canvas.style.display = "none";
        fileInput.value = "";

        navigator.mediaDevices.getUserMedia({ video: true })
            .then(s => {
                stream = s;
                video.srcObject = stream;
                video.style.display = "block";
                captureBtn.style.display = "inline";
                newPicBtn.style.display = "none";
            })
            .catch(() => {
                alert("Could not access camera. Please try file upload instead.");
            });
    }

    function captureFromCamera() {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        saveImageState();
        video.style.display = "none";
        captureBtn.style.display = "none";
        newPicBtn.style.display = "inline";
        canvas.style.display = "block";
        downloadBtn.disabled = false;
        stopCameraStream();
    }

    function stopCameraStream() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
    }

    function resetImageSource() {
        startCamera();
        newPicBtn.style.display = "none";
        canvas.style.display = "none";
        downloadBtn.disabled = true;
    }

    // File Handling
    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        stopCameraStream();
        video.style.display = "none";
        captureBtn.style.display = "none";
        newPicBtn.style.display = "inline";

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                saveImageState();
                canvas.style.display = "block";
                downloadBtn.disabled = false;
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // Painting Functions
    function handleCanvasClick(event) {
        if (isProcessing || !imgData) return;
        isProcessing = true;
        loadingIndicator.style.display = "flex";

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = Math.floor((event.clientX - rect.left) * scaleX);
        const y = Math.floor((event.clientY - rect.top) * scaleY);

        const targetColor = getPixelColor(imgData, x, y);
        const newColor = hexToRgb(colorInput.value);
        const tolerance = parseInt(sensitivityInput.value);
        const feather = parseInt(featherInput.value);

        setTimeout(() => {
            magicWandFloodFill(imgData, x, y, targetColor, newColor, tolerance, feather);
            saveStateToUndoStack();
            ctx.putImageData(imgData, 0, 0);
            isProcessing = false;
            loadingIndicator.style.display = "none";
        }, 100);
    }

    function getPixelColor(imgData, x, y) {
        const index = (y * imgData.width + x) * 4;
        return imgData.data.slice(index, index + 3);
    }

    function hexToRgb(hex) {
        const bigint = parseInt(hex.slice(1), 16);
        return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
    }

    function rgbToHex(r, g, b) {
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
    }

    function magicWandFloodFill(imgData, x, y, targetColor, newColor, tolerance, feather) {
        const width = imgData.width;
        const height = imgData.height;
        const stack = [[x, y]];
        const visited = new Set();
        const transparency = parseInt(document.getElementById('transparency').value) / 100;
        const matchColor = (color1, color2) =>
            color1.every((c, i) => Math.abs(c - color2[i]) <= tolerance);

        // Create a copy of the original image data for reference
        const originalData = new Uint8ClampedArray(imgData.data);

        while (stack.length) {
            const [cx, cy] = stack.pop();
            if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
            
            const index = (cy * width + cx) * 4;
            const color = imgData.data.slice(index, index + 3);
            if (!matchColor(color, targetColor)) continue;

            // Get original pixel color from our copy
            const originalR = originalData[index];
            const originalG = originalData[index + 1];
            const originalB = originalData[index + 2];

            // Blend with new color based on transparency
            const blendedR = Math.round(newColor[0] * (1 - transparency) + originalR * transparency);
            const blendedG = Math.round(newColor[1] * (1 - transparency) + originalG * transparency);
            const blendedB = Math.round(newColor[2] * (1 - transparency) + originalB * transparency);

            imgData.data[index] = blendedR;
            imgData.data[index + 1] = blendedG;
            imgData.data[index + 2] = blendedB;
            imgData.data[index + 3] = 255; // Keep full opacity for the blended result

            visited.add(`${cx},${cy}`);

            // 8-directional flood fill for better coverage
            if (!visited.has(`${cx + 1},${cy}`)) stack.push([cx + 1, cy]);
            if (!visited.has(`${cx - 1},${cy}`)) stack.push([cx - 1, cy]);
            if (!visited.has(`${cx},${cy + 1}`)) stack.push([cx, cy + 1]);
            if (!visited.has(`${cx},${cy - 1}`)) stack.push([cx, cy - 1]);
            if (!visited.has(`${cx + 1},${cy + 1}`)) stack.push([cx + 1, cy + 1]);
            if (!visited.has(`${cx - 1},${cy - 1}`)) stack.push([cx - 1, cy - 1]);
            if (!visited.has(`${cx + 1},${cy - 1}`)) stack.push([cx + 1, cy - 1]);
            if (!visited.has(`${cx - 1},${cy + 1}`)) stack.push([cx - 1, cy + 1]);
        }

        // Apply feather effect to the edges
        if (feather > 0) {
            const featherRadius = feather;
            visited.forEach(pos => {
                const [cx, cy] = pos.split(',').map(Number);
                const index = (cy * width + cx) * 4;
                
                // Check if this pixel is on the edge of the filled area
                let isEdge = false;
                for (let yOffset = -1; yOffset <= 1; yOffset++) {
                    for (let xOffset = -1; xOffset <= 1; xOffset++) {
                        if (xOffset === 0 && yOffset === 0) continue;
                        const nx = cx + xOffset;
                        const ny = cy + yOffset;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const nIndex = (ny * width + nx) * 4;
                            if (!visited.has(`${nx},${ny}`)) {
                                isEdge = true;
                                break;
                            }
                        }
                    }
                    if (isEdge) break;
                }
                
                if (isEdge) {
                    imgData.data[index + 3] = Math.max(0, 255 - featherRadius);
                }
            });
        }
    }

    // Undo/Redo Functions
    function saveStateToUndoStack() {
        const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
        undoStack.push(currentState);
        redoStack = [];
    }

    function saveImageState() {
        imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        originalImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
        undoStack = [];
        redoStack = [];
    }

    function undoAction() {
        if (undoStack.length > 0) {
            redoStack.push(imgData);
            imgData = undoStack.pop();
            ctx.putImageData(imgData, 0, 0);
        }
    }

    function redoAction() {
        if (redoStack.length > 0) {
            undoStack.push(imgData);
            imgData = redoStack.pop();
            ctx.putImageData(imgData, 0, 0);
        }
    }

    function resetCanvas() {
        if (originalImage) {
            ctx.putImageData(originalImage, 0, 0);
            imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            undoStack = [];
            redoStack = [];
        }
    }

    // Color Palette Functions
    function generatePalette() {
        const numColors = parseInt(document.getElementById('colorCount').value);
        const baseColor = paletteBase.value === "selected" ? colorInput.value : WALL_COLORS[Math.floor(Math.random() * WALL_COLORS.length)];
        const paletteType = document.getElementById('paletteType').value;
        const contrastMode = document.getElementById('contrastMode').value;
        const lightMode = document.getElementById('lightMode').value;
        const colorTemp = document.getElementById('colorTemp').value;

        const palette = generateHousePaintPalette(
            numColors, 
            baseColor, 
            paletteType, 
            contrastMode, 
            lightMode, 
            colorTemp
        );

        displayPalette(palette);
    }

    function generateHousePaintPalette(numColors, baseColor, paletteType, contrastMode, lightMode, colorTemp) {
        // Color name databases
        const colorNames = {
            warm: ["Terracotta", "Honey", "Buttercream", "Cinnamon", "Amber", "Coral", "Peach", "Sand", "Clay", "Brick"],
            cool: ["Seafoam", "Mist", "Slate", "Sage", "Dusk", "Icy", "Frost", "Ocean", "Rain", "Dove"],
            neutral: ["Linen", "Stone", "Taupe", "Khaki", "Putty", "Pebble", "Sandstone", "Ash", "Driftwood", "Mushroom"]
        };

        const paintNames = [
            "Whisper White", "Seaside Villa", "Morning Fog", "Toasted Almond", 
            "Misty Rose", "Quiet Gray", "Pale Oak", "Repose Gray"
        ];

        // Convert hex to HSL
        function hexToHsl(hex) {
            const r = parseInt(hex.substr(1, 2), 16) / 255;
            const g = parseInt(hex.substr(3, 2), 16) / 255;
            const b = parseInt(hex.substr(5, 2), 16) / 255;
            
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const diff = max - min;
            
            let h = 0, s = 0;
            const l = (max + min) / 2;
            
            if (diff !== 0) {
                s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);
                switch (max) {
                    case r: h = (g - b) / diff + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / diff + 2; break;
                    case b: h = (r - g) / diff + 4; break;
                }
                h /= 6;
            }
            
            return [h * 360, s * 100, l * 100];
        }
        
        // HSL to Hex
        function hslToHex(h, s, l) {
            h /= 360;
            s /= 100;
            l /= 100;
            
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            
            let r, g, b;
            if (s === 0) {
                r = g = b = l;
            } else {
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                r = hue2rgb(p, q, h + 1/3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1/3);
            }
            
            const toHex = x => Math.round(x * 255).toString(16).padStart(2, '0');
            return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
        }

        // Generate color name
        function generateColorName(hsl) {
            const [h, s] = hsl;
            if (s < 15) return paintNames[Math.floor(Math.random() * paintNames.length)];
            
            const temp = (h >= 15 && h <= 165) ? "cool" : "warm";
            const names = colorNames[temp];
            return names[Math.floor(Math.random() * names.length)];
        }

        // Adjust color based on contrast mode
        function adjustContrast([h, s, l], contrast) {
            s = contrast === "low" ? s * 0.6 : 
                contrast === "medium" ? s * 0.8 : 
                Math.min(100, s * 1.2);
            return [h, Math.max(10, s), l];
        }

        // Adjust color based on light mode
        function adjustLightness([h, s, l], mode) {
            l = mode === "light" ? 70 + Math.random() * 20 :
                mode === "medium" ? 40 + Math.random() * 30 :
                mode === "dark" ? 20 + Math.random() * 20 :
                20 + Math.random() * 60;
            return [h, s, l];
        }

        // Adjust color temperature
        function adjustTemperature([h, s, l], temp) {
            if (temp === "warm" && h > 180) h = (h + 360) / 2;
            else if (temp === "cool" && h < 180) h = (h + 180) / 2;
            else if (temp === "neutral") s = Math.max(5, s * 0.3);
            return [h, s, l];
        }

        const baseHsl = hexToHsl(baseColor);
        let palette = [];
        
        // Generate colors based on palette type
        switch (paletteType) {
            case "analogous":
                for (let i = 0; i < numColors; i++) {
                    const hue = (baseHsl[0] + (i - Math.floor(numColors/2)) * 30) % 360;
                    let hsl = [hue, baseHsl[1], baseHsl[2]];
                    hsl = adjustTemperature(hsl, colorTemp);
                    hsl = adjustContrast(hsl, contrastMode);
                    hsl = adjustLightness(hsl, lightMode);
                    palette.push(hsl);
                }
                break;
                
            case "complementary":
                palette.push([...baseHsl]);
                for (let i = 1; i < numColors; i++) {
                    const hue = (baseHsl[0] + 180 + (i % 2 === 0 ? -1 : 1) * Math.floor(i/2) * 20) % 360;
                    let hsl = [hue, baseHsl[1], baseHsl[2]];
                    hsl = adjustTemperature(hsl, colorTemp);
                    hsl = adjustContrast(hsl, contrastMode);
                    hsl = adjustLightness(hsl, lightMode);
                    palette.push(hsl);
                }
                break;
                
            case "triadic":
                for (let i = 0; i < numColors; i++) {
                    const hue = (baseHsl[0] + i * 120) % 360;
                    let hsl = [hue, baseHsl[1], baseHsl[2]];
                    hsl = adjustTemperature(hsl, colorTemp);
                    hsl = adjustContrast(hsl, contrastMode);
                    hsl = adjustLightness(hsl, lightMode);
                    palette.push(hsl);
                }
                break;
                
            case "monochromatic":
                for (let i = 0; i < numColors; i++) {
                    let hsl = [...baseHsl];
                    hsl[1] = baseHsl[1] * (0.7 + 0.3 * (i / numColors));
                    hsl = adjustLightness(hsl, lightMode);
                    palette.push(hsl);
                }
                break;
                
            case "neutral":
                for (let i = 0; i < numColors; i++) {
                    const lightness = lightMode === "light" ? 70 + Math.random() * 20 :
                        lightMode === "dark" ? 20 + Math.random() * 20 :
                        lightMode === "medium" ? 40 + Math.random() * 30 :
                        20 + Math.random() * 60;
                    palette.push([baseHsl[0], 5 + Math.random() * 10, lightness]);
                }
                break;
                
            case "random":
                for (let i = 0; i < numColors; i++) {
                    let hue = Math.random() * 360;
                    let saturation = contrastMode === "low" ? 10 + Math.random() * 30 :
                        contrastMode === "medium" ? 30 + Math.random() * 40 :
                        60 + Math.random() * 40;
                    
                    if (colorTemp === "warm" && hue > 180) hue = (hue + 360) / 2;
                    else if (colorTemp === "cool" && hue < 180) hue = (hue + 180) / 2;
                    else if (colorTemp === "neutral") saturation = 5 + Math.random() * 15;
                    
                    palette.push(adjustLightness([hue, saturation, 50], lightMode));
                }
                break;
        }

        // Convert HSL array to color objects with hex and name
        return palette.map(hsl => {
            const hex = hslToHex(hsl[0], hsl[1], hsl[2]);
            return {
                hsl: `hsl(${Math.round(hsl[0])}, ${Math.round(hsl[1])}%, ${Math.round(hsl[2])}%)`,
                hex,
                rgb: `rgb(${hexToRgb(hex).join(', ')})`,
                name: generateColorName(hsl)
            };
        });
    }

    function displayPalette(palette) {
        paletteContainer.innerHTML = palette.map(color => `
            <div class="color-box" style="background-color: ${color.hsl}" 
                 data-hex="${color.hex}" data-rgb="${color.rgb}" title="${color.name}">
                <div class="color-swatch"></div>
                <div class="color-info">
                    <div>${currentColorFormat === 'hex' ? color.hex : color.rgb}</div>
                    <div class="color-name">${color.name}</div>
                </div>
            </div>
        `).join('');

        // Add click handlers to palette colors
        document.querySelectorAll('.color-box').forEach(box => {
            box.addEventListener('click', () => {
                const hexColor = box.getAttribute('data-hex');
                colorInput.value = hexColor;
                updateColorPreview();
            });
        });
    }

    function updateColorPreview() {
        // Update palette display if format changed
        if (paletteContainer.children.length > 0) {
            document.querySelectorAll('.color-box .color-info > div:first-child').forEach(el => {
                const box = el.closest('.color-box');
                el.textContent = currentColorFormat === 'hex' 
                    ? box.getAttribute('data-hex') 
                    : box.getAttribute('data-rgb');
            });
        }
    }

    // Download Function
    function downloadImage() {
        if (canvas.style.display !== "none" && canvas.width > 0 && canvas.height > 0) {
            const link = document.createElement("a");
            link.href = canvas.toDataURL("image/png");
            link.download = "painted-image.png";
            link.click();
        }
    }
});