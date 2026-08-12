# MiraLink — étude des fonctionnalités et roadmap

Document de conception local. Il ne constitue pas une promesse de support matériel.

- Produit : MiraLink
- Développeur : MaruChiwa
- Cible matérielle : Raspberry Pi Pico 2 W uniquement
- Politique : local uniquement, sans télémétrie, cloud, synchronisation ou publication
- État du document : roadmap active, socle local partiellement implémenté
- Version produit concernée : 0.6.0
- Date : 2026-08-12

## 1. Décisions transversales

### 1.1 Modèle de capacité

Chaque bridge, manette et fonction expose un état explicite :

- `supporté` : la capacité a été négociée et son chemin est disponible ;
- `partiel` : une partie du comportement est disponible ;
- `indisponible` : le matériel ou le firmware ne permet pas l’action ;
- `non testé` : le code existe mais aucun matériel réel n’a encore validé le comportement.

L’interface ne transforme jamais `non testé` en `supporté`. Le mode simulation porte une mention permanente `MODE SIMULATION` et ne modifie pas le statut des tests matériels.

### 1.2 Données locales

Les données sont réparties en quatre catégories :

1. état instantané en mémoire, supprimable à la fermeture ;
2. préférences et brouillons locaux ;
3. historiques locaux contrôlés par une durée et une taille maximale ;
4. exports JSON documentés, versionnés, masqués par défaut et déclenchés par l’utilisateur.

Les numéros de série, adresses radio, identifiants USB et identifiants de session sont masqués par défaut. Un export ne contient jamais d’identifiant sensible sans action locale explicite.

### 1.3 Écriture et confirmation

Une lecture peut être automatique. Une écriture persistante ne l’est jamais par défaut :

1. lecture de l’état ;
2. brouillon local ;
3. aperçu lisible des changements ;
4. confirmation de la cible et de l’action ;
5. écriture ;
6. relecture et vérification ;
7. entrée dans l’historique local.

Les actions qui peuvent couper une liaison, modifier le firmware, réinitialiser une configuration ou déclencher une vibration nécessitent une confirmation distincte.

### 1.4 Contrat de protocole proposé et tranche 0.6.0

Les commandes suivantes sont des propositions et ne doivent pas être ajoutées au firmware avant validation du modèle de données :

| Groupe | Commandes proposées | Rôle |
|---|---|---|
| Capacités | `GET_CAPABILITIES` | Négocier les fonctions et leurs états |
| État | `GET_LIVE_STATUS`, `GET_METRICS_PAGE` | Obtenir un instantané ou une page de mesures locales |
| Profils | `GET_PROFILE_LIST`, `GET_PROFILE`, `SET_PROFILE_DRAFT`, `APPLY_PROFILE`, `DELETE_PROFILE` | Gérer des profils et leur application confirmée |
| Lab | `GET_INPUT_SAMPLE`, `START_CALIBRATION`, `SET_CALIBRATION_DRAFT`, `COMMIT_CALIBRATION`, `RESTORE_CALIBRATION` | Échantillonnage et calibration |
| Haptique | `GET_HAPTIC_CAPABILITIES`, `TEST_HAPTIC`, `SET_HAPTIC_DRAFT`, `COMMIT_HAPTIC` | Tester ou persister un pattern borné |
| Gâchettes | `GET_TRIGGER_CAPABILITIES`, `TEST_TRIGGER`, `SET_TRIGGER_DRAFT`, `COMMIT_TRIGGER` | Courbes et limites réellement disponibles |
| Session | `START_LOCAL_SESSION`, `STOP_LOCAL_SESSION`, `GET_SESSION_PAGE` | Tampon temporaire local, jamais envoyé ailleurs |
| Diagnostic | `GET_DIAGNOSTIC_CAPABILITIES`, `RUN_DIAGNOSTIC_STEP`, `GET_DIAGNOSTIC_REPORT` | Parcours borné et résultat explicite |
| Firmware | `GET_FIRMWARE_IDENTITY`, `GET_UPDATE_STATUS`, `ENTER_RECOVERY` | Inspection et récupération, jamais flash automatique |
| Historique | `GET_CONFIG_HISTORY_PAGE`, `RESTORE_CONFIG_REVISION` | Historique local ou révision persistée, après confirmation |

Chaque commande doit être bornée en taille, associée à une capacité, protégée par séquence/CRC, rejetée si non supportée et testée contre les paquets malformés. Les commandes de configuration restent distinctes des commandes de test.

La tranche 0.6.0 implémente déjà `GET_CONTROLLER_STATE` et `OPEN_PAIRING_WINDOW`.
Le Pico 2 W héberge le transport Bluetooth Classic HID DualSense en entrée,
publie des événements de contrôleur sur USB et garde la découvrabilité fermée
au démarrage. L’ouverture de la fenêtre d’appairage reste une action locale
confirmée ; le branchement au bouton visible est laissé à la conversation qui
travaille sur le visuel.

### 1.5 Limites Pico 2 W

Le Pico 2 W est un bridge et une cible de configuration ; il ne suffit pas à lui seul à fournir toutes les mesures demandées. Les valeurs radio, audio, température, batterie et mémoire doivent être exposées seulement si le firmware possède une source de mesure fiable. Sinon, l’interface doit indiquer `indisponible` ou `non testé`.

Une manette peut fournir certaines informations par ses rapports, mais MiraLink ne doit pas inventer une température, une batterie, une latence radio ou un état adaptatif à partir d’une simple présence USB.

## 2. Classement global

### Priorité haute — MVP réellement utilisable

1. Mode simulation et scénarios contrôlés.
2. Profils intelligents, avec aperçu et confirmation.
3. Profils individuels par manette.
4. Socle de capacités et états supporté/partiel/indisponible/non testé.
5. Carte des connexions de base.
6. Centre d’accessibilité fondamental.
7. Sauvegarde, comparaison et restauration des configurations.

Ces éléments rendent l’application utilisable sans matériel, sûrs avec un Pico 2 W réel et structurent les lots suivants.

