# TODO — Miss Sensuelle

## Vitrine responsive, identité et navigation

- [x] La boutique présente une page d'accueil responsive en français pour Miss Sensuelle, avec un thème clair utilisant du blanc, du bleu, un peu de vert et d'orange, ainsi que des dégradés violet-orange.
- [x] La page d'accueil présente des catégories pour vêtements femme, vestes & ensembles, cosmétiques, lentilles de couleur et extensions de cheveux.
- [x] La page d'accueil présente des produits phares et plusieurs appels à l'action vers le catalogue et les fiches produits.
- [x] L'interface est moderne, colorée, girly et premium, avec profondeur 3D CSS, halos, cartes flottantes et animations au scroll respectant `prefers-reduced-motion`.
- [x] La navigation est responsive et le panier est accessible depuis l'en-tête.

## Catalogue et commandes client

- [x] Le client peut consulter plusieurs pages produit avec image, catégorie, prix en dinars algériens, description, variantes, quantité et ajout au panier.
- [x] Le catalogue peut être filtré par catégorie et recherché par nom.
- [x] Le panier affiche les articles, quantités, sous-total et récapitulatif de livraison en paiement à la livraison.
- [x] Le formulaire de commande COD demande nom, numéro de téléphone, wilaya, commune, adresse et note.
- [x] Une confirmation de commande affiche un identifiant de commande et rappelle que la boutique confirme par téléphone.

## Administration des commandes et des stocks

- [x] Le panneau admin affiche les commandes avec nom, numéro de téléphone, produit, quantité, wilaya, commune, adresse, note et ID de commande.
- [x] Le panneau admin permet de rechercher par ID de commande ou numéro de téléphone.
- [x] Le panneau admin permet de filtrer selon la durée et l'état : confirmé, annulé, reporté, ne répond pas et transféré, avec un état nouveau/en attente pour les commandes entrantes.
- [x] Chaque commande propose des actions confirmer, annuler, reporter, ne répond pas et transférer, avec feedback visuel.
- [x] Chaque commande possède un bouton appeler qui copie le numéro et ouvre le clavier téléphonique via `tel:`.
- [x] Le panneau admin présente des indicateurs de commandes et une section de gestion des stocks.
- [x] L'espace admin possède une section Catalogue séparée permettant d'ajouter, modifier et supprimer un produit.
- [x] Le formulaire produit admin gère le nom, slug, catégorie, badge, prix, ancien prix, stock, accent, description, détails, couleurs, nom/catégorie/description arabe, photo principale et galerie multi-photos importées ou par URL.

## Données et intégrations

- [x] Les produits, commandes, lignes de commande et stocks sont persistés dans la base gérée via Drizzle/MySQL avec migrations additives; le schéma `store_products`, `store_orders` et `store_order_items` est créé et la migration `0001_magenta_dormammu.sql` est appliquée.
- [ ] Les commandes peuvent être synchronisées vers Google Sheets après configuration sécurisée des identifiants et du document cible.
- [ ] Les notifications email et téléphone sont activées après choix du fournisseur et configuration sécurisée des secrets; aucune clé n'est inventée dans le code.
- [x] Le rôle `admin` protège les mutations admin dans le serveur via les procédures `adminProcedure`.
- [x] La page Pixels & paramètres permet d'enregistrer un ID Meta Pixel, un ID TikTok ou le code TikTok complet, puis d'envoyer les événements `ViewContent`, `InitiateCheckout` et `Purchase` sur le tunnel COD.

## Livraison technique

- [x] `public/manus-routes.json` déclare toutes les routes frontend.
- [x] Le projet passe les diagnostics TypeScript et le build frontend/backend; le manifeste `/manus-routes.json` répond en JSON avec les routes de la boutique et de l'admin.

## Ajustements demandés — formulaire Abaya mobile

- [x] La couleur Bordeaux n'est plus proposée pour l'Abaya, y compris dans les anciens catalogues déjà enregistrés; les autres informations du catalogue sont conservées.
- [x] La commune est une liste déroulante dépendante de la wilaya, désactivée avant le choix de la wilaya et réinitialisée lorsque celle-ci change; les données sont réutilisées depuis la maquette HTML fournie.
- [x] Le formulaire Abaya ne contient plus de champ adresse ni note. Les choix de taille, couleur et mode de livraison sont conservés.
- [x] Le formulaire Abaya est lisible sur téléphone : champs avec libellés visibles, zones tactiles d'au moins 48 px, aucun débordement horizontal et bouton de confirmation mis en évidence.

