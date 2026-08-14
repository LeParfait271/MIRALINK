import { preferences } from './storage.js';

export const LANGUAGES = Object.freeze([['fr', 'Français']]);

const NAVIGATION_EN = Object.freeze({
  tabOverview: 'Overview',
  tabBridge: 'Bridge',
  tabControllers: 'Controllers',
  tabDiagnostics: 'Diagnostics',
  tabFirmware: 'Firmware',
  tabBackups: 'Backups',
  tabLogs: 'Logs'
});

const NAVIGATION_FR = Object.freeze({
  tabOverview: 'Système',
  tabBridge: 'Configuration',
  tabControllers: 'Manettes',
  tabDiagnostics: 'Diagnostics',
  tabFirmware: 'Firmware',
  tabBackups: 'Sauvegardes',
  tabLogs: 'Journaux'
});

const RUNTIME_EN = Object.freeze({
  audioBufferUnavailableHint: 'Unavailable in 0.41 — USB audio transport is not exposed.',
  psShortcutUnavailableHint: 'Unavailable in 0.41 — the current firmware does not expose this command.'
});

const RUNTIME_FR = Object.freeze({
  audioBufferUnavailableHint: 'Indisponible en 0.41 — le transport audio USB n’est pas exposé.',
  psShortcutUnavailableHint: 'Indisponible en 0.41 — cette commande n’est pas exposée par le firmware actuel.'
});

const EN = Object.freeze({
  ...NAVIGATION_EN,
  ...RUNTIME_EN,
  skip: 'Skip to content', brandSubtitle: 'Pico 2 W control center', language: 'Language', statusReady: 'Ready', eyebrow: 'LOCAL / HARDWARE / CONTROL', title: 'Make every connection intentional.', heroLede: 'A focused workspace for your bridge, controllers and firmware state. Your data stays on this computer.', workspace: 'WORKSPACE', devices: 'Connected devices', connect: 'Connect device', refresh: 'Refresh', webhidMissingTitle: 'MiraLink bridge unavailable.', webhidMissingBody: 'MiraLink uses WebHID to reach the Pico 2 W bridge; Bluetooth pairing is handled by the bridge.', webhidInsecureTitle: 'Secure connection required.', webhidInsecureBody: 'Open MiraLink over HTTPS or localhost before connecting the Pico 2 W bridge.', webhidPolicyTitle: 'WebHID is blocked by the page policy.', webhidPolicyBody: 'The deployment must allow WebHID with Permissions-Policy hid=(self).', webhidContextTitle: 'Desktop bridge connection unavailable.', webhidContextBody: 'This browser context does not expose WebHID. Use desktop Chrome or Edge to connect the Pico 2 W bridge; the controller is paired by the bridge.', noDevices: 'No device connected', noDevicesCopy: 'Connect a MiraLink device to begin.', overviewEyebrow: 'SYSTEM VIEW', overviewTitle: 'Everything in one place.', localOnly: 'LOCAL ONLY', metricBridge: 'Bridge', metricController: 'Controller', metricFirmware: 'Firmware', notConnected: 'Not connected', awaitingDevice: 'Awaiting device', safetyTitle: 'A calm interface for risky actions.', safetyBody: 'MiraLink keeps drafts local, shows changes before flash writes and never sends device data away.', bridgeEyebrow: 'PICO 2 W / PERSISTENT SETTINGS', bridgeTitle: 'Bridge configuration', selectDevice: 'Select a device', readOnlyTitle: 'Read-only state', readOnlyBody: 'Connect a MiraLink Pico 2 W to edit persistent settings.', feedbackTitle: 'Feedback', feedbackCopy: 'Tactile response and trigger comfort.', hapticsGain: 'Haptics gain', triggerReduce: 'Trigger reduction', performanceTitle: 'Performance', performanceCopy: 'Polling and audio timing.', pollingMode: 'Polling mode', audioBuffer: 'Audio buffer', powerTitle: 'Power and indicators', powerCopy: 'Sleep, light and wake behavior.', inactiveTime: 'Inactive timeout', disableLed: 'Disable Pico LED', enableWake: 'Enable host wake', compatibilityTitle: 'Compatibility', compatibilityCopy: 'Controller mode and safe host behavior.', controllerMode: 'Controller mode', enableUsbSerial: 'Enable USB serial', psShortcut: 'Enable PS shortcut', draftStatus: 'DRAFT STATUS', noDraft: 'No local changes.', readConfig: 'Read from Pico 2 W', saveConfig: 'Save to Pico 2 W', resetConfig: 'Reset draft', controllerEyebrow: 'INPUT / CALIBRATION / HISTORY', controllerTitle: 'Controller workspace', desktopOnly: 'DESKTOP ONLY', calibrationTitle: 'Calibration', calibrationCopy: 'Center, range and fine adjustment with a visible before/after state.', openWorkspace: 'Open workspace', quickTestTitle: 'Quick tests', quickTestCopy: 'Check sticks, buttons, haptics, audio and inputs without writing anything.', runTest: 'Run test', historyTitle: 'History', historyCopy: 'Keep local snapshots and restore a known-good calibration.', viewHistory: 'View history', controllerNoticeTitle: 'Controller work is local.', controllerNoticeBody: 'MiraLink will never upload a serial number, Bluetooth address or calibration sample.', diagnosticEyebrow: 'OBSERVE / VERIFY / RECOVER', diagnosticTitle: 'Diagnostics', runDiagnostics: 'Run diagnostics', diagUsb: 'USB transport', diagRadio: 'Radio transport', diagAudio: 'Audio path', diagStorage: 'Flash storage', diagnosticIdle: 'Diagnostics have not run yet.', firmwareEyebrow: 'VERIFY / RECOVER / UPDATE', firmwareTitle: 'Firmware center', manualUpdate: 'MANUAL UPDATE', installedVersion: 'Installed version', chooseUf2: 'Choose a UF2 file', verifyLocal: 'It will be inspected locally before anything else.', backupEyebrow: 'LOCAL / PORTABLE / VERSIONED', backupTitle: 'Backups and profiles', noCloud: 'NO CLOUD', exportTitle: 'Export', exportCopy: 'Save a versioned configuration file on this computer.', exportButton: 'Export backup', importTitle: 'Import', importCopy: 'Load a local backup into a draft for review.', chooseBackup: 'Choose backup', profileTitle: 'Profiles', profileCopy: 'Keep named local profiles without changing the Pico 2 W until you confirm.', manageProfiles: 'Manage profiles', backupNoticeTitle: 'Backups are user-controlled.', backupNoticeBody: 'MiraLink does not sync or upload them.', logsEyebrow: 'LOCAL EVENT TRAIL', logsTitle: 'Logs', clearLogs: 'Clear logs', confirmation: 'CONFIRMATION', confirmTitle: 'Confirm action', cancel: 'Cancel', confirm: 'Confirm'
});

