# MiraLink 1.6.0 - validation locale

Date de verification : 2026-08-12

## Corrections validees hors materiel

- Le firmware est reconstruit depuis les sources MiraLink independantes pour
  la cible `pico2_w` / `rp2350-arm-s`.
- La demande PIN Bluetooth classique `0000` est acceptee uniquement pendant
  la fenetre d'appairage locale ou pour une adresse deja memorisee.
- Le callback HID accepte les deux formes equivalentes observees cote hote :
  64 octets de donnees apres retrait de l'identifiant, ou 65 octets avec
  l'identifiant `2` en tete ; les tailles invalides restent rejetees.
- Les tests JavaScript, les tests C++ natifs et le build ARM Pico 2 W passent.
- Le paquet local 1.6.0 contient les artefacts issus du meme build et leurs
  empreintes SHA-256.

## Resultats de cette verification

- Tests JavaScript : 60/60 passants.
- Tests C++ natifs Debug : `MiraLink core tests passed`.
- Build Pico 2 W Release : termine avec succes.
- UF2 : 874496 octets, version `1.6.0` confirmee par picotool.
- SHA-256 UF2 : `7E815731D10D445ED6E175E98575D824B5BF1C6A3CB0F5A2F0B44446754E0909`.
- Controle de format : `git diff --check` requis avant commit.

## Limite obligatoire

Aucun resultat de ce document ne constitue un test materiel. Le Pico 2 W
observe avant ce build expose encore l'identite USB de developpement et
retournait l'erreur Windows 31 aux commandes HID de configuration ; il n'a
pas ete flashe automatiquement. La connexion USB WebHID, l'appairage PS +
Create, les rapports DualSense, le relais gamepad et les sorties reelles
restent `non testes` jusqu'au flash manuel puis a l'essai avec le materiel.

## Procedure de validation physique a effectuer

1. Flasher manuellement `firmware/releases/1.6.0/miralink_pico_firmware.uf2`
   en mode BOOTSEL.
2. Rebrancher le Pico, ouvrir MiraLink dans Chrome ou Edge, puis verifier que
   le bridge est reconnu sans `Unsupported HID device`.
3. Ouvrir la fenetre d'appairage depuis MiraLink et mettre la DualSense en
   mode `PS + Create`.
4. Verifier la reception des entrees, puis tester separement vibration,
   barre lumineuse, LEDs joueur et mute micro.
5. Refaire un diagnostic apres deconnexion et reconnexion ; toute fonction
   non observee doit rester marquee `non testee` ou `indisponible`.