## Landing veste depuis la maquette HTML et admin responsive

- [x] La landing veste reprend les images, styles, proportions du hero, quatre détails, bloc mannequin, assurances et formulaire du fichier `معطفشتويفاخر.html`, avec l'identité Miss Sensuelle et les prix/stock administrables. Les versions noire et blanche suivent la couleur sélectionnée. Le faux envoi de la maquette est remplacé par le parcours COD existant et une confirmation après sauvegarde réussie.
- [x] L'administration garde ses actions existantes et s'adapte au téléphone : navigation accessible, commandes lisibles, boutons appel/détails, catalogue, champs produits, réglages et modale sans débordement horizontal.
- [x] Les éléments à fournir pour Meta Pixel et TikTok Pixel sont expliqués, avec distinction entre suivi navigateur et API serveur; aucun mot de passe ni jeton secret n'est demandé en chat.

## Limites à résoudre avant un lancement publicitaire en production

- [ ] Les commandes, le catalogue et les paramètres pixels du frontend sont reliés au serveur et partagés entre les visiteurs/appareils (actuellement localStorage, malgré les tables backend existantes).
- [ ] L’accès réel à l’administration et ses mutations sont authentifiés avant publication; la page locale actuelle n’a pas de garde de connexion.
- [x] Le filtre de période admin utilise les dates réelles de commandes plutôt qu’un choix visuel uniquement.
- [ ] Une politique de réservation/décrément et restitution du stock après commandes COD est appliquée côté serveur; le stock affiché seul ne réserve pas les articles.
- [ ] Les pixels sont testés dans les comptes Meta et TikTok avec les IDs de la cliente et les paramètres de confidentialité adaptés au site publié.

## Nouvelle photo hero Abaya

- [x] Le hero de la page Abaya utilise la photo `1000013293.jpg` fournie, entière, sans recadrage, déformation ni texte ajouté par-dessus. Le formulaire, les photos de détails et le reste de la landing sont conservés; les garanties n'empiètent pas sur la nouvelle image.

## Photos Abaya — annotations Preview du 31 octobre

- [x] Remplacer seulement les photos 1, 2 et 4 de `.emerald-detail-grid` par les photos fournies de l'Abaya noire, des broderies et de l'Abaya verte; adapter les légendes et conserver les autres éléments répétés.
- [x] Le hero promotionnel, le formulaire et les photos 3 et 5 restent inchangés. Les trois nouvelles photos sont visibles entières sur mobile; les anciens catalogues enregistrés reçoivent ces remplacements sans écraser prix, stock, couleurs ou photos personnalisées.

## Correction TikTok Pixel — site publié

- [x] Le pixel public `CUD92NJC77U74NKABJI0` se charge via un code de base dans l'en-tête de toutes les pages, sans dépendre du localStorage du visiteur. Le bootstrap site envoie une seule page initiale et ne double pas l'installation au montage React.
- [x] Les événements ViewContent, InitiateCheckout et Purchase COD existants utilisent ce même pixel et restent en file d'attente jusqu'au chargement du SDK; aucune fausse commande n'est créée pour tester.
- [x] L'admin distingue le pixel TikTok global des réglages locaux, affiche l'état réel du chargement et les erreurs réseau, sans prétendre que les événements ont été confirmés dans Ads Manager.
- [ ] Le correctif est sauvegardé puis publié sur le site existant, et le chargement du SDK est contrôlé dans un contexte sans réglages pixels locaux. La réception côté TikTok et la détection par l'extension personnelle de la cliente restent à vérifier dans son navigateur/compte.

## Administration — données enregistrées uniquement

