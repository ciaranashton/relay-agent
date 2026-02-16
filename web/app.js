(() => {
  const slides = document.querySelectorAll(".slide");
  const container = document.querySelector(".slides");
  const progressFill = document.querySelector(".progress-fill");
  const dotsContainer = document.querySelector(".slide-nav__dots");
  const prevBtn = document.querySelector(".slide-nav__btn--prev");
  const nextBtn = document.querySelector(".slide-nav__btn--next");

  let current = 0;
  const total = slides.length;

  // Build dots
  for (let i = 0; i < total; i++) {
    const dot = document.createElement("div");
    dot.classList.add("slide-nav__dot");
    dot.addEventListener("click", () => goTo(i));
    dotsContainer.appendChild(dot);
  }
  const dots = dotsContainer.querySelectorAll(".slide-nav__dot");

  function goTo(index) {
    if (index < 0 || index >= total) return;
    current = index;
    container.style.transform = `translateX(-${current * 100}vw)`;
    progressFill.style.width = `${((current + 1) / total) * 100}%`;

    slides.forEach((s, i) => s.classList.toggle("active", i === current));
    dots.forEach((d, i) => d.classList.toggle("active", i === current));
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  // Keyboard
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    if (e.key === "Home") { e.preventDefault(); goTo(0); }
    if (e.key === "End") { e.preventDefault(); goTo(total - 1); }
  });

  // Buttons
  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);

  // Click on slide advances (but not on interactive elements)
  document.addEventListener("click", (e) => {
    if (e.target.closest(".slide-nav")) return;
    if (e.target.closest("a, button, code, .code-block, .terminal, .annotation")) return;

    const rect = document.body.getBoundingClientRect();
    const x = e.clientX / rect.width;
    if (x > 0.35) next();
    else prev();
  });

  // Touch swipe
  let touchStartX = 0;
  document.addEventListener("touchstart", (e) => { touchStartX = e.touches[0].clientX; });
  document.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      if (dx < 0) next();
      else prev();
    }
  });

  // Config annotation hover highlights
  const annotations = document.querySelectorAll(".annotation[data-hl]");
  const codeKeys = document.querySelectorAll(".code-block .key[data-hl]");

  annotations.forEach((ann) => {
    const hl = ann.dataset.hl;
    ann.addEventListener("mouseenter", () => {
      codeKeys.forEach((k) => {
        if (k.dataset.hl === hl) {
          k.style.background = "rgba(108,99,255,0.25)";
          k.style.borderRadius = "3px";
          k.style.padding = "0 3px";
        }
      });
    });
    ann.addEventListener("mouseleave", () => {
      codeKeys.forEach((k) => {
        k.style.background = "";
        k.style.borderRadius = "";
        k.style.padding = "";
      });
    });
  });

  // Init
  goTo(0);
})();
