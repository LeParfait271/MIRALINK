const shell = document.querySelector('.terminal-direction');
const sequence = document.querySelector('.narrative-sequence');
const sequenceFrames = [...document.querySelectorAll('.sequence-frame')];
const sequenceLabel = document.querySelector('#sequence-progress-label');
const sequenceLine = document.querySelector('.sequence-progress-line i');
const sequenceNames = ['01 / RELIER', '02 / CONFIGURER', '03 / OBSERVER'];

if (shell) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let pointerFrame = 0;
  let scrollFrame = 0;

  const updateSequence = () => {
    if (!sequence || sequenceFrames.length === 0) return;
    const travel = Math.max(1, sequence.offsetHeight - window.innerHeight);
    const amount = Math.min(1, Math.max(0, -sequence.getBoundingClientRect().top / travel));
    const activeIndex = Math.min(sequenceFrames.length - 1, Math.floor(amount * sequenceFrames.length));
    sequenceFrames.forEach((frame, index) => frame.classList.toggle('is-active', index === activeIndex));
    if (sequenceLabel) sequenceLabel.textContent = sequenceNames[activeIndex] || sequenceNames[0];
    if (sequenceLine) sequenceLine.style.width = `${Math.round(amount * 100)}%`;
    shell.style.setProperty('--sequence-progress', amount.toFixed(3));
  };

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
      updateSequence();
    });
  };

  document.querySelectorAll('[data-sequence-tab]').forEach((action) => {
    action.addEventListener('click', () => {
      const tab = action.dataset.sequenceTab;
      const target = action.dataset.routeTarget;
      document.querySelector(`.site-nav-item[data-tab="${tab}"]`)?.click();
      if (target) requestAnimationFrame(() => document.querySelector(target)?.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' }));
    });
  });

  window.addEventListener('pointermove', setPointer, { passive: true });
  window.addEventListener('scroll', setScrollState, { passive: true });
  window.addEventListener('resize', setScrollState, { passive: true });
  setScrollState();
}
