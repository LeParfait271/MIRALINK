import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDualSenseAdapter,
  DUALSENSE_PRODUCT_ID,
  DUALSENSE_USB_REPORT_ID,
  DUALSENSE_VENDOR_ID,
  parseDualSenseInputReport
} from '../src/dualsense.js';

test('direct DualSense parser accepts only exact payload and wire forms', () => {
  const payload = new Uint8Array(63);
  payload[7] = 0x08;
  assert.equal(parseDualSenseInputReport(payload, { reportId: DUALSENSE_USB_REPORT_ID }).hardwareTested, true);

  const wire = new Uint8Array(64);
  wire[0] = DUALSENSE_USB_REPORT_ID;
  wire[8] = 0x08;
  assert.equal(parseDualSenseInputReport(wire).hardwareTested, true);

  assert.throws(() => parseDualSenseInputReport(new Uint8Array(62), { reportId: 1 }), /exactly 63 bytes/);
  assert.throws(() => parseDualSenseInputReport(new Uint8Array(65), { reportId: 1 }), /exactly 63 bytes/);
  assert.throws(() => parseDualSenseInputReport(new Uint8Array(64), { reportId: 1 }), /must start with report ID/);
});

test('invalid direct reports never mark the adapter hardware-tested', () => {
  let inputListener = null;
  const errors = [];
  const device = {
    vendorId: DUALSENSE_VENDOR_ID,
    productId: DUALSENSE_PRODUCT_ID,
    addEventListener(type, listener) { if (type === 'inputreport') inputListener = listener; },
    removeEventListener() {}
  };
  const adapter = createDualSenseAdapter(device, { onError: (error) => errors.push(error) });
  assert.equal(adapter.start().hardwareTested, false);
  inputListener({ device, reportId: DUALSENSE_USB_REPORT_ID, data: new Uint8Array(62) });
  assert.equal(errors.length, 1);
  assert.deepEqual(adapter.snapshot(), {
    state: 'listening',
    sampleCount: 0,
    lastSample: null,
    source: 'hardware',
    hardwareTested: false
  });

  inputListener({ device, reportId: DUALSENSE_USB_REPORT_ID, data: new Uint8Array(63) });
  assert.equal(adapter.snapshot().hardwareTested, true);
  assert.equal(adapter.snapshot().sampleCount, 1);
});
