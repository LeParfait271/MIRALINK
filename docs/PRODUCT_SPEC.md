# MiraLink — Spécification produit

- Cible actuelle : Raspberry Pi Pico 2 W
- État décrit : candidat 0.38, avant validation matérielle finale
- Date d’alignement : 2026-08-14

## 1. Vision

MiraLink est un centre de contrôle local pour un pont Pico 2 W et des manettes PlayStation. Le produit réunit connexion, configuration, observation des entrées, diagnostics, profils, sauvegardes et inspection de firmware dans une même application.

La cible normative et l’état effectivement livré ne doivent jamais être confondus. Une fonction prévue, compilée ou simulée n’est pas présentée comme matériellement supportée tant qu’elle n’a pas été validée sur le matériel concerné.

## 2. Cible normative

À terme, l’application doit :

- représenter séparément le Pico 2 W et chaque manette ;
- identifier clairement le transport et la cible de chaque action ;
- négocier les capacités avant de proposer une commande ;
- distinguer `supporté`, `partiel`, `indisponible` et `non testé` ;
- lire la configuration persistante avant toute édition, conserver un brouillon local, montrer un diff, demander confirmation, écrire puis relire ;
- fournir des diagnostics sourcés sans inventer de métrique absente ;
- proposer une inspection et une récupération de firmware sans flash automatique ;
- prendre en charge chaque famille de manette via un adaptateur indépendant et validé.

Le Pico 2 W reste la seule carte ciblée. DualSense, DualSense Edge, DualShock 4 et PlayStation VR2 Sense sont des cibles produit, mais leur présence dans cette liste ne constitue pas une preuve de compatibilité 0.38.

## 3. Capacités livrées dans le candidat 0.38

### 3.1 Interface

Le candidat 0.38 fournit une application web responsive en une page. La connexion et le résumé des diagnostics restent visibles en haut de l’espace de travail ; les sections Système, Configuration, Manettes, Diagnostics, Firmware, Sauvegardes et Journaux organisent les actions détaillées.

La langue effectivement proposée est le français. L’architecture d’internationalisation existe, mais aucune autre langue ne doit être annoncée comme livrée dans cette version.

### 3.2 Connexion locale

WebHID sert uniquement à atteindre le canal USB local du pont Pico 2 W ou une DualSense filaire explicitement reconnue. L’appairage Bluetooth de la manette est géré par le pont. L’interface expose un bouton d’appairage visible et une action de reconnexion ; aucune donnée HID n’est envoyée vers un service distant.

La reconnaissance du pont repose sur l’identité USB attendue et sur son canal de gestion MiraLink. Un périphérique HID inconnu ne doit recevoir aucune commande d’identification MiraLink.

### 3.3 Configuration du pont

Le parcours 0.38 suit cette séquence :

1. lecture de la configuration du Pico 2 W ;
2. création d’un brouillon local à partir de cette lecture ;
3. édition et calcul d’un diff lisible ;
4. confirmation explicite de l’écriture ;
5. envoi du brouillon puis validation persistante par le firmware.

Les contrôles d’édition et l’enregistrement restent verrouillés tant qu’une lecture valide n’a pas fourni la base du brouillon. Une sauvegarde importée ou un profil prépare un brouillon ; elle n’écrit jamais seule dans la flash.

Les réglages exposés comprennent le gain haptique, la réduction des gâchettes, le mode d’interrogation, le tampon audio, le délai d’inactivité, la LED du Pico, le réveil de l’hôte, le mode manette, le numéro de série USB et le raccourci PS. Leur présence dans la configuration ne prouve pas que leurs effets physiques ont tous été testés.

### 3.4 Profils et sauvegardes

Les trois profils intégrés sont visibles depuis l’interface. Les profils locaux peuvent être créés, importés, exportés et utilisés pour préparer un brouillon avec aperçu des changements. L’écriture sur le Pico demande toujours une confirmation séparée.

Les sauvegardes JSON sont créées et chargées localement. Une importation alimente le brouillon à contrôler ; elle ne constitue pas une restauration persistante automatique.

### 3.5 Entrées et analyses de manette

