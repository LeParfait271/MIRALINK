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
const DEFAULT_RECEIVE_IO_RETRIES = 2;

function cancelledTransaction(message = 'The queued HID transaction is no longer active') {
  return new ProtocolError(message, 'transaction_cancelled');
}

/**
 * Serialize all feature-report exchanges for one HIDDevice. Cancelling the
 * queue invalidates work that has not started and rejects an in-flight result
 * before it can be consumed; WebHID itself does not expose an abort primitive.
 */
export function createHidTransactionQueue() {
  let generation = 0;
  let pending = 0;
  let tail = Promise.resolve();
  let cancellationMessage = 'The queued HID transaction was cancelled';

  const assertGeneration = (queuedGeneration) => {
    if (queuedGeneration !== generation) throw cancelledTransaction(cancellationMessage);
  };

  const queue = {
    enqueue(operation) {
      if (typeof operation !== 'function') throw new TypeError('A HID transaction must be a function');
      const queuedGeneration = generation;
      pending += 1;
      const run = tail.then(async () => {
        assertGeneration(queuedGeneration);
        const context = Object.freeze({
          assertActive: () => assertGeneration(queuedGeneration)
        });
        const result = await operation(context);
        assertGeneration(queuedGeneration);
        return result;
      });
      const settled = run.finally(() => { pending -= 1; });
      tail = settled.catch(() => undefined);
      return settled;
    },
    cancel(message = 'The queued HID transaction was cancelled') {
      cancellationMessage = String(message || 'The queued HID transaction was cancelled');
      generation += 1;
    },
    async drain() {
      // Include work appended while an earlier tail is settling.
      let observed;
      do {
        observed = tail;
        await observed;
      } while (observed !== tail);
    },
    get pending() { return pending; }
  };
  return Object.freeze(queue);
}

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
  const browserName = String(error?.browserErrorName || name);
  const detail = error instanceof Error && error.message ? error.message : String(error || 'Erreur WebHID inconnue.');
  let summary = bridgeIdentified
    ? `Le pont MiraLink est visible, mais son canal de contrôle ne répond pas : ${detail}`
    : `La connexion WebHID a échoué : ${detail}`;
  let nextAction = 'Débranchez puis rebranchez le périphérique, cliquez sur Actualiser, puis réessayez.';
  let retryable = true;

  if (['NotAllowedError', 'SecurityError'].includes(browserName) || ['permission_denied', 'security_error'].includes(code)) {
    summary = 'Le navigateur a refusé l’accès WebHID au périphérique.';
    nextAction = 'Autorisez le périphérique dans Chrome ou Edge sur une page HTTPS, puis cliquez sur Connecter.';
  } else if (code === 'feature_report_unavailable') {
    summary = 'Le pont est visible, mais ce navigateur ne fournit pas les rapports WebHID nécessaires à MiraLink.';
    nextAction = 'Ouvrez le site dans Chrome ou Edge pour ordinateur, puis reconnectez le Pico.';
    retryable = false;
  } else if (['InvalidStateError', 'NetworkError', 'NotReadableError', 'NotFoundError'].includes(browserName)
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

function featureReportIoError(error, stage) {
  if (error instanceof ProtocolError && ['device_disconnected', 'transaction_cancelled'].includes(error.code)) return error;
  const detail = error instanceof Error && error.message ? error.message : String(error || 'Unknown WebHID error');
  const wrapped = new ProtocolError(`WebHID ${stage} failed: ${detail}`, 'device_io');
  wrapped.operationStage = stage;
  wrapped.browserErrorName = String(error?.name || 'Error');
  wrapped.cause = error;
  return wrapped;
}

function assertTransactionActive(assertActive) {
  if (typeof assertActive !== 'function') return;
  if (assertActive() === false) throw cancelledTransaction();
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
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  receiveIoRetries = DEFAULT_RECEIVE_IO_RETRIES,
  assertActive = null,
  onReceiveRetry = null
} = {}) {
  if (!device || typeof device.sendFeatureReport !== 'function' || typeof device.receiveFeatureReport !== 'function') {
    throw new ProtocolError('WebHID feature-report methods are unavailable', 'feature_report_unavailable');
  }

  assertTransactionActive(assertActive);
  if (device.opened === false) throw new ProtocolError('The HID device is disconnected', 'device_disconnected');
  const frame = encodeFrame({ sequence, command, payload });
  const deadline = Date.now() + timeoutMs;
  try {
    // A failed send is ambiguous: the firmware may already have received the
    // command. Never resend it automatically, especially for write commands.
    await device.sendFeatureReport(REPORT_IDS.command, frame);
  } catch (error) {
    throw featureReportIoError(error, 'send');
  }
  assertTransactionActive(assertActive);

  let lastError = null;
  let receiveIoFailureCount = 0;
  while (Date.now() < deadline) {
    assertTransactionActive(assertActive);
    if (device.opened === false) throw new ProtocolError('The HID device is disconnected', 'device_disconnected');
    try {
      const data = await device.receiveFeatureReport(REPORT_IDS.response);
      assertTransactionActive(assertActive);
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
      if (error instanceof ProtocolError && ['device_disconnected', 'transaction_cancelled'].includes(error.code)) throw error;
      if (['InvalidStateError', 'NotAllowedError', 'NotFoundError', 'SecurityError'].includes(error?.name)) {
        throw featureReportIoError(error, 'receive');
      }
      if (['NetworkError', 'NotReadableError'].includes(error?.name)) {
        receiveIoFailureCount += 1;
        lastError = featureReportIoError(error, 'receive');
        // Receiving the already-requested response again is safe. Keep this
        // retry bounded; a persistent USB failure must remain visible.
        if (receiveIoFailureCount > Math.max(0, Number(receiveIoRetries) || 0)) throw lastError;
        if (typeof onReceiveRetry === 'function') {
          try {
            onReceiveRetry(Object.freeze({
              attempt: receiveIoFailureCount,
              maximum: Math.max(0, Number(receiveIoRetries) || 0),
              error: lastError
            }));
          } catch {
            // Observability hooks must never alter transport semantics.
          }
        }
      } else {
        lastError = error;
      }
    }

    const remaining = deadline - Date.now();
    if (remaining > 0) await wait(Math.min(pollIntervalMs, remaining));
  }

  const detail = lastError instanceof Error && lastError.message ? `: ${lastError.message}` : '';
  const error = new ProtocolError(`Device did not answer in time${detail}`, 'timeout');
  error.operationStage = 'receive';
  error.cause = lastError;
  throw error;
}
