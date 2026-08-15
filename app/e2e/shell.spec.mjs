import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function installWebHidStub(page) {
  await page.addInitScript(() => {
    const listeners = new Map();
    const hid = {
      getDevices: async () => [],
      requestDevice: async (options) => {
        globalThis.__miralinkHidRequestOptions = options;
        return [];
      },
      addEventListener(type, callback) {
        const callbacks = listeners.get(type) || [];
        callbacks.push(callback);
        listeners.set(type, callbacks);
      },
      removeEventListener(type, callback) {
        listeners.set(type, (listeners.get(type) || []).filter((item) => item !== callback));
      }
    };
    Object.defineProperty(navigator, 'hid', { configurable: true, value: hid });
  });
}

async function installMiraLinkBridgeStub(page) {
  await page.addInitScript(() => {
    const crc32 = (input) => {
      let crc = 0xffffffff;
      for (const byte of input) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
      return (crc ^ 0xffffffff) >>> 0;
    };
    const responsePayload = (command) => {
      if (command === 0x01) return Uint8Array.from([1, 1, 1, 0]);
      if (command === 0x02) return Uint8Array.from([...new TextEncoder().encode('MiraLink'), 0, 55, 0]);
      if (command === 0x03) return Uint8Array.from([1, 100, 0, 100, 100, 0, 0, 1, 96, 2, 4, 0, 0, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      if (command === 0x05) return Uint8Array.from([1, 1]);
      if (command === 0x0d) return Uint8Array.from([1, 0, 0, 1, 0, 0, 0xb8, 0x0b]);
      if (command === 0x0b) {
        const payload = new Uint8Array(48);
        payload.set([2, 0x0f, 0x31, 160, 96, 200, 64, 128, 255, 0x22, 0x21, 0x05], 0);
        payload.set([75, 2, 0x1f, 9], 16);
        const view = new DataView(payload.buffer);
        view.setInt16(20, -100, true); view.setInt16(22, 200, true); view.setInt16(24, 300, true);
        view.setInt16(26, 400, true); view.setInt16(28, -500, true); view.setInt16(30, 600, true);
        view.setUint32(32, 1234, true); view.setUint16(36, 100, true); view.setUint16(38, 200, true);
        return payload;
      }
      if (command === 0x08) {
        const payload = new Uint8Array(48);
        payload.set([4, 1, 1, 1, 1, 1, 0, 0, 0, 0]);
        return payload;
      }
      if (command === 0x12) return Uint8Array.from([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      return new Uint8Array();
    };
    const makeResponse = (request) => {
      const payload = responsePayload(request[6]);
      const frame = new Uint8Array(64);
      frame.set([0x4d, 0x4c, 1, 1]);
      frame[4] = request[4];
      frame[5] = request[5];
      frame[6] = request[6];
      frame[7] = payload.length & 0xff;
      frame[8] = payload.length >>> 8;
      frame.set(payload, 9);
      new DataView(frame.buffer).setUint32(9 + payload.length, crc32(frame.subarray(0, 9 + payload.length)), true);
      return frame;
    };

    let pendingResponse = null;
    let pendingCommand = null;
    let reconnectDisconnectScheduled = false;
    const listeners = new Map();
    globalThis.__miralinkCommandLog = [];
    globalThis.__miralinkReceiveFailures = 0;
    globalThis.__miralinkReconnectReceiveFailures = 0;
    globalThis.__miralinkSuppressReconnectDisconnect = false;
    globalThis.__miralinkTransportMetrics = {
      activeCalls: 0,
      maxConcurrentCalls: 0,
      overlappingWrites: 0,
      replacedPendingResponses: 0,
      sendCount: 0,
      receiveCount: 0,
      openCount: 0,
      closeCount: 0
    };
    const beginIo = (operation) => {
      const metrics = globalThis.__miralinkTransportMetrics;
      metrics.activeCalls += 1;
      metrics.maxConcurrentCalls = Math.max(metrics.maxConcurrentCalls, metrics.activeCalls);
      if (operation === 'send' && metrics.activeCalls > 1) metrics.overlappingWrites += 1;
    };
    const endIo = () => { globalThis.__miralinkTransportMetrics.activeCalls -= 1; };
    const device = {
      vendorId: 0x054c,
      productId: 0x0ce6,
      productName: 'MiraLink Pico 2 W',
      opened: false,
      collections: [{
        usagePage: 0x01,
        usage: 0x05,
        children: [{
          usagePage: 0xff00,
          usage: 0x01,
          featureReports: [{ reportId: 0x70 }, { reportId: 0x71 }]
        }]
      }],
      async open() { this.opened = true; globalThis.__miralinkTransportMetrics.openCount += 1; },
      async close() { this.opened = false; globalThis.__miralinkTransportMetrics.closeCount += 1; },
      addEventListener() {},
      removeEventListener() {},
      async sendFeatureReport(reportId, data) {
        beginIo('send');
        try {
          await new Promise((resolve) => setTimeout(resolve, 4));
          if (reportId !== 0x70) throw new Error('Unexpected command report');
          if (pendingResponse) {
            // Firmware keeps 0x71 stable for receive retries and replaces it
            // only when a later SET starts a distinct transaction.
            globalThis.__miralinkTransportMetrics.replacedPendingResponses += 1;
          }
          const request = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
          pendingCommand = request[6];
          const payloadLength = request[7] | (request[8] << 8);
          globalThis.__miralinkCommandLog.push({ command: pendingCommand, payload: [...request.subarray(9, 9 + payloadLength)] });
          globalThis.__miralinkTransportMetrics.sendCount += 1;
          pendingResponse = makeResponse(request);
        } finally {
          endIo();
        }
      },
      async receiveFeatureReport(reportId) {
        beginIo('receive');
        try {
          await new Promise((resolve) => setTimeout(resolve, 4));
          globalThis.__miralinkTransportMetrics.receiveCount += 1;
          if (reportId !== 0x71 || !pendingResponse) throw new Error('No pending MiraLink response');
          const command = pendingCommand;
          if (command === 0x07 && !reconnectDisconnectScheduled && !globalThis.__miralinkSuppressReconnectDisconnect) {
            reconnectDisconnectScheduled = true;
            setTimeout(() => {
              device.opened = false;
              for (const callback of listeners.get('disconnect') || []) callback({ device });
            }, 120);
          }
          if (command === 0x07 && globalThis.__miralinkReconnectReceiveFailures > 0) {
            globalThis.__miralinkReconnectReceiveFailures -= 1;
            throw Object.assign(new Error('Injected RECONNECT_USB ACK read failure'), { name: 'NetworkError' });
          }
          if (globalThis.__miralinkReceiveFailures > 0) {
            globalThis.__miralinkReceiveFailures -= 1;
            throw Object.assign(new Error('Injected transient feature-report read failure'), { name: 'NetworkError' });
          }
          const response = pendingResponse;
          pendingResponse = null;
          pendingCommand = null;
          return new DataView(response.buffer);
        } finally {
          endIo();
        }
      }
    };
    const hid = {
      getDevices: async () => [device],
      requestDevice: async (options) => {
        globalThis.__miralinkHidRequestOptions = options;
        return [device];
      },
      addEventListener(type, callback) {
        const callbacks = listeners.get(type) || [];
        callbacks.push(callback);
        listeners.set(type, callbacks);
      },
      removeEventListener(type, callback) {
        listeners.set(type, (listeners.get(type) || []).filter((item) => item !== callback));
      }
    };
    Object.defineProperty(navigator, 'hid', { configurable: true, value: hid });
  });
}

test.beforeEach(async ({ page }) => {
  await installWebHidStub(page);
});

async function revealSection(page, selector) {
  const section = page.locator(selector);
  await section.scrollIntoViewIfNeeded();
  await expect(section).toBeVisible();
  return section;
}

test('loads an operational shell and keeps WebHID warnings contextual', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');

  await expect(page).toHaveTitle(/MiraLink/);
  await expect(page.locator('#connect-button')).toBeVisible();
  await expect(page.locator('#connect-button')).toBeEnabled();
  await expect(page.locator('#refresh-devices-button')).toBeEnabled();
  await expect(page.locator('#hid-warning')).toBeHidden();

  await revealSection(page, '#tab-diagnostics');
  await expect(page.locator('#run-diagnostics-button')).toBeVisible();
  await expect(page.locator('[data-diagnostic="signal"]')).toHaveText('—');
  expect(errors).toEqual([]);
});

test('blocks connection actions when WebHID is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    // Override the shared WebHID stub explicitly; deleting a browser-provided
    // accessor is not reliable across Chromium versions.
    Object.defineProperty(navigator, 'hid', { configurable: true, value: undefined });
  });
  await page.goto('/');

  await expect(page.locator('#hid-warning')).toBeVisible();
  await expect(page.locator('#connect-button')).toBeDisabled();
  await expect(page.locator('#refresh-devices-button')).toBeDisabled();
});

