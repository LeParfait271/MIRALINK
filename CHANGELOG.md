# Changelog

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
