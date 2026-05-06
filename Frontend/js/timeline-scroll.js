"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const timeline = document.querySelector('.timeline');
    const scrollObj = document.getElementById('scrollObj');
    const gyro = scrollObj ? scrollObj.querySelector('.gyro') : null;

    if (!timeline || !scrollObj || !gyro) return;

    const timelineItems = document.querySelectorAll('.timeline-item');

    window.addEventListener('scroll', () => {
        const rect = timeline.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        let progress = (windowHeight / 2 - rect.top) / rect.height;
        progress = Math.max(0, Math.min(1, progress));
        
        const currentY = progress * rect.height;
        
        let maxScale = 1;
        
        timelineItems.forEach(item => {
            const dotY = item.offsetTop + item.offsetHeight / 2;
            const dist = Math.abs(currentY - dotY);
            
            if (dist < 80) {
                const bump = 1 - (dist / 80);
                const scale = 1 + (Math.pow(bump, 1.5) * 0.8);
                if (scale > maxScale) maxScale = scale;
                item.classList.add('active-dot');
            } else {
                item.classList.remove('active-dot');
            }
        });
        
        let opacity = 1;
        if (progress > 0.95) {
            opacity = (1 - progress) / 0.05;
        } else if (progress < 0.05) {
            opacity = progress / 0.05;
        }
        scrollObj.style.top = `${progress * 100}%`;
        scrollObj.style.transform = `translateX(-50%) translateY(-50%) scale(${maxScale * opacity})`;
        scrollObj.style.opacity = opacity;
        const rotX = progress * 720;
        const rotY = progress * 1080;
        const rotZ = progress * 360;
        gyro.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg)`;
    });
});
