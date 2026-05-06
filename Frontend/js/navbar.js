"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const navbar = document.querySelector(".glass-navbar");
  if (!navbar) return;
  let lastScrollY = window.scrollY;
  const handleScroll = () => {
    const currentScrollY = window.scrollY;
    if (currentScrollY > lastScrollY && currentScrollY > 60) {
      navbar.classList.add("nav-hidden");
    } else {
      navbar.classList.remove("nav-hidden");
    }   
    lastScrollY = currentScrollY;
  };
  window.addEventListener("scroll", handleScroll, { passive: true });
});