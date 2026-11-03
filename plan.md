# Plan — Miss Sensuelle

## Périmètre et approche

Miss Sensuelle est une boutique e-commerce responsive en français, orientée paiement à la livraison en Algérie. La vitrine est une SPA React avec routes `/`, `/catalogue`, `/produit/:slug`, `/panier`, `/commande`, `/merci` et `/admin`. Les données métier sont préparées pour Drizzle/MySQL via `products`, `orders`, `orderItems` et `inventory`; la démo frontend conserve un jeu de données local pour rester immédiatement navigable même avant le premier seed de base.

Le parcours client couvre la découverte, le filtrage par catégorie, la fiche produit, l’ajout au panier, le checkout COD avec nom, téléphone, wilaya, commune, adresse et note, puis une confirmation claire. Le panneau admin présente KPI, recherche par ID/téléphone, filtre d’état et de durée, détail des commandes, actions confirmer/annuler/reporter/ne répond pas/transférer, bouton d’appel et suivi du stock. Les interfaces serveur/tRPC seront ajoutées pour persister ces actions; les intégrations Google Sheets, email et SMS/téléphone seront isolées derrière des fonctions TODO avec des états visuels de préparation, sans inventer de clés.

## Structure du projet

- `client/src/App.tsx` : routes, layout partagé et états de navigation.
- `client/src/pages/Storefront.tsx` : accueil, catalogue, produit, panier, commande et confirmation.
- `client/src/pages/Admin.tsx` : tableau de bord commandes/stocks et interactions de statut.
- `client/src/components/` : en-tête, pied de page, cartes produits, badge de statut, modales et éléments de formulaire réutilisables.
- `client/src/lib/store-data.ts` : catégories, produits, wilayas, formatage des prix et état de démo.
- `client/src/index.css` : direction artistique, responsive, décor 3D CSS, transitions et animations de scroll.
- `drizzle/schema.ts` : tables persistantes pour produits, commandes, lignes de commandes et inventaire.
- `server/db.ts` et `server/routers.ts` : accès aux données et procédures tRPC publiques/admin.
- `public/manus-routes.json` : manifeste des routes servies.

## Direction artistique choisie

### Mouvement

**Y2K editorial / soft-glam digital boutique** : une vitrine lumineuse, expressive et premium, avec composition en rubans, cartes flottantes et profondeur douce plutôt qu'une grille rigide.

### Principes

1. Féminin sans être enfantin : silhouettes arrondies, typographie éditoriale et détails glossy.
2. Conversion visible : prix en DA, COD rassurant, CTA contrastés et accès panier toujours proche.
3. Profondeur légère : halos, cartes en perspective, objets flottants et badges qui donnent une sensation 3D sans ralentir la lecture.
4. Mobile d'abord : navigation compacte, cibles tactiles généreuses et formulaires courts.

### Couleurs

Fond ivoire/blanc chaud pour la confiance, bleu électrique comme couleur d'action et de navigation, lavande pour la douceur, touches vert menthe pour les signaux positifs, orange mandarine pour les urgences promotionnelles. Le gradient violet-orange devient la signature visuelle des hero cards et CTA secondaires.

### Mise en page

Hero asymétrique en deux plans : message éditorial à gauche et collage de cartes produit en profondeur à droite. Les sections alternent des alignements en ruban, des carrousels horizontaux sur mobile et des panneaux latéraux dans l'admin. Les produits utilisent des cartes aérées avec image grand format, prix et action courte, plutôt qu'une matrice dense.

### Signatures

- Wordmark « Miss Sensuelle » avec une boucle en forme de ruban dans le S.
- Orbe irisée et petites étoiles comme motif de marque.
- Pastilles de statut colorées, mini halos et ombres colorées en profondeur.

### Interaction et animation

Les éléments principaux entrent en fondu + translation courte via `IntersectionObserver`, les cartes produits remontent légèrement au survol et les boutons répondent par une compression douce. Les halos flottent lentement en arrière-plan, sans bloquer les interactions ni les préférences `prefers-reduced-motion`. Les changements de statut dans l'admin donnent un retour toast immédiat.

