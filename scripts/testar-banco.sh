#!/usr/bin/env bash
# Testa as migrações do banco num Postgres local descartável.
# Uso: ./scripts/testar-banco.sh   (precisa do Postgres 16 instalado)
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
PASTA="$(mktemp -d)"
PORTA="${PG_PORTA:-54339}"
DONO="$(id -un)"

limpar() { "$BIN/pg_ctl" -D "$PASTA/dados" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$PASTA"; }
trap limpar EXIT

if [ "$DONO" = "root" ]; then
  # O Postgres não roda como root; usa o usuário "postgres".
  chown postgres "$PASTA"
  RODAR=(runuser -u postgres --)
else
  RODAR=()
fi

"${RODAR[@]}" "$BIN/initdb" -D "$PASTA/dados" -A trust -U postgres >/dev/null
"${RODAR[@]}" "$BIN/pg_ctl" -D "$PASTA/dados" -o "-p $PORTA -k $PASTA -c listen_addresses=''" -l "$PASTA/log" start >/dev/null

PSQL=(psql -h "$PASTA" -p "$PORTA" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$RAIZ/supabase/tests/stub_auth.sql"
for m in "$RAIZ"/supabase/migrations/*.sql; do
  echo "→ migração $(basename "$m")"
  "${PSQL[@]}" -f "$m"
done
"${PSQL[@]}" -f "$RAIZ/supabase/tests/fundacao_test.sql"
