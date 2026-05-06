"use strict";

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1 
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (entry.target.classList.contains('timeline-item')) {
                    entry.target.classList.add('animate');
                } else {
                    entry.target.classList.add('is-revealed');
                }
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const isAboutPage = document.body.classList.contains('about-page');
    const animSelectors = [
        '.hero-title',
        '.hero-desc',
        '.feature-pill',
        '.upload-card',
        '.score-hero-card',
        '.summary-card',
        '.metric-card',
        '.chart-card',
        '.insight-card',
        '.plan-card',
        '.timeline-item'
    ];

    animSelectors.forEach(selector => {
        if (isAboutPage && ['.hero-title', '.hero-desc'].includes(selector)) {
            return;
        }
        const elements = document.querySelectorAll(selector);
        elements.forEach((el, index) => {
            el.classList.add('reveal-on-scroll');
            if (['.feature-pill', '.metric-card', '.sub-score-card', '.timeline-item'].includes(selector)) {
                 el.style.transitionDelay = `${(index % 4) * 0.1}s`;
            } else if (selector === '.hero-desc') {
                 el.style.transitionDelay = "0.15s";
            }
            observer.observe(el);
        });
    });
    const heroDesc = document.querySelector(".hero-desc");
    if (heroDesc) {
        const text = heroDesc.textContent.trim();
        const words = text.split(/\s+/);
        heroDesc.innerHTML = '';
        words.forEach(word => {
            const span = document.createElement('span');
            span.classList.add('magnetic-word');
            span.textContent = word;
            heroDesc.appendChild(span);
            heroDesc.appendChild(document.createTextNode(' '));
        });
    }
});
