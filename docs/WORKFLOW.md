# MiraLink — Workflow obligatoire

Ce document complète `MIRALINK_GARDE_FOU.md`. Le garde-fou reste la source
prioritaire pour les règles de sécurité et les décisions explicites de
l’utilisateur.

## Avant chaque prompt de travail

1. Relire entièrement `MIRALINK_GARDE_FOU.md`.
2. Vérifier que le dépôt actif est exactement `C:\MIRALINK\MIRALINK` sur la
   branche `main`. Le dossier OneDrive
   `C:\Users\kokom\OneDrive\Documents\ChatGPT\MIRALINK` est un contexte
   séparé et reste hors périmètre du firmware.
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
- Pour la persona native courante, vérifier qu'il existe exactement une interface
  HID contenant une seule collection Application racine Gamepad et une
  collection vendor MiraLink imbriquée.
  Inspecter les rapports `0x01`, `0x02`, `0x05`, `0x09`, `0x20`, `0x70` et
  `0x71`, et vérifier que le rapport réservé `0x72` n'est ni déclaré ni émis.
- Vérifier séparément la forme de sortie compacte de 48 octets et la forme
  Linux de 63 octets ; seule la partie commune bornée de 47 octets peut être
  relayée à la manette.
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
- Pour chaque problème firmware, consulter obligatoirement le fichier UF2 officiel
  DS5Dongle `v0.7.2-hotfix` et son code source avant de proposer une cause ou une
  modification. Comparer le comportement concerné, classer OBSERVÉ / INFÉRÉ /
  PROUVÉ, puis écrire la cause probable et le test discriminant. Cette référence
  reste clean-room : aucun code, binaire, protocole interne ou structure n’est
  copié.
- Demander confirmation avant une action dangereuse, un flash ou une publication ; le push Git est autorisé par la règle permanente du 2026-08-14 après un prompt qui modifie MiraLink.
- Après une correction USB, conserver séparément la preuve du build, du
  descripteur, du paquet UF2 et du test de l’échange sur la carte réellement
  flashée ; un build réussi ne valide pas le binaire déjà installé.
- Ne pas lancer les exécutables de tests firmware natifs Windows tant que leur
  runtime LLVM n'est pas empaqueté de façon autonome : les dépendances
  `libc++.dll` et `libunwind.dll` manquantes ouvrent des dialogues système et
  ne constituent pas un résultat de test. Utiliser les assertions pures en
  compilation ARM/syntax-only et le cross-build Pico comme portes logicielles.
- Sérialiser les commandes WebHID par périphérique. Avant chaque écriture,
  revérifier cycle de vie, descripteur et identité MiraLink. Ne jamais renvoyer
  un `SET_REPORT` dont l'issue est ambiguë ; seule la lecture de la réponse
  correspondante peut être reprise de façon bornée.

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
6. Ne jamais créer de commit partiel ; pousser immédiatement le commit complet vers le remote configuré après tout prompt qui modifie le dépôt.

Les prompts purement conversationnels qui ne modifient pas le dépôt ne créent
pas de commit vide artificiel.

La version publique actuelle du site est `0.48`. Le paquet npm peut représenter
cette même version sous la forme technique `0.48.0`, mais l'application, le
manifeste de livraison, la documentation et le firmware affichent `0.48`.
La source CMake peut employer `0.48.0`, mais la métadonnée du Pico et l'UF2
livré utilisent exactement `0.48`.

La correction firmware `0.46` venait d'une comparaison directe avec DS5Dongle
`v0.7.2-hotfix` : la référence réactive le page scan après
`HCI_EVENT_DISCONNECTION_COMPLETE`. MiraLink enregistre désormais cette frontière
dans le callback puis réalise la transition `0 -> 1` depuis le polling foreground.
La découvrabilité reste désactivée hors appairage ; l’acceptation d’un appareil
hors fenêtre reste limitée aux adresses déjà mémorisées.

La correction firmware `0.48` compare aussi la découvrabilité de reconnexion
à DS5Dongle, en plus de l'échec d'authentification HCI
au chemin DS5Dongle : seule la clé de l'adresse active, déjà connue avant la
tentative et non encore validée par un rapport `0x31`, peut être supprimée.
Une nouvelle association et une liaison déjà validée ne sont jamais effacées
par un timeout ou une fermeture ordinaire.

