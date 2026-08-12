# MiraLink 1.5.0 - validation locale

Date de verification : 2026-08-12

## Ce qui est verifie

- Le firmware est reconstruit depuis les sources MiraLink independantes.
- La cible est `pico2_w`, famille `rp2350-arm-s`, puce RP2350 ARM Secure.
- `picotool` lit l'identite du UF2 et confirme la version `1.5.0`.
- Le coeur C++ est teste en mode Debug avec les parseurs de trames USB,
  DualSense USB/Bluetooth, CRC, batterie et sorties Bluetooth bornees.
- Les tests JavaScript passent avec les schemas de controleur 1 et 2, les
  capacites et les encodeurs de sorties bornes.
- Les quatre artefacts du paquet 1.5.0 correspondent au build final et leurs
  SHA-256 sont inscrits dans `firmware/releases/1.5.0/SHA256SUMS.txt`.

## Resultats de cette verification

- Tests JavaScript : 60/60 passants.
- Tests C++ natifs Debug : `MiraLink core tests passed`.
- Build Pico 2 W Release : termine avec succes.
- UF2 : `874496` octets, version `1.5.0` confirmee par picotool.
- Erreurs de format Git : `git diff --check` requis avant commit.

## Ce qui reste a valider sur materiel reel

Aucun Pico 2 W ni DualSense n'etait connecte pendant cette verification. Les
points suivants restent donc `non testes` : enumeration USB WebHID avec le
nouveau UF2, appairage PS + Create, reception des rapports Bluetooth, relais
HID gamepad, vibration, lumiere/LEDs et mute micro.

Le flash est manuel uniquement. La procedure est documentee dans le README du
paquet ; un build, une simulation ou une cle Bluetooth memorisee ne constitue
pas une preuve de connexion physique.
