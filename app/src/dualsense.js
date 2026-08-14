import { ProtocolError } from './protocol.js';

export const DUALSENSE_VENDOR_ID = 0x054c;
export const DUALSENSE_PRODUCT_ID = 0x0ce6;
export const DUALSENSE_EDGE_PRODUCT_ID = 0x0df2;
export const DUALSENSE_USB_REPORT_ID = 0x01;

const INPUT_PAYLOAD_BYTES = 63;
const WIRE_REPORT_BYTES = INPUT_PAYLOAD_BYTES + 1;

function bytesOf(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new ProtocolError('DualSense report data is invalid', 'invalid_dualsense_report');
}

function axis(value) {
  return (value / 127.5) - 1;
}

function trigger(value) {
  return value / 255;
}

function pressed(value, bit) {
  return Boolean(value & (1 << bit));
}

function dpadState(value) {
  const direction = value & 0x0f;
  const states = [
    { up: true, right: false, down: false, left: false },
    { up: true, right: true, down: false, left: false },
    { up: false, right: true, down: false, left: false },
    { up: false, right: true, down: true, left: false },
    { up: false, right: false, down: true, left: false },
    { up: false, right: false, down: true, left: true },
    { up: false, right: false, down: false, left: true },
    { up: true, right: false, down: false, left: true },
    { up: false, right: false, down: false, left: false }
  ];
  return states[direction] || states[8];
}

export function isDualSenseDevice(device) {
  return Boolean(device)
    && Number(device.vendorId) === DUALSENSE_VENDOR_ID
    && [DUALSENSE_PRODUCT_ID, DUALSENSE_EDGE_PRODUCT_ID].includes(Number(device.productId));
}

export function dualSenseWebHidFilters() {
  return [
    { vendorId: DUALSENSE_VENDOR_ID, productId: DUALSENSE_PRODUCT_ID },
    { vendorId: DUALSENSE_VENDOR_ID, productId: DUALSENSE_EDGE_PRODUCT_ID }
  ];
}

export function parseDualSenseInputReport(input, { reportId = null, timestamp = new Date().toISOString() } = {}) {
  const bytes = bytesOf(input);
  let id = reportId === null || reportId === undefined ? null : Number(reportId);
  let offset = 0;
  if (bytes.length === WIRE_REPORT_BYTES) {
    if (bytes[0] !== DUALSENSE_USB_REPORT_ID) throw new ProtocolError('DualSense wire report must start with report ID 0x01', 'invalid_dualsense_report');
    if (id === null) id = bytes[0];
    offset = 1;
  } else if (bytes.length === INPUT_PAYLOAD_BYTES) {
    if (id === null) id = DUALSENSE_USB_REPORT_ID;
  } else {
    throw new ProtocolError('DualSense input payload must contain exactly 63 bytes, or 64 bytes including report ID 0x01', 'invalid_dualsense_report_length');
  }
  if (id !== DUALSENSE_USB_REPORT_ID) throw new ProtocolError('Only the wired DualSense input report is supported in this adapter', 'unsupported_dualsense_report');

  const dpadFace = bytes[offset + 7];
  const shoulder = bytes[offset + 8];
  const system = bytes[offset + 9];
  const dpad = dpadState(dpadFace);
  return Object.freeze({
    timestamp,
    source: 'hardware',
    hardwareTested: true,
    testStatus: 'available',
    transport: 'usb',
    reportId: id,
    leftStick: Object.freeze({ x: axis(bytes[offset + 0]), y: axis(bytes[offset + 1]) }),
    rightStick: Object.freeze({ x: axis(bytes[offset + 2]), y: axis(bytes[offset + 3]) }),
    leftTrigger: trigger(bytes[offset + 4]),
    rightTrigger: trigger(bytes[offset + 5]),
    buttons: Object.freeze({
      dpad: Object.freeze(dpad),
      square: pressed(dpadFace, 4),
      cross: pressed(dpadFace, 5),
      circle: pressed(dpadFace, 6),
      triangle: pressed(dpadFace, 7),
      l1: pressed(shoulder, 0),
      r1: pressed(shoulder, 1),
      l2: pressed(shoulder, 2),
      r2: pressed(shoulder, 3),
      create: pressed(shoulder, 4),
      options: pressed(shoulder, 5),
      l3: pressed(shoulder, 6),
      r3: pressed(shoulder, 7),
      ps: pressed(system, 0),
      touchpad: pressed(system, 1),
      mute: pressed(system, 2)
    }),
    capabilities: Object.freeze({
      input: 'supported',
      battery: 'unavailable',
      haptics: 'not-implemented',
      adaptiveTriggers: 'not-implemented',
      calibration: 'local-analysis-only'
    })
  });
}

export function createDualSenseAdapter(device, { onSample = () => {}, onError = () => {} } = {}) {
  if (!isDualSenseDevice(device)) throw new ProtocolError('This HID device is not a DualSense', 'unsupported_controller');
  let listening = false;
  let sampleCount = 0;
  let lastSample = null;
  const handleInputReport = (event) => {
    if (event.device !== device) return;
    try {
      const sample = parseDualSenseInputReport(event.data, { reportId: event.reportId });
      sampleCount += 1;
      lastSample = sample;
      onSample(sample);
    } catch (error) {
      onError(error);
    }
  };
  return Object.freeze({
    model: 'DualSense',
    transport: 'usb',
    capabilities: Object.freeze({ input: 'supported', battery: 'unavailable', haptics: 'not-implemented', adaptiveTriggers: 'not-implemented' }),
    start() {
      if (!listening) { device.addEventListener('inputreport', handleInputReport); listening = true; }
      return { state: 'listening', source: 'hardware', hardwareTested: sampleCount > 0 };
    },
    stop() {
      if (listening) { device.removeEventListener('inputreport', handleInputReport); listening = false; }
      return { state: 'stopped', source: 'hardware', hardwareTested: sampleCount > 0 };
    },
    snapshot() {
      return Object.freeze({ state: listening ? 'listening' : 'stopped', sampleCount, lastSample, source: 'hardware', hardwareTested: sampleCount > 0 });
    }
  });
}