- [x] L’admin n’ajoute plus les cinq commandes de démonstration au chargement, après rechargement ou après un changement de statut. Les anciennes copies enregistrées sont retirées seulement si elles correspondent précisément aux exemples connus; les autres commandes sont conservées, même avec un ID ressemblant.
- [x] Les chiffres fixes (128 commandes, 486.2k DA, 78.4% et variations fictives) et mini-graphiques décoratifs disparaissent. Les indicateurs sont calculés sur les commandes enregistrées; un montant confirmé n’est pas présenté comme du chiffre d’affaires encaissé.
- [x] L’admin affiche un état vide et des valeurs adaptées lorsqu’aucune commande n’est enregistrée. La date d’en-tête est actuelle et aucun indicateur ne suggère de fausses notifications ou une connexion Google Sheets active.
- [x] Les nouvelles commandes enregistrent leur date réelle. Le filtre de période utilise les dates disponibles, sans inventer une date pour les anciennes commandes « À l’instant »; la vue « Toutes les dates » conserve ces anciennes commandes.
- [x] Les produits, photos, stocks renseignés et réglages pixels sont conservés. Les commandes de démonstration n’apparaissent plus dans les exports ni dans les changements de statut.

## Pixel Meta global — 3938968343072960

- [x] Le pixel Facebook fourni est chargé sur toutes les pages depuis le bootstrap d’en-tête, sans dépendre des paramètres locaux du navigateur ni remplacer le pixel TikTok existant. Le SDK et la PageView initiale ne sont pas doublés par React.
- [x] ViewContent, InitiateCheckout, AddToCart et Purchase COD existants utilisent le pixel Meta configuré. L’achat représente la commande COD enregistrée, pas un paiement encaissé; aucune fausse commande n’est envoyée pour tester.
- [x] Les réglages admin affichent le pixel Facebook global en lecture seule avec un diagnostic de chargement, sans affirmer que Meta Ads Manager a confirmé la réception.
- [ ] Le bootstrap est versionné selon son contenu, validé et publié sur le site existant. La vérification dans Meta Pixel Helper et le Gestionnaire d’événements reste distincte de l’installation technique.

## Réception réelle et commandes abandonnées — 1 novembre

- [ ] Toutes les commandes validées sur Abaya, veste, autres produits et panier sont transmises à la base partagée et visibles depuis le compte admin, indépendamment du navigateur client. Validation serveur, prix fiables, transaction et jeton d’idempotence empêchent faux succès, montant falsifié et double commande après double appui/réessai.
- [ ] Purchase et les remerciements ne sont déclenchés qu’après confirmation du serveur d’une commande durable; jamais pour un brouillon, une erreur réseau ou une simple validation locale. Les coordonnées ne sont pas transmises aux pixels.
- [ ] La section « Commandes abandonnées » affiche les informations du formulaire enregistrées, même incomplètes (nom, téléphone partiel, produit, quantité, variante, wilaya, commune, adresse, note, identifiant et dates). Une information visible et une case facultative non précochée recueillent l’accord du client avant la capture progressive; aucun autre champ ni frappe hors commande n’est enregistré.
- [ ] Les brouillons sont sauvegardés pendant le remplissage et à la sortie de page avec requêtes keepalive; visibles immédiatement, distingués « en cours »/« abandonné après 10 minutes d’inactivité ». Une finalisation retire le brouillon de cette liste; les réponses tardives ne rétrogradent pas une commande. Le retrait d’accord efface le brouillon propre au jeton, sans effacer la commande finalisée.
- [ ] Les abandons offrent recherche/filtre, téléphone copiable et appel seulement si le numéro est valide; suivi nouveau/contacté/ignoré sans créer de faux achat.
- [ ] Le tableau des commandes, mises à jour de statut et abandons sont protégés par une connexion Manus OAuth réelle et le rôle admin. L’activation propriétaire requiert une clé privée imprévisible, à usage unique, en plus du compte connecté; aucun premier visiteur ni mode Preview ne contourne l’accès. La clé n’est pas publiée dans le site, Git ou les pixels.
- [ ] Les maquettes, champs simplifiés Abaya, boutons, variantes, galerie, filtres d’état/période, recherche, appel, export CSV et responsive sont conservés. Les erreurs serveur affichent une erreur et un réessai, pas zéro commande ni une confirmation fictive.
- [ ] Une migration additive conserve les tables/données existantes. Les tests vérifient les contrats, le consentement, prix, idempotence, interdiction de lecture anonyme et ordre sauvegarde/Purchase sans écrire de faux client ni achat dans la base de production. Le correctif est sauvegardé et publié; les anciennes coordonnées jamais transmises ne sont pas inventées à partir de Meta.