### Priorité moyenne — valeur forte après le socle

1. Controller Lab.
2. Cockpit de supervision en direct.
3. Assistant de diagnostic guidé.
4. Studio haptique.
5. Réglages avancés des gâchettes, seulement selon les capacités négociées.
6. Centre firmware sécurisé.
7. Enregistrement local de sessions.

### Idées à long terme

1. Historique visuel complet et diff entre révisions.
2. Automatisations locales.
3. Pack de maintenance portable.
4. Comparaison avancée de sessions.
5. Scénarios de simulation composables et reproductibles.
6. Profils par jeu avec import manuel de règles locales, sans détection cloud.

Le classement peut changer après les premiers essais avec un Pico 2 W et une DualSense réels. Il ne change pas la cible matérielle.

## 3. Fiches fonctionnelles

### 3.1 Mode simulation — priorité haute

**Valeur utilisateur.** Permet de découvrir l’interface, de tester les profils, de rejouer des erreurs et de valider les parcours sans Pico 2 W ni manette.

**Écrans.** Sélecteur global de simulation ; Overview ; carte des connexions ; profils ; Controller Lab ; diagnostics ; cockpit ; bandeau permanent `MODE SIMULATION`.

**Données stockées.** Scénario actif, horodatage local, états générés, éventuel seed de reproduction, préférences d’affichage. Aucun identifiant réel.

**Protocole.** Aucun protocole matériel obligatoire. Le simulateur implémente le même contrat d’adaptateur que le matériel et peut produire des réponses synthétiques au format MiraLink.

**Dépendances.** Application seule pour le premier lot ; firmware non nécessaire.

**Risques.** Confusion entre simulation et test réel. Le bandeau, les badges d’état et les exports doivent porter le statut de simulation.

**Tests.** Scénarios connexion, erreur, déconnexion, batterie faible, perte de paquets et configuration invalide ; vérification que le mode ne crée jamais une affirmation de test matériel.

**Difficulté.** Moyenne.

### 3.2 Profils intelligents — priorité haute

**Valeur utilisateur.** Change rapidement un ensemble cohérent de réglages sans perdre le contrôle de ce qui sera écrit.

**Profils initiaux.** `Compétitif`, `Basique` et `Économie`. Compétitif privilégie la latence minimale et les performances maximales ; Basique privilégie la fiabilité ; sous 10 % de batterie, Basique peut proposer le passage vers Économie, tandis que Compétitif reste protégé.

**Écrans.** Galerie de profils ; détail et éditeur ; aperçu des changements ; choix de cible `bridge` ou manette individuelle ; confirmation ; résultat et restauration.

**Données stockées.** Identifiant de profil, nom, description, cible, schéma, valeurs connues, champs inconnus préservés quand possible, dernière application, source et historique local.

**Protocole.** `GET_PROFILE_LIST`, `GET_PROFILE`, `SET_PROFILE_DRAFT`, `APPLY_PROFILE`, éventuellement `COMMIT_CONFIG` existant pour le bridge.

**Dépendances.** Stockage local de l’application ; configuration flash du Pico 2 W pour la persistance bridge ; adaptateur manette pour les champs individuels. Le moteur de profils local est en place ; son intégration à l’interface reste à faire.

**Risques.** Écrasement d’un réglage ou application à la mauvaise manette. La cible, le diff et la confirmation sont obligatoires ; les profils non compatibles sont refusés.

**Tests.** Diff exact, annulation, application à la bonne cible, refus d’une capacité absente, conservation des champs inconnus, reprise après déconnexion.

**Difficulté.** Moyenne.

### 3.3 Profils individuels par manette — priorité haute

**Valeur utilisateur.** Évite de mélanger calibration, préférences et presets entre plusieurs appareils similaires.

**Écrans.** Registre des manettes ; fiche par manette ; renommage ; calibration ; préférences ; historique ; masquage d’identifiants.

**Données stockées.** Identifiant local stable dérivé et masqué, famille, nom choisi, préférences, calibrations, presets, historique et statut de confiance. L’adresse et le numéro de série restent optionnels et masqués.

**Protocole.** Pas forcément de commande dédiée au début ; les commandes de calibration et de profil sont ciblées par un identifiant de session local. Le firmware ne reçoit que ce qui est nécessaire.

**Dépendances.** Adapters DualSense, DualShock 4, DualSense Edge et PS VR2 Sense ; stockage local.

**Risques.** Ré-identification par combinaison d’attributs. Minimisation, masquage par défaut, suppression locale et export contrôlé.

**Tests.** Deux appareils proches, renommage, suppression, export masqué, remplacement de manette, changement de connexion.

**Difficulté.** Moyenne.

### 3.4 Carte des connexions — priorité haute

**Valeur utilisateur.** Rend immédiatement visible le chemin ordinateur → Pico 2 W → manette et l’endroit exact d’une panne.

**Écrans.** Vue principale avec nœuds, transports, états, erreurs et reconnexions ; détail d’une liaison ; vue textuelle accessible équivalente.

**Données stockées.** Préférences de mise en page, événements locaux récents et erreurs redacted ; pas de flux permanent obligatoire.

**Protocole.** `GET_CAPABILITIES`, `GET_LIVE_STATUS`, événements locaux de connexion ; `GET_DIAGNOSTICS` existant pour le premier niveau.

**Dépendances.** Découverte WebHID, identification du Pico 2 W, adapters manettes.

**Risques.** Afficher une liaison comme active alors qu’elle n’est que découverte. Utiliser les états explicites et la date du dernier échantillon.

**Tests.** Connexion, déconnexion, reconnexion, périphérique inconnu, transport indisponible, mode simulation.

**Difficulté.** Faible à moyenne.

### 3.5 Centre d’accessibilité — priorité haute

**Valeur utilisateur.** Rend MiraLink utilisable par davantage de personnes et améliore la fiabilité générale.

**Écrans.** Panneau accessibilité global : contrôles grands, contraste renforcé, daltonisme, clavier, interface simplifiée, réduction des animations ; labels et annonces dans chaque écran.

