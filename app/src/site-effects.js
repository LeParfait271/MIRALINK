const shell = document.querySelector('.terminal-direction');

if (shell) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let pointerFrame = 0;
  let scrollFrame = 0;

  const setPointer = (event) => {
    if (reducedMotion.matches) return;
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    pointerFrame = requestAnimationFrame(() => {
      const x = (event.clientX / window.innerWidth - 0.5) * 18;
      const y = (event.clientY / window.innerHeight - 0.5) * 12;
      shell.style.setProperty('--pointer-shift-x', `${x.toFixed(2)}px`);
      shell.style.setProperty('--pointer-shift-y', `${y.toFixed(2)}px`);
      shell.style.setProperty('--pointer-x', `${event.clientX}px`);
      shell.style.setProperty('--pointer-y', `${event.clientY}px`);
    });
  };

  const setScrollState = () => {
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      const progress = Math.min(1, window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight));
      shell.style.setProperty('--scroll-progress', progress.toFixed(3));
      shell.classList.toggle('has-scrolled', window.scrollY > 32);
    });
  };

  window.addEventListener('pointermove', setPointer, { passive: true });
  window.addEventListener('scroll', setScrollState, { passive: true });
  setScrollState();
}
