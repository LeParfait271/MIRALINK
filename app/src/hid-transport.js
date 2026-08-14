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
  const hid = browserNavigator?.hid;
  const apiAvailable = Boolean(hid
    && typeof hid.requestDevice === 'function'
    && typeof hid.getDevices === 'function');
  let permissionsPolicy = null;
  try {
    const policy = browserDocument?.permissionsPolicy || browserDocument?.featurePolicy;
    if (policy && typeof policy.allowsFeature === 'function') {
      permissionsPolicy = policy.allowsFeature('hid');
    }
  } catch {
    permissionsPolicy = null;
  }
  const secureContext = Boolean(isSecureContext);
  const available = apiAvailable && secureContext && permissionsPolicy !== false;
  let reason = 'available';
  if (!secureContext) reason = 'insecure-context';
  else if (permissionsPolicy === false) reason = 'permissions-policy';
  else if (!apiAvailable) reason = 'browser-or-context';
  return Object.freeze({ available, isSecureContext: secureContext, permissionsPolicy, reason });
}

/**
 * The page stylesheet intentionally gives notices an explicit display value,
 * which can override the HTML `hidden` presentation rule. Keep both the
 * semantic state and an inline display override in sync.
 */
export function setWebHidWarningVisibility(warning, visible) {
  if (!warning) return false;
  const shouldShow = Boolean(visible);
  warning.hidden = !shouldShow;
  if (shouldShow) {
    warning.style?.removeProperty?.('display');
    warning.removeAttribute?.('aria-hidden');
  } else {
    warning.style?.setProperty?.('display', 'none', 'important');
    warning.setAttribute?.('aria-hidden', 'true');
  }
  return shouldShow;
}

export function isHidRequestCancellation(error) {
  return ['AbortError', 'NotFoundError'].includes(error?.name);
}

export function describeWebHidError(error, { bridgeIdentified = false, operation = 'connection' } = {}) {
  const code = String(error?.code || '');
  const name = String(error?.name || '');
  const detail = error instanceof Error && error.message ? error.message : String(error || 'Erreur WebHID inconnue.');
  let summary = bridgeIdentified
    ? `Le pont MiraLink est visible, mais son canal de contrôle ne répond pas : ${detail}`
    : `La connexion WebHID a échoué : ${detail}`;
  let nextAction = 'Débranchez puis rebranchez le périphérique, cliquez sur Actualiser, puis réessayez.';
  let retryable = true;

  if (['NotAllowedError', 'SecurityError'].includes(name) || ['permission_denied', 'security_error'].includes(code)) {
    summary = 'Le navigateur a refusé l’accès WebHID au périphérique.';
    nextAction = 'Autorisez le périphérique dans Chrome ou Edge sur une page HTTPS, puis cliquez sur Connecter.';
  } else if (code === 'feature_report_unavailable') {
    summary = 'Le pont est visible, mais ce navigateur ne fournit pas les rapports WebHID nécessaires à MiraLink.';
    nextAction = 'Ouvrez le site dans Chrome ou Edge pour ordinateur, puis reconnectez le Pico.';
    retryable = false;
  } else if (['InvalidStateError', 'NetworkError', 'NotReadableError', 'NotFoundError'].includes(name)
    || ['device_not_open', 'device_disconnected', 'device_io'].includes(code)) {
    summary = bridgeIdentified
      ? 'Le pont MiraLink a été identifié, mais la liaison USB WebHID a été interrompue.'
      : 'La liaison USB WebHID a été interrompue.';
    nextAction = 'Fermez les autres pages utilisant le périphérique, rebranchez-le, puis cliquez sur Actualiser.';
  } else if (bridgeIdentified && ['timeout', 'sequence_mismatch', 'command_mismatch', 'bad_magic', 'bad_crc', 'bad_version', 'invalid_hello_payload'].includes(code)) {
    const exchange = operation === 'hello' ? 'HELLO' : `échange ${operation}`;
    summary = `Le Pico est identifié comme pont MiraLink, mais l’${exchange} 0x70/0x71 a échoué : ${detail}`;
    nextAction = 'Rebranchez le Pico, vérifiez qu’il utilise le dernier firmware MiraLink, puis ouvrez Diagnostics pour réessayer.';
  }

  return Object.freeze({ summary, nextAction, retryable, detail, code: code || name || 'webhid_error' });
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
    if (device.opened === false) throw new ProtocolError('The HID device is disconnected', 'device_disconnected');
    try {
      const data = await device.receiveFeatureReport(REPORT_IDS.response);
      const response = decodeFrame(normalizeFeatureReport(data, REPORT_IDS.response));
      if (response.sequence !== sequence) {
        lastError = new ProtocolError('Feature response sequence does not match the request', 'sequence_mismatch');
      } else if (response.command !== command) {
        lastError = new ProtocolError('Feature response command does not match the request', 'command_mismatch');
      } else if (response.flags & RESPONSE_FLAGS.error) {
        throw responseError(response);
      } else {
        return response;
      }
    } catch (error) {
      if (error instanceof ProtocolError && error.code === 'device_error') throw error;
      if (['InvalidStateError', 'NetworkError', 'NotAllowedError', 'NotFoundError', 'NotReadableError', 'SecurityError'].includes(error?.name)) throw error;
      lastError = error;
    }

    const remaining = deadline - Date.now();
    if (remaining > 0) await wait(Math.min(pollIntervalMs, remaining));
  }

  const detail = lastError instanceof Error && lastError.message ? `: ${lastError.message}` : '';
  throw new ProtocolError(`Device did not answer in time${detail}`, 'timeout');
}
