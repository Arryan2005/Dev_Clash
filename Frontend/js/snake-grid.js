"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.createElement("canvas");
    canvas.id = "hero-snake-grid";
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "0"; 
    
    const heroSection = document.querySelector(".hero-section");
    const existingOverlay = document.querySelector(".hero-grid-overlay");
    if (!heroSection || !existingOverlay) return;
    
    existingOverlay.insertAdjacentElement("afterend", canvas);

    const ctx = canvas.getContext("2d");
    
    let width, height, cols, rows;
    const gridSize = 24;

    function resize() {
        width = canvas.width = heroSection.clientWidth;
        height = canvas.height = heroSection.clientHeight;
        cols = Math.ceil(width / gridSize);
        rows = Math.ceil(height / gridSize);
    }
    window.addEventListener("resize", resize);
    resize();
    const snakes = [
        createSnake("left"),
        createSnake("right")
    ];

    function createSnake(side) {
        let minCol = 0, maxCol = cols - 1;
        if (side === "left") {
            maxCol = Math.max(1, Math.floor(cols * 0.25));
        } else if (side === "right") {
            minCol = Math.floor(cols * 0.75);
        }

        const c = minCol + Math.floor(Math.random() * Math.max(1, maxCol - minCol));
        const r = Math.floor(Math.random() * rows);
        const startDir = pickRandomDir();
        return {
            path: [{c, r}], 
            side: side,
            dirX: startDir.x,
            dirY: startDir.y,
            maxLength: 3 + Math.floor(Math.random() * 4), 
            colorBase: `0, 212, 170`, 
            speed: 8 + Math.floor(Math.random() * 6), 
            frame: 0
        };
    }

    function pickRandomDir(excludeX = 0, excludeY = 0) {
        const dirs = [ {x:1, y:0}, {x:-1, y:0}, {x:0, y:1}, {x:0, y:-1} ];
        const valid = dirs.filter(d => !(d.x === excludeX && d.y === excludeY) && (d.x !== 0 || d.y !== 0));
        return valid[Math.floor(Math.random() * valid.length)];
    }

    function updateSnake(s) {
        s.frame++;
        if (s.frame >= s.speed) {
            s.frame = 0;
            
            const head = s.path[0];
            let nx = head.c + s.dirX;
            let ny = head.r + s.dirY;

            if (Math.random() < 0.15) {
                const newDir = pickRandomDir(-s.dirX, -s.dirY);
                s.dirX = newDir.x;
                s.dirY = newDir.y;
                nx = head.c + s.dirX;
                ny = head.r + s.dirY;
            }
            let minC = 0, maxC = cols - 1;
            if (s.side === "left") {
                maxC = Math.max(1, Math.floor(cols * 0.25));
            } else if (s.side === "right") {
                minC = Math.floor(cols * 0.75);
            }

            if (nx < minC) { nx = maxC; }
            if (nx > maxC) { nx = minC; }
            if (ny < 0) { ny = rows - 1; }
            if (ny >= rows) { ny = 0; }

            s.path.unshift({c: nx, r: ny});
            if (s.path.length > s.maxLength) {
                s.path.pop();
            }
        }
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);

        snakes.forEach(s => {
            updateSnake(s);

            for (let i = 0; i < s.path.length; i++) {
                const cell = s.path[i];
                const opacity = 1 - (i / s.path.length);
                
                ctx.fillStyle = `rgba(${s.colorBase}, ${opacity * 0.8})`;
                const padding = 1; 
                ctx.fillRect(
                    cell.c * gridSize + padding, 
                    cell.r * gridSize + padding, 
                    gridSize - padding * 2, 
                    gridSize - padding * 2
                );

                if (i === 0) {
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = `rgba(${s.colorBase}, 1)`;
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(
                        cell.c * gridSize + padding + 3, 
                        cell.r * gridSize + padding + 3, 
                        gridSize - (padding*2) - 6, 
                        gridSize - (padding*2) - 6
                    );
                    ctx.shadowBlur = 0;
                }
            }
        });
    }

    function loop() {
        draw();
        requestAnimationFrame(loop);
    }
    loop();
});
