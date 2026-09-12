# k6-Tests

- `smoke.ts`: Ist die Item-Liste erreichbar?
- `e2e.ts`: Key erstellen/rotieren, Item erstellen/lesen/bearbeiten/loeschen, fehlenden und alten Key ablehnen, Such-Flag pruefen.
- `performance.ts`: Item-Liste mit 5 gleichzeitigen Nutzern fuer 30 Sekunden abrufen.

Die Pipeline erwartet fuer den E2E-Test, dass `item-search` in PostHog fuer `public-api` eingeschaltet ist. `SEARCH_ENABLED=true` beschreibt den erwarteten Zustand; es veraendert PostHog nicht.

## Beide Flag-Zustaende pruefen

1. Pipeline mit eingeschaltetem `item-search` ausfuehren.
2. Nach dem erfolgreichen Lauf `item-search` in PostHog ausschalten.
3. Auf EC2 im Ordner `/home/ubuntu/lost-and-found` denselben Test erneut ausfuehren. Hier wird Green getestet; fuer Blue den Port auf 3000 aendern:

```bash
sudo docker run --rm --network host -v "$PWD/tests/k6:/tests:ro" -e BASE_URL=http://127.0.0.1:3001 -e SEARCH_ENABLED=false grafana/k6:latest run /tests/e2e.ts
```

4. Flag fuer zukuenftige Pipeline-Laeufe wieder einschalten.

Die Testdateien werden beim Pipeline-Lauf aus dem neuen Image nach EC2 kopiert. Ein fehlgeschlagener Check macht den k6-Lauf durch den Threshold rot. Erwartete HTTP-Fehler (401 und 404) gehoeren hier zum Test, daher gibt es in `e2e.ts` keinen `http_req_failed`-Threshold.

Jeder E2E-Lauf erstellt einen API-Key-Datensatz in `users`. Dieser bleibt bestehen, weil die API keine Route zum Loeschen von Keys besitzt. Der Test loescht seinen eigenen Gegenstand auch bei Fehlern innerhalb des Testablaufs; bei Prozessabbruch oder nicht erreichbarer API kann er zurueckbleiben. Bestehende Gegenstaende werden nicht bearbeitet.

Die Tests wurden lokal auf Syntax geprueft. Der echte E2E-Lauf gegen AWS steht noch aus.
