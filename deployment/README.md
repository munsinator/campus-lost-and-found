# Einfaches Blue-Green-Deployment

Die Befehle stehen direkt in `.github/workflows/pipeline.yml`. Separate Deployment-Scriptdateien sind nicht notwendig.

## Ablauf

1. **Deploy:** Nginx zeigt die aktive Farbe. Die Pipeline startet das neue Image auf der anderen Farbe.
2. **Tests:** k6 prüft die neue Version mit Smoke- und Performance-Test.
3. **Manuell umschalten:** Nach erfolgreichen Tests stellst du Nginx selbst auf die neue Version um. Die Pipeline verändert Nginx nicht. Der bisherige Container läuft weiter.

Der Image-Tag kommt automatisch von `github.run_number`. Die Datei `.deploy-TAG` auf EC2 merkt sich die Farbe für den Test-Job.

Jeder AWS-Job meldet sich an, sendet Befehle über SSM, wartet auf das Ergebnis und zeigt die Ausgabe. `jq` verpackt die Befehle als JSON. `set -eu` stoppt bei Fehlern.

## Vorhandene Einrichtung auf EC2

- Projektordner: `/home/ubuntu/lost-and-found`.
- Compose-Services: `blue` auf Port 3000 und `green` auf Port 3001.
- `.env` enthält `BLUE_IMAGE_TAG`, `GREEN_IMAGE_TAG` und die App-Einstellungen.
- `/etc/nginx/sites-available/default` enthält genau ein `proxy_pass http://127.0.0.1:3000;` oder `proxy_pass http://127.0.0.1:3001;`.
- SSM funktioniert mit der LabRole. Docker Hub ist für root angemeldet (`sudo docker login`).

## Nächster Schritt

Änderungen committen und nach `deploy/production` pushen. Die AWS-Secrets müssen zur aktuellen Learner-Lab-Sitzung gehören.

Nach erfolgreichen Tests steht im Pipeline-Log die neue Farbe mit ihrem Port. Öffne im EC2-Browserterminal die Nginx-Konfiguration:

```bash
sudo nano /etc/nginx/sites-available/default
```

Ändere bei `proxy_pass` den Port auf die getestete Farbe: **3000 für Blue**, **3001 für Green**. Speichere mit Strg+O, Enter und schließe mit Strg+X. Anschließend:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Danach prüfen:

```bash
sudo grep proxy_pass /etc/nginx/sites-available/default
curl --max-time 10 -i http://localhost/items/
```

Bei fehlgeschlagenen Tests nicht umschalten. Jeder SSM-Auftrag hat 90 Sekunden Ausführungszeit; langsame Image-Downloads können diesen Zeitraum überschreiten. Warte mit dem manuellen Umschalten, bis die Pipeline fertig ist.

Der erste echte Pipeline-Lauf und der Fehlerfall müssen noch auf AWS überprüft werden. GitHub-Benachrichtigungen für fehlgeschlagene Workflows werden in den persönlichen Benachrichtigungseinstellungen aktiviert.
