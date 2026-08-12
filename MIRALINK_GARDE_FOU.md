# MIRALINK — GARDE-FOU OBLIGATOIRE

> À lire entièrement avant toute lecture, modification, génération, test, build, commit ou livraison.

## Identité

- Produit : **MiraLink**
- Développeur affiché : **MaruChiwa**
- Dossier unique : `C:\MIRALINK\MIRALINK`
- Version initiale : `0.1.0`
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
- Chaque commit qui modifie le projet augmente la version de `0.1` : `0.1.0` → `0.2.0` → `0.3.0` → `0.4.0` → `0.5.0` → `0.6.0` → `0.7.0` → `0.8.0` → `0.9.0`.
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
