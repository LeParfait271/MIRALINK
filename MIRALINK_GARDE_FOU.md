# MIRALINK — GARDE-FOU OBLIGATOIRE

> À lire entièrement avant toute lecture, modification, génération, test, build, commit ou livraison.

## Identité

- Produit : **MiraLink**
- Développeur affiché : **MaruChiwa**
- Dossier unique : `C:\MIRALINK\MIRALINK`
- Version initiale : `0.1.0`
- Version publique actuelle du site : `0.26`
- Version firmware suivie séparément : `2.3.0`
- Date de démarrage : `2026-08-12`
- Livraison locale uniquement tant qu'une publication n'est pas autorisée.

## Règles absolues

1. MiraLink est un projet neuf, indépendant et créé de zéro.
2. Ne copier, importer, forker, intégrer ou réutiliser aucun code, fichier, ressource visuelle ou dépendance des projets précédemment examinés.
3. Ne créer aucun lien direct, import, iframe, URL, synchronisation ou dépendance avec les anciens sites, dépôts ou firmware examinés.
4. Ne pas utiliser l'ancien UF2 comme base technique ou comme firmware de fonctionnement.
5. Les anciens projets ne servent qu'à définir les capacités attendues de façon abstraite.
6. La première cible matérielle est exclusivement le Raspberry Pi Pico 2 W.
7. Les réglages restent enregistrés dans la mémoire flash du Pico 2 W.
8. Aucune télémétrie, statistique, analyse ou donnée de périphérique ne quitte l'ordinateur.
9. Ne pas publier, pousser, flasher, écraser ou contacter un service externe sans autorisation explicite.
10. Ne jamais déclarer un test matériel sans matériel réellement connecté.
11. Préserver les fichiers existants tant qu'une suppression n'est pas explicitement autorisée.
12. Toute nouvelle règle donnée par l'utilisateur doit être ajoutée à ce fichier avant de poursuivre.
13. Un correctif WebHID limité à l'application peut cibler le VID/PID MiraLink sans imposer un reflash du firmware compatible déjà installé ; l'énumération du Pico et l'appairage de la manette restent des validations séparées.

## Produit attendu

- Une application unique à onglets, desktop-first, pouvant gérer plusieurs appareils.
- Thème sombre uniquement.
- Design original, sobre, futuriste, octogonal, vert émeraude et néon maîtrisé.
- Inspiration HUD de combat VR uniquement ; aucune copie de ressources protégées.
- Anglais par défaut et couverture des langues européennes prévue dans l'architecture.
- Sauvegardes locales exportables/importables, comparaison avant écriture et restauration.
- Confirmations pour les opérations dangereuses.
- Journaux lisibles, diagnostics guidés et validation locale des fichiers firmware.
- Toutes les capacités utiles demandées sont réimplémentées et les ajouts pertinents sont documentés.

## Firmware MiraLink

Le firmware est une nouvelle implémentation Pico 2 W avec :

- protocole MiraLink propre ;
- schéma de configuration versionné ;
- conservation des réglages dans le Pico 2 W ;
- migration contrôlée des configurations MiraLink ;
- valeurs sûres par défaut ;
- écriture flash atomique et vérifiée ;
- récupération documentée ;
- validation stricte de toutes les longueurs de paquets ;
- limites explicites pour audio, vibrations, gâchettes, LED, veille, réveil et diagnostic ;
- aucun mécanisme réseau non demandé.

La compatibilité avec les contrôleurs est réimplémentée selon les contraintes matérielles et protocolaires nécessaires, sans réutiliser le code précédent.

## Version et commits