**Données stockées.** Préférences locales uniquement.

**Protocole.** Aucune commande matérielle.

**Dépendances.** HTML sémantique, focus management, live regions, palettes redondantes par forme/texte.

**Risques.** Le néon ne doit pas dégrader le contraste ou communiquer une information par la couleur seule.

**Tests.** Clavier complet, focus visible, zoom, lecteur d’écran, contraste, daltonisme, réduction de mouvement, simulation.

**Difficulté.** Moyenne.

### 3.6 Controller Lab — priorité moyenne

**Valeur utilisateur.** Diagnostique les sticks et gâchettes avec des mesures compréhensibles et permet de comparer avant/après.

**Écrans.** Vue X/Y des sticks ; jauges gâchettes ; mesures de dérive, zone morte, amplitude, circularité et asymétrie ; calibration ; comparaison ; historique/restauration.

**Données stockées.** Échantillons en mémoire par défaut ; résumé de calibration et versions restaurables localement après confirmation.

**Protocole.** `GET_INPUT_SAMPLE`, `START_CALIBRATION`, `SET_CALIBRATION_DRAFT`, `COMMIT_CALIBRATION`, `RESTORE_CALIBRATION`.

**Dépendances.** Rapports réels des manettes et modèle de calibration par famille ; le Pico 2 W doit seulement relayer ou appliquer ce qu’il sait réellement faire.

**Risques.** Mauvaise calibration ou interprétation d’un axe. Bornes, validation, aperçu et retour arrière ; aucune calibration persistante automatique.

**Tests.** Fixtures de rapports, axes centrés, dérive artificielle, valeurs hors plage, interruption, comparaison et restauration ; tests réels séparés.

**Difficulté.** Élevée.

### 3.7 Cockpit de supervision en direct — priorité moyenne

**Valeur utilisateur.** Donne un état opérationnel lisible sans obliger à parcourir plusieurs onglets.

**Écrans.** Cockpit avec cartes de latence USB/radio, pertes de paquets, batterie, température, connexion, audio, microphone, vibration et mémoire flash ; graphiques courts et lisibles ; dernier échantillon et statut de disponibilité.

**Données stockées.** Tampons de courte durée en mémoire ; rétention locale optionnelle et bornée si l’utilisateur l’active.

**Protocole.** `GET_LIVE_STATUS`, `GET_METRICS_PAGE`, éventuellement événements de statut. Chaque métrique doit avoir une source et un statut de confiance.

**Dépendances.** Compteurs mesurés par firmware ou par adapter. La température et la batterie ne sont pas garanties par le Pico 2 W seul.

**Risques.** Glissement vers de la télémétrie ou affichage de fausses mesures. Rétention par défaut nulle/ courte, aucune sortie réseau, marqueur `indisponible`.

**Tests.** Calculs de moyenne et perte, trous de données, horloge, déconnexion, limites, absence de capteur, mode simulation.

**Difficulté.** Élevée.

### 3.8 Assistant de diagnostic guidé — priorité moyenne

**Valeur utilisateur.** Transforme un problème vague en parcours sûr et rapport exploitable.

**Écrans.** Sélection du problème ; étapes ; résultat `réussi`, `échoué`, `indisponible`, `non testé` ; cause probable ; action proposée ; récupération ; rapport local.

**Données stockées.** Étapes, résultats, versions, horodatages locaux et données minimisées ; rapport exportable seulement sur action.

**Protocole.** `GET_DIAGNOSTIC_CAPABILITIES`, `RUN_DIAGNOSTIC_STEP`, `GET_DIAGNOSTIC_REPORT`, plus les lectures existantes.

**Dépendances.** Modèle de diagnostic local ; commandes firmware sûres et non destructives en premier.

**Risques.** Présenter une hypothèse comme une certitude ou déclencher une action dangereuse. Séparer cause probable, preuve observée et action ; confirmer reconnexion/récupération.

**Tests.** Chaque branche et chaque état indisponible ; rapport sans identifiants ; interruption ; absence de matériel ; scénario simulé.

**Difficulté.** Moyenne à élevée.

### 3.9 Studio haptique — priorité moyenne

**Valeur utilisateur.** Permet de concevoir et tester des vibrations de manière contrôlée.

**Écrans.** Bibliothèque de presets ; éditeur de pattern ; intensité, durée, répétition ; test limité ; aperçu ; bouton d’enregistrement explicite.

**Données stockées.** Presets nommés et versions locales ; aucun pattern permanent sans confirmation ; historique des changements.

**Protocole.** `GET_HAPTIC_CAPABILITIES`, `TEST_HAPTIC`, `SET_HAPTIC_DRAFT`, `COMMIT_HAPTIC`.

**Dépendances.** Support haptique réel de la manette/bridge ; le Pico 2 W doit annoncer les canaux et limites.

**Risques.** Surprise sonore/haptique ou usure inutile ; limites d’intensité, durée, répétitions, bouton stop et confirmation avant persistance.

**Tests.** Bornes, arrêt, répétition, absence de moteur, déconnexion, preset corrompu, simulation.

**Difficulté.** Élevée.

### 3.10 Réglages avancés des gâchettes — priorité moyenne

**Valeur utilisateur.** Adapte le comportement à un usage ou à un jeu, tout en montrant ce que chaque manette supporte vraiment.

**Écrans.** Courbe de résistance ; profils par usage ; test interactif ; limites par appareil ; comparaison avant/après ; restauration.

**Données stockées.** Courbes bornées, profil cible, version de l’adapter, historique local.

**Protocole.** `GET_TRIGGER_CAPABILITIES`, `TEST_TRIGGER`, `SET_TRIGGER_DRAFT`, `COMMIT_TRIGGER`.

**Dépendances.** Gâchettes adaptatives réellement prises en charge par DualSense/DualSense Edge et leur transport ; les autres modèles indiquent `indisponible`.

