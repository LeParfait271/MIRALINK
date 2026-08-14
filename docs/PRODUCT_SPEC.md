# MiraLink — Spécification produit

- Cible actuelle : Raspberry Pi Pico 2 W
- État décrit : candidat 0.40, avant validation matérielle de la reconnexion
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

Le Pico 2 W reste la seule carte ciblée. DualSense, DualSense Edge, DualShock 4 et PlayStation VR2 Sense sont des cibles produit, mais leur présence dans cette liste ne constitue pas une preuve de compatibilité 0.40.

## 3. Capacités livrées dans le candidat 0.40

### 3.1 Interface

Le candidat 0.40 fournit une application web de bureau en page continue. La connexion et le résumé des diagnostics restent visibles en haut de l’espace de travail ; configuration, manettes, diagnostics, firmware, sauvegardes et journaux suivent directement dans le flux. Une barre d’accès rapide contient de vrais liens d’ancrage, fait défiler la page vers la section demandée et indique la section active ; elle ne masque aucun contenu et ne se présente pas comme un faux jeu d’onglets.

La langue effectivement proposée est le français. L’architecture d’internationalisation existe, mais aucune autre langue ne doit être annoncée comme livrée dans cette version.

### 3.2 Connexion locale

WebHID sert uniquement à atteindre le canal USB local du pont Pico 2 W ou une DualSense filaire explicitement reconnue. L’appairage Bluetooth de la manette est géré par le pont. L’interface expose un bouton d’appairage visible et une action de reconnexion ; aucune donnée HID n’est envoyée vers un service distant.

La reconnaissance du pont repose sur l’identité USB attendue et sur son canal de gestion MiraLink. Un périphérique HID inconnu ne doit recevoir aucune commande d’identification MiraLink. Les commandes d’un même périphérique sont sérialisées dans une FIFO annulable. L’identité et le cycle de vie sont revérifiés avant chaque écriture ; un `SET_REPORT` au résultat ambigu n’est jamais renvoyé, tandis que la lecture de la réponse `0x71` peut être reprise un nombre borné de fois.

La lecture d’état contrôleur utilise un cycle récursif toutes les 100 ms, avec recul borné après erreur. Une déconnexion annule le travail devenu obsolète. Pour `RECONNECT_USB`, l’application attend une disparition réelle du périphérique, même si la lecture de l’ACK est devenue ambiguë ; elle ne renvoie jamais la commande.

### 3.3 Configuration du pont

Le parcours 0.40 suit cette séquence :

1. lecture de la configuration du Pico 2 W ;
2. création d’un brouillon local à partir de cette lecture ;
3. édition et calcul d’un diff lisible ;
4. confirmation explicite de l’écriture ;
5. envoi du brouillon puis validation persistante par le firmware.

Les contrôles d’édition et l’enregistrement restent verrouillés tant qu’une lecture valide n’a pas fourni la base du brouillon. Une sauvegarde importée ou un profil prépare un brouillon ; elle n’écrit jamais seule dans la flash.

Les réglages actifs exposés comprennent le gain haptique, la réduction des gâchettes, le mode d’interrogation, le délai d’inactivité, la LED du Pico, le réveil de l’hôte, la persona USB et le numéro de série USB. Le tampon audio et le raccourci PS restent visibles uniquement pour expliquer et préserver leur valeur persistante : ils sont désactivés dans l’interface 0.40 parce que la classe USB Audio n’est pas exposée et que le firmware ne consomme pas encore le drapeau PS.

Un commit de configuration ne réénumère jamais implicitement l’USB. Son accusé de réception indique si le PID effectif ou la politique de numéro de série exige une nouvelle énumération. L’application affiche alors une action séparée avec confirmation. L’annulation du brouillon local et la restauration persistante des valeurs d’usine sont deux opérations distinctes.

### 3.4 Profils et sauvegardes

Les trois profils intégrés sont visibles depuis l’interface. Les profils locaux peuvent être créés, importés, exportés et utilisés pour préparer un brouillon avec aperçu des changements. L’écriture sur le Pico demande toujours une confirmation séparée.

