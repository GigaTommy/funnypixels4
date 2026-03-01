#!/usr/bin/env bash
set -euo pipefail

# Auto scaling helper for the tile rendering stack.
#
# The script polls Prometheus for CPU, memory, request rate and queue depth
# metrics, then scales the Kubernetes deployments or AWS AutoScaling groups
# when thresholds are crossed. It is intended to be executed by a cron job or
# GitHub Action on a 1-5 minute cadence.

PROM_URL=${PROM_URL:-"https://prometheus.funnypixels.local"}
NAMESPACE=${NAMESPACE:-"render"}
READ_DEPLOYMENT=${READ_DEPLOYMENT:-"tile-gateway"}
WRITE_DEPLOYMENT=${WRITE_DEPLOYMENT:-"tile-writer"}
WORKER_DEPLOYMENT=${WORKER_DEPLOYMENT:-"tile-workers"}
ASG_NAME=${ASG_NAME:-"funnypixels-render-asg"}
MIN_REPLICAS=${MIN_REPLICAS:-4}
MAX_REPLICAS=${MAX_REPLICAS:-64}
MIN_WORKERS=${MIN_WORKERS:-6}
MAX_WORKERS=${MAX_WORKERS:-80}
AWS_REGION=${AWS_REGION:-"us-east-1"}
QUEUE_TARGET=${QUEUE_TARGET:-5000}
CPU_TARGET=${CPU_TARGET:-65}
MEM_TARGET=${MEM_TARGET:-70}
RPS_TARGET=${RPS_TARGET:-80000}

log() {
  echo "[$(date -Is)] $*"
}

fetch_metric() {
  local query=$1
  curl -sS --fail -G "$PROM_URL/api/v1/query" --data-urlencode "query=$query" \
    | jq -r '.data.result[0].value[1] // "0"'
}

scale_deployment() {
  local deployment=$1
  local replicas=$2
  log "Scaling $deployment to $replicas replicas"
  kubectl -n "$NAMESPACE" scale deployment "$deployment" --replicas="$replicas"
}

scale_asg() {
  local desired=$1
  log "Setting ASG $ASG_NAME desired capacity to $desired"
  aws autoscaling set-desired-capacity \
    --auto-scaling-group-name "$ASG_NAME" \
    --desired-capacity "$desired" \
    --min-size "$MIN_REPLICAS" \
    --max-size "$MAX_REPLICAS" \
    --region "$AWS_REGION"
}

clamp() {
  local value=$1
  local min=$2
  local max=$3
  if (( value < min )); then
    echo "$min"
  elif (( value > max )); then
    echo "$max"
  else
    echo "$value"
  fi
}

main() {
  local cpu=$(printf '%.0f' "$(fetch_metric "avg(node_namespace_pod_container:container_cpu_usage_seconds_total:sum_irate{namespace='$NAMESPACE'} * 100)")")
  local mem=$(printf '%.0f' "$(fetch_metric "avg(container_memory_working_set_bytes{namespace='$NAMESPACE'}) / 1024 / 1024 / 1024 * 100")")
  local rps=$(printf '%.0f' "$(fetch_metric "sum(rate(http_requests_total{namespace='$NAMESPACE',pod=~'${READ_DEPLOYMENT}.*'}[1m]))")")
  local queue_depth=$(printf '%.0f' "$(fetch_metric "sum(render_queue_depth)")")

  log "CPU=${cpu}% MEM=${mem}% RPS=${rps} QUEUE=${queue_depth}"

  local desired_read=$MIN_REPLICAS
  local desired_write=$MIN_REPLICAS
  local desired_worker=$MIN_WORKERS
  local desired_asg=$MIN_REPLICAS

  if (( cpu > CPU_TARGET || mem > MEM_TARGET )); then
    desired_read=$(( (cpu + mem) / 2 / 5 + MIN_REPLICAS ))
    desired_write=$(( (cpu + mem) / 2 / 5 + MIN_REPLICAS ))
    desired_asg=$(( (cpu + mem) / 2 / 5 + MIN_REPLICAS ))
  fi

  if (( rps > RPS_TARGET )); then
    desired_read=$(( rps / RPS_TARGET * MIN_REPLICAS + MIN_REPLICAS ))
  fi

  if (( queue_depth > QUEUE_TARGET )); then
    desired_worker=$(( queue_depth / QUEUE_TARGET * MIN_WORKERS + MIN_WORKERS ))
  fi

  desired_read=$(clamp "$desired_read" "$MIN_REPLICAS" "$MAX_REPLICAS")
  desired_write=$(clamp "$desired_write" "$MIN_REPLICAS" "$MAX_REPLICAS")
  desired_worker=$(clamp "$desired_worker" "$MIN_WORKERS" "$MAX_WORKERS")
  desired_asg=$(clamp "$desired_asg" "$MIN_REPLICAS" "$MAX_REPLICAS")

  scale_deployment "$READ_DEPLOYMENT" "$desired_read"
  scale_deployment "$WRITE_DEPLOYMENT" "$desired_write"
  scale_deployment "$WORKER_DEPLOYMENT" "$desired_worker"
  scale_asg "$desired_asg"
}

main "$@"