- La version, la date de dernière mise à jour et `MaruChiwa` doivent être visibles dans l'application et les livrables.
- Version initiale : `0.1.0`.
- Chaque commit qui modifie le site ou l'application augmente la version publique de `0.01` : `0.10` → `0.11` → `0.12` → … → `0.25` → `0.26`. La version technique du paquet npm utilise `0.26.0` pour respecter le format semver, tandis que la version affichée et livrée du site reste `0.26`.
- La version du firmware est indépendante de celle du site. Le firmware actuellement suivi reste `2.3.0` et ne change que lorsqu'un nouveau firmware est réellement construit et documenté.
- Version et date sont modifiées dans le même commit que le changement.
- Chaque prompt utilisateur qui demande une intervention sur le projet est clôturé par un seul commit local complet regroupant toutes les modifications du prompt ; aucun commit partiel.
- Avant chaque commit, `MIRALINK_GARDE_FOU.md` et `docs/WORKFLOW.md` sont relus et mis à jour si le workflow, une règle ou une limite a changé.
- Aucun commit vide artificiel pour un prompt purement conversationnel sans modification du dépôt.
- Aucun push automatique.

## Méthode obligatoire

Avant chaque intervention :

1. Relire ce fichier entièrement.
2. Vérifier l'état du dossier sans l'écraser.
3. Définir l'objectif et le périmètre autorisé.
4. Réaliser une étape réduite et vérifiable.
5. Modifier uniquement les fichiers nécessaires.
6. Tester immédiatement.
7. Conserver les résultats, erreurs et limites.
8. Mettre à jour le workflow et les garde-fous avant le commit si le prompt ajoute une règle, une décision ou une limite.
9. Mettre à jour version et date avant le commit.
10. Vérifier que le commit contient toutes les modifications du prompt et aucun fichier hors périmètre.
11. Créer un seul commit local complet ; ne pas pousser sans autorisation explicite.
12. Demander une décision si une ambiguïté change l'architecture, la compatibilité ou la sécurité.

## Contrôles avant livraison

Un nouvel artefact UF2 doit provenir du build MiraLink courant, être inspecté
localement avec son identifiant de famille et être accompagné d'un SHA-256.
Cette génération ne vaut pas test matériel et ne déclenche jamais un flash
automatique.

- application démarrable localement ;
- aucune dépendance ou télémétrie non autorisée ;
- clavier et accessibilité vérifiés ;
- tests unitaires du protocole ;
- tests de configurations invalides et paquets courts ;
- build firmware reproductible ;
- UF2 identifié et vérifié ;
- échanges HID de fonctionnalité vérifiés par lecture explicite du rapport de réponse, avec distinction claire des événements d’entrée ;
- politique de permissions WebHID explicitement déclarée dans le déploiement statique ;
- version/date cohérentes partout ;
- documentation d'installation et de récupération ;
- limites des tests matériels indiquées.

## Règles utilisateur append-only