**Risques.** Échec silencieux ou application d’une courbe non supportée. Validation par capacité, seuils sûrs et confirmation avant écriture.

**Tests.** Courbes monotones, valeurs hors limites, manette sans adaptatif, perte de liaison, simulation.

**Difficulté.** Élevée.

### 3.11 Centre firmware sécurisé — priorité moyenne

**Valeur utilisateur.** Réduit le risque d’utiliser un mauvais UF2 et rend la récupération compréhensible.

**Écrans.** Inspection locale ; comparaison avec l’identité installée ; notes locales ; sauvegarde de configuration ; pré-vol ; vérification après mise à jour ; récupération.

**Données stockées.** Hash, métadonnées UF2, version, notes locales et sauvegarde de configuration ; aucun téléchargement automatique.

**Protocole.** `GET_FIRMWARE_IDENTITY`, `GET_UPDATE_STATUS`, `ENTER_RECOVERY`. Le transfert/flash reste une action manuelle autorisée séparément et n’est jamais déclenché automatiquement.

**Dépendances.** Validateur UF2 local, picotool local, Pico 2 W réel pour la comparaison installée et la vérification.

**Risques.** Mauvais fichier, perte de configuration, récupération incomplète. Refus par cible/version/hash, sauvegarde obligatoire, confirmation forte et résultat vérifié.

**Tests.** UF2 valide/invalide, cible différente, hash, annulation, sauvegarde/restauration, absence de Pico, récupération simulée.

**Difficulté.** Moyenne à élevée.

### 3.12 Enregistrement local de session — priorité moyenne

**Valeur utilisateur.** Aide à comprendre une déconnexion, une latence ou une dérive sans exporter un flux permanent.

**Écrans.** Contrôle d’enregistrement ; durée et taille ; marqueurs ; lecture ; comparaison ; suppression ; export anonymisé.

**Données stockées.** Tampon circulaire des dernières secondes en mémoire par défaut ; fichier local uniquement après activation explicite.

**Protocole.** `START_LOCAL_SESSION`, `STOP_LOCAL_SESSION`, `GET_SESSION_PAGE`; les échantillons sont bornés et jamais transmis à un serveur.

**Dépendances.** Sources d’entrée et de statut ; format local versionné.

**Risques.** Capturer des identifiants ou conserver plus que prévu. Minimisation, rétention configurable, masquage et suppression immédiate.

**Tests.** Taille maximale, arrêt, purge, export masqué, lecture, comparaison, déconnexion et simulation.

**Difficulté.** Moyenne.

### 3.13 Historique visuel — long terme

**Valeur utilisateur.** Comprend qui/quoi/quand a changé la configuration et permet un retour contrôlé.

**Écrans.** Timeline ; diff de deux versions ; détail appareil/date/source ; restauration avec aperçu.

**Données stockées.** Revisions locales, diffs, source `utilisateur`, `import`, `simulation` ou `firmware`, hash et rétention bornée.

**Protocole.** `GET_CONFIG_HISTORY_PAGE`, `RESTORE_CONFIG_REVISION`, ou stockage application seul si l’historique ne doit pas vivre sur le Pico.

**Dépendances.** Schéma de configuration versionné et stockage local robuste.

**Risques.** Exposer un identifiant ou restaurer une ancienne valeur incompatible. Diff lisible, validation actuelle et confirmation.

**Tests.** Révisions, diff, suppression, migration de schéma, restauration échouée et retour arrière.

**Difficulté.** Moyenne.

### 3.14 Automatisations locales — long terme

**Valeur utilisateur.** Réduit les manipulations répétitives tout en restant sous contrôle de l’utilisateur.

**Écrans.** Règles locales ; déclencheur ; aperçu ; journal ; interrupteur global désactivé par défaut ; confirmation pour chaque écriture.

**Données stockées.** Règles, état activé, dernière exécution, résultat et limites de fréquence.

**Protocole.** Réutilise les commandes existantes et les commandes de profils/état ; aucune commande d’écriture silencieuse.

**Dépendances.** Moteur local de règles et notifications de l’application.

**Risques.** Boucle d’écritures ou changement inattendu. Pas d’écriture automatique par défaut, simulation préalable, limite de fréquence et journal visible.

**Tests.** Connexion, reconnexion, batterie faible, conflit de règles, boucle, suppression, désactivation et arrêt d’urgence.

**Difficulté.** Élevée.

### 3.15 Pack de maintenance portable — long terme

**Valeur utilisateur.** Permet de déplacer un état de support entre ordinateurs sans cloud.

**Écrans.** Export guidé ; cases profils/configurations/diagnostics/empreintes ; masquage ; aperçu ; import contrôlé ; comparaison ; refus partiel.

**Données stockées.** Archive locale documentée et versionnée, manifest, checksums, données choisies et marqueurs de simulation.

**Protocole.** Aucun besoin direct ; peut inclure des lectures déjà effectuées, jamais des commandes d’écriture cachées.

**Dépendances.** Format d’archive local, validateur, migrations et redaction.

**Risques.** Import de données malveillantes ou fuite d’identifiants. Pas d’exécution de contenu, validation stricte, aperçu, taille bornée et masquage par défaut.

**Tests.** Archive valide/invalide, version ancienne, checksum, fichier trop grand, champ inconnu, identifiant masqué, import sans application.

**Difficulté.** Moyenne à élevée.

## 4. Fonctionnalités complémentaires proposées

### 4.1 Centre de capacités et de compatibilité — priorité haute

Une page compacte qui explique, pour chaque appareil et chaque fonction, pourquoi elle est disponible, partielle, indisponible ou non testée. Elle évite les promesses implicites et sert de contrat entre interface, adapters et firmware.

### 4.2 Mode lecture seule global — priorité haute

Un interrupteur qui interdit toutes les écritures de session, de configuration et de firmware. Il est utile pour l’audit, le dépannage et les ordinateurs partagés. Il doit être visible dans toute l’application.

### 4.3 Coffre de brouillons et restauration d’urgence — priorité haute

