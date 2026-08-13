# Changelog

# 0.23 - 2026-08-13

- Rebuilt the public desktop landing hero with cinematic local hardware scenes,
  crossfades, parallax, scroll choreography and magnetic calls to action while
  preserving the existing WebHID application underneath.

## 0.22 - 2026-08-13

- Corrected the public MiraLink site/application version to `0.22`, with a
  `0.01` increment policy for future site commits.
- Kept firmware version `2.2.0` independent; no firmware binary or hardware
  claim changed in this metadata-only update.

## Firmware 2.2.0 - 2026-08-13

- Replaced the failing USB composite descriptor with a HID-only Pico 2 W
  configuration after Windows reported Code 10 on both the audio and HID
  child interfaces of the 2.0.0 bridge.
- Kept the MiraLink feature channel and standard gamepad collection while
  removing the unvalidated UAC2 interface from the active descriptor.
- Kept audio USB explicitly unavailable; the audio pipeline remains isolated
  in source for a later descriptor-specific validation cycle.
- Built and inspected a new RP2350 ARM Secure UF2 locally. It has not been
  flashed or tested on physical hardware.

## 2.1.0 - 2026-08-13

- Added the MiraLink bridge VID/PID to the WebHID chooser filters so Chrome can
  select the enumerated Pico 2 W HID interface even when the vendor collection
  usage page is not exposed consistently by the host.
- Kept this as an application-only transport hotfix: the already installed
  firmware `2.0.0` remains compatible and does not require a reflash.
- Local Windows enumeration confirmed the connected bridge identity as
  `VID_CAFE/PID_4D4C`; this is not a claim that a controller has paired.

## 2.0.0 - 2026-08-13

- Added local Bluetooth failure diagnostics: last failing stage, controller
  attempt/failure counters and automatic-reconnect attempts, without exposing
  radio addresses or sending data away from the computer.
- Hardened the bounded Bluetooth output queue so a pending BTstack report is
  not overwritten by a concurrent haptic, trigger or audio report.
- Kept one validated audio report in local RAM while the output queue is busy,
  discarded stale audio after a link loss, and encoded the actual Opus payload
  length instead of advertising the full capacity as audio data.
- Added host coverage for fixed DualSense audio-report layout validation and
  application coverage for diagnostics schema 4.
- Rebuilt the local Pico 2 W manual-test candidate. Hardware behavior remains
  untested; no flash, push or public publication is claimed.

## 1.9.0 - 2026-08-13

- Added a local UAC2 audio input for four-channel, 48 kHz, 16-bit PCM. Audio
  samples stay in a bounded RAM ring and are never persisted or sent to a
  network service.
- Added a bounded DualSense audio HID report path (`0x36`, 398 bytes): the
  local four-channel USB PCM input is converted to Opus stereo speaker data
  plus 3 kHz haptic channels. The link is reported only after a valid HID
  controller route exists and streaming only after reports are accepted by
  BTstack; no standard A2DP/SBC route is advertised.
- Added a fixed-size DualSense output route for haptic/trigger-compatible game
  output: 47 validated USB body bytes are wrapped with a MiraLink-owned
  Bluetooth header, sequence and CRC.
- Added `SET_CONTROLLER_OUTPUT`, `GET_AUDIO_STATUS` and diagnostics schema 3;
  the application now displays local audio status instead of hard-coding it as
  unavailable.
- Rebuilt the local Pico 2 W candidate with the corrected 48 kHz endpoint,
  locally vendored Opus 1.5.2 and fresh ELF/BIN/HEX/UF2 artifacts.
  budget. Software checks pass; no physical flash, controller test, push or
  public release is claimed.

## 1.8.0 - 2026-08-13

- Extended the independent Pico 2 W DualSense path to recognize the DualSense
  Edge USB identity and Bluetooth inquiry variants.
- Made Bluetooth inquiry more tolerant of incomplete device metadata while
  keeping the final HID report validation strict.
- Fixed stale HID connection cleanup so a failed handshake cannot block the
  next local pairing or reconnection attempt.
- Increased local HID descriptor storage for complete DualSense revisions and
  kept unsupported audio streaming and adaptive-trigger effects explicitly
  unavailable instead of advertising them as firmware capabilities.
- Prepared a versioned 1.8.0 manual-test candidate with build evidence and
  SHA-256 manifests. No physical hardware test, flash, push or publication is
  claimed.

## 1.7.0 - 2026-08-13

- Corrected automatic DualSense reconnection so a failed controller does not
  exhaust the retry index permanently and multiple remembered controllers are
  retried in a bounded rotation.