- `2026-08-12` — Projet neuf, indépendant, créé de zéro.
- `2026-08-12` — Nom : MiraLink.
- `2026-08-12` — Développeur : MaruChiwa.
- `2026-08-12` — Version augmentée de 0.1 à chaque commit.
- `2026-08-12` — Ce fichier doit être lu avant tout travail.
- `2026-08-12` — Les profils applicatifs sont limités à Compétitif, Basique et Économie. Compétitif privilégie la latence minimale et les performances maximales ; Basique privilégie un fonctionnement fiable ; sous 10 % de batterie, le basculement automatique de Basique vers Économie est autorisé, mais Compétitif ne doit jamais être remplacé automatiquement.
- `2026-08-12` — Le dépôt de travail et de publication GitHub Desktop est `C:\MIRALINK\MIRALINK` ; le dossier parent `C:\MIRALINK` ne doit pas être utilisé comme dépôt actif.
- `2026-08-12` — La partie visuelle du site est travaillée dans une autre conversation ; ne pas modifier `app/index.html`, `app/styles.css`, `app/icon.svg` ou `app/dist` sans coordination explicite.
- `2026-08-12` — Le workflow et les garde-fous doivent être relus et mis à jour avant chaque commit ; chaque prompt de travail doit être clôturé par un commit local complet regroupant toutes ses modifications.
- `2026-08-12` — Les réponses MiraLink transportées par rapport HID de fonctionnalité doivent être lues avec `receiveFeatureReport`; un événement `inputreport` seul ne constitue pas une réponse de commande.
- `2026-08-12` — L’ancien UF2 reste une référence de comportement lue en analyse ; MiraLink ne réutilise ni son code ni son firmware, et conserve son propre canal HID et son propre protocole.
- `2026-08-12` — Le déploiement statique doit autoriser explicitement WebHID avec une politique locale `hid=(self)` ; l’application doit journaliser si le blocage vient du contexte sécurisé ou de la politique de permissions.
- `2026-08-12` — Le build statique doit conserver `_headers` dans `app/dist/` afin que la politique WebHID survive à une publication Cloudflare Pages configurée sur le dossier de sortie.
- `2026-08-12` — L’ancien UF2 peut être inspecté en lecture seule comme référence comportementale et de couverture fonctionnelle ; aucun code, binaire, protocole propriétaire ou structure interne ne doit être réutilisé dans MiraLink.
- `2026-08-12` — Un rapport HID MiraLink de 64 octets de données avec un identifiant non nul occupe 65 octets sur le contrôle USB ; le tampon TinyUSB doit être dimensionné pour l’identifiant inclus, et un refus `SET_FEATURE` doit être diagnostiqué sur le matériel réel avant toute conclusion WebHID.
- `2026-08-12` — La version 1.2.0 contient le correctif de tampon HID, mais le nouvel UF2 doit être flashé manuellement puis vérifié sur le Pico connecté avant de déclarer la correction matérielle réussie.
- `2026-08-12` — Le correctif USB est livré dans le candidat 1.3.0 ; le polling local et l’ouverture confirmée de la fenêtre d’appairage ne valent pas une connexion DualSense tant que les compteurs du Pico réellement flashé ne progressent pas.
- `2026-08-12` — La reconnexion automatique MiraLink ne parcourt que les adresses présentes dans la base locale de clés BTstack ; une manette inconnue reste soumise à la fenêtre d’appairage confirmée, et aucun identifiant radio n’est exporté par défaut.
- `2026-08-12` — Le bridge USB peut exposer une collection HID gamepad standard distincte du canal vendor MiraLink ; seuls les rapports DualSense validés peuvent l’alimenter, et une déconnexion doit produire un rapport neutre sans être déclarée testée avant validation physique.
- `2026-08-12` — Le schéma DualSense MiraLink 2 conserve la partie historique de l’état, mais les offsets de boutons, mouvement, tactile et batterie doivent suivre le rapport complet validé ; un octet de séquence ne doit jamais être interprété comme un bouton.
- `2026-08-12` — Les sorties DualSense passent uniquement par des commandes MiraLink bornées et typées ; aucun rapport HID brut fourni par l’application n’est accepté. Les vibrations sont temporaires, limitées à 3000 ms et doivent revenir automatiquement à l’état neutre.
- `2026-08-12` — Les capacités haptique compatible, barre lumineuse, LEDs joueur, mute micro, batterie, mouvement et tactile ne sont annoncées qu’après un rapport DualSense Bluetooth complet validé ; les routes audio et gâchettes restent distinctes de la preuve d’un effet physique et doivent être affichées avec leur limite réelle.
- `2026-08-12` — La file de sortie Bluetooth est locale, bornée à deux buffers, conserve les données jusqu’à l’acceptation par BTstack et est vidée à chaque déconnexion ; son fonctionnement synthétique ne vaut pas validation d’une vibration réelle.
- `2026-08-12` — La version 1.5.0 n’expose que les sorties DualSense bornées et annoncées ; aucun chemin interne de gâchettes adaptatives ne doit être conservé tant qu’il n’est pas documenté, négocié et validé sur matériel.
- `2026-08-12` — La version 1.6.0 accepte le PIN Bluetooth classique `0000` uniquement pendant la fenêtre d'appairage locale ou pour une adresse déjà mémorisée ; toute autre demande PIN est refusée.
- `2026-08-13` — Le candidat firmware 1.7.0 utilise exclusivement la banque de clés Bluetooth locale initialisée par le SDK Pico, vérifie statiquement sa séparation avec la flash MiraLink, borne la reconnexion, ferme une liaison HID sans rapport valide après 10 secondes et reste soumis à une validation manuelle sur Pico 2 W réel.
- `2026-08-13` — L'objectif firmware 1.8.0 est la parité fonctionnelle complète avec les fonctions observables du firmware de référence : mêmes résultats utilisateur sur Pico 2 W, sans réutiliser son code, son binaire, son protocole propriétaire ou ses structures internes ; toute capacité non réalisable sur le matériel doit rester explicitement signalée.
- `2026-08-13` — Le candidat firmware 1.9.0 ajoute une entrée audio USB UAC2 locale (4 canaux, 48 kHz, PCM 16 bits) conservée en RAM et un rapport HID audio DualSense borné (id `0x36`, 398 octets) avec Opus stéréo pour les haut-parleurs et canaux haptiques 3 kHz ; aucun transport A2DP/SBC n'est annoncé, et l'acceptation par une DualSense réelle reste à vérifier sur matériel.
- `2026-08-13` — La sortie DualSense de 1.9.0 accepte soit des commandes MiraLink typées, soit un corps de rapport de sortie USB DualSense strictement borné à 47 octets ; MiraLink ajoute l'en-tête Bluetooth, la séquence et le CRC, et n'accepte jamais un tampon HID arbitraire.
- `2026-08-13` — Les gâchettes adaptatives sont exposées comme voie de sortie contrôleur bornée et négociable, mais ne sont pas déclarées validées tant qu'un Pico 2 W et une DualSense réels n'ont pas confirmé l'effet.
- `2026-08-13` — Le statut audio distingue endpoint local, encodeur prêt, liaison HID Bluetooth validée et flux actif après envoi réussi ; aucun compteur audio, échantillon ou identifiant ne quitte l'ordinateur.
- `2026-08-13` — Le lot 2.0.0 expose un diagnostic local borné de la dernière étape Bluetooth en échec et de compteurs d'essais ; ces champs ne contiennent ni adresse radio, ni identifiant sensible, ni télémétrie distante.
- `2026-08-13` — La file de sortie protège un rapport accepté par BTstack pendant une fenêtre bornée afin de ne pas l'écraser par un rapport concurrent ; l'absence d'événement de fin BTstack reste une limite documentée et doit être vérifiée sur Pico 2 W réel.
- `2026-08-13` — Le pipeline audio conserve au plus un rapport en attente en RAM, valide la structure fixe avant l'envoi et abandonne un bloc devenu obsolète après perte de liaison ; il ne persiste aucun audio.
- `2026-08-13` — Le candidat firmware 2.2.0 expose uniquement le HID MiraLink et le gamepad standard : l'interface audio UAC2 est retiree apres un Code 10 Windows observe sur les interfaces audio et HID du composite 2.0.0. Aucun fonctionnement audio USB n'est declare avant une nouvelle validation du descripteur sur materiel reel.
- `2026-08-13` — La version publique du site MiraLink est `0.25` et augmente de `0.01` par commit de site/application ; la version firmware reste indépendante et courante `2.2.0`.
- `2026-08-13` — Le firmware `2.3.0` corrige une collision d'identifiants de rapports dans le descripteur HID qui pouvait entraîner un Code 10 Windows. Chaque ID reste unique à l'échelle du descripteur ; le correctif doit être testé par flash manuel sur Pico 2 W avant toute déclaration de fonctionnement matériel.
- `2026-08-13` — La version publique du site MiraLink est `0.26`; son paquet technique est `0.26.0`. La version firmware indépendante courante est `2.3.0`.
- `2026-08-13` — Les artefacts générés par Codex hors du dossier unique `C:\MIRALINK\MIRALINK` doivent être supprimés en fin de tâche après vérification de leur périmètre ; les fichiers existants de l'utilisateur restent protégés.