Avant toute écriture, MiraLink conserve localement le brouillon précédent et propose une restauration si la relecture échoue. Cela complète le double secteur du Pico 2 W sans déplacer la source de vérité hors du bridge.

### 4.4 Centre des permissions d’action — priorité moyenne

Une page locale indiquant quelles opérations sont autorisées : lecture, écriture de configuration, vibration de test, reconnexion, récupération et flash manuel. Les opérations dangereuses restent bloquées jusqu’à confirmation.

### 4.5 Contrat de données versionné — priorité haute

Un format commun pour profils, sessions, diagnostics, historiques et maintenance avec `format`, `formatVersion`, `product`, `createdAt`, `source`, `redaction`, `payload` et checksum. Cela rend les exports comparables sans imposer un service externe.

### 4.6 Remappage des boutons et profils de commandes — priorité haute

**Valeur utilisateur.** Adapter les commandes d'une manette sans toucher au firmware tant que le brouillon n'est pas confirmé.

**Écrans.** Éditeur source → commande, profil lié à un bridge ou à une manette, diff avant application et restauration.

**Données stockées.** Mapping borné des boutons, nom du profil, cible, version du format et dates locales. Aucun numéro de série ni adresse radio.

**Protocole.** Contrat applicatif local pour le premier lot ; une future commande `SET_INPUT_MAPPING_DRAFT` devra être négociée avant toute écriture Pico 2 W.

**Dépendances.** Adapters de rapports de manette et capacité de remappage explicitement supportée.

**Risques.** Commande inverse ou cible incorrecte. Validation stricte, aperçu, confirmation et retour arrière obligatoires.

**Tests.** Mapping inconnu, permutation de boutons, cible différente, export/import et application sans persistance.

**Difficulté.** Moyenne.

### 4.7 Mode urgence — priorité haute

**Valeur utilisateur.** Revenir rapidement à la configuration `Basique` connue comme sûre lorsque le bridge devient instable.

**Écrans.** Accès depuis Overview et Diagnostics, aperçu renforcé, confirmation, relecture et résultat.

**Données stockées.** Brouillon précédent, cible, raison locale, diff et résultat de relecture. Aucun export automatique.

**Protocole.** Réutilise `SET_CONFIG_DRAFT` et `COMMIT_CONFIG` uniquement après capacité négociée ; aucun reset silencieux.

**Dépendances.** Configuration versionnée du Pico 2 W et coffre de brouillons local.

**Risques.** Écraser une configuration utile ou agir sur le mauvais bridge. Confirmation renforcée, cible explicite et abandon si la liaison est instable.

**Tests.** Diff, refus sans confirmation, configuration invalide, cible et échec de persistance.

**Difficulté.** Faible à moyenne.

### 4.8 Tableau de compatibilité firmware/manettes — priorité haute

**Valeur utilisateur.** Montrer ce qui est valide, partiel, indisponible ou non testé sans transformer une absence de preuve en compatibilité.

**Écrans.** Matrice firmware / modèle de manette / version d'adapter, filtres et détail de la preuve locale.

**Données stockées.** Versions, modèle abstrait, état de capacité, notes et date de test. Pas d'identifiant d'appareil.

**Protocole.** Lecture de `GET_INFO` et `GET_CAPABILITIES` lorsqu'ils seront implémentés ; le registre local ne simule aucune réponse firmware.

**Dépendances.** Manifeste de firmware et adapters versionnés.

**Risques.** Afficher une compatibilité trop large. Match exact, état `not-tested` par défaut et notes obligatoires.

**Tests.** Match exact, combinaison inconnue, doublon, import/export et états partiel/indisponible.

**Difficulté.** Faible.

### 4.9 Diagnostics guidés et rapports lisibles — priorité moyenne

**Valeur utilisateur.** Séparer une preuve, une cause probable et une solution, puis conserver un rapport local exploitable.

**Écrans.** Parcours par étapes, quatre résultats (`passed`, `failed`, `unavailable`, `not-tested`), détail et export anonymisé.

**Données stockées.** Étapes, commandes proposées, observations, hypothèses, recommandations et source. Les identifiants sensibles sont exclus.

**Protocole.** `HELLO`, `GET_INFO`, `GET_CONFIG`, `GET_LIVE_STATUS` et `ENTER_RECOVERY` comme commandes candidates, jamais lancées automatiquement par le moteur de rapport.

**Dépendances.** Capacités négociées et résultats de transport réels ou de simulation clairement marqués.

**Risques.** Déclarer un test matériel à partir d'une simulation. `MODE SIMULATION`, `hardwareTested: false` et `testStatus: not-tested` sont conservés à l'export.

**Tests.** Parcours incomplet, échec, indisponibilité, simulation, export masqué et rapport sans identifiant.

**Difficulté.** Moyenne.

### 4.10 Garde d'actions local — priorité haute

**Valeur utilisateur.** Empêcher une écriture ou un test à risque pendant un audit, un dépannage ou une utilisation partagée.

**Écrans.** Indicateur lecture seule/verrouillé, centre des permissions et demande de confirmation pour chaque action sensible.

**Données stockées.** Deux préférences locales, date de changement et résultat d'autorisation. Aucun état matériel n'est transmis.

**Protocole.** Aucun au premier niveau ; le garde s'applique avant les commandes de configuration, test, récupération ou firmware.

**Dépendances.** Toutes les actions futures doivent passer par ce contrat.

**Risques.** Blocage involontaire ou contournement par un nouvel écran. Liste d'actions fermée, refus par défaut et tests de chaque état.

**Tests.** Lecture, export, écriture, verrouillage, lecture seule, capacité indisponible et confirmation.

**Difficulté.** Faible.

### 4.11 Enregistrement local de sessions — priorité moyenne

**Valeur utilisateur.** Garder les dernières secondes d'entrées pour comprendre une dérive, une latence ou une déconnexion sans capture permanente.

**Écrans.** Démarrer/arrêter, durée et taille, événements, résumé, comparaison et export avec choix explicite des échantillons.

