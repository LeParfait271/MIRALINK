# MiraLink — Workflow obligatoire

Ce document complète `MIRALINK_GARDE_FOU.md`. Le garde-fou reste la source
prioritaire pour les règles de sécurité et les décisions explicites de
l’utilisateur.

## Avant chaque prompt de travail

1. Relire entièrement `MIRALINK_GARDE_FOU.md`.
2. Vérifier que le dépôt actif est exactement `C:\MIRALINK\MIRALINK`.
3. Inspecter l’état Git et repérer les modifications d’une autre conversation.
4. Définir le périmètre du prompt avant toute écriture.
5. Préserver les fichiers visuels travaillés dans une autre conversation.

## Pendant le travail

- Procéder par étapes courtes et vérifiables.
- Ne modifier que les fichiers autorisés par le prompt.
- Ne jamais transformer une simulation ou un build en test matériel déclaré.
- Garder les configurations comparables, restaurables et locales.
- Signaler toute capacité non supportée par le matériel.
- Pour chaque échange HID, distinguer les rapports d’entrée des rapports de
  fonctionnalité et tester la lecture explicite des réponses avec
  `receiveFeatureReport`.
- Pour un rapport HID à identifiant non nul, compter l’octet d’identifiant dans
  le tampon de contrôle USB ; vérifier directement le `SET_FEATURE` et le
  `GET_FEATURE` sur Windows lorsque WebHID signale seulement un périphérique
  non pris en charge.
- Pour chaque déploiement WebHID, vérifier la présence de la politique
  `Permissions-Policy: hid=(self)` et conserver un diagnostic local du contexte.
- Si Cloudflare Pages publie `app/dist/`, vérifier que le build y copie aussi
  `_headers`; si Pages publie `app/` directement, vérifier le fichier source.
- L’ancien UF2 peut uniquement servir de référence observée en lecture seule
  pour les capacités attendues ; ne jamais en extraire ni réutiliser du code,
  du binaire ou une structure interne.
- Demander confirmation avant une action dangereuse, un flash, un push ou une publication.
- Après une correction USB, conserver séparément la preuve du build, du
  descripteur, du paquet UF2 et du test de l’échange sur la carte réellement
  flashée ; un build réussi ne valide pas le binaire déjà installé.

## Clôture de chaque prompt de travail

1. Mettre à jour `MIRALINK_GARDE_FOU.md` et ce workflow si le prompt ajoute une
   règle, une décision, une limite ou une procédure.
2. Mettre à jour la version et la date dans le même commit lorsque le dépôt est
   modifié ; augmenter la version de `0.1` à chaque commit.
3. Exécuter les contrôles adaptés et conserver les résultats et limites.
4. Vérifier `git diff --check`, l’état Git et le périmètre des fichiers.
5. Créer un seul commit local complet avec toutes les modifications du prompt.
6. Ne jamais créer de commit partiel ni pousser automatiquement.

Les prompts purement conversationnels qui ne modifient pas le dépôt ne créent
pas de commit vide artificiel.

## État de référence

- Développeur : `MaruChiwa`.
- Cible matérielle : Raspberry Pi Pico 2 W uniquement.
- Données : locales à l’ordinateur et au Pico 2 W.
- Publication : uniquement après autorisation explicite.

Un nouvel artefact UF2 doit provenir du build MiraLink courant, être inspecté
localement avec son identifiant de famille et être accompagné d'un SHA-256.
Cette génération ne vaut pas test matériel et ne déclenche jamais un flash
automatique.