La release `0.42` conserve l'ouverture automatique pendant cinq minutes de la
fenêtre Bluetooth locale quand la banque de clés BTstack ne contient encore
aucune manette. Le premier appairage peut donc se faire après flash en mettant
la DualSense en mode association, sans connecter le Pico au site. Une manette
déjà mémorisée se reconnecte passivement vers le Pico page-scannable : aucune
tentative `hid_host_connect` automatique ne réserve le seul slot HID-host
BTstack. Les connexions sortantes sont limitées aux résultats d'une inquiry
d'appairage active : automatique seulement si aucune clé n'existe, sinon
ouverte par l'utilisateur. Le page scan est appliqué seulement après
`HCI_STATE_WORKING`, la connectabilité est réarmée après fermeture et la
fenêtre d'appairage se ferme au premier `0x31` complet avec CRC valide.

La release `0.42` expose une persona USB DualSense-family expérimentale sous le
VID Sony `0x054c`, avec PID standard/Auto `0x0ce6` ou Edge `0x0df2`. Cette
compatibilité explicitement autorisée est une implémentation clean-room et ne
constitue ni un firmware Sony, ni une approbation, ni une affiliation. Une
seule interface HID contient une collection Application racine Gamepad et une
collection vendor MiraLink imbriquée ; le
composite UAC2 reste désactivé. Les entrées natives passent par `0x01`, les
sorties bornées par `0x02`, et les commandes de gestion par Feature `0x70` /
`0x71`. La réponse `0x71` reste relisible jusqu'au prochain rapport de commande
MiraLink produisant une réponse de succès ou d'erreur.
L'état contrôleur est interrogé par un cycle récursif toutes les 100 ms, avec
recul borné après erreur ; `0x72` n'est pas
exposé. Un build ou un UF2 ne vaut pas preuve d'énumération, d'échange WebHID,
de flash ou de fonctionnement sur matériel réel.

Le test Windows de la `0.36` a affiché deux entrées `DualSense` dans `joy.cpl`;
les deux ont disparu au débranchement du Pico. Cette preuve invalide la
topologie à deux collections Application racines. Le test manuel suivant de la
`0.37` a affiché exactement une entrée, y compris après redémarrage : la
correction de topologie USB est donc partiellement validée sur Windows.
Cependant aucun bouton ni joystick n'a réagi dans les propriétés du contrôleur.
Aucun paquet Bluetooth n'a été capturé pendant ce test. L'analyse source a
identifié un verrou compatible avec le résultat : MiraLink n'acceptait que le
rapport enrichi `0x31`, une DualSense peut commencer par le rapport minimal
`0x01`, et le pont ne lançait pas la séquence Feature d'activation. L'entrée,
les sorties et la reconnexion ne sont donc pas validées par le test `0.37`.

La `0.37` remplace aussi le contexte CYW43 `threadsafe_background` par le
contexte polling du SDK. La boucle principale exécute `tud_task()`, puis
`cyw43_arch_poll()`, puis les machines d'état audio/Bluetooth ; aucun appel
BTstack de premier plan ne doit concurrencer un callback BTstack en IRQ.

La `0.38` ajoute, après validation du descripteur HID Bluetooth, un amorçage
asynchrone borné des Feature reports `0x05` → `0x09` → `0x20`, puis un
fallback de sortie neutre borné si le flux enrichi ne démarre pas. Un seul
échange est en vol et les états busy/not-ready ou timeouts restent pilotés
par la machine d'état. Le rapport simple `0x01` ne prouve que la vivacité de la
liaison; seul un rapport `0x31` complet, de longueur stricte et CRC valide peut
déclarer `Connected`, alimenter les entrées et mémoriser une nouvelle manette.
Le candidat compilé sérialise aussi les appels de sortie/BTstack concernés via
un patch source généré au build. Chaque propriété reste à vérifier par un flash
manuel `0.38` et une observation physique.

Le test matériel `0.38` a confirmé une seule manette Windows, les
boutons/sticks dans `joy.cpl` et un commit de configuration. Le test `0.39` a
confirmé l'appairage initial, un échantillon au test rapide, le Controller Lab,
les diagnostics et la lecture de configuration. Après extinction de la manette, la reconnexion par clé connue a
échoué et un nouvel appairage a été nécessaire. Le candidat `0.40` corrige la
politique de reconnexion comme décrit ci-dessus, mais cette correction n'est
pas une preuve matérielle avant flash et cycles réels extinction/rallumage,
redémarrage Pico et pertes brutales de liaison.

L'application `0.42` regroupe connexion WebHID, état suivant, diagnostics,
profils locaux, inspection UF2 et reprise hors ligne dans une interface
high-tech originale en page continue. La barre de sections est une navigation
d'ancrage réelle : chaque action doit faire défiler vers sa zone visible et
indiquer la position active, sans masquer le contenu comme des onglets. La
cible produit est le navigateur de bureau. Avant livraison, tester au minimum
le parcours desktop, les sept destinations, le clavier, l'accessibilité, un
bridge WebHID simulé et un rechargement hors ligne à froid. Ces contrôles sont
une preuve logicielle, jamais un test du Pico réel.