**Données stockées.** Échantillons en mémoire, événements bornés, source, scénario et statut de test. La persistance est désactivée par défaut.

**Protocole.** `START_LOCAL_SESSION`, `STOP_LOCAL_SESSION` et `GET_SESSION_PAGE` devront être négociées avant utilisation matérielle.

**Dépendances.** Rapports d'entrée validés, rétention bornée et export local.

**Risques.** Rétention excessive ou fuite d'identifiants dans un événement. Limites strictes, confirmation d'export et redaction des messages.

**Tests.** Limite d'échantillons, arrêt, déconnexion, export sans confirmation, simulation et suppression d'identifiants.

**Difficulté.** Moyenne.

### 4.12 Benchmark de latence et score de connexion — priorité moyenne

**Valeur utilisateur.** Résumer des mesures locales sans fabriquer une latence radio quand elle n'est pas disponible.

**Écrans.** Mesure, détail par transport, score, méthode de calcul et état de preuve.

**Données stockées.** Séries bornées et résumé local optionnel ; aucune synchronisation.

**Protocole.** `GET_LIVE_STATUS` ou mesures de transport réelles après négociation de capacité.

**Dépendances.** Sources USB/radio locales et horodatage fiable.

**Risques.** Score trompeur si une composante manque. Composantes absentes exclues et poids normalisés avec méthode affichée.

**Tests.** Mesures manquantes, valeurs hors limites, simulation, score et source matérielle explicite.

**Difficulté.** Faible à moyenne.

### 4.13 Détection locale de dérive et de batterie anormale — priorité moyenne

**Valeur utilisateur.** Signaler une tendance observable tout en séparant une alerte d'un diagnostic confirmé.

**Écrans.** Alerte, seuils, preuve utilisée, historique court et lien vers Controller Lab/Diagnostics.

**Données stockées.** Échantillons bornés, seuils, alertes et source. Aucun identifiant matériel.

**Protocole.** Réutilise les rapports d'entrée et de batterie réellement exposés ; aucune valeur n'est inventée à partir d'une simple connexion.

**Dépendances.** Analyse Controller Lab et métriques de capacité.

**Risques.** Faux positif ou confusion simulation/matériel. Seuils visibles, preuve listée et statut `not-tested` hors preuve matérielle.

**Tests.** Dérive, batterie faible, chute rapide, aucune donnée, valeurs hors limites et simulation.

**Difficulté.** Moyenne.

## 5. Roadmap proposée

### Lot 0 — socle de sécurité et capacités

Objectif : rendre les états et les limites fiables avant d’ajouter des contrôles.

- contrat de capacités et états `supporté/partiel/indisponible/non testé` ;
- mode lecture seule global ;
- modèle de cible bridge/manette ;
- mode urgence avec aperçu et restauration ;
- matrice de compatibilité firmware/manettes ;
- format versionné des profils, sessions et exports ;
- séparation lecture, brouillon, confirmation, écriture, vérification ;
- accessibilité fondamentale et vue textuelle de la carte des connexions.
- garde d'actions local, lecture seule et verrouillage ;

**Sortie.** Aucun bouton ne propose une écriture si la capacité n’est pas négociée ; les actions dangereuses sont confirmées ; les tests logiciels passent.

### Lot 1 — MVP simulation + profils

Objectif : offrir un produit utile immédiatement sans matériel.

- faux Pico 2 W et fausses manettes ;
- scénarios demandés ;
- profils Compétitif, Basique et Économie ;
- règle locale Basique → Économie sous 10 % de batterie, sans remplacement automatique de Compétitif ;
- diff avant application ;
- remappage local des boutons et profils de commandes ;
- profils liés au bridge ou à une manette ;
- profils individuels et noms personnalisés ;
- sauvegarde/restauration locale ;
- bandeau `MODE SIMULATION` persistant.

**Sortie.** Tous les parcours de découverte, comparaison, confirmation, annulation et restauration fonctionnent sans WebHID et ne produisent aucune déclaration de test matériel.

**État vérifié.** Les contrats locaux de simulation, profils, aperçu, confirmation, basculement batterie et stockage versionné sont testés. Le sélecteur de simulation, le bandeau permanent et les écrans de profils restent à intégrer dans l’application.

### Lot 2 — Controller Lab

Objectif : valider les données d’entrée avant d’afficher des mesures avancées.

- adapters indépendants et fixtures ;
- visualisation sticks/gâchettes ;
- dérive, zone morte, amplitude, circularité, asymétrie ;
- calibration en brouillon ;
- comparaison et restauration ;
- simulation de défauts.

**Dépendance de sortie.** Aucun réglage n’est marqué supporté sans rapport réel décodé et capacité négociée.

**État vérifié.** Le moteur d’analyse local et l’historique de calibration sont testés avec des échantillons synthétiques. L’adapter WebHID, l’affichage et les tests avec matériel réel restent à faire ; aucun test matériel n’est déclaré.

### Lot 3 — Cockpit et carte de connexions

Objectif : rendre l’état opérationnel lisible en direct.

- carte ordinateur → Pico 2 W → manettes ;
- indicateurs transport/liaison/reconnexion ;
- métriques locales et graphiques courts ;
- distinction mesure réelle, indisponible et simulée ;
- tampon mémoire borné.

**État vérifié.** Le benchmark local, son score explicable et la détection bornée des anomalies sont implémentés et testés. Les mesures réelles et l'affichage restent à intégrer.

**Sortie.** Pas de flux externe, pas de rétention permanente par défaut, pas de métrique inventée.

**État vérifié.** Le modèle local de métriques bornées, statuts de capacité, historique mémoire limité et carte ordinateur → Pico 2 W → manette est en place et testé. Le cockpit visuel, les sources WebHID/radio réelles et les graphiques restent à intégrer.

### Lot 4 — Diagnostics guidés

Objectif : transformer les états du cockpit en parcours de résolution.

- arbre de diagnostic ;
- résultats en quatre états ;
- cause probable séparée de la preuve ;
- actions de récupération confirmées ;
- rapport local anonymisé.

