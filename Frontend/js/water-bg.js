"use strict";

document.addEventListener("DOMContentLoaded", () => {
    try {
        $('#water-bg').ripples({
            resolution: 512,        
            dropRadius: 20,        
            perturbance: 0.04,      
            interactive: true      
        });

        setInterval(() => {
            const $el = $('#water-bg');
            if ($el.length === 0) return;

            const x = Math.random() * $el.outerWidth();
            const y = Math.random() * $el.outerHeight();
            const dropRadius = 15 + Math.random() * 10;
            const strength = 0.03 + Math.random() * 0.02;
            
            $el.ripples('drop', x, y, dropRadius, strength);
        }, 1200);

    } catch (e) {
        console.warn("Ripples.js WebGL not loaded or supported in this environment.", e);
    }
});
