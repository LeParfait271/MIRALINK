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
2. Mettre à jour la version publique du site et la date dans le même commit
   lorsque le dépôt est modifié ; augmenter la version du site de `0.01` à
   chaque commit. La version affichée du firmware est identique à la version
   publique du site et tout changement de version exige un nouveau build
   firmware documenté.
3. Exécuter les contrôles adaptés et conserver les résultats et limites.
4. Vérifier `git diff --check`, l’état Git et le périmètre des fichiers.
5. Créer un seul commit local complet avec toutes les modifications du prompt.
6. Ne jamais créer de commit partiel ni pousser automatiquement.

Les prompts purement conversationnels qui ne modifient pas le dépôt ne créent
pas de commit vide artificiel.

La version publique actuelle du site est `0.33`. Le paquet npm peut représenter
cette même version sous la forme technique `0.33.0`, mais l'application, le
manifeste de livraison, la documentation et le firmware affichent `0.33`.
La source CMake peut employer `0.33.0`, mais la métadonnée du Pico et l'UF2
livré utilisent exactement `0.33`.

Le lot 2.0.0 etend le diagnostic local au schema 4 de 48 octets : derniere
etape Bluetooth en echec, octet de statut et compteurs d'essais/reconnexion.
Ces donnees restent bornees au Pico et a l'ordinateur ; aucune adresse radio,
aucun numero de serie et aucune donnee de session n'est exporte.

La file de sortie considere un rapport accepte par l'API BTstack comme « en
vol » pendant une courte fenetre bornee, car BTstack ne fournit pas a MiraLink
un evenement de fin d'envoi HID. Un rapport concurrent est conserve en attente
ou refuse proprement, puis le comportement doit etre confirme avec un Pico 2 W
reel. L'audio conserve au plus un rapport encode en RAM, valide sa structure
fixe et abandonne le rapport s'il devient obsolete apres une perte de liaison.

## État de référence

- Développeur : `MaruChiwa`.
- Cible matérielle : Raspberry Pi Pico 2 W uniquement.
- Données : locales à l’ordinateur et au Pico 2 W.
- Publication : uniquement après autorisation explicite.
- Les artefacts generes par Codex hors de `C:\MIRALINK\MIRALINK` sont verifies puis
  supprimes en fin de tache lorsque l'utilisateur l'a demande ; les fichiers
  preexistants ou appartenant a l'utilisateur ne sont pas supprimes.

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

Un correctif de découverte WebHID qui ne modifie que l'application peut ajouter
le VID/PID MiraLink au filtre du navigateur sans exiger un nouveau flash si le
firmware installé expose déjà cette identité. L'énumération Windows du Pico,
la sélection WebHID et l'appairage DualSense doivent rester consignés comme
trois preuves séparées.

Les rapports DualSense doivent être décodés avec leurs offsets documentés :
l'octet de séquence précède les trois groupes de boutons et ne peut pas être
traité comme un bouton. Les données de batterie, mouvement, tactile et audio
de statut ne sont exposées qu'après validation d'un rapport complet.

Les sorties vers une manette doivent utiliser des commandes MiraLink bornées.
Le seul chemin de compatibilité de jeu supplémentaire est un corps de rapport
de sortie DualSense fixe de 47 octets, vérifié avant d’être enveloppé par
MiraLink ; aucun tampon HID arbitraire n’est accepté. Une vibration est
temporaire, plafonnée à 3000 ms, et sa commande d’arrêt neutre reste locale.
La file BTstack est bornée et vidée lors d’une déconnexion ; un build réussi ou
un test synthétique ne vaut pas une preuve de retour haptique sur une manette
réelle.

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

Le lot firmware 1.9.0 ajoute l’entrée UAC2 locale 4 canaux à 48 kHz/16 bits,
un tampon audio RAM borné et un rapport HID audio DualSense fixe `0x36` de
398 octets. Les deux premiers canaux sont encodés en Opus stéréo pour la
sortie haut-parleur et les deux autres sont réduits en canaux haptiques 3 kHz.
Aucun transport A2DP/SBC n’est utilisé. Le statut exposé à l’application ne
passe à « liaison disponible » qu’après un rapport HID DualSense valide et
« flux actif » exige un rapport audio effectivement accepté par BTstack. Cette
implémentation logicielle ne remplace pas la validation d’une DualSense réelle.

Le chemin de sortie contrôleur 1.9.0 accepte un corps USB DualSense fixe de
47 octets via `SET_CONTROLLER_OUTPUT` ou le rapport HID de sortie id `0x11`.
MiraLink recalcule l’en-tête Bluetooth et le CRC ; le chemin ne permet pas
d’injecter une trame HID arbitraire.