**État vérifié.** Le plan d'étapes, les quatre états, la séparation preuve/cause/solution et l'export anonymisé sont implémentés et testés. Le parcours visuel et l'exécution des commandes sur matériel restent à faire.

### Lot 5 — Studio haptique et gâchettes avancées

Objectif : ajouter les contrôles à risque de surprise ou de compatibilité.

- capacités haptique/gâchettes ;
- presets bornés ;
- test limité avec bouton stop ;
- courbes et restauration ;
- refus clair pour les manettes sans support.

### Lot 6 — Centre firmware sécurisé

Objectif : sécuriser le cycle d’inspection et de mise à jour manuelle.

- inspection UF2 locale ;
- comparaison avec identité installée ;
- notes locales ;
- backup obligatoire et diff ;
- vérification post-opération ;
- récupération documentée ;
- aucune écriture automatique ni flash automatique.

### Lot 7 — Historique, automatisations et maintenance

Objectif : ajouter le confort après stabilisation des primitives.

- timeline et diff ;
- restauration de révision ;
- règles locales désactivées par défaut ;
- propositions de profil/batterie/reconnexion ;
- pack portable versionné, masqué et contrôlé ;
- migrations et tests de compatibilité.

## 6. Critères de qualité communs

Une fonctionnalité n’est livrable que si :

1. son état de support est explicite ;
2. son périmètre de données locales est documenté ;
3. l’action persistante possède un aperçu et une confirmation ;
4. l’annulation et l’échec ont un comportement défini ;
5. les identifiants sensibles sont masqués par défaut ;
6. la simulation est testée sans être confondue avec le matériel ;
7. les tests logiciels, protocolaires et de sécurité sont écrits ;
8. les limites matérielles sont affichées ;
9. aucun test réel n’est déclaré sans Pico 2 W ou manette réellement connecté ;
10. la documentation et la version sont mises à jour dans le même changement validé.

## 7. Ordre de décision recommandé

La prochaine décision utile n’est pas de choisir une couleur ou une commande isolée. Il faut valider le Lot 0 puis le Lot 1, car ils fixent le modèle de capacité, la simulation, les profils, la confirmation et les données exportables. Les lots suivants pourront alors s’appuyer sur des contrats déjà testés sans réécrire l’application.

## 8. Backlog complémentaire ajouté le 2026-08-12

Ces demandes complètent les lots précédents. Elles restent soumises au même modèle local, aux capacités négociées et aux états `supporté`, `partiel`, `indisponible` ou `non testé`.

| Fonctionnalité | Priorité proposée | Lot cible | Valeur et limite principale |
|---|---|---|---|
| Remappage des boutons et profils de commandes | Haute | Lot 1 — simulation + profils | Adapter les commandes par bridge ou manette avec aperçu, confirmation et restauration ; aucune écriture automatique. |
| Benchmark de latence avec score de connexion | Moyenne | Lot 3 — cockpit | Donner un score explicable à partir de mesures locales ; ne jamais transformer le score en télémétrie externe ni inventer une mesure radio. |
| Détection automatique de dérive ou de batterie anormale | Moyenne | Lots 2 et 3 | Signaler une tendance locale avec seuils expliqués ; distinguer alerte, mesure indisponible et diagnostic confirmé. |
| Mode urgence pour remettre rapidement des réglages sûrs | Haute | Lot 0 puis Lot 1 | Restaurer un profil sûr minimal après confirmation renforcée ; relecture obligatoire et procédure d’arrêt si la liaison est instable. |
| Retour arrière firmware avec version précédente | Moyenne | Lot 6 — firmware sécurisé | Préparer une version locale précédente et guider une récupération manuelle ; aucun flash automatique et aucune garantie si l’image précédente n’est pas disponible. |
| Tableau de compatibilité firmware/manettes | Haute | Lot 0 | Montrer les combinaisons testées, partielles, indisponibles ou non testées ; séparer clairement firmware, modèle et version d’adapter. |
| Tableau de bord personnalisable | Moyenne | Lot 3 — cockpit | Choisir les cartes et leur ordre sans perdre la vue textuelle accessible ; préférences uniquement locales. |
| Notifications locales configurables | Moyenne | Lot 7 — automatisations | Alerter pour batterie, reconnexion ou erreur avec niveaux et horaires locaux ; aucune notification distante. |
| Groupes de manettes et renommage des appareils | Haute | Lot 1 | Organiser plusieurs appareils et profils sans exposer les identifiants sensibles ; les groupes ne déclenchent aucune action implicite. |
| Mode verrouillage contre les modifications accidentelles | Haute | Lot 0 | Bloquer les écritures et les tests à risque jusqu’au déverrouillage explicite ; rester compatible avec le mode lecture seule global. |
| Centre d’aide hors ligne intégré | Haute | Lots 0 et 1 | Expliquer les écrans, limites et procédures de récupération sans connexion réseau ; contenu versionné avec le produit. |
| Génération de rapports de diagnostic lisibles | Moyenne | Lot 4 — diagnostics guidés | Produire un rapport local compréhensible, exportable et masqué par défaut ; distinguer observations, hypothèses et solutions. |
| Système d’extensions pour futurs adaptateurs | Long terme | Lot 7 | Ajouter des adapters isolés sans modifier le cœur ; extensions déclaratives, locales, versionnées et refusées si leur contrat est incomplet. |
| Comparaison de deux manettes ou deux profils | Moyenne | Lots 1 et 2 | Comparer commandes, calibrations et capacités avec un diff lisible ; ne jamais mélanger les historiques de deux appareils. |
| Gestion avancée de l’énergie et de la veille | Moyenne | Lot 5 | Ajuster veille, réveil, LED et consommation selon les capacités du Pico 2 W et de la manette ; confirmation avant persistance. |
| Mode test automatique répété pour problèmes intermittents | Moyenne | Lot 4 | Répéter des contrôles locaux avec durée et taille bornées ; arrêt explicite, aucune capture permanente par défaut et statut `non testé` sans matériel réel. |