const FR = Object.freeze({ ...EN, brandSubtitle: 'Centre de contrôle Pico 2 W', statusReady: 'Prêt', language: 'Langue', skip: 'Aller au contenu', heroEyebrow: 'CONNEXION LOCALE', heroLive: 'PRÊT À CONNECTER', title: 'Le contrôle commence ici.', heroLede: 'Un poste de contrôle local pour relier votre Pico 2 W, lire l’état du système et agir avec précision.', workspace: 'ESPACE DE TRAVAIL', devices: 'Appareils connectés', connect: 'Connecter un appareil', refresh: 'Actualiser', webhidMissingTitle: 'WebHID indisponible.', webhidMissingBody: 'Utilisez un navigateur de bureau compatible WebHID.', noDevices: 'Aucun appareil connecté', noDevicesCopy: 'Lancez la recherche pour connecter un appareil MiraLink.', connectionEyebrow: 'CONNEXION', connectionTitle: 'Votre appareil, ici.', scrollToSystem: 'ACCÉDER AU SYSTÈME', overviewEyebrow: 'ÉTAT DU SYSTÈME', overviewTitle: 'Tout ce qui compte, au même endroit.', localOnly: 'LOCAL UNIQUEMENT', metricBridge: 'Bridge', metricController: 'Manette', metricFirmware: 'Firmware', notConnected: 'Non connecté', awaitingDevice: 'En attente d’un appareil', safetyTitle: 'Chaque action importante reste visible.', safetyBody: 'Les brouillons restent locaux et les écritures sont confirmées avant modification.', bridgeEyebrow: 'PICO 2 W / RÉGLAGES PERSISTANTS', bridgeTitle: 'Configuration du bridge', selectDevice: 'Sélectionnez un appareil', readOnlyTitle: 'Lecture seule', readOnlyBody: 'Connectez un Pico 2 W MiraLink pour modifier les réglages persistants.', feedbackTitle: 'Retour', feedbackCopy: 'Réponse haptique et confort des gâchettes.', hapticsGain: 'Gain haptique', triggerReduce: 'Réduction des gâchettes', performanceTitle: 'Performances', performanceCopy: 'Fréquence de lecture et timing audio.', pollingMode: 'Mode de lecture', audioBuffer: 'Buffer audio', powerTitle: 'Énergie et voyants', powerCopy: 'Veille, lumière et réveil.', inactiveTime: 'Délai d’inactivité', disableLed: 'Désactiver la LED du Pico', enableWake: 'Autoriser le réveil de l’ordinateur', compatibilityTitle: 'Compatibilité', compatibilityCopy: 'Mode manette et comportement sûr.', controllerMode: 'Mode manette', enableUsbSerial: 'Activer le port série USB', psShortcut: 'Activer le raccourci PS', draftStatus: 'ÉTAT DU BROUILLON', noDraft: 'Aucune modification locale.', readConfig: 'Lire le Pico 2 W', saveConfig: 'Enregistrer dans le Pico 2 W', resetConfig: 'Réinitialiser le brouillon', controllerEyebrow: 'ENTRÉE / CALIBRATION / HISTORIQUE', controllerTitle: 'Espace manette', desktopOnly: 'ORDINATEUR UNIQUEMENT', calibrationTitle: 'Calibration', calibrationCopy: 'Centre, portée et réglage fin avec comparaison avant/après.', openWorkspace: 'Ouvrir l’espace de travail', quickTestTitle: 'Tests rapides', quickTestCopy: 'Vérifiez les sticks, boutons, vibrations, audio et entrées sans écriture.', runTest: 'Lancer le test', historyTitle: 'Historique', historyCopy: 'Conservez des instantanés locaux et restaurez une calibration fiable.', viewHistory: 'Voir l’historique', controllerNoticeTitle: 'Le travail manette reste local.', controllerNoticeBody: 'MiraLink n’envoie ni numéro de série, ni adresse Bluetooth, ni échantillon de calibration.', diagnosticEyebrow: 'OBSERVER / VÉRIFIER / RÉCUPÉRER', diagnosticTitle: 'Diagnostics', runDiagnostics: 'Lancer les diagnostics', diagUsb: 'Transport USB', diagRadio: 'Transport radio', diagAudio: 'Chemin audio', diagStorage: 'Mémoire flash', diagnosticIdle: 'Les diagnostics n’ont pas encore été lancés.', firmwareEyebrow: 'VÉRIFIER / RÉCUPÉRER / METTRE À JOUR', firmwareTitle: 'Firmware', manualUpdate: 'MISE À JOUR MANUELLE', installedVersion: 'Version installée', connectForVersion: 'Connectez un Pico 2 W pour la lire.', chooseUf2: 'Choisir un fichier UF2', verifyLocal: 'Il sera vérifié localement avant toute action.', downloadRelease: 'Télécharger la release GitHub', backupEyebrow: 'LOCAL / PORTABLE / VERSIONNÉ', backupTitle: 'Sauvegardes et profils', noCloud: 'AUCUN CLOUD', exportTitle: 'Exporter', exportCopy: 'Enregistrez une configuration versionnée sur cet ordinateur.', exportButton: 'Exporter la sauvegarde', importTitle: 'Importer', importCopy: 'Chargez une sauvegarde locale dans un brouillon à vérifier.', chooseBackup: 'Choisir une sauvegarde', profileTitle: 'Profils', profileCopy: 'Conservez des profils locaux sans modifier le Pico 2 W avant confirmation.', manageProfiles: 'Gérer les profils', backupNoticeTitle: 'Les sauvegardes restent sous votre contrôle.', backupNoticeBody: 'MiraLink ne les synchronise ni ne les envoie.', logsEyebrow: 'HISTORIQUE LOCAL', logsTitle: 'Journaux', clearLogs: 'Effacer les journaux', confirmation: 'CONFIRMATION', confirmTitle: 'Confirmer l’action', cancel: 'Annuler', confirm: 'Confirmer' });

