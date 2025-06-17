#!/usr/bin/env bash
#
# mongodb_backup.sh
# Faz dump do MongoDB e mantém apenas os últimos 7 dias de backup.
#

set -euo pipefail

# Se existir um arquivo .env na raiz, carrega variáveis de ambiente dele
if [[ -f "$(dirname "$0")/.env" ]]; then
  # exporta toda variável declarada no .env
  set -a
  source "$(dirname "$0")/.env"
  set +a
fi

# Configurações (podem vir do .env ou usar valores padrões)
BACKUP_DIR="${MONGOBACKUP_DIR:-$(dirname "$0")/dbbackups}"
RETENTION_DAYS="${MONGOBACKUP_RETENTION_DAYS:-7}"

# Para conexão:
# você pode definir MONGO_URI, ou
# MONGO_HOST, MONGO_PORT, MONGO_USER, MONGO_PASS, MONGO_DB
# Exemplo no .env:
# MONGO_URI="mongodb://user:pass@localhost:27017/minhadb"
# OU:
# MONGO_HOST="localhost"
# MONGO_PORT="27017"
# MONGO_USER="user"
# MONGO_PASS="pass"
# MONGO_DB="minhadb"

TIMESTAMP="$(date +'%Y-%m-%d_%H-%M-%S')"
DEST="$BACKUP_DIR/$TIMESTAMP"

echo "==> Iniciando backup MongoDB em $DEST"

# Garante que o diretório existe
mkdir -p "$DEST"

# Executa o dump
if [[ -n "${MONGO_URI-}" ]]; then
  mongodump --uri="$MONGO_URI" --out="$DEST"
else
  mongodump \
    --host="${MONGO_HOST:-localhost}" \
    --port="${MONGO_PORT:-27017}" \
    --username="${MONGO_USER:-}" \
    --password="${MONGO_PASS:-}" \
    --db="${MONGO_DB:-}" \
    --out="$DEST"
fi

echo "==> Backup concluído: $DEST"

# Remover backups com mais de RETENTION_DAYS dias
echo "==> Limpando backups com mais de $RETENTION_DAYS dias em $BACKUP_DIR"
find "$BACKUP_DIR" -maxdepth 1 -mindepth 1 -type d -mtime +"$RETENTION_DAYS" -print -exec rm -rf {} \;

echo "==> Backup rotacionado com sucesso."