test('never forces horizontal page overflow', async ({ page }) => {
  await page.goto('/');
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  await expect(page.locator('#connect-button')).toBeVisible();
});

test('keeps connection and live state above the fold', async ({ page }) => {
  await page.goto('/');
  const fold = await page.evaluate(() => {
    const bounds = (selector) => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    };
    return {
      height: window.innerHeight,
      connection: bounds('#workspace'),
      connectButton: bounds('#connect-button'),
      console: bounds('#diagnostic-console')
    };
  });
  expect(fold.connection.top).toBeLessThan(fold.height);
  expect(fold.connectButton.bottom).toBeLessThanOrEqual(fold.height);
  expect(fold.console.top).toBeLessThan(fold.height);
});

test('uses the section index as an accessible continuous-page navigator', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const routes = [
    ['overview', 'tab-overview'],
    ['bridge', 'tab-bridge'],
    ['controllers', 'tab-controllers'],
    ['diagnostics', 'tab-diagnostics'],
    ['firmware', 'tab-firmware'],
    ['backups', 'tab-backups'],
    ['logs', 'tab-logs']
  ];

  await expect(page.locator('.site-nav')).toBeVisible();
  await expect(page.locator('[role="tablist"], [role="tab"]')).toHaveCount(0);

  for (const [name, id] of routes) {
    const link = page.locator(`#nav-link-${name}`);
    const section = page.locator(`#${id}`);
    await expect(section).toBeVisible();
    await expect(section.locator('h2').first()).toBeVisible();
    const before = await page.evaluate(() => window.scrollY);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(link).toHaveAttribute('aria-current', 'location');
    await expect(section).toBeInViewport();
    const position = await page.evaluate((sectionId) => {
      const target = document.getElementById(sectionId).getBoundingClientRect();
      const chrome = document.querySelector('.site-chrome').getBoundingClientRect();
      return { top: target.top, chromeBottom: chrome.bottom, height: window.innerHeight, scrollY: window.scrollY };
    }, id);
    expect(position.scrollY).not.toBe(before);
    expect(position.top).toBeGreaterThanOrEqual(position.chromeBottom + 8);
    expect(position.top).toBeLessThan(position.height);
  }

  await page.locator('#tab-controllers').evaluate((section) => section.scrollIntoView({ block: 'start' }));
  await expect(page.locator('#nav-link-controllers')).toHaveAttribute('aria-current', 'location');

  await page.locator('#nav-link-overview').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#nav-link-bridge')).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.locator('#nav-link-logs')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.locator('#nav-link-overview')).toBeFocused();

  await page.locator('#nav-link-diagnostics').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#tab-diagnostics$/);
  await expect(page.locator('#nav-link-diagnostics')).toHaveAttribute('aria-current', 'location');
  await expect(page.locator('#tab-diagnostics')).toBeFocused();
});

