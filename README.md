# Fortune District

Eigenständiges, deutschsprachiges Immobilien-Brettspiel mit 40 Feldern, perspektivischer 3D-Brettdarstellung und Online-Spielräumen für 2–6 Personen. Keine offiziellen Markenlogos oder Originalgrafiken.

## Lokal starten

Voraussetzung: Node.js 18 oder neuer. Es werden keine npm-Pakete benötigt.

```bash
npm start
```

Danach `http://localhost:4173` öffnen. Für einen anderen Port: `PORT=8080 npm start`.

Regeltests:

```bash
npm test
```

## Online mit verschiedenen Geräten spielen

Die App hat jetzt einen zentralen Node.js-Spielserver. Er verwaltet Räume, Spielerkonten, Regeln und den maßgeblichen Spielzustand. Spielaktionen werden serverseitig mit der Spiellogik validiert. Alle Clients eines Raums erhalten Änderungen live über Server-Sent Events (SSE); Aktionen gehen per HTTP-POST an den Server. Dafür ist keine WebSocket-Bibliothek nötig.

1. Die Website muss auf einem öffentlich erreichbaren Node.js-Host laufen (HTTPS empfohlen).
2. Eine Person erstellt einen Raum und teilt den sechsstelligen Raumcode oder den Einladungslink.
3. Freunde öffnen denselben Website-Link auf PC, Tablet oder Smartphone, geben den Code und ihren Namen ein.
4. Die Spielleitung ändert bei Bedarf die Regeln und startet die Partie.
5. Der Server akzeptiert Aktionen nur mit dem privaten Spielertoken und prüft den Zug im Regelkern. Falsche Zugaktionen werden abgewiesen.

### Auf Render veröffentlichen

Eine `render.yaml` ist enthalten. Sie definiert einen Node-Webdienst samt persistentem Datenträger. Im Render-Dashboard kann das Git-Repository mit dieser Datei als Blueprint verbunden werden. Render baut mit `npm install`, startet mit `npm start` und prüft `/api/health`. Der Datenträger wird unter `/var/data` eingebunden; `DATA_DIR=/var/data` speichert Räume und Spielstände dort.

Für den öffentlichen Betrieb muss das Projekt in ein Git-Repository hochgeladen und mit einem Hostingkonto verbunden werden. Ein öffentliches Hostingkonto oder eine Domain wird durch dieses Projekt nicht automatisch angelegt. Erst nach erfolgreichem Deployment erhältst du eine echte Website-Adresse, die du an Freunde schicken kannst.

Alternativ lokal im selben WLAN: Server mit `npm start` starten und die LAN-IP des Rechners samt Port `4173` auf den anderen Geräten öffnen. Firewall und WLAN müssen Gerätekommunikation zulassen. Das ist kein Internet-Hosting.

## Online-Architektur

- `server.mjs`: HTTP-Server, private Räume, Join/Rejoin, Host-Regeln, SSE-Live-Updates und persistente Speicherung.
- `src/game/engine.js`: maßgeblicher Regelkern; Aktionen laufen serverseitig durch `applyAction`.
- `src/game/board.js`: Brett- und Kartendaten.
- `src/main.js`: Lobby, Darstellung, Interaktionen und Online-Client.
- `src/styles.css`: responsives Layout und Brettgestaltung.
- `tests/engine.test.js`: automatisierte Regeltests.

Jeder Client erhält eine zufällige Spieler-ID und ein privates Token. Das Token wird lokal im Browser gespeichert und nicht an andere Spieler verteilt. Es wird für Aktionen, Live-Verbindung und Wiederbeitritt benötigt. Die Spielleitung wird serverseitig authentifiziert.

## Regeln

Standard: 1.500 M Startkapital, 200 M Startgehalt, Auktionen an, doppelte Grundmiete bei kompletter Farbgruppe an, Freiparktopf aus, 50 M Gefängnisfreikauf. Im Warteraum kann die Spielleitung Startkapital, Startgehalt, Auktionen, Farbgruppenbonus und Freiparktopf anpassen. 2–6 Spieler.

Implementiert sind Zugreihenfolge, Würfeln, Bewegung, Startgehalt, Pasch-Extrazüge, Grundstückskauf, Auktionen, Miete, Steuern, Ereignis-/Gemeinschaftskarten, Gefängnis, Häuser/Hotels, Handel, Hypotheken, automatische Liquidation, Zahlungsausfall und Spielende.

## Betrieb und bekannte Grenzen

- Der Spielstand wird nach Raumänderungen in `DATA_DIR/rooms.json` geschrieben. Lokal wird `.private-data/` verwendet; in Render `/var/data`.
- Für eine einzelne Serverinstanz ist der eingebaute Dateispeicher ausreichend für private Spielrunden. Bei mehreren parallelen Serverinstanzen sollte er durch eine gemeinsame Datenbank (z. B. PostgreSQL) und einen gemeinsamen Pub/Sub-Kanal ersetzt werden.
- Die Räume besitzen derzeit keine Benutzerkonten oder Passwortsperre. Der Raumcode ist als Einladung gedacht; behandle ihn wie einen privaten Link. Spieler-Tokens werden als Geheimnisse im Browser gespeichert.
- Räume haben aktuell keine automatische Ablaufzeit oder Host-Übergabe.
- Wenn der Serverprozess neu startet, werden Räume vom persistenten Datenträger wiederhergestellt. Ohne persistenten `DATA_DIR` gehen Räume beim Neustart verloren.
- Ein neuer Spieler kann einer bereits gestarteten Partie nicht beitreten; ein bereits registrierter Spieler kann mit demselben Browser-Token wieder beitreten.
- Die Bretttiefe basiert auf CSS-Perspektive, nicht auf WebGL. Zoom und Kameraneigung sind Ansichtssteuerungen.
- Die Karten sind zufällig gemischt. Es handelt sich um eine eigenständige Hausregel-Interpretation und nicht um eine vollständige Kopie eines kommerziellen Regelwerks.