Pour le lot firmware 1.7.0, la persistance des clés Bluetooth est celle du SDK
Pico déjà initialisée par `cyw43_arch_init()` ; aucune seconde instance de
stockage ne doit être créée. La séparation entre cette banque et les secteurs
de configuration MiraLink est vérifiée à la compilation. Une liaison HID qui
ne produit aucun rapport valide est fermée après un délai borné, puis repasse
par la reconnexion locale. Cette preuve de build ne remplace pas le test sur
un Pico 2 W et une DualSense réels.

Le chemin d’appairage Bluetooth classique peut répondre `0000` uniquement dans
la fenêtre locale explicitement ouverte ou pour une adresse déjà mémorisée.

Le candidat firmware 2.2.0 est un lot de récupération USB HID-only. Il retire
l’interface UAC2 du descripteur actif après l’observation locale d’un Code 10
Windows sur les enfants audio et HID du composite 2.0.0. La preuve de build,
la preuve du descripteur et la preuve de l’échange sur la carte flashée restent
trois preuves séparées ; l’audio USB doit rester indisponible dans l’application
tant qu’un Pico 2 W réel n’a pas énuméré l’interface correspondante sans erreur.

Le correctif firmware 2.3.0 impose que chaque identifiant de rapport HID soit
unique dans le descripteur complet, quel que soit son type (feature, input ou
output). Une collision de rapport est un risque d’énumération Windows : un
build et une inspection statique ne valent pas confirmation matérielle. Toute
release qui modifie le descripteur doit documenter ses IDs et être testée
manuellement sur un Pico 2 W avant d’être annoncée fonctionnelle.

Le candidat firmware 2.4.0 réintroduit une fonction USB UAC2 standard dans le
composite sans fusionner les canaux HID : quatre canaux de lecture 48 kHz / PCM
16 bits, un canal de capture mono local, une horloge fixe, des contrôles
mute/volume et des endpoints distincts. La capture est un monitor local de la
lecture, pas un microphone DualSense. Chaque contrôle UAC2 est borné et le
buffer reste en RAM. Un build et l'inspection UF2 ne remplacent ni
l’énumération Windows, ni un test audio/haptique/gâchette sur Pico 2 W et
DualSense réels.

Si un dossier de build a été configuré avec `PICO_NO_PICOTOOL=1`, un ancien
fichier UF2 peut rester présent alors que l'ELF vient d'être recompilé. Avant
toute livraison locale, régénérer alors explicitement l'UF2 depuis cet ELF avec
le picotool local, inspecter sa version embarquée, sa famille RP2350 et son
type ARM Secure, puis calculer son SHA-256. La simple date d'un fichier UF2 ne
constitue pas une preuve de fraîcheur.

L'option de réveil USB du candidat 2.4.0 ne peut être demandée qu'après une
entrée manette validée, avec l'option locale active et l'autorisation de
l'hôte USB. Elle ne doit jamais être décrite comme testée avant un essai
physique de veille/réveil sur le Pico 2 W réel.

Le build firmware 0.33 applique les réglages persistants qui peuvent être
mis en oeuvre sans prétendre à une preuve matérielle : volume haut-parleur et
monitor, gain haut-parleur borné, réduction de gâchettes dans le corps de
sortie fixe, suspension locale d'inactivité, numéro de série USB optionnel et
GPIO d'état limité aux broches `0..22`. La configuration d'un GPIO doit rester
confirmée par l'utilisateur ; elle ne vaut jamais preuve de sécurité électrique
sans le circuit réel. La capture UAC2 reste un monitor local, pas un micro
DualSense, tant qu'une route contrôleur distincte n'a pas été implémentée et
testée.

Les actions de l’espace Manettes doivent être réellement reliées à l’interface
et rester locales : Calibration analyse les échantillons déjà reçus, Quick
tests ne fait aucune écriture et History conserve des snapshots par manette.
Un snapshot restauré est un brouillon local ; il ne vaut pas une calibration
flashée. Les vibrations, l’audio et les gâchettes adaptatives doivent rester
« non testés » tant qu’une sortie physique correspondante n’a pas été vérifiée.

Le build statique doit rester reproductible depuis un clone Git propre. Le
dossier `app/assets` est optionnel pour l'interface actuelle, mais il conserve
un marqueur suivi par Git lorsqu'il est vide afin que la copie vers `app/dist`
ne provoque pas d'erreur `ENOENT` sur Cloudflare Pages.