Les sauvegardes JSON sont créées et chargées localement. Une importation alimente le brouillon à contrôler ; elle ne constitue pas une restauration persistante automatique.

### 3.5 Entrées et analyses de manette

Le Controller Lab affiche en direct les sticks, gâchettes, boutons, batterie, état casque/microphone, gyroscope, accéléromètre et points tactiles réellement présents dans le dernier rapport valide. Il calcule localement le centre, l’amplitude et une mesure de circularité à partir de l’historique borné de la session, puis peut créer des instantanés locaux pour comparaison. Ces instantanés sont des analyses de session : ils ne sont ni appliqués à la manette, ni écrits dans le firmware, ni une calibration persistante restaurable.

Le test rapide est un test de lecture des entrées uniquement. Il n’envoie aucune commande de vibration, d’audio ou de gâchette adaptative.

### 3.6 Diagnostics

Les diagnostics 0.40 sont partiels. Ils peuvent afficher les états que le pont publie pour le transport USB, la configuration flash, la radio Bluetooth, la connexion et la réception d’entrées. L’état audio est affiché seulement si le firmware expose une information exploitable ; l’absence de flux reste `non testé` ou `indisponible`, jamais `PASS` par déduction.

La version installée est affichée lorsque le pont répond à la commande d’information. Les résultats ne remplacent pas un test physique complet du firmware 0.40.

### 3.7 Inspection UF2

L’inspection d’un fichier UF2 vérifie localement sa structure et calcule son SHA-256 lorsque l’API du navigateur le permet. Elle ne vérifie pas la carte cible, l’identité MiraLink, la provenance, la signature ni l’authenticité du fichier. Aucun flash n’est déclenché par l’application.

## 4. Limites explicites du candidat 0.40

- Le test matériel 0.38 a validé les boutons/sticks dans `joy.cpl` et un commit de configuration. Le test 0.39 a validé l’appairage initial, un échantillon au test rapide, le Controller Lab, les diagnostics et la lecture de configuration, mais la manette ne s’est pas reconnectée après extinction sans nouvel appairage.
- La reconnexion passive du candidat 0.40 est vérifiée par le code, les tests purs et le cross-build seulement ; elle doit être confirmée après flash manuel par des cycles extinction/rallumage, redémarrage du Pico et pertes brutales de liaison.
- Le mouvement et le tactile sont transportés par le rapport enrichi mais n’ont pas été exercés pendant le test 0.39.
- L’audio, les haptiques, les gâchettes adaptatives et les effets lumineux ne sont pas déclarés validés matériellement.
- Les instantanés du Controller Lab ne modifient aucune calibration matérielle.
- L’inspecteur UF2 ne fournit aucune garantie cryptographique d’origine ou de compatibilité.
- Les métriques absentes du protocole restent indisponibles ; MiraLink n’invente ni batterie, ni température, ni latence radio.
- Le français est la seule langue livrée dans l’interface 0.40.

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

## 7. Langage visuel 0.40

Le candidat 0.40 conserve le poste de contrôle high-tech original introduit en 0.39 :

- fond charbon et surfaces graphite avec contraste confortable ;
- ivoire doux, sauge froide, bleu-gris et ambre d’état en accents parcimonieux ;
- grille éditoriale, titres courts à grande échelle, profondeur et repères numérotés ;
- effets de trame, lumière, balayage et mouvement subtils, sans ressource distante ;
- sections continues directement accessibles et barre d’accès rapide ancrée avec état actif ;
- état, prochaine action et limites visibles près des commandes ;
- cible bureau explicite, focus clavier visible et mouvement réduit lorsque demandé par le système.

Cette direction s’inspire de principes généraux d’interface industrielle et éditoriale. Elle ne copie aucun code, texte, logo, visuel ou actif propriétaire d’un site tiers.

## 8. Livraison

Une livraison comprend le source, les tests, la documentation, les sommes SHA-256 et les artefacts firmware construits. Le firmware peut être publié dans une release GitHub après validation du dépôt, mais son installation reste une action manuelle de l’utilisateur. Le site distribué doit fonctionner sans télémétrie et conserver les opérations matérielles dans le navigateur local.