test('WebHID chooser filters never authorize an arbitrary vendor collection', async ({ page }) => {
  await page.goto('/');
  await page.locator('#connect-button').click();
  const filters = await page.evaluate(() => globalThis.__miralinkHidRequestOptions?.filters || []);
  expect(filters.length).toBeGreaterThan(0);
  expect(filters.every((filter) => filter.vendorId === 0x054c)).toBe(true);
  expect(filters.some((filter) => filter.usagePage === 0xff00 && filter.vendorId === undefined)).toBe(false);
  expect(filters.some((filter) => filter.productId === 0x0ce6)).toBe(true);
  expect(filters.some((filter) => filter.productId === 0x0df2)).toBe(true);
});

test('identifies the Pico bridge and exposes actionable diagnostics', async ({ page }) => {
  await installMiraLinkBridgeStub(page);
  await page.goto('/');
  await page.locator('#connect-button').click();

  await expect(page.locator('.device-meta').first()).toContainText('MiraLink bridge');
  await expect(page.locator('#installed-version')).toHaveText('0.55');
  await expect(page.locator('#hid-warning')).toBeHidden();

  const confirmation = page.locator('#confirm-dialog');
  await expect(confirmation).toBeVisible();
  await confirmation.locator('[value="cancel"]').click();

  await expect(page.locator('#overview-controller-state')).toHaveText('PRÊTE');
  await expect(page.locator('#overview-controller-note')).toContainText('entrées actives');

  await revealSection(page, '#tab-controllers');
  await expect(page.locator('#controller-lab-link-state')).toContainText('Manette connectée');
  await expect(page.locator('#controller-lab-sample-count')).not.toHaveText('0');
  await expect(page.locator('#controller-lab-battery')).toContainText('75 %');
  await expect(page.locator('#controller-lab-headset')).toContainText('Connecté');
  await expect(page.locator('#controller-lab-headset')).toContainText('non exposé');
  await expect(page.locator('#controller-lab-microphone')).toContainText('muet');
  await expect(page.locator('#controller-left-stick-value')).toContainText('X 0.255');
  await expect(page.locator('#controller-right-trigger-value')).toHaveText('100 %');
  await expect(page.locator('[data-controller-button="cross"]')).toHaveAttribute('data-active', 'true');
  await expect(page.locator('[data-controller-button="cross"]')).toHaveAttribute('aria-label', /appuyé/);
  await expect(page.locator('#controller-gyro-value')).toContainText('X -100 / Y 200 / Z 300');
  await expect(page.locator('#controller-touch-1-value')).toContainText('Actif / X 100 / Y 200');
  await expect(page.locator('#controller-analysis-summary')).toContainText('aucune calibration écrite');
  await expect(page.locator('#controller-analysis-left-center')).not.toHaveText('—');

  await revealSection(page, '#tab-bridge');
  await expect(page.locator('#haptics-gain')).toBeDisabled();
  await expect(page.locator('#save-config-button')).toBeDisabled();
  await expect(page.locator('#read-config-button')).toBeEnabled();
  await page.locator('#read-config-button').click();
  await expect(page.locator('#haptics-gain')).toBeEnabled();
  await expect(page.locator('.capability-row')).toHaveCount(2);
  await expect(page.locator('.capability-row').first()).toContainText('Audio USB');
  await expect(page.locator('.capability-row').last()).toContainText('Raccourci PS');
  await expect(page.locator('#save-config-button')).toBeDisabled();
  await page.locator('#haptics-gain').evaluate((input) => {
    input.value = '1.4';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#save-config-button')).toBeEnabled();
  await page.locator('#save-config-button').click();
  await expect(confirmation).toBeVisible();
  await expect(page.locator('#confirm-message')).toContainText('Gain haptique : 1 → 1.4');
  await confirmation.locator('[value="cancel"]').click();

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('miralink:open-pairing-window')));
  await expect(confirmation).toBeVisible();
  await expect(page.locator('#confirm-message')).toContainText('Bluetooth pairing window');
  await confirmation.locator('[value="cancel"]').click();
  await expect(page.locator('#open-pairing-button')).toBeEnabled();
  await page.locator('#open-pairing-button').click();
  await expect(confirmation).toBeVisible();
  await confirmation.locator('[value="cancel"]').click();

  await revealSection(page, '#tab-backups');
  await page.locator('#profiles-button').click();
  const lab = page.locator('#controller-lab-dialog');
  await expect(lab).toBeVisible();
  await expect(lab).toHaveAttribute('aria-labelledby', 'controller-lab-title');
  await lab.getByRole('button', { name: 'Préparer le brouillon' }).first().click();
  await expect(confirmation).toBeVisible();
  await expect(page.locator('#confirm-message')).toContainText('avant → après');
  await expect(page.locator('#confirm-message')).toContainText('Mode de lecture');
  await confirmation.locator('[value="cancel"]').click();
  await page.locator('#controller-lab-dialog').getByRole('button', { name: 'Fermer' }).click();

  await revealSection(page, '#tab-diagnostics');
  await page.locator('#run-diagnostics-button').click();
  await expect(page.locator('#diagnostic-summary')).toContainText(/Bluetooth pairing window open/i);
});