const ENGLISH = Object.freeze({
  ...EN,
  openPairing: 'Open pairing',
  controllerNotConnected: 'Controller not connected',
  enableUsbSerial: 'Enable USB serial number',
  controllerEyebrow: 'INPUT / SESSION ANALYSIS / COMPARISON',
  calibrationTitle: 'Local input analysis',
  calibrationCopy: 'Analyze received inputs and create a session snapshot that is never applied to firmware.',
  openWorkspace: 'Open analysis',
  quickTestTitle: 'Input test',
  quickTestCopy: 'Check received sticks, triggers and buttons without sending vibration, audio or any other output.',
  historyTitle: 'Session snapshots',
  historyCopy: 'Compare ephemeral input analyses locally; nothing is restored or applied to firmware.',
  viewHistory: 'View session snapshots',
  installedVersion: 'Installed version',
  connectForVersion: 'Connect a Pico 2 W to read it.'
});

const MESSAGES = Object.freeze({
  fr: Object.freeze({
    ...FR,
    ...NAVIGATION_FR,
    ...RUNTIME_FR,
    webhidMissingTitle: 'Pont MiraLink indisponible.',
    webhidMissingBody: 'MiraLink utilise WebHID uniquement pour atteindre le pont Pico 2 W ; l’appairage Bluetooth est géré par le pont.',
    webhidInsecureTitle: 'Connexion sécurisée requise.',
    webhidInsecureBody: 'Ouvrez MiraLink en HTTPS ou sur localhost avant de connecter le pont Pico 2 W.',
    webhidPolicyTitle: 'WebHID est bloqué par la politique de la page.',
    webhidPolicyBody: 'Le déploiement doit autoriser WebHID avec Permissions-Policy hid=(self).',
    webhidContextTitle: 'Connexion au pont impossible dans ce contexte.',
    webhidContextBody: 'Ce contexte de navigateur n’expose pas WebHID. Utilisez Chrome ou Edge sur ordinateur pour connecter le pont Pico 2 W ; la manette est appairée par le pont.',
    openPairing: 'Ouvrir l’appairage',
    controllerNotConnected: 'Manette non connectée',
    enableUsbSerial: 'Activer le numéro de série USB',
    controllerEyebrow: 'ENTRÉES / ANALYSE DE SESSION / COMPARAISON',
    calibrationTitle: 'Analyse locale',
    calibrationCopy: 'Analysez les entrées reçues et créez un instantané de session qui n’est jamais appliqué au firmware.',
    openWorkspace: 'Ouvrir l’analyse',
    quickTestTitle: 'Test des entrées',
    quickTestCopy: 'Vérifiez sticks, gâchettes et boutons reçus, sans envoyer de vibration, d’audio ni d’autre sortie.',
    historyTitle: 'Instantanés de session',
    historyCopy: 'Comparez localement des analyses éphémères ; rien n’est restauré ni appliqué au firmware.',
    viewHistory: 'Voir les instantanés',
    installedVersion: 'Version installée',
    connectForVersion: 'Connectez un Pico 2 W pour la lire.'
  }),
  en: ENGLISH
});
let current = 'fr';

export function setupLanguage(select, onChange) {
  for (const [code, label] of LANGUAGES) { const option = document.createElement('option'); option.value = code; option.textContent = label; select.append(option); }
  if (!LANGUAGES.some(([code]) => code === current)) current = 'fr';
  select.value = current;
  select.addEventListener('change', () => { current = select.value; preferences.setLanguage(current); applyTranslations(); onChange?.(current); });
  applyTranslations();
}

export function translate(key) { return (MESSAGES[current] || ENGLISH)[key] || ENGLISH[key] || key; }

export function applyTranslations() {
  document.documentElement.lang = current;
  document.querySelectorAll('[data-i18n]').forEach((element) => { element.textContent = translate(element.dataset.i18n); });
}
