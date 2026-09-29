#!/bin/sh
# Zero-downtime rolling update for the stateless application services of the production
# Compose stack. Sourced by the deploy script (.github/workflows/deploy.yml) on the server.
#
# For each service it starts the new container NEXT TO the running one, waits until the new
# one reports healthy, gives nginx and the services' HTTP clients a moment to see it in
# Docker DNS, and only then stops the old container gracefully. A new container that never
# becomes healthy is removed and the old one keeps serving — the deploy then fails.
#
# Requirements on the Compose service: no container_name (two containers must coexist), no
# published ports, and a healthcheck (without one, "running" is taken as ready).
#
# Tunables (environment):
#   COMPOSE                  compose command            (default: docker compose -f docker-compose.prod.yml)
#   ROLLOUT_HEALTH_TIMEOUT   seconds to wait for healthy (default: 180)
#   ROLLOUT_DRAIN_SECONDS    old+new overlap before stop (default: 8; nginx re-resolves every 5s)
#   ROLLOUT_STOP_TIMEOUT     graceful stop before SIGKILL (default: 30)

: "${COMPOSE:=docker compose -f docker-compose.prod.yml}"
: "${ROLLOUT_HEALTH_TIMEOUT:=180}"
: "${ROLLOUT_DRAIN_SECONDS:=8}"
: "${ROLLOUT_STOP_TIMEOUT:=30}"

rollout_log() {
  echo "[rollout:$1] $2"
}

# healthy | starting | unhealthy | running (no healthcheck) | exited | missing
rollout_container_state() {
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$1" 2>/dev/null \
    || echo missing
}

# Waits until every given container is healthy (or running, when it has no healthcheck).
rollout_wait_healthy() {
  svc="$1"
  shift
  waited=0
  while [ "$waited" -lt "$ROLLOUT_HEALTH_TIMEOUT" ]; do
    pending=0
    for id in "$@"; do
      state="$(rollout_container_state "$id")"
      case "$state" in
        healthy|running) ;;
        starting|created|restarting) pending=1 ;;
        *)
          rollout_log "$svc" "container ${id%"${id#????????????}"} is $state"
          return 1
          ;;
      esac
    done
    [ "$pending" -eq 0 ] && return 0
    sleep 2
    waited=$((waited + 2))
  done
  rollout_log "$svc" "not healthy after ${ROLLOUT_HEALTH_TIMEOUT}s"
  return 1
}

rollout_service() {
  svc="$1"
  # A broken compose file must fail here, not read as "nothing running".
  old_ids="$($COMPOSE ps -q "$svc")" || return 1

  if [ -z "$old_ids" ]; then
    rollout_log "$svc" "not running — starting"
    $COMPOSE up -d --no-deps "$svc" || return 1
    # shellcheck disable=SC2046
    rollout_wait_healthy "$svc" $($COMPOSE ps -q "$svc") || return 1
    rollout_log "$svc" "started"
    return 0
  fi

  # Same config (image tag, environment…) and healthy ⇒ nothing to roll.
  want_hash="$($COMPOSE config --hash "$svc" | awk '{print $2}')"
  up_to_date=1
  for id in $old_ids; do
    have_hash="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.config-hash"}}' "$id")"
    [ "$have_hash" = "$want_hash" ] || up_to_date=0
    [ "$(rollout_container_state "$id")" = "healthy" ] || up_to_date=0
  done
  if [ "$up_to_date" -eq 1 ]; then
    rollout_log "$svc" "already up to date"
    return 0
  fi

  count=$(echo "$old_ids" | wc -w | tr -d ' ')
  rollout_log "$svc" "starting new container next to the old one"
  $COMPOSE up -d --no-deps --no-recreate --scale "$svc=$((count * 2))" "$svc" || return 1

  new_ids=""
  for id in $($COMPOSE ps -q "$svc"); do
    case " $(echo $old_ids) " in
      *" $id "*) ;;
      *) new_ids="$new_ids $id" ;;
    esac
  done
  if [ -z "$new_ids" ]; then
    rollout_log "$svc" "no new container was created"
    return 1
  fi

  # shellcheck disable=SC2086
  if ! rollout_wait_healthy "$svc" $new_ids; then
    rollout_log "$svc" "new container failed — keeping the old one; last log lines:"
    for id in $new_ids; do
      docker logs --tail 80 "$id" 2>&1 | sed "s/^/[rollout:$svc] | /" || true
      docker rm -f "$id" >/dev/null 2>&1 || true
    done
    return 1
  fi

  # Old and new both serve for a moment, so DNS-caching clients move over before the stop.
  sleep "$ROLLOUT_DRAIN_SECONDS"
  for id in $old_ids; do
    docker stop -t "$ROLLOUT_STOP_TIMEOUT" "$id" >/dev/null
    docker rm "$id" >/dev/null
  done
  rollout_log "$svc" "rolled"
}

# Rolls services concurrently and fails if any of them failed.
rollout_parallel() {
  pids=""
  for svc in "$@"; do
    rollout_service "$svc" &
    pids="$pids $!"
  done
  status=0
  for pid in $pids; do
    wait "$pid" || status=1
  done
  return "$status"
}