### 8.1 Répartition de conception

- **Socle immédiat :** mode verrouillage, tableau de compatibilité, centre d’aide hors ligne, remappage et groupes d’appareils.
- **Après le MVP :** comparaison de profils/manettes, score de latence, anomalies de dérive/batterie, tableau de bord et rapports lisibles.
- **Après les diagnostics :** mode test répété, énergie/veille, notifications locales et retour arrière firmware guidé.
- **Long terme :** système d’extensions, avec un contrat d’adapter stable et des tests d’isolation obligatoires.

Le mode urgence doit rester disponible depuis Overview et Diagnostics, mais il ne doit jamais contourner le mode verrouillage, la confirmation ou la relecture après écriture.

## 9. Liste de suivi vérifiée — 2026-08-12

Cette liste sépare les éléments réellement contrôlés dans le dépôt des intégrations encore nécessaires. Les cases cochées ne signifient pas qu’un matériel réel a été testé.

### Terminé dans le socle local

- [x] Contrat de trois profils intégrés : Compétitif, Basique, Économie.
- [x] Profil Compétitif protégé contre le basculement automatique sur batterie faible.
- [x] Basculement Basique → Économie uniquement sous 10 %, avec confirmation d’écriture conservée.
- [x] Aperçu différentiel, ciblage bridge/manette et refus d’une mauvaise cible.
- [x] Scénarios de simulation : connexion, erreur, déconnexion, batterie faible, pertes de paquets et configuration invalide.
- [x] Marqueur permanent de simulation dans les données (`MODE SIMULATION`, `hardwareTested: false`, `not-tested`).
- [x] Analyse Controller Lab : dérive, zone morte configurée, amplitude, circularité, asymétrie et gâchettes.
- [x] Historique de calibration borné, comparaison et restauration soumise à confirmation.
- [x] Stockage local de profils versionné avec détection des entrées corrompues.
- [x] Modèle local du cockpit et de la carte des connexions avec statuts `supporté`, `partiel`, `indisponible` et `non testé`.
- [x] Métriques bornées, historique mémoire limité et absence d'identifiants sensibles dans la carte des connexions.
- [x] Contrat de remappage local des boutons avec diff, cible et confirmation.
- [x] Mode urgence vers le profil Basique avec aperçu, confirmation et aucune persistance implicite.
- [x] Matrice locale de compatibilité firmware/manettes avec état `not-tested` par défaut.
- [x] Plan de diagnostics guidés et rapport local anonymisé sans identifiants sensibles.
- [x] Garde d'actions local avec lecture seule, verrouillage et confirmations.
- [x] Enregistrement temporaire de sessions avec rétention bornée et export contrôlé.
- [x] Benchmark local de latence avec score explicable et gestion des composantes absentes.
- [x] Détection locale de dérive et de batterie anormale avec statut de preuve.
- [x] 50 tests logiciels passants et vérification syntaxique de tous les modules applicatifs.
- [x] Parseur indépendant des rapports USB filaires DualSense et adaptateur WebHID local ; les capacités non implémentées restent signalées.
- [x] Parseur Bluetooth DualSense `0x31` avec CRC, hôte Bluetooth Classic HID Pico 2 W et relais d’événements USB compilés.
- [x] Appairage fermé au démarrage, commande locale de fenêtre de cinq minutes et séparation des secteurs flash MiraLink/BTstack.
- [x] Rebuild ARM du firmware 0.6.0 et test C++ natif du cœur protocole/parseurs validés.
- [x] Candidat UF2 0.6.0 empaqueté localement avec picotool 2.3.0 et SHA-256 ; flash manuel et test matériel restent à faire.
- [x] Recherche de liens externes et de références aux anciens projets : aucun résultat dans les nouveaux modules.

### Prochaines tâches, dans l’ordre

- [ ] Brancher les moteurs simulation/profils au parcours visible de l’application.
- [ ] Ajouter le sélecteur de scénario, le bandeau `MODE SIMULATION` et les états accessibles dans l’interface.
- [ ] Ajouter la galerie des trois profils, l’aperçu des changements, la confirmation et le résultat d’application.
- [ ] Connecter la batterie réelle lorsqu’une capacité fiable est négociée ; sinon afficher `indisponible` ou `non testé`.
- [ ] Ajouter la règle d’automatisation locale Basique → Économie avec préférence désactivable et journal lisible.
- [ ] Brancher Controller Lab aux rapports réels des manettes, sans transformer les échantillons synthétiques en test matériel.
- [ ] Brancher l’événement d’échantillon DualSense au parcours visible du Controller Lab, sans modifier le statut matériel.
- [ ] Brancher le bouton visible de fenêtre d’appairage à l’événement `miralink:open-pairing-window`, avec confirmation déjà imposée par le cœur applicatif.
- [ ] Construire la carte ordinateur → Pico 2 W → manette avec transport, reconnexion et erreurs.
- [ ] Construire le cockpit local avec métriques sourcées, statuts de capacité et graphiques bornés.
- [ ] Construire l'interface de l'assistant de diagnostic guidé et ses rapports locaux anonymisés.
- [ ] Ajouter studio haptique, gâchettes avancées, centre firmware sécurisé, historique visuel, maintenance et automatisations restantes.
- [ ] Après stabilisation des autres conversations : reconstruire `dist/`, effectuer le test navigateur/accessibilité, mettre à jour la version puis préparer un commit local.

### Limites de cette vérification

- Aucun Pico 2 W ni aucune manette réelle n'était connecté ; aucun résultat matériel n'est revendiqué.
- Le build de `dist/` n'a pas été lancé pour ne pas écraser le travail visuel parallèle.
- Les fichiers visuels `app/index.html`, `app/styles.css`, `app/icon.svg` et `app/dist` sont volontairement laissés à l'autre conversation qui travaille sur le visuel.
- Aucun test matériel n'a été effectué et aucun push n'est autorisé par ce lot.
