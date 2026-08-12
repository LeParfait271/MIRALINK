import {
  HID_REPORT_BYTES,
  ProtocolError,
  RESPONSE_FLAGS,
  REPORT_IDS,
  decodeFrame,
  encodeFrame
} from './protocol.js';

const DEFAULT_TIMEOUT_MS = 1400;
const DEFAULT_POLL_INTERVAL_MS = 20;

export function inspectWebHidAvailability({ navigator: browserNavigator = null, document: browserDocument = null, isSecureContext = false } = {}) {
  const available = Boolean(browserNavigator && 'hid' in browserNavigator);
  let permissionsPolicy = null;
  try {
    if (browserDocument?.permissionsPolicy && typeof browserDocument.permissionsPolicy.allowsFeature === 'function') {
      permissionsPolicy = browserDocument.permissionsPolicy.allowsFeature('hid');
    }
  } catch {
    permissionsPolicy = null;
  }
  const reason = available
    ? 'available'
    : !isSecureContext
      ? 'insecure-context'
      : permissionsPolicy === false
        ? 'permissions-policy'
        : 'browser-or-context';
  return Object.freeze({ available, isSecureContext: Boolean(isSecureContext), permissionsPolicy, reason });
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function responseError(response) {
  const message = new TextDecoder().decode(response.payload).replace(/[\0\s]+$/g, '') || 'Device rejected the command.';
  return new ProtocolError(message, 'device_error');
}

function normalizeFeatureReport(input, reportId) {
  if (input instanceof Uint8Array) {
    return input.length === HID_REPORT_BYTES + 1 && input[0] === reportId
      ? input.subarray(1)
      : input;
  }
  if (input instanceof ArrayBuffer) {
    return normalizeFeatureReport(new Uint8Array(input), reportId);
  }
  if (ArrayBuffer.isView(input)) {
    return normalizeFeatureReport(new Uint8Array(input.buffer, input.byteOffset, input.byteLength), reportId);
  }
  return input;
}

/**
 * Exchange one typed MiraLink command over HID feature reports.
 * WebHID does not emit `inputreport` for a feature-report response; the
 * response must be retrieved explicitly with `receiveFeatureReport()`.
 */
export async function transactFeatureReport(device, {
  sequence,
  command,
  payload = new Uint8Array(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS
} = {}) {
  if (!device || typeof device.sendFeatureReport !== 'function' || typeof device.receiveFeatureReport !== 'function') {
    throw new ProtocolError('WebHID feature-report methods are unavailable', 'feature_report_unavailable');
  }

  const frame = encodeFrame({ sequence, command, payload });
  await device.sendFeatureReport(REPORT_IDS.command, frame);

  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const data = await device.receiveFeatureReport(REPORT_IDS.response);
      const response = decodeFrame(normalizeFeatureReport(data, REPORT_IDS.response));
      if (response.sequence !== sequence) {
        lastError = new ProtocolError('Feature response sequence does not match the request', 'sequence_mismatch');
      } else if (response.flags & RESPONSE_FLAGS.error) {
        throw responseError(response);
      } else {
        return response;
      }
    } catch (error) {
      if (error instanceof ProtocolError && error.code === 'device_error') throw error;
      lastError = error;
    }

    const remaining = deadline - Date.now();
    if (remaining > 0) await wait(Math.min(pollIntervalMs, remaining));
  }

  const detail = lastError instanceof Error && lastError.message ? `: ${lastError.message}` : '';
  throw new ProtocolError(`Device did not answer in time${detail}`, 'timeout');
}