test('serializes polling and foreground WebHID work while recovering bounded response reads', async ({ page }) => {
  await installMiraLinkBridgeStub(page);
  await page.goto('/');
  await page.locator('#connect-button').click();
  const confirmation = page.locator('#confirm-dialog');
  await expect(confirmation).toBeVisible();
  await confirmation.locator('[value="cancel"]').click();
  await expect(page.locator('.device-meta').first()).toContainText('MiraLink bridge');

  await page.evaluate(() => { globalThis.__miralinkReceiveFailures = 2; });
  await page.evaluate(() => {
    document.querySelector('#read-config-button').click();
    document.querySelector('#run-diagnostics-button').click();
  });

  await expect.poll(() => page.evaluate(() => globalThis.__miralinkReceiveFailures)).toBe(0);
  await expect.poll(() => page.evaluate(() => {
    const commands = globalThis.__miralinkCommandLog.map(({ command }) => command);
    return commands.includes(0x03) && commands.includes(0x08);
  })).toBe(true);
  await expect(page.locator('#log-view')).toContainText('the command was not resent');
  const metrics = await page.evaluate(() => globalThis.__miralinkTransportMetrics);
  expect(metrics.maxConcurrentCalls).toBe(1);
  expect(metrics.overlappingWrites).toBe(0);
  await expect(page.locator('.device-meta').first()).toContainText('MiraLink bridge');
});

