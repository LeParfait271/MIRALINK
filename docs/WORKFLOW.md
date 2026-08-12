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

La reconnexion Bluetooth automatique doit utiliser uniquement la base locale de
clés BTstack, rester bornée, ne jamais exporter les adresses radio et ne jamais
transformer une adresse connue en preuve de connexion matérielle.

La collection HID gamepad standard et le canal vendor MiraLink doivent rester
séparés ; un rapport gamepad ne peut être envoyé qu'après validation d'un
rapport DualSense, et toute déconnexion doit remettre les boutons à zéro.

Les rapports DualSense doivent être décodés avec leurs offsets documentés :
l'octet de séquence précède les trois groupes de boutons et ne peut pas être
traité comme un bouton. Les données de batterie, mouvement, tactile et audio
de statut ne sont exposées qu'après validation d'un rapport complet.

Les sorties vers une manette doivent utiliser des commandes MiraLink bornées,
jamais un rapport HID brut. Une vibration est temporaire, plafonnée à 3000 ms,
et sa commande d'arrêt neutre reste locale. La file BTstack est bornée et
vidée lors d'une déconnexion ; un build réussi ou un test synthétique ne vaut
pas une preuve de retour haptique sur une manette réelle.

La version 1.7.0 ne conserve aucun chemin d’effet de gâchette adaptative non
exposé ou non validé. Toute nouvelle sortie doit d’abord avoir une commande
typée, une capacité négociée, des limites documentées et un test matériel
distinct avant de pouvoir être annoncée comme supportée.

Le lot firmware 1.8.0 vise la parité fonctionnelle complète avec les fonctions
observables du firmware de référence, sans reprendre son code, son binaire,
son protocole propriétaire ou ses structures internes. La comparaison porte
sur les résultats utilisateur et les états vérifiables ; une capacité qui ne
peut pas être réalisée sur le Pico 2 W reste indisponible et clairement
signalée.

Pour le lot firmware 1.7.0, la persistance des clés Bluetooth est celle du SDK
Pico déjà initialisée par `cyw43_arch_init()` ; aucune seconde instance de
stockage ne doit être créée. La séparation entre cette banque et les secteurs
de configuration MiraLink est vérifiée à la compilation. Une liaison HID qui
ne produit aucun rapport valide est fermée après un délai borné, puis repasse
par la reconnexion locale. Cette preuve de build ne remplace pas le test sur
un Pico 2 W et une DualSense réels.

Le chemin d’appairage Bluetooth classique peut répondre `0000` uniquement dans
la fenêtre locale explicitement ouverte ou pour une adresse déjà mémorisée.
