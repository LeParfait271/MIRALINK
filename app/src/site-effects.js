const shell = document.querySelector('.terminal-direction');
const sequence = document.querySelector('.narrative-sequence');
const sequenceFrames = [...document.querySelectorAll('.sequence-frame')];
const sequenceLabel = document.querySelector('#sequence-progress-label');
const sequenceLine = document.querySelector('.sequence-progress-line i');
const sequenceNames = ['01 / RELIER', '02 / CONFIGURER', '03 / OBSERVER'];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const siteChrome = document.querySelector('.site-chrome');
const siteNavigation = document.querySelector('.site-nav');
const navigationItems = siteNavigation
  ? [...siteNavigation.querySelectorAll('.site-nav-item[data-route-target]')]
  : [];

function targetIdFromSelector(selector) {
  if (typeof selector !== 'string' || !selector.startsWith('#') || selector.length < 2) return null;
  try {
    return decodeURIComponent(selector.slice(1));
  } catch {
    return null;
  }
}

function targetFromSelector(selector) {
  const id = targetIdFromSelector(selector);
  return id ? document.getElementById(id) : null;
}

const navigationRoutes = navigationItems
  .map((item) => ({ item, selector: item.dataset.routeTarget, target: targetFromSelector(item.dataset.routeTarget) }))
  .filter(({ target }) => Boolean(target));

let navigationLock = null;
let navigationLockTimer = 0;
let pointerFrame = 0;
let scrollFrame = 0;

function stickyOffset() {
  return Math.max(0, Math.ceil(siteChrome?.getBoundingClientRect().height || 0) + 12);
}

function setActiveNavigation(target) {
  navigationRoutes.forEach((route) => {
    const active = route.target === target;
    route.item.classList.toggle('is-active', active);
    if (active) route.item.setAttribute('aria-current', 'location');
    else route.item.removeAttribute('aria-current');
  });
}

function releaseNavigationLock(delay) {
  if (navigationLockTimer) window.clearTimeout(navigationLockTimer);
  navigationLockTimer = window.setTimeout(() => {
    navigationLock = null;
    updateActiveNavigation();
  }, delay);
}

export function scrollToRouteTarget(selector, {
  updateHash = false,
  focus = false,
  behavior = reducedMotion.matches ? 'auto' : 'smooth'
} = {}) {
  const target = targetFromSelector(selector);
  if (!target) return false;

  const route = navigationRoutes.find((candidate) => candidate.target === target);
  if (route) {
    navigationLock = target;
    setActiveNavigation(target);
  }

  const top = target.getBoundingClientRect().top + window.scrollY - stickyOffset();
  window.scrollTo({ top: Math.max(0, Math.round(top)), behavior });

  if (updateHash) {
    const hash = `#${encodeURIComponent(target.id)}`;
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    else window.history.replaceState(null, '', hash);
  }

  if (focus) {
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  if (route) releaseNavigationLock(behavior === 'smooth' ? 900 : 80);
  return true;
}

function updateActiveNavigation() {
  if (!navigationRoutes.length) return;
  if (navigationLock) {
    setActiveNavigation(navigationLock);
    return;
  }

  let activeRoute = navigationRoutes[0];
  const activationLine = stickyOffset() + Math.min(160, window.innerHeight * 0.2);
  const atDocumentEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;

  if (atDocumentEnd) activeRoute = navigationRoutes[navigationRoutes.length - 1];
  else {
    for (const route of navigationRoutes) {
      if (route.target.getBoundingClientRect().top > activationLine) break;
      activeRoute = route;
    }
  }

  setActiveNavigation(activeRoute.target);
}

function updateSequence() {
  if (!sequence || sequenceFrames.length === 0 || !shell) return;
  const travel = Math.max(1, sequence.offsetHeight - window.innerHeight);
  const amount = Math.min(1, Math.max(0, -sequence.getBoundingClientRect().top / travel));
  const activeIndex = Math.min(sequenceFrames.length - 1, Math.floor(amount * sequenceFrames.length));
  sequenceFrames.forEach((frame, index) => frame.classList.toggle('is-active', index === activeIndex));
  if (sequenceLabel) sequenceLabel.textContent = sequenceNames[activeIndex] || sequenceNames[0];
  if (sequenceLine) sequenceLine.style.width = `${Math.round(amount * 100)}%`;
  shell.style.setProperty('--sequence-progress', amount.toFixed(3));
}

function setPointer(event) {
  if (!shell || reducedMotion.matches) return;
  if (pointerFrame) cancelAnimationFrame(pointerFrame);
  pointerFrame = requestAnimationFrame(() => {
    const x = (event.clientX / window.innerWidth - 0.5) * 18;
    const y = (event.clientY / window.innerHeight - 0.5) * 12;
    shell.style.setProperty('--pointer-shift-x', `${x.toFixed(2)}px`);
    shell.style.setProperty('--pointer-shift-y', `${y.toFixed(2)}px`);
    shell.style.setProperty('--pointer-x', `${event.clientX}px`);
    shell.style.setProperty('--pointer-y', `${event.clientY}px`);
  });
}

function setScrollState() {
  if (scrollFrame) cancelAnimationFrame(scrollFrame);
  scrollFrame = requestAnimationFrame(() => {
    if (shell) {
      const progress = Math.min(1, window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight));
      shell.style.setProperty('--scroll-progress', progress.toFixed(3));
      shell.classList.toggle('has-scrolled', window.scrollY > 32);
      updateSequence();
    }
    updateActiveNavigation();
  });
}

navigationItems.forEach((action) => {
  action.addEventListener('click', (event) => {
    event.preventDefault();
    scrollToRouteTarget(action.dataset.routeTarget, { updateHash: true, focus: event.detail === 0 });
  });
});

siteNavigation?.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const currentIndex = navigationItems.indexOf(document.activeElement);
  if (currentIndex < 0) return;

  let nextIndex = null;
  if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % navigationItems.length;
  else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + navigationItems.length) % navigationItems.length;
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = navigationItems.length - 1;
  if (nextIndex === null) return;

  event.preventDefault();
  navigationItems[nextIndex].focus();
});

document.querySelectorAll('[data-sequence-tab][data-route-target]').forEach((action) => {
  action.addEventListener('click', () => {
    scrollToRouteTarget(action.dataset.routeTarget, { updateHash: true });
  });
});

function restoreNavigationFromLocation() {
  navigationLock = null;
  if (navigationLockTimer) {
    window.clearTimeout(navigationLockTimer);
    navigationLockTimer = 0;
  }
  scrollToRouteTarget(window.location.hash || '#top', { behavior: 'auto' });
  updateActiveNavigation();
}

window.addEventListener('popstate', restoreNavigationFromLocation);
window.addEventListener('hashchange', restoreNavigationFromLocation);
window.addEventListener('pointermove', setPointer, { passive: true });
window.addEventListener('scroll', setScrollState, { passive: true });
window.addEventListener('resize', setScrollState, { passive: true });

if (window.location.hash) {
  requestAnimationFrame(() => scrollToRouteTarget(window.location.hash, { behavior: 'auto' }));
}
setScrollState();
