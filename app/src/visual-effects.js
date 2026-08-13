const hero = document.querySelector('.hero-panel');
const scenes = [...document.querySelectorAll('.hero-scene')];
const sceneNumber = document.querySelector('#hero-scene-number');
const magneticTargets = [...document.querySelectorAll('[data-magnetic]')];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (hero) {
  const resetPointer = () => {
    hero.style.setProperty('--hero-pointer-x', '50%');
    hero.style.setProperty('--hero-pointer-y', '42%');
    hero.style.setProperty('--hero-copy-x', '0px');
    hero.style.setProperty('--hero-copy-y', '0px');
    hero.style.setProperty('--hero-image-x', '0px');
    hero.style.setProperty('--hero-image-y', '0px');
  };

  const handlePointerMove = (event) => {
    if (reduceMotion) return;
    const x = event.clientX / window.innerWidth;
    const y = event.clientY / window.innerHeight;
    hero.style.setProperty('--hero-pointer-x', `${x * 100}%`);
    hero.style.setProperty('--hero-pointer-y', `${y * 100}%`);
    hero.style.setProperty('--hero-copy-x', `${(x - .5) * -7}px`);
    hero.style.setProperty('--hero-copy-y', `${(y - .5) * -4}px`);
    hero.style.setProperty('--hero-image-x', `${(x - .5) * 18}px`);
    hero.style.setProperty('--hero-image-y', `${(y - .5) * 12}px`);
  };

  let scrollFrame = 0;
  const updateScroll = () => {
    scrollFrame = 0;
    if (reduceMotion) return;
    const bounds = hero.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, -bounds.top / Math.max(bounds.height * .78, 1)));
    hero.style.setProperty('--hero-scroll-copy-y', `${progress * -56}px`);
    hero.style.setProperty('--hero-copy-opacity', `${1 - progress * .94}`);
    hero.style.setProperty('--hero-scroll-image-y', `${progress * -24}px`);
  };

  const handleScroll = () => {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScroll);
  };

  resetPointer();
  hero.addEventListener('pointermove', handlePointerMove);
  hero.addEventListener('pointerleave', resetPointer);
  window.addEventListener('scroll', handleScroll, { passive: true });
  updateScroll();

  magneticTargets.forEach((target) => {
    const resetMagnetic = () => {
      target.style.setProperty('--magnetic-x', '0px');
      target.style.setProperty('--magnetic-y', '0px');
    };

    target.addEventListener('pointermove', (event) => {
      if (reduceMotion) return;
      const bounds = target.getBoundingClientRect();
      const x = (event.clientX - (bounds.left + bounds.width / 2)) / bounds.width;
      const y = (event.clientY - (bounds.top + bounds.height / 2)) / bounds.height;
      target.style.setProperty('--magnetic-x', `${x * 10}px`);
      target.style.setProperty('--magnetic-y', `${y * 8}px`);
    });
    target.addEventListener('pointerleave', resetMagnetic);
  });

  if (!reduceMotion && scenes.length > 1) {
    let activeScene = 0;
    window.setInterval(() => {
      scenes[activeScene].classList.remove('is-active');
      activeScene = (activeScene + 1) % scenes.length;
      scenes[activeScene].classList.add('is-active');
      if (sceneNumber) sceneNumber.textContent = String(activeScene + 1).padStart(2, '0');
    }, 6800);
  }
}