- Kept Bluetooth link-key persistence on the Pico SDK's local BTstack store and
  added compile-time flash separation checks against MiraLink configuration.
- Added SSP reconnection for remembered controllers, a ten-second HID
  handshake timeout and recovery through the normal local reconnect path.
- Kept the bridge local, manual-flash-only and explicit about unsupported audio
  streaming and adaptive-trigger effects.

## 1.6.0 - 2026-08-12

- Accepted the legacy DualSense Bluetooth PIN `0000` only during the explicit
  local pairing window or for a controller address already known to BTstack.
- Normalized MiraLink HID feature commands when a host provides the report ID
  in the callback buffer, while retaining strict report-size validation.
- Kept the pairing and HID changes local, confirmation-gated and unvalidated
  on physical hardware until the new candidate is manually flashed.

## 1.5.0 - 2026-08-12

- Corrected the DualSense USB/Bluetooth input offsets for buttons, motion,
  touch and battery status instead of treating the sequence byte as buttons.
- Added schema-2 controller state data with local battery, headset, microphone,
  motion and touch fields, plus explicit capability negotiation.
- Added bounded Bluetooth-compatible rumble, lightbar/player LEDs and
  microphone mute output commands with CRC-protected reports and automatic
  haptic stop handling.
- Kept adaptive-trigger effects and audio streaming explicitly unavailable;
  no physical Pico 2 W or DualSense test is claimed until the candidate is
  manually flashed and observed on real hardware.

## 1.4.0 - 2026-08-12

- Added local BTstack link-key discovery and bounded automatic reconnection for
  previously paired DualSense controllers.
- Allowed incoming HID connections from locally known paired controllers after
  the pairing window closes, while keeping unknown devices confirmation-gated.
- Exposed paired-controller knowledge in the controller-state protocol and
  added the corresponding local protocol test.
- Physical DualSense pairing remains untested until the 1.4.0 candidate is
  manually flashed on a Pico 2 W.

## 1.3.0 — 2026-08-12

- Fixed the TinyUSB buffer size for MiraLink HID reports with a report ID:
  `SET_FEATURE` now accepts the identifier plus 64 data bytes.
- Added local normalization for WebHID responses with or without the report
  ID, bounded controller-state polling, and a confirmed pairing-window start
  after a bridge is connected.
- Added the Pico 2 W candidate in `firmware/releases/1.3.0/` with RP2350
  inspection and SHA-256 manifests.
- Flashing the candidate and connecting a DualSense remain manual physical
  hardware checks.

## 1.1.0 — 2026-08-12

- Ajouté la recherche locale de DualSense pendant la fenêtre d’appairage du Pico 2 W, avec filtrage d’identité, demande de nom et reconnexion après fermeture.
- Ajouté les diagnostics firmware structurés : radio, appairage, recherche, connexion, rapports validés et rapports rejetés.
- Ajouté les commandes locales bornées de reconnexion USB, journalisation en RAM et entrée recovery confirmation-gated ; aucune action n’est automatique.
- Ajouté le candidat firmware Pico 2 W `firmware/releases/1.1.0/` avec ELF, BIN, HEX, UF2 et manifestes SHA-256.
- Aucun flash, test matériel réel, push ou publication n’a été effectué ; les limites audio, batterie, haptique, gâchettes adaptatives et VID/PID de production restent explicites.

## 1.0.0 — 2026-08-12

- Rendu le build statique compatible avec les deux sorties Cloudflare Pages : `app/` et `app/dist/`.
- Conservation automatique de `_headers` dans `app/dist/` pour ne pas perdre l’autorisation WebHID pendant le build.
- Aucun firmware, fichier visuel ou test matériel réel n’a été modifié ou déclaré.

## 0.9.0 — 2026-08-12

- Ajouté l’autorisation de déploiement `Permissions-Policy: hid=(self)` pour Cloudflare Pages.
- Ajouté un diagnostic local distinguant contexte non sécurisé, politique de permissions et navigateur/contexte incompatible.
- Analysé l’ancien UF2 en lecture seule comme référence de comportement, sans réutiliser son code ni son firmware.

## 0.8.0 — 2026-08-12

- Corrigé l’échange WebHID du bridge : les réponses de commandes sont maintenant lues comme rapports HID de fonctionnalité avec `receiveFeatureReport(2)`.
- Ajouté une attente bornée et une vérification de séquence pour éviter qu’un Pico connecté soit classé à tort comme périphérique HID non supporté.
- Complété le cache hors ligne avec les modules DualSense et transport HID.
- Ajouté un test de régression local ; aucun firmware, fichier visuel ou test matériel n’a été modifié.

