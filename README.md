# ⛳ Mini-Golf entre amis

Jeu de mini-golf multijoueur en ligne, inspiré de *Golf With Your Friends*.  
9 trous, jusqu'à 10 joueurs, chacun joue en simultané sur le même trou avec collisions entre les balles.

Chaque trou autorise jusqu'à 12 coups. Un joueur qui ne termine pas reçoit 14 points.

## Lancer en local

```bash
npm install
npm start
```

Ouvre [http://localhost:3000](http://localhost:3000) dans ton navigateur.

1. Choisis un pseudo et une couleur.
2. **Créer une partie** → partage le code ou le lien d'invitation.
3. Tes amis **Rejoignent** avec le code à 4 lettres.
4. L'hôte clique **Lancer la partie**.

### Contrôles

| Action | Contrôle |
|--------|----------|
| Viser, régler la puissance et frapper | Clic gauche maintenu : horizontal pour viser, vertical pour la puissance |
| Capturer/cacher la souris | Cliquer sur le terrain |
| Viser et déplacer la caméra | Déplacer la souris |
| Libérer la souris | `Échap` |
| Zoom | Molette |
| Sauter pendant le mouvement | `Espace` |
| Frein à main | Maintenir `S` |
| Récupérer un pouvoir aléatoire | Passer sur une boîte lumineuse |
| Utiliser le pouvoir récupéré | `E` |
| Recentrer vers le trou | `C` |
| Replacer au dernier tir (+1 coup) | `R` |
| Tableau des scores | `Tab` (maintenir ou appuyer) |

Le randomiseur transforme réellement la physique des adversaires : cube lourd et très freinant,
cône instable sur les rebonds, ou dodécaèdre très rebondissant.

## Jouer à distance (amis hors de ton réseau)

Le serveur écoute sur ton réseau local. Pour jouer via Internet, expose le port 3000 avec un tunnel :

### Cloudflared (gratuit, recommandé)

```bash
# Installe cloudflared : https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:3000
```

Copie l'URL `https://….trycloudflare.com` et envoie-la à tes amis.

### ngrok

```bash
ngrok http 3000
```

## Stack technique

- **Serveur** : Node.js + WebSocket (`ws`)
- **Client** : Three.js (rendu 3D), physique côté client
- **Réseau** : positions des balles distantes interpolées ; le serveur gère scores et timing

## Structure

```
public/js/
  main.js      — point d'entrée, liaison réseau / jeu / UI
  game.js      — moteur 3D, caméra, boucle de jeu
  physics.js   — gravité, collisions, bumpers
  courses.js   — définition et construction des 9 trous
  ui.js        — menus, HUD, scores
  net.js       — client WebSocket
  audio.js     — sons synthétisés (Web Audio API)
server.js      — serveur HTTP + salons multijoueur
```
