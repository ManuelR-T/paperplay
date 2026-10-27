# Choix technologiques pour Paperplay

Recherche effectuée le 26 octobre 2026 dans les documentations officielles. Les recommandations ci-dessous sont des choix d’architecture pour ce prototype, pas des résultats de benchmarks.

## Recommandation

**Next.js App Router + React + TypeScript, API officielle Meta Model API via le SDK OpenAI configuré vers Meta, PDF.js pour les références du document, Zod pour le contrat des widgets.** Commencer avec des visualisations SVG contrôlées ; ajouter Recharts pour des graphiques standards et Motion seulement lorsque les transitions pédagogiques le justifient.

Next.js est construit sur React : ce choix conserve React et TypeScript, et remplace surtout l’assemblage Vite + Express. TypeScript permet de décrire les propriétés des composants ; les données réellement renvoyées par le modèle demandent toujours une validation à l’exécution. [React et TypeScript](https://react.dev/learn/typescript).

## Comparaison des frameworks

| Option | Capacités documentées | Appréciation pour Paperplay |
| --- | --- | --- |
| Next.js App Router | Pages serveur par défaut, composants client pour l’interaction, Route Handlers HTTP dans le même projet. | Choix recommandé : lecteur et intégration Meta dans une application. Il faut maîtriser la frontière serveur/client. |
| TanStack Start | Framework React stable, SSR, streaming, fonctions serveur, routing typé et builds client/serveur. | Alternative très crédible si le routage et les paramètres typés deviennent centraux. Ce projet ne présente pas encore de besoin qui justifie de le préférer à Next. |
| React + Vite + Express | Vite propose des primitives SSR bas niveau ; Express fournit le routage HTTP. | Assemblage valide, particulièrement avec une API indépendante existante. Ici, il impose d’assembler des éléments qu’un framework full-stack fournit déjà. |
| SvelteKit | Framework complet autour de Svelte, comparable à Next autour de React. | Option valable pour une équipe Svelte. Le changement de modèle de composants ne résout pas un besoin propre à Paperplay. |

Sources : [frontière serveur/client Next](https://nextjs.org/docs/app/getting-started/server-and-client-components), [Route Handlers Next](https://nextjs.org/docs/app/getting-started/route-handlers), [TanStack Start](https://tanstack.com/start/latest/docs/framework/react/overview), [fonctions serveur TanStack](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions), [SSR Vite](https://vite.dev/guide/ssr), [routage Express](https://expressjs.com/en/starter/basic-routing/), [SvelteKit](https://svelte.dev/docs/kit/introduction).

## Choix produit confirmés et hypothèses restantes

Le cadrage utilisateur remplace la proposition initiale : interface et explications en anglais ; papiers algorithmiques ; catalogue de widgets animation, graphe et comparaison ; papier original reformatté avec figures intégrées et citations ; reproduction vérifiée lorsque possible, sinon version explicitement simplifiée ; traitement asynchrone avec reprise ; stockage local sans compte ; paramètres partageables par URL. Le développeur travaille seul et demande une architecture générique plutôt qu'un produit limité au pathfinding. Des renderers réutilisables et des moteurs d'exécution spécifiques doivent donc être séparés. L'illustration d'une méthode non prise en charge ne constitue pas son exécution.

Groq n’est plus une option recommandée : l’utilisateur a choisi l’API officielle Meta et dispose, selon son indication, d’environ 150 dollars de crédits. Aucun appel payant ni contrôle du solde du compte n’a été effectué dans cette recherche.

## API officielle Meta : distinguer deux générations

Le portail développeur actuel expose **Meta Model API** à `https://api.meta.ai/v1`, avec authentification Bearer via `MODEL_API_KEY`. Il liste notamment `muse-spark-1.3`, `muse-spark-1.2`, `muse-spark-1.1` et `muse-wonder-1.0`. Ces faits viennent du portail actuel ; ne pas figer arbitrairement Llama 3.3 parce que la première idée était une intégration Meta. [Vue d’ensemble Meta](https://dev.meta.ai/docs/overview).

Le SDK historique `meta-llama/llama-api-typescript`, publié comme `llama-api-client`, est officiel mais cible par défaut `https://api.llama.com/v1` avec `LLAMA_API_KEY`. Ses exemples lisent `completion_message`, ce qui diffère du format des SDK OpenAI. Il documente SSE et un schéma de réponse JSON. L’existence de ce dépôt ne confirme ni que cet ancien endpoint est adapté aux crédits du hackathon actuel, ni qu’il accepte une clé Model API. [README historique](https://github.com/meta-llama/llama-api-typescript), [configuration et authentification du client](https://github.com/meta-llama/llama-api-typescript/blob/main/src/client.ts), [types de completions](https://github.com/meta-llama/llama-api-typescript/blob/main/src/resources/chat/completions.ts).

**Décision proposée : SDK `openai` côté serveur, explicitement configuré avec `baseURL: 'https://api.meta.ai/v1'` et `apiKey: process.env.MODEL_API_KEY`.** Le nom du package ne change pas le fournisseur appelé : les requêtes vont directement chez Meta. Meta documente cette intégration en TypeScript. `muse-spark-1.3` en mode Standard constitue un point de départ à vérifier avec la clé réelle. [Quickstart Meta](https://dev.meta.ai/docs/quickstart).

Meta expose Responses, Chat Completions et Messages. Sa recommandation pour les nouveaux projets est Responses, qui apporte notamment exécution en arrière-plan, fichiers et continuité entre appels. Chat Completions reste pertinent pour un appel simple existant, mais ce projet demande explicitement reprise asynchrone. [Choix du protocole](https://dev.meta.ai/docs/protocols).

AI SDK reste compatible avec l’endpoint Meta via `@ai-sdk/openai`, ce que le quickstart Meta documente. Néanmoins, pour notre pipeline d’analyse à identifiant de réponse et reprise, utiliser directement le SDK documenté évite de masquer les primitives `background`, `retrieve` et `cancel`. AI SDK pourra être ajouté si un dialogue interactif en streaming apparaît comme un besoin distinct. Ce choix est notre appréciation, pas une limitation générale d’AI SDK. [Quickstart Meta](https://dev.meta.ai/docs/quickstart), [API Responses](https://dev.meta.ai/docs/protocols/responses).

## JSON structuré, budget et vérifications

Meta Model API documente les sorties contraintes par JSON Schema. Avec Responses, le paramètre est `text.format` ; `response_format` concerne Chat Completions. Le mode strict demande notamment une racine objet, tous les champs requis et `additionalProperties: false` sur chaque objet ; `oneOf` et `allOf` ne font pas partie du sous-ensemble strict. Zod reste utile pour les règles applicatives, les limites numériques et la validation avant affichage. Un schéma respecté ne garantit pas la fidélité scientifique. [Structured output Meta](https://dev.meta.ai/docs/structured-output), [notes Responses](https://dev.meta.ai/docs/protocols/responses).

Tarifs consultés : Muse Spark Standard coûte 1,25 dollar par million de tokens d’entrée et 4,25 dollars par million en sortie ; Muse Wonder coûte respectivement 4 et 20 dollars. Contributor est moins cher, mais autorise l’usage des contenus pour l’entraînement : ne pas le sélectionner implicitement pour réduire le coût. Proposition : Standard par défaut, plafonds de tokens, cache des analyses et compteur d’usage réel. Le budget indiqué ne constitue pas un nombre garanti de papiers analysables. [Tarifs officiels Meta](https://dev.meta.ai/docs/pricing-rate-limits).

## Hackathon : faits vérifiés et inconnus

La page officielle publique décrit un événement du 26 octobre au 4 novembre 2026, avec soumission le 4 novembre à 21 h ET. Elle cite Muse Spark, Muse Wonder, Muse Image et SAM 3.1 via Meta Model API, ainsi que les modèles Meta ouverts. [Page officielle Cerebral Valley](https://cerebralvalley.ai/e/meta-ai-developer-hackathon).

Le contenu embarqué du waiver officiel, récupéré en lecture seule, annonce 150 dollars de crédits **Meta Model API** pour les participants sélectionnés, valables sur une fenêtre de développement de dix jours. Cela confirme l’offre générale, pas son activation pour ce compte ni l’admissibilité de chaque requête ; les conditions liées aux crédits doivent être consultées dans le portail. [Waiver officiel](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver).

L’URL `/details?backUrl=…` fournie n’était pas accessible avec l’outil web ; la page publique principale et le waiver ont été consultés à sa place. Le waiver a également été vérifié dans le champ `event.waiver` de l’API publique de l’événement. Le crédit disponible, les modèles autorisés par la clé, les modalités de facturation et les quotas réels du compte ne sont pas vérifiés. Il faut les vérifier avant le premier appel payant plutôt que les déduire de la documentation générale.

Le waiver pondère impact (30 %), usage des outils Meta (25 %), profondeur technique (20 %) et démonstration (25 %). Il prévoit une vidéo de démonstration, sans durée indiquée dans les passages consultés. Il exige un travail original et le respect des licences des composants ouverts ; il ne précise pas ici une interdiction générale de code préexistant. Pour Paperplay, vérifier la licence des figures redistribuées et citer le papier. La propriété reste au participant, avec une licence étendue accordée aux organisateurs. [Règles dans l’API publique de l’événement](https://api.cerebralvalley.ai/v1/event/meta-ai-developer-hackathon).

## PDF : préserver le document original

PDF.js permet de charger un PDF, d’accéder aux pages, de les afficher et d’en extraire le texte. C’est le choix recommandé pour conserver le papier original à côté du laboratoire, avec des références de page. `getTextContent` fournit le contenu textuel d’une page ; il ne faut pas assimiler cela à une reconstruction fiable de toutes les équations ou de l’ordre de lecture multicolonne. [Exemples PDF.js](https://github.com/mozilla/pdf.js/blob/master/docs/contents/examples/index.md), [API de page PDF.js](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html).

`pdf-parse` fournit une interface TypeScript d’extraction avec `PDFParse`, `getText` et `destroy`, utilisable côté Node ou navigateur. Il simplifie une ingestion serveur mais ne remplace pas une expérience de lecture synchronisée. Pour le MVP, éviter deux chaînes d’extraction différentes : utiliser PDF.js côté client pour afficher et extraire, ou retenir pdf-parse côté serveur si l’import est plus urgent que la synchronisation précise. [Dépôt officiel pdf-parse](https://github.com/mehmet-kozan/pdf-parse).

## Visualisations : des composants dont le calcul est maîtrisé

Recharts compose des composants React autour de SVG : bon choix pour courbes, barres et scatterplots standards. Visx fournit des primitives combinant D3 et React : meilleur candidat pour des visualisations scientifiques spécifiques, au prix d’un travail de composition plus important. Motion prend en charge des animations déclaratives, SVG et transitions liées à l’état. [Recharts](https://recharts.github.io/en-US/), [Visx](https://github.com/airbnb/visx), [Motion](https://motion.dev/docs/react).

Pour le premier build, les schémas d’attention et les parcours d’algorithmes peuvent être écrits directement en React/SVG. Installer toutes ces bibliothèques dès le départ ajouterait du travail sans bénéfice établi.

## Architecture de génération proposée

Cette section décrit notre proposition, plutôt qu’une capacité garantie par un fournisseur.

1. Ingérer le papier et conserver son texte original, sa structure, les figures, les légendes et les références de page. Afficher un document reformatté fidèle, distinct des explications générées.
2. Construire un identifiant local de document basé sur son contenu. Préparer des passages référencés et les figures utiles pour l’analyse.
3. Créer une réponse Meta en arrière-plan avec sortie JSON structurée. Sauvegarder localement l’identifiant de réponse dès acceptation.
4. Demander des blocs pédagogiques en anglais et des spécifications choisies dans un catalogue animation/graphe/comparaison, avec ancres de source et hypothèses explicites. L'application attribue ensuite le niveau de fidélité selon les moteurs et vérifications disponibles ; le modèle ne peut pas auto-certifier une reproduction.
5. Récupérer l’état après rechargement ; valider chaque résultat final avant de l’enregistrer et d’activer les widgets.
6. Exécuter des composants et algorithmes contrôlés : mêmes entrées, mêmes calculs, mêmes unités pour les comparaisons. Ne pas attribuer une amélioration de performance à un papier sans mesure ou résultat sourcé.
7. Stocker documents, analyses et paramètres dans IndexedDB. Partager les petits paramètres sérialisés et validés dans l’URL. Le destinataire doit disposer du même papier ou d’un exemple public : une URL de paramètres seule ne transfère pas un PDF local.

Une citation retrouvée confirme sa provenance, pas toute l’interprétation. Le catalogue ne doit pas se limiter à renommer un simulateur préfabriqué : ses hypothèses, paramètres et calculs doivent correspondre au passage source. La reproduction de l’algorithme nécessite des tests de référence ; elle ne découle pas de la qualité du JSON généré.

Pour la lecture reformattée, l’extraction PDF brute reste le point risqué : colonnes, équations et figures demandent une étape de reconstruction. Pour le premier papier public, un contenu HTML/XML source s’il existe ou une préparation contrôlée du document peut fournir une démonstration fidèle. Ne pas promettre un import PDF arbitraire parfait avant une validation sur un corpus réel.

## Asynchrone et reprise

Meta Responses documente `background: true` avec acceptation immédiate, identifiant et statut `queued`. On récupère ensuite la réponse par identifiant, ou un flux SSE de suivi ; l’annulation existe aussi. La création ne peut pas combiner `background: true` et `stream: true`. Le corps d’une création en arrière-plan est limité à **1 MiB** : utiliser des références de fichiers ou des passages bornés plutôt qu’un gros PDF en base64. Pour Responses, garder les paramètres de température par défaut, comme le recommande Meta. [Guide Responses](https://dev.meta.ai/docs/protocols/responses).

Proposition locale : Next expose création/récupération/annulation côté serveur, avec clé Meta dans l’environnement ; le navigateur conserve identifiant de job, état et résultat dans IndexedDB. Les appels de statut doivent être bornés et reprendre après rechargement. Cette reprise concerne l’appel modèle ; l’extraction de document et les contrôles applicatifs restent à rendre relançables par étapes.

Une application hébergée avec une clé commune et sans compte demande aussi un moyen de restreindre les endpoints payants et l’accès aux réponses. Le périmètre « sans compte, local » est simple pour un prototype local ; il ne suffit pas à rendre une API publique prête à accueillir des inconnus. C’est une décision de déploiement ultérieure, pas une raison d’ajouter une authentification au MVP local.

## Déploiement

Next.js ne supprime pas les limites de l’hébergeur. Sur Vercel, une requête de Function est limitée à 4,5 Mo ; un import PDF annoncé à 10 Mo en local ne passera pas tel quel. Utiliser extraction navigateur ou upload direct vers un stockage si nécessaire. [Limite Vercel](https://vercel.com/docs/errors/function_payload_too_large).

Les durées de fonctions dépendent du plan et de la configuration ; les analyses longues ne doivent pas rester dépendantes d’une connexion HTTP applicative. L’exécution Meta en arrière-plan réduit cette dépendance mais ne remplace pas la persistance locale des résultats ni la reprise de tout le pipeline. [Limites Functions](https://vercel.com/docs/functions/limitations).

## Vérifications avant implémentation de l’intégration

- Confirmer dans le dashboard l’activation des crédits et la disponibilité de `muse-spark-1.3` avec la clé du projet.
- Tester un petit schéma JSON, puis sa variante asynchrone et une reprise après rechargement, avec un budget explicite pour ces essais.
- Choisir des papiers de démonstration dans au moins deux familles pour éprouver le contrat générique, sans promettre des moteurs pour chaque méthode publiée.
- Définir pour chaque widget les invariants qui autorisent l’étiquette « reproduction vérifiée » et ceux qui imposent « simplifié ».
- Valider l’extraction du papier retenu et ses figures avant de généraliser l’import.
