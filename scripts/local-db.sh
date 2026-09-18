#!/usr/bin/env bash
# Self-contained Postgres for local development.
#
# Creates a throwaway cluster under .localdb/ (gitignored) on port 5434 with
# trust auth, so `pnpm dev` works with no signup and no password. It does not
# touch any Postgres you already have installed.
#
# To use a hosted database instead, just point DATABASE_URL at it — nothing here
# is required.
set -euo pipefail

PGBIN="${PGBIN:-/Library/PostgreSQL/17/bin}"
PORT="${LOCAL_DB_PORT:-5434}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGDATA="$ROOT/.localdb"
# The socket path has a 103-byte limit, so it cannot live inside the project.
SOCKDIR="/tmp/lunchtime-pg"
LOGFILE="$PGDATA/server.log"
DBNAME="lunchtime"
DBUSER="lunch"

if [ ! -x "$PGBIN/pg_ctl" ]; then
  echo "Postgres binaries not found at $PGBIN" >&2
  echo "Set PGBIN=/path/to/postgres/bin and re-run." >&2
  exit 1
fi

start() {
  mkdir -p "$SOCKDIR"

  if [ ! -d "$PGDATA" ]; then
    echo "Creating cluster in .localdb ..."
    "$PGBIN/initdb" -D "$PGDATA" -U "$DBUSER" --auth=trust -E UTF8 >/dev/null
  fi

  if "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
    echo "Already running on port $PORT."
  else
    "$PGBIN/pg_ctl" -D "$PGDATA" -l "$LOGFILE" \
      -o "-p $PORT -k $SOCKDIR -c listen_addresses=localhost" \
      -w start >/dev/null
    echo "Started on port $PORT."
  fi

  if ! "$PGBIN/psql" -h localhost -p "$PORT" -U "$DBUSER" -d postgres -tAc \
      "select 1 from pg_database where datname='$DBNAME'" | grep -q 1; then
    "$PGBIN/createdb" -h localhost -p "$PORT" -U "$DBUSER" "$DBNAME"
    echo "Created database '$DBNAME'."
  fi

  echo
  echo "DATABASE_URL=\"postgresql://$DBUSER@localhost:$PORT/$DBNAME\""
}

stop() {
  if "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
    "$PGBIN/pg_ctl" -D "$PGDATA" -m fast -w stop >/dev/null
    echo "Stopped."
  else
    echo "Not running."
  fi
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  status) "$PGBIN/pg_ctl" -D "$PGDATA" status || true ;;
  destroy)
    stop || true
    rm -rf "$PGDATA" "$SOCKDIR"
    echo "Removed .localdb."
    ;;
  *) echo "usage: $0 {start|stop|status|destroy}" >&2; exit 1 ;;
esac
