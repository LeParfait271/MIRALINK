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
- Demander confirmation avant une action dangereuse, un flash, un push ou une publication.

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