test('surfaces persistent polling failures and reopens WebHID only on an explicit recovery action', async ({ page }) => {
  await installMiraLinkBridgeStub(page);
  await page.goto('/');
  await page.locator('#connect-button').click();
  const confirmation = page.locator('#confirm-dialog');
  await expect(confirmation).toBeVisible();
  await confirmation.locator('[value="cancel"]').click();

  await page.evaluate(() => { globalThis.__miralinkReceiveFailures = 9; });
  await expect(page.locator('#global-status-text')).toHaveText('Bridge attention', { timeout: 5000 });
  await expect(page.locator('#log-view')).toContainText('Controller polling retry 3/3');
  const before = await page.evaluate(() => ({ ...globalThis.__miralinkTransportMetrics }));
  expect(before.openCount).toBe(1);
  expect(before.closeCount).toBe(0);

  await page.locator('#run-diagnostics-button').click();
  await expect.poll(() => page.evaluate(() => globalThis.__miralinkTransportMetrics.openCount)).toBe(2);
  await expect.poll(() => page.evaluate(() => globalThis.__miralinkTransportMetrics.closeCount)).toBe(1);
  await expect(page.locator('.device-meta').first()).toContainText('MiraLink bridge');
  await expect(page.locator('#log-view')).toContainText('reopening the authorised WebHID session');
  const after = await page.evaluate(() => globalThis.__miralinkTransportMetrics);
  expect(after.maxConcurrentCalls).toBe(1);
  expect(after.overlappingWrites).toBe(0);
});