Toutes les transactions WebHID `0.42` passent par une FIFO annulable par
périphérique. Une déconnexion annule les opérations obsolètes ; la récupération
contrôlée referme/réouvre le périphérique puis exige un nouveau `HELLO` strict.
Un échec de lecture `0x71` peut relire la réponse au plus de façon bornée, sans
renvoyer la commande. Pour `RECONNECT_USB`, l'application attend la disparition
USB réelle même si la lecture de l'ACK a échoué ; en l'absence de disparition,
elle reprend le polling et affiche l'erreur sans réémission.

Le test matériel de la `0.40` a confirmé, après redémarrage du Pico, que le
bridge pouvait être reconnecté manuellement par WebHID (`USB PASS`) et que la
radio était prête (`Radio PASS`), mais l'écran signalait `DualSense connue ·
non connectée` sans nouvelle fenêtre d'appairage. La reconnexion passive échoue
donc encore après extinction de la manette et après redémarrage du Pico.
L'inspection de BTstack montre que `gap_connectable_control(1)` peut être un
no-op lorsque son indicateur logiciel est déjà vrai alors que le contrôleur a
désactivé le page scan. Le lot `0.41` reporte le réarmement hors callback,
réapplique les paramètres de page scan et force une transition `0 → 1` ; cette
correction doit rester non validée jusqu'au prochain flash manuel.

Le lot `0.42` conserve cette politique et traite aussi la reprise depuis la
suspension locale d'inactivite. Lorsqu'un commit de configuration reactive la
radio, il ne doit pas appeler directement les commandes BTstack depuis le
callback USB : il pose une demande de rearmement, puis le polling foreground
reapplique les parametres et la transition `0 -> 1`. Ce chemin reste non
valide sur materiel ; le test discriminant doit d'abord provoquer la veille
locale, modifier le delai, puis verifier une reconnexion PS sans appairage.

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
- Publication applicative : uniquement après autorisation explicite ; le push Git de clôture est régi par l'autorisation permanente du 2026-08-14.
- Les artefacts générés par Codex hors de `C:\Users\MC\MIRALINK` sont vérifiés puis
  supprimes en fin de tache lorsque l'utilisateur l'a demande ; les fichiers
  preexistants ou appartenant a l'utilisateur ne sont pas supprimes.

Un nouvel artefact UF2 doit provenir du build MiraLink courant, être inspecté
localement avec son identifiant de famille et être accompagné d'un SHA-256.
Cette génération ne vaut pas test matériel et ne déclenche jamais un flash
automatique.

La reconnexion Bluetooth automatique doit utiliser uniquement la base locale de
clés BTstack, rester bornée, ne jamais exporter les adresses radio et ne jamais
transformer une adresse connue en preuve de connexion matérielle.

La collection HID Gamepad doit rester l'unique collection Application racine
de l'interface HID ; la collection vendor MiraLink est imbriquée sous cette
racine afin que Windows ne crée pas un second enfant contrôleur ;
un rapport gamepad ne peut être envoyé qu'après validation d'un rapport
DualSense, et toute déconnexion doit remettre les boutons à zéro.

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

Le chemin de sortie contrôleur courant accepte un corps USB DualSense fixe de
47 octets via `SET_CONTROLLER_OUTPUT` ou le rapport HID natif `0x02`. Le host
peut fournir la forme compacte de 48 octets ou la forme Linux de 63 octets ;
MiraLink ne relaie que le corps commun borné, recalcule l’en-tête Bluetooth et
le CRC, et ne permet pas d’injecter une trame HID arbitraire.

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

Le build firmware 0.40 applique les réglages persistants qui peuvent être
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

## Comparaison firmware de fin de lot

Après toute modification du firmware, mettre à jour et présenter un tableau
court comparant le candidat courant à DS5Dongle `v0.7.2-hotfix`, dont chaque
catégorie de référence vaut `100 %`. Le tableau doit couvrir au minimum la
persona USB, Bluetooth, les entrées, les sorties, l'audio/haptique/microphone
et la gestion/diagnostic, puis fournir un score global pondéré. La pondération
et les pénalités d'absence de preuve matérielle doivent être visibles et
reproductibles. Une capacité inactive ou seulement présente dans le source ne
peut pas être comptée comme fonctionnelle. Un score supérieur à `100 %` est
réservé à une capacité MiraLink supplémentaire démontrée. Afficher le ratio de
taille UF2 sur une ligne distincte, sans l'intégrer au score qualité.
