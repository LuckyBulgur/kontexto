#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/LuckyBulgur/kontexto.git"
APP_DIR="/opt/kontexto"
DEPLOY_USER="deploy"

echo "=== Kontexto Server Setup (Ubuntu 24.04) ==="
echo ""

# --- Schritt 1/5: System aktualisieren ---
echo "=== Schritt 1/5: System aktualisieren ==="
apt-get update && apt-get upgrade -y
echo "System ist auf dem neuesten Stand."
echo ""

# --- Schritt 2/5: Docker installieren ---
echo "=== Schritt 2/5: Docker installieren ==="
if command -v docker &>/dev/null; then
    echo "Docker ist bereits installiert: $(docker --version)"
else
    echo "Docker wird installiert..."
    curl -fsSL https://get.docker.com | sh
    echo "Docker wurde erfolgreich installiert: $(docker --version)"
fi
echo ""

# --- Schritt 3/5: Deploy-Benutzer erstellen ---
echo "=== Schritt 3/5: Deploy-Benutzer erstellen ==="
if id "$DEPLOY_USER" &>/dev/null; then
    echo "Benutzer '$DEPLOY_USER' existiert bereits."
else
    echo "Benutzer '$DEPLOY_USER' wird erstellt..."
    useradd -m -s /bin/bash "$DEPLOY_USER"
    echo "Benutzer '$DEPLOY_USER' wurde erstellt."
fi
usermod -aG docker "$DEPLOY_USER"
echo "Benutzer '$DEPLOY_USER' wurde zur Docker-Gruppe hinzugefuegt."
echo ""

# --- Schritt 4/5: SSH haerten ---
echo "=== Schritt 4/5: SSH haerten ==="
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
echo "SSH-Konfiguration wurde angepasst (Root-Login und Passwort-Authentifizierung deaktiviert)."

DEPLOY_HOME=$(eval echo "~$DEPLOY_USER")
mkdir -p "$DEPLOY_HOME/.ssh"
touch "$DEPLOY_HOME/.ssh/authorized_keys"
chmod 700 "$DEPLOY_HOME/.ssh"
chmod 600 "$DEPLOY_HOME/.ssh/authorized_keys"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_HOME/.ssh"
echo "SSH-Verzeichnis fuer '$DEPLOY_USER' wurde eingerichtet."

systemctl restart ssh
echo "SSH-Dienst wurde neu gestartet."
echo ""

# --- Schritt 5/5: Repository klonen ---
echo "=== Schritt 5/5: Repository klonen ==="
if [ -d "$APP_DIR" ]; then
    echo "Verzeichnis '$APP_DIR' existiert bereits, ueberspringe Klonen."
else
    echo "Repository wird nach '$APP_DIR' geklont..."
    git clone "$REPO_URL" "$APP_DIR"
    echo "Repository wurde erfolgreich geklont."
fi
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
echo "Eigentuemer von '$APP_DIR' auf '$DEPLOY_USER' gesetzt."
echo ""

# --- Zusammenfassung ---
SERVER_IP=$(hostname -I | awk '{print $1}')

echo "=== Setup abgeschlossen ==="
echo ""
echo "Naechste Schritte:"
echo ""
echo "1. SSH Public Key fuer den Deploy-Benutzer hinzufuegen:"
echo "   echo 'DEIN_PUBLIC_KEY' >> $DEPLOY_HOME/.ssh/authorized_keys"
echo ""
echo "2. Folgende GitHub Secrets im Repository setzen:"
echo "   DEPLOY_HOST=$SERVER_IP"
echo "   DEPLOY_USER=$DEPLOY_USER"
echo "   DEPLOY_SSH_KEY=(privater SSH-Schluessel des Deploy-Benutzers)"
echo ""
echo "3. Ersten Build starten:"
echo "   su - $DEPLOY_USER"
echo "   cd $APP_DIR"
echo "   docker compose up -d --build"
echo ""
echo "=== WARNUNG ==="
echo "Stelle sicher, dass dein eigener SSH-Schluessel zum Deploy-Benutzer"
echo "hinzugefuegt wurde, BEVOR du dich als Root abmeldest!"
echo "Andernfalls verlierst du den Zugang zum Server."