## 0.7.0 — 2026-08-12

- Renforcé le workflow obligatoire : lecture et mise à jour des garde-fous avant chaque commit.
- Imposé un commit local complet à la clôture de chaque prompt de travail, sans commit partiel ni push implicite.
- Aucun comportement firmware, test matériel ou fichier visuel n’a été modifié dans ce lot.

## 0.6.0 — 2026-08-12

- Ajouté un parseur indépendant des rapports d’entrée USB filaires DualSense dans le cœur firmware.
- Ajouté la détection et l’adaptateur WebHID local DualSense pour les rapports réels côté ordinateur.
- Ajoutée la publication locale des échantillons Controller Lab via un événement dédié, sans stockage permanent ni sortie réseau.
- Ajouté un hôte Bluetooth Classic HID Pico 2 W pour les rapports d’entrée DualSense `0x31`, avec vérification CRC.
- Ajouté la commande `OPEN_PAIRING_WINDOW`, fermée au démarrage et activable localement pendant cinq minutes après confirmation.
- Séparé les secteurs flash de configuration MiraLink et la banque locale de clés BTstack.
- Recompilé le firmware source 0.6.0 avec le SDK Pico officiel et validé les tests C++ du parseur/protocole.
- Ajouté le candidat UF2 local `firmware/releases/0.6.0/` avec SHA-256 ; aucun flash ni push n’a été effectué.
- Corrigé l’identification : un HID inconnu n’est plus présenté comme une manette MiraLink.
- Corrigé le décodage binaire de HELLO et des diagnostics ; les capacités radio et audio restent explicitement indisponibles.
- Aucun fichier visuel ni `app/dist/` n’a été modifié ; aucun flash ni test matériel réel n’a été effectué ou déclaré.

## 0.5.0 — 2026-08-12

- Ajouté le garde d’actions local pour le mode lecture seule, le verrouillage et les confirmations.
- Ajouté l’enregistrement temporaire de sessions avec rétention bornée et export contrôlé/anonymisé.
- Ajouté le benchmark local USB/radio/pertes avec score explicable et exclusion des mesures absentes.
- Ajoutée la détection locale de dérive et de batterie anormale, sans transformer une simulation en test matériel.
- Ajoutés 8 tests de fonctionnalités ; 44 tests logiciels passent au total.
- Aucun fichier visuel, firmware, build `dist/` ou test matériel n’a été modifié ou exécuté.

## 0.4.0 — 2026-08-12

- Ajouté le contrat local de remappage des boutons avec profils ciblés, diff, export/import et confirmation.
- Ajouté le mode urgence vers la configuration Basique, sans persistance implicite.
- Ajoutée la matrice locale de compatibilité firmware/manettes avec état `not-tested` par défaut.
- Ajouté le plan de diagnostics guidés et l'export de rapports anonymisés, avec séparation preuve/cause/solution.
- Ajouté 5 tests de fonctionnalités ; 36 tests logiciels passent au total.
- La structure visuelle et `dist/` restent volontairement inchangés pendant le travail visuel parallèle.

## 0.3.0 — 2026-08-12

- Added local simulation scenarios with an explicit `MODE SIMULATION` status and no hardware-test claims.
- Added the Competitive, Basic and Economy profile contracts with confirmation-gated previews.
- Added the Basic → Economy battery policy below 10 %, while protecting Competitive from automatic replacement.
- Added local profile storage, Controller Lab analysis and bounded calibration history.
- Added capability-aware live status metrics and a redacted computer → Pico 2 W → controller connection map model.
- Added 31 application and protocol tests covering the new local feature contracts.
- Documented the verified implementation state and the remaining UI integration roadmap.

## 0.2.0 — 2026-08-12

- Published a versioned Pico 2 W firmware delivery artifact with checksum and local release notes.
- Refined the application into an original blue/cyan crystalline HUD visual system inspired by the supplied mood references without copying game assets.
- Added service-worker cache rotation and synchronized application metadata with the release version.

## 0.1.0 — 2026-08-12

- Created the independent MiraLink project from zero.
- Added the mandatory guardrail document.
- Added the initial product brief, architecture and protocol direction.
- Set MaruChiwa as the displayed developer.
- Downloaded and documented the official local Pico SDK, ARM toolchain, CMake, Ninja and picotool.
- Implemented fixed 64-byte HID frames, CRC/padding checks and a two-sector flash configuration store.
- Compiled and inspected the first Pico 2 W ELF/BIN/HEX/UF2 firmware target.
- Strengthened local application protocol tests and UF2 validation.
