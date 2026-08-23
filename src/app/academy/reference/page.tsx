"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Controls";
import { CodeBlock } from "@/components/ui/CodeBlock";

const SHEETS: { id: string; label: string; title: string; code: string }[] = [
  {
    id: "docker",
    label: "docker",
    title: "Docker essentials",
    code: `docker build -t app:1.0 .                    # build image
docker build --target runtime -t app:1.0 .    # multi-stage target

docker run -d --name api -p 8000:8000 \\
  -e DATABASE_URL=... --memory 512m app:1.0   # run with limits
docker ps                       # running containers
docker logs -f api              # follow logs
docker exec -it api sh          # shell in (debug only)
docker stats                    # live resource usage

docker compose up -d --build    # full stack
docker compose down -v          # teardown incl volumes (careful!)
docker compose logs -f api      # one service's logs

docker system prune -af         # reclaim disk (CI runners!)
docker image ls --format '{{.Repository}}:{{.Tag}} {{.Size}}'`,
  },
  {
    id: "kubectl",
    label: "kubectl",
    title: "Kubernetes daily commands",
    code: `kubectl get pods -o wide -w                  # watch pods
kubectl describe pod api-7f9c                # events tell the story
kubectl logs api-7f9c -f --previous          # crashed container's logs
kubectl exec -it api-7f9c -- sh              # debug shell

kubectl rollout status deploy/api            # gate pipelines on health
kubectl rollout undo deploy/api              # instant rollback
kubectl rollout history deploy/api           # revision list

kubectl scale deploy/api --replicas=6
kubectl set image deploy/api api=reg/app:v1.8.1

kubectl top pods                             # needs metrics-server
kubectl get endpoints svc-api                # readiness gating, visible
kubectl apply -k overlays/prod               # kustomize`,
  },
  {
    id: "git",
    label: "git",
    title: "Git that covers 95% of work",
    code: `git switch -c feat/x && git push -u origin feat/x

git pull --rebase origin main     # replay your work on top
git add -p                        # review your own diff hunk by hunk
git commit --amend                # fold into last commit
git push --force-with-lease       # safe force for YOUR branches

git restore --staged file         # unstage
git restore file                  # discard local changes
git revert <sha>                  # safe undo on shared branches
git reset --soft HEAD~1           # uncommit, keep changes staged
git reflog                        # nothing is ever really lost

git rebase -i HEAD~5              # squash/clean before PR
git log --oneline --graph --all   # the map`,
  },
  {
    id: "psql",
    label: "psql",
    title: "PostgreSQL investigation",
    code: `-- what is running right now?
SELECT pid, state, wait_event_type, query_start, left(query,80)
FROM pg_stat_activity WHERE datname = current_database();

-- table sizes + bloat signal
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables ORDER BY 2 DESC LIMIT 10;

-- index usage: find dead weight
SELECT relname, indexrelname, idx_scan
FROM pg_stat_user_indexes ORDER BY idx_scan ASC LIMIT 10;

EXPLAIN (ANALYZE, BUFFERS) SELECT ...;        -- the truth

-- safe DDL on big tables
SET lock_timeout = '3s';
SET statement_timeout = '60s';`,
  },
  {
    id: "redis",
    label: "redis-cli",
    title: "Redis operations",
    code: `redis-cli info memory | grep used_memory_human
redis-cli info stats | grep instantaneous_ops_per_sec

redis-cli --bigkeys                 # scan for memory hogs
redis-cli --latency                 # watch server latency
redis-cli slowlog get 10            # slowest recent commands
redis-cli client list | awk '{print $2}' | sort | uniq -c

redis-cli ttl user:42               # check expiry
redis-cli zrevrange board 0 9 WITHSCORES
redis-cli scan 0 match user:* count 1000    # NEVER keys * in prod

redis-cli config set maxmemory-policy allkeys-lru`,
  },
  {
    id: "kafka",
    label: "kafka",
    title: "Kafka operations",
    code: `# consumer lag — THE health metric
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --all-groups

# topics & partitions
kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic orders.events
kafka-topics.sh --create --partitions 12 --replication-factor 3 \\
  --topic orders.events --bootstrap-server localhost:9092

# inspect messages (careful with prod data policies)
kafka-console-consumer.sh --topic orders.events --from-beginning \\
  --property print.key=true --max-messages 10

# rebalance / reset a group to earliest
kafka-consumer-groups.sh --reset-offsets --to-earliest \\
  --execute --group inventory-proj --topic orders.events`,
  },
  {
    id: "gha",
    label: "gh actions",
    title: "GitHub Actions snippets",
    code: `# trigger manually with inputs
on:
  workflow_dispatch:
    inputs:
      env: { type: choice, options: [staging, production] }

# cache pip + docker layers
- uses: actions/setup-python@v5
  with: { python-version: "3.12", cache: pip }
- uses: docker/build-push-action@v6
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max

# required status checks → branch protection:
#   ci/test · ci/build · security/scan
# protected environment 'production':
#   reviewers + wait timer + restricted secrets

# emergency rollback from CLI
gh run list --workflow=deploy.yml --limit 5
gh run watch <run-id>
kubectl rollout undo deploy/api`,
  },
];

export default function ReferencePage() {
  const [sheet, setSheet] = useState("docker");
  const current = SHEETS.find((s) => s.id === sheet)!;
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <header className="border-b border-line pb-7">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Reference</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Command Sheets</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-mute">
          The commands that matter during real operations — curated for diagnosis speed, not completeness.
        </p>
      </header>
      <div className="py-8">
        <Tabs
          tabs={SHEETS.map((s) => ({ id: s.id, label: s.label }))}
          active={sheet}
          onChange={setSheet}
          className="mb-4 w-fit flex-wrap"
        />
        <CodeBlock code={current.code} lang="bash" title={current.title} />
      </div>
    </div>
  );
}
