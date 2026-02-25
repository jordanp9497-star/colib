# QA Checklist - Trajet actif + opportunites colis

## Navigation apps
- [ ] Waze installe: `Demarrer un trajet` ouvre Waze avec destination correcte.
- [ ] Waze absent Android: fallback `google.navigation` fonctionne.
- [ ] Waze absent iOS: fallback Apple Plans fonctionne.
- [ ] Aucune app dispo: l'app reste stable, pas de crash, log warning present.

## Permissions
- [ ] Toggle opportunites ON: demande notif + localisation background.
- [ ] Toggle opportunites OFF: pas de demande notif/background, only foreground location.
- [ ] Refus foreground: blocage propre avec message utilisateur.
- [ ] Refus background/notif: blocage propre avec message utilisateur.

## Session lifecycle
- [ ] CTA visible depuis `Trajets` en 1 tap.
- [ ] Lancement trajet affiche banner persistante (destination, deviation, count).
- [ ] Bouton `Voir les colis` ouvre l'ecran filtres du trajet actif.
- [ ] Bouton `Arreter` stoppe la session et retire la banner.
- [ ] Relaunch app: session active restauree (best effort via storage + backend).

## Matching + notifications
- [ ] `pushLocation` met a jour `matchesCountCache`.
- [ ] Notification envoyee quand count passe de 0 a >0.
- [ ] Notification envoyee quand new_count > old_count.
- [ ] Cooldown 10 min respecte (pas de spam).
- [ ] Tap notif ouvre `trip/active-matches`.

## Basic regressions
- [ ] Tabs existantes toujours navigables.
- [ ] Ecrans `send`, `offer`, `map`, `profile` inchanges fonctionnellement.
- [ ] Lint OK (warnings existantes hors scope).
- [ ] Unit tests `tripSessionMatching` et `tripTracking` passent.
