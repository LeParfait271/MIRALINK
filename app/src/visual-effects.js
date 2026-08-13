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

const revealTargets = [...document.querySelectorAll('[data-reveal]')];
const progressBar = document.querySelector('#page-progress-bar');
const pageHeader = document.querySelector('#site-header');
const navLinks = [...document.querySelectorAll('[data-nav-link]')];

revealTargets.forEach((target) => {
  const delay = Number(target.dataset.revealDelay || 0);
  if (delay) target.style.transitionDelay = `${delay}ms`;
});

if (revealTargets.length) {
  document.documentElement.classList.add('reveal-ready');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: .16, rootMargin: '0px 0px -8% 0px' });
    revealTargets.forEach((target) => revealObserver.observe(target));
  } else {
    revealTargets.forEach((target) => target.classList.add('is-visible'));
  }
}

const updateLandingChrome = () => {
  const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
  const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
  progressBar?.style.setProperty('transform', `scaleY(${progress})`);
  pageHeader?.classList.toggle('is-scrolled', window.scrollY > 38);

  const sections = navLinks.map((link) => document.querySelector(link.getAttribute('href'))).filter((section) => section && !section.hidden && section.getClientRects().length);
  let active = sections[0];
  sections.forEach((section) => {
    if (section.getBoundingClientRect().top <= window.innerHeight * .42) active = section;
  });
  navLinks.forEach((link) => link.classList.toggle('is-active', link.getAttribute('href') === `#${active?.id}`));
};

let landingScrollFrame = 0;
const handleLandingScroll = () => {
  if (landingScrollFrame) return;
  landingScrollFrame = window.requestAnimationFrame(() => {
    landingScrollFrame = 0;
    updateLandingChrome();
  });
};

window.addEventListener('scroll', handleLandingScroll, { passive: true });
window.addEventListener('resize', updateLandingChrome);
updateLandingChrome();

document.querySelectorAll('[data-open-tab]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const tabName = link.dataset.openTab;
    const tabButton = [...document.querySelectorAll('.tab-button')].find((button) => button.dataset.tab === tabName);
    if (!tabButton) return;
    event.preventDefault();
    tabButton.click();
    document.querySelector('#system-view')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });
});