Le Controller Lab peut analyser les échantillons d’entrée reçus, afficher des valeurs de sticks, gâchettes et boutons, puis créer des instantanés locaux pour comparaison. Ces instantanés sont des analyses de session : ils ne sont ni appliqués à la manette, ni écrits dans le firmware, ni une calibration persistante restaurable.

Le test rapide est un test de lecture des entrées uniquement. Il n’envoie aucune commande de vibration, d’audio ou de gâchette adaptative.

### 3.6 Diagnostics

Les diagnostics 0.38 sont partiels. Ils peuvent afficher les états que le pont publie pour le transport USB, la configuration flash, la radio Bluetooth, la connexion et la réception d’entrées. L’état audio est affiché seulement si le firmware expose une information exploitable ; l’absence de flux reste `non testé` ou `indisponible`, jamais `PASS` par déduction.

La version installée est affichée lorsque le pont répond à la commande d’information. Les résultats ne remplacent pas un test physique complet du firmware 0.38.

### 3.7 Inspection UF2

L’inspection d’un fichier UF2 vérifie localement sa structure et calcule son SHA-256 lorsque l’API du navigateur le permet. Elle ne vérifie pas la carte cible, l’identité MiraLink, la provenance, la signature ni l’authenticité du fichier. Aucun flash n’est déclenché par l’application.

## 4. Limites explicites du candidat 0.38

- Le firmware 0.38 est un candidat construit et testé par les suites logicielles, mais son nouveau démarrage Bluetooth doit encore être validé sur un Pico 2 W et une DualSense réels.
- Les entrées Bluetooth complètes doivent encore être confirmées après flash manuel de l’UF2 0.38.
- L’audio, les haptiques, les gâchettes adaptatives et les effets lumineux ne sont pas déclarés validés matériellement.
- Les instantanés du Controller Lab ne modifient aucune calibration matérielle.
- L’inspecteur UF2 ne fournit aucune garantie cryptographique d’origine ou de compatibilité.
- Les métriques absentes du protocole restent indisponibles ; MiraLink n’invente ni batterie, ni température, ni latence radio.
- Le français est la seule langue livrée dans l’interface 0.38.

## 5. Modèle de sécurité

- Les données en lecture seule restent accessibles sans autoriser une écriture.
- Une écriture persistante exige une cible prête, une configuration lue, un brouillon valide, un diff et une confirmation.
- Les actions d’appairage, de réinitialisation, de récupération et d’écriture sont explicites.
- Les types, tailles, schémas, séquences et contrôles d’intégrité du protocole sont validés avant action.
- Un échec ne doit jamais être présenté comme un succès.
- La mise à jour du Pico reste manuelle ; MiraLink ne flashe jamais automatiquement un UF2.

## 6. Confidentialité

MiraLink reste local-first et sans télémétrie :

- aucune analytique ;
- aucun journal distant ;
- aucune sauvegarde cloud ;
- aucun téléversement d’adresse Bluetooth, de numéro de série ou d’échantillon de manette ;
- aucun CDN requis pour exécuter l’application.

Les exports sont déclenchés par l’utilisateur. Les identifiants sensibles doivent être minimisés et masqués par défaut.

## 7. Langage visuel 0.38

Le candidat 0.38 adopte un poste de contrôle high-tech original :

- fond noir profond et surfaces à fort contraste ;
- vert lime comme signal principal, blanc froid et gris techniques en soutien ;
- grille éditoriale, titres courts à grande échelle et repères numérotés ;
- cartes modulaires denses, traits fins et angles nets ;
- état, prochaine action et limites visibles près des commandes ;
- responsive desktop/mobile, focus clavier visible et mouvement réduit lorsque demandé par le système.

Cette direction s’inspire de principes généraux d’interface industrielle et éditoriale. Elle ne copie aucun code, texte, logo, visuel ou actif propriétaire d’un site tiers.

## 8. Livraison

Une livraison comprend le source, les tests, la documentation, les sommes SHA-256 et les artefacts firmware construits. Le firmware peut être publié dans une release GitHub après validation du dépôt, mais son installation reste une action manuelle de l’utilisateur. Le site distribué doit fonctionner sans télémétrie et conserver les opérations matérielles dans le navigateur local.