### Typographie

Titres en `Fraunces` pour l'élégance éditoriale; interface en `DM Sans` pour la clarté. Hiérarchie nette : très grand titre compact, sur-titres en capitales espacées, prix très lisibles et microcopy courte.

### Essence et voix

Positionnement : « Les looks et détails beauté qui font passer une journée ordinaire en moment signature. » Personnalité : pétillante, confiante, soignée. La voix est directe, complice et locale : « Ton prochain coup de cœur est ici. » et « Commande tranquille, on te confirme par téléphone. »

### Logo et couleur propriétaire

Logo typographique rubané, accompagné d'une petite étoile/orbe. Couleur propriétaire : **Miss Lilac** `#8367F5`, utilisée avec parcimonie pour signer la marque au milieu du blanc, du bleu et des accents chauds.

## Données et limites assumées

Le checkout crée une commande structurée en COD sans paiement en ligne. Le numéro de téléphone est validé côté interface et les wilayas sont données dans un sélecteur. Les notifications email/SMS et la synchronisation Google Sheets sont préparées côté serveur mais nécessitent des secrets et choix de fournisseur pour être activées en production. L'admin est protégé par le rôle `admin` dans la base existante; la démo conserve le rendu de l'espace afin que le flux soit visible immédiatement.

## Correction prioritaire — commandes reçues et brouillons (1 novembre)

La lecture du code et les compteurs en base confirment que les formulaires enregistrent dans localStorage, sans transmission serveur, et que l’admin lit uniquement son navigateur. Le schéma existant est vide. Cette version remplace ce parcours de commande par une sauvegarde réelle en base partagée, sans refaire les maquettes.

Les formulaires Abaya, veste, autres produits et panier utilisent un contrat commun `shared/checkout.ts`, des POST `/api/checkout/draft`, `/api/checkout/order` et `/api/checkout/discard`, et un jeton aléatoire propre au formulaire. La création complète est transactionnelle, idempotente et validée côté serveur. Les prix viennent du catalogue publié/serveur, jamais d’un montant déclaré par le navigateur. La confirmation et Purchase ne s’exécutent qu’après une réponse de succès d’une commande durable. Une perte de réseau n’affiche plus de faux remerciement.

Une case facultative et non précochée informe le client de la sauvegarde du brouillon et du rappel pour sa commande. Après accord, les seuls champs de commande sont sauvegardés progressivement, même incomplets. Les brouillons apparaissent immédiatement dans l’admin; ils sont distingués entre « en cours » et « abandonné après 10 minutes d’inactivité ». L’opt-out efface les informations du brouillon propre au jeton sans supprimer une commande finalisée. Les réponses tardives ne peuvent pas recréer un brouillon révoqué ou rétrograder une commande validée. Aucun contact ni texte saisi ne part dans les événements publicitaires.

L’admin consulte la base après connexion Manus OAuth et vérification du rôle admin. Comme aucun compte ni rôle propriétaire n’est configuré, l’activation initiale exige, en plus de la connexion réelle, une clé privée aléatoire à usage unique fournie uniquement à la propriétaire; son empreinte seule est stockée en base. Aucun premier visiteur ne devient administrateur automatiquement. Le tableau et les actions gardent les filtres, appels, états, exports et responsive, avec un onglet Brouillons/commandes abandonnées.

Modules : `server/checkout.ts` pour les transactions et endpoints, `server/adminSetup.ts` pour l’activation propriétaire, tables additionnelles dans `drizzle/schema.ts`, hook et notice de brouillon sous `client/src/components/`, formulaires existants conservés, composant abandons et garde OAuth pour l’admin. Les tests sont isolés/mocks : pas de faux achat, ni fausse donnée client dans la base partagée. Les anciennes commandes qui n’ont jamais quitté les navigateurs des clients ne sont pas reconstructibles à partir d’un compteur publicitaire. Google Sheets reste non connecté tant que le document et l’accès ne sont pas fournis.