test('keeps commit, factory reset and explicit USB reconnect as separate confirmed actions', async ({ page }) => {
  await installMiraLinkBridgeStub(page);
  await page.goto('/');
  await page.locator('#connect-button').click();
  const confirmation = page.locator('#confirm-dialog');
  await expect(confirmation).toBeVisible();
  await confirmation.locator('[value="cancel"]').click();

  await revealSection(page, '#tab-bridge');
  await page.locator('#read-config-button').click();
  await expect(page.locator('#haptics-gain')).toBeEnabled();
  await expect(page.locator('.capability-row')).toHaveCount(2);

  await page.locator('#haptics-gain').evaluate((input) => {
    input.value = '1.4';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#save-config-button')).toBeEnabled();
  await page.locator('#save-config-button').click();
  await expect(confirmation).toBeVisible();
  await confirmation.locator('[value="confirm"]').click();

  await expect(page.locator('#global-status-text')).toHaveText('Ready');
  await expect(page.locator('#usb-reconnect-notice')).toBeVisible();
  await expect(page.locator('#reconnect-usb-button')).toBeEnabled();
  const savedCommands = await page.evaluate(() => globalThis.__miralinkCommandLog);
  expect(savedCommands.some(({ command }) => command === 0x04)).toBe(true);
  expect(savedCommands.some(({ command }) => command === 0x05)).toBe(true);
  expect(savedCommands.some(({ command }) => command === 0x07)).toBe(false);
  const draftPayload = savedCommands.filter(({ command }) => command === 0x04).at(-1).payload;
  expect(draftPayload[8]).toBe(96);
  expect((draftPayload[10] | (draftPayload[11] << 8)) & (1 << 2)).toBe(1 << 2);

  // A prior approval must never leak into the next destructive prompt when
  // that prompt is dismissed with Escape.
  await page.locator('#factory-reset-config-button').click();
  await expect(confirmation).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(confirmation).toBeHidden();
  expect(await page.evaluate(() => globalThis.__miralinkCommandLog.some(({ command }) => command === 0x06))).toBe(false);

  await page.locator('#factory-reset-config-button').click();
  await expect(confirmation).toBeVisible();
  await expect(page.locator('#confirm-message')).toContainText('Configuration actuelle → usine');
  await expect(page.locator('#confirm-message')).toContainText('Buffer audio : 96 → 64');
  await expect(page.locator('#confirm-message')).toContainText('Raccourci PS : activé → désactivé');
  await confirmation.locator('[value="confirm"]').click();
  await expect.poll(() => page.evaluate(() => {
    const commands = globalThis.__miralinkCommandLog.map(({ command }) => command);
    const resetIndex = commands.lastIndexOf(0x06);
    return resetIndex >= 0 && commands.slice(resetIndex + 1).includes(0x05);
  })).toBe(true);
  const resetCommands = await page.evaluate(() => globalThis.__miralinkCommandLog.map(({ command }) => command));
  expect(resetCommands).toContain(0x06);
  expect(resetCommands.slice(resetCommands.lastIndexOf(0x06) + 1)).toContain(0x05);
  await expect(page.locator('#usb-reconnect-notice')).toBeVisible();

  await page.locator('#reconnect-usb-button').click();
  await expect(confirmation).toBeVisible();
  await expect(page.locator('#confirm-message')).toContainText('déconnexion est attendue');
  expect(await page.evaluate(() => globalThis.__miralinkCommandLog.some(({ command }) => command === 0x07))).toBe(false);
  await confirmation.locator('[value="confirm"]').click();
  await expect.poll(() => page.evaluate(() => globalThis.__miralinkCommandLog.some(({ command }) => command === 0x07))).toBe(true);
  await expect(page.locator('#log-view')).toContainText('disconnected temporarily as expected');
  await expect(page.locator('#global-status-text')).toHaveText('Waiting for USB reconnect');
  await expect(page.locator('#usb-reconnect-notice')).toBeHidden();
});

test('accepts a RECONNECT_USB ACK read failure only when the expected disconnect follows', async ({ page }) => {
  await installMiraLinkBridgeStub(page);
  await page.goto('/');
  await page.locator('#connect-button').click();
  const confirmation = page.locator('#confirm-dialog');
  await expect(confirmation).toBeVisible();
  await confirmation.locator('[value="cancel"]').click();

  await page.locator('#read-config-button').click();
  await expect(page.locator('#haptics-gain')).toBeEnabled();
  await page.locator('#haptics-gain').evaluate((input) => {
    input.value = '1.4';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#save-config-button')).toBeEnabled();
  await page.locator('#save-config-button').click();
  await confirmation.locator('[value="confirm"]').click();
  await expect(page.locator('#usb-reconnect-notice')).toBeVisible();

  await page.evaluate(() => { globalThis.__miralinkReconnectReceiveFailures = 3; });
  await page.locator('#reconnect-usb-button').click();
  await confirmation.locator('[value="confirm"]').click();

  await expect(page.locator('#log-view')).toContainText('Expected USB disconnect observed after an unreadable RECONNECT_USB acknowledgement');
  await expect(page.locator('#log-view')).toContainText('WebHID receive failed: Injected RECONNECT_USB ACK read failure');
  await expect(page.locator('#log-view')).toContainText('disconnected temporarily as expected');
  await expect(page.locator('#global-status-text')).toHaveText('Waiting for USB reconnect');
  await expect(page.locator('#usb-reconnect-notice')).toBeHidden();
  await expect(page.locator('.device-card')).toHaveCount(0);

  await page.waitForTimeout(250);
  const reconnectCommands = await page.evaluate(() => globalThis.__miralinkCommandLog.filter(({ command }) => command === 0x07).length);
  expect(reconnectCommands).toBe(1);
  const commands = await page.evaluate(() => globalThis.__miralinkCommandLog.map(({ command }) => command));
  expect(commands.at(-1)).toBe(0x07);
});

test('does not accept an unreadable RECONNECT_USB ACK when no disconnect follows', async ({ page }) => {
  await installMiraLinkBridgeStub(page);
  await page.goto('/');
  await page.locator('#connect-button').click();
  const confirmation = page.locator('#confirm-dialog');
  await expect(confirmation).toBeVisible();
  await confirmation.locator('[value="cancel"]').click();

  await page.locator('#read-config-button').click();
  await expect(page.locator('#haptics-gain')).toBeEnabled();
  await page.locator('#haptics-gain').evaluate((input) => {
    input.value = '1.4';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#save-config-button')).toBeEnabled();
  await page.locator('#save-config-button').click();
  await confirmation.locator('[value="confirm"]').click();
  await expect(page.locator('#usb-reconnect-notice')).toBeVisible();

  await page.evaluate(() => {
    globalThis.__miralinkReconnectReceiveFailures = 3;
    globalThis.__miralinkSuppressReconnectDisconnect = true;
  });
  await page.locator('#reconnect-usb-button').click();
  await confirmation.locator('[value="confirm"]').click();

  await expect(page.locator('#log-view')).toContainText('no USB disconnect followed within 900 ms');
  await expect(page.locator('#global-status-text')).toHaveText('USB reconnect failed');
  await expect(page.locator('#usb-reconnect-notice')).toBeVisible();
  await expect(page.locator('#reconnect-usb-button')).toBeEnabled();
  await expect(page.locator('.device-card')).toHaveCount(1);
  await expect(page.locator('#log-view')).not.toContainText('disconnected temporarily as expected');

  await expect.poll(() => page.evaluate(() => {
    const commands = globalThis.__miralinkCommandLog.map(({ command }) => command);
    const reconnectIndex = commands.lastIndexOf(0x07);
    return reconnectIndex >= 0 && commands.slice(reconnectIndex + 1).includes(0x0b);
  })).toBe(true);
  const reconnectCommands = await page.evaluate(() => globalThis.__miralinkCommandLog.filter(({ command }) => command === 0x07).length);
  expect(reconnectCommands).toBe(1);
});

test('keeps the complete local control shell available from a cold offline cache', async ({ context, page }) => {
  await page.goto('/');
  const cachedPaths = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('Service workers are unavailable');
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
    const cacheNames = await caches.keys();
    const requests = await Promise.all(cacheNames.map(async (name) => (await caches.open(name)).keys()));
    return requests.flat().map((request) => new URL(request.url).pathname);
  });
  expect(cachedPaths).toContain('/src/profiles.js');
  expect(cachedPaths).toContain('/src/profile-store.js');
  expect(cachedPaths).toContain('/src/ui-state.js');

  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.clearBrowserCache');
  try {
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#connect-button')).toBeVisible();
    await revealSection(page, '#tab-diagnostics');
  } finally {
    await context.setOffline(false);
  }
});

test('service worker activation removes only obsolete MiraLink shell caches', async ({ page }) => {
  const unrelatedCache = 'unrelated-origin-cache-e2e';
  const obsoleteMiraLinkCache = 'miralink-shell-obsolete-e2e';
  await page.goto('/');
  await page.evaluate(async ({ unrelatedCache, obsoleteMiraLinkCache }) => {
    await navigator.serviceWorker.ready;
    await caches.open(unrelatedCache);
    await caches.open(obsoleteMiraLinkCache);
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }, { unrelatedCache, obsoleteMiraLinkCache });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; return true; });
  await expect.poll(() => page.evaluate(() => caches.keys())).not.toContain(obsoleteMiraLinkCache);
  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames).toContain(unrelatedCache);
  expect(cacheNames.some((name) => name.startsWith('miralink-shell-'))).toBe(true);
  await page.evaluate((name) => caches.delete(name), unrelatedCache);
});

test('has no automatically detectable serious accessibility violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const serious = results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
  expect(serious).toEqual([]);
});

test('keeps the dynamic profiles dialog accessible', async ({ page }) => {
  await page.goto('/');
  await revealSection(page, '#tab-backups');
  await page.locator('#profiles-button').click();
  await expect(page.locator('#controller-lab-dialog')).toBeVisible();
  const results = await new AxeBuilder({ page })
    .include('#controller-lab-dialog')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const serious = results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
  expect(serious).toEqual([]);
});
