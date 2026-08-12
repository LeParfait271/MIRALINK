import { ProtocolError } from './protocol.js';

export const DIAGNOSTIC_FORMAT = 'miralink-diagnostic-report';
export const DIAGNOSTIC_VERSION = 1;
export const DIAGNOSTIC_STATES = Object.freeze(['passed', 'failed', 'unavailable', 'not-tested']);
export const DIAGNOSTIC_SOURCES = Object.freeze(['hardware', 'simulation', 'local', 'unknown']);

const STEP_DEFINITIONS = Object.freeze([
  Object.freeze({ id: 'transport', title: 'Transport link', command: 'GET_INFO', purpose: 'Check the local bridge transport.' }),
  Object.freeze({ id: 'protocol', title: 'Protocol response', command: 'HELLO', purpose: 'Check protocol version and capability negotiation.' }),
  Object.freeze({ id: 'configuration', title: 'Configuration integrity', command: 'GET_CONFIG', purpose: 'Read and validate the current configuration.' }),
  Object.freeze({ id: 'controller', title: 'Controller path', command: 'GET_LIVE_STATUS', purpose: 'Check whether a controller path is actually reported.' }),
  Object.freeze({ id: 'recovery', title: 'Recovery readiness', command: 'ENTER_RECOVERY', purpose: 'Describe recovery without entering it automatically.' })
]);

function text(value, field, maxLength = 240) {
  if (typeof value !== 'string' || value.trim().length > maxLength) throw new ProtocolError(`${field} is invalid`, 'invalid_diagnostic');
  return value.trim();
}

function source(value) {
  if (!DIAGNOSTIC_SOURCES.includes(value)) throw new ProtocolError('Diagnostic source is invalid', 'invalid_diagnostic');
  return value;
}

function state(value) {
  if (!DIAGNOSTIC_STATES.includes(value)) throw new ProtocolError('Diagnostic state is invalid', 'invalid_diagnostic');
  return value;
}

function safeHardwareTested(sourceValue, value) {
  return sourceValue === 'hardware' && value === true;
}

export function listDiagnosticSteps() {
  return STEP_DEFINITIONS.map((step) => ({ ...step }));
}

export function createDiagnosticPlan({ source: sourceValue = 'local', scenario = null } = {}) {
  const normalizedSource = source(sourceValue);
  if (scenario !== null && (typeof scenario !== 'string' || scenario.length > 80)) throw new ProtocolError('Diagnostic scenario is invalid', 'invalid_diagnostic');
  return {
    format: DIAGNOSTIC_FORMAT,
    formatVersion: DIAGNOSTIC_VERSION,
    product: 'MiraLink',
    source: normalizedSource,
    scenario,
    modeLabel: normalizedSource === 'simulation' ? 'MODE SIMULATION' : null,
    hardwareTested: false,
    testStatus: 'not-tested',
    createdAt: new Date().toISOString(),
    steps: STEP_DEFINITIONS.map((step) => ({ ...step, state: 'not-tested', evidence: '', probableCause: '', recommendation: '', source: normalizedSource, hardwareTested: false, testStatus: 'not-tested' }))
  };
}

export function recordDiagnosticResult(report, stepId, { state: resultState, evidence = '', probableCause = '', recommendation = '', source: resultSource = report?.source || 'local', hardwareTested = false } = {}) {
  if (!report || report.format !== DIAGNOSTIC_FORMAT || !Array.isArray(report.steps)) throw new ProtocolError('Diagnostic report is invalid', 'invalid_diagnostic');
  const index = report.steps.findIndex((step) => step.id === stepId);
  if (index < 0) throw new ProtocolError('Diagnostic step was not found', 'diagnostic_step_not_found');
  const normalizedSource = source(resultSource);
  const normalizedState = state(resultState);
  const steps = report.steps.map((step, stepIndex) => stepIndex === index ? {
    ...step,
    state: normalizedState,
    evidence: text(evidence, 'Diagnostic evidence'),
    probableCause: text(probableCause, 'Diagnostic probable cause'),
    recommendation: text(recommendation, 'Diagnostic recommendation'),
    source: normalizedSource,
    hardwareTested: safeHardwareTested(normalizedSource, hardwareTested),
    testStatus: normalizedSource === 'simulation' ? 'not-tested' : (normalizedSource === 'hardware' && hardwareTested ? 'available' : 'not-tested')
  } : step);
  const states = steps.map((step) => step.state);
  const overall = states.includes('failed') ? 'failed' : states.every((value) => value === 'passed') ? 'passed' : states.some((value) => value === 'unavailable') ? 'unavailable' : 'not-tested';
  return { ...report, source: report.source, hardwareTested: report.source === 'hardware' && steps.some((step) => step.hardwareTested), testStatus: report.source === 'simulation' ? 'not-tested' : (report.source === 'hardware' && steps.some((step) => step.hardwareTested) ? 'available' : 'not-tested'), overallState: overall, steps };
}

export function exportDiagnosticReport(report) {
  if (!report || report.format !== DIAGNOSTIC_FORMAT || !Array.isArray(report.steps)) throw new ProtocolError('Diagnostic report is invalid', 'invalid_diagnostic');
  return {
    format: DIAGNOSTIC_FORMAT,
    formatVersion: DIAGNOSTIC_VERSION,
    product: 'MiraLink',
    source: report.source,
    scenario: report.scenario || null,
    modeLabel: report.source === 'simulation' ? 'MODE SIMULATION' : null,
    hardwareTested: report.source === 'hardware' && report.hardwareTested === true,
    testStatus: report.source === 'hardware' && report.hardwareTested === true ? 'available' : 'not-tested',
    overallState: report.overallState || 'not-tested',
    redaction: 'identifiers-omitted',
    steps: report.steps.map(({ id, title, command, purpose, state: stepState, evidence, probableCause, recommendation, source: stepSource, hardwareTested, testStatus }) => ({ id, title, command, purpose, state: stepState, evidence, probableCause, recommendation, source: stepSource, hardwareTested: stepSource === 'hardware' && hardwareTested === true, testStatus: stepSource === 'hardware' && hardwareTested === true ? testStatus : 'not-tested' }))
  };
}
