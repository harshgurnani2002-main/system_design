import type { Chapter } from "@/lib/types";

export const infraChapters: Chapter[] = [
  {
    slug: "docker",
    track: "infrastructure",
    num: 1,
    title: "Docker",
    subtitle:
      "Containers, images, layers, volumes and Compose — packaging anything to run identically on your laptop and in production.",
    minutes: 28,
    skills: ["infra"],
    concepts: ["container", "image", "dockerfile", "compose", "volume"],
    blocks: [
      {
        t: "p",
        md: "'Works on my machine' dies the day your app meets production. **Docker packages your application with its exact dependencies into an image** — an immutable artifact that runs as a container, identically, everywhere. It is the unit of modern deployment and the foundation Kubernetes orchestrates.",
      },
      { t: "h", text: "Images vs containers vs VMs" },
      {
        t: "diagram",
        height: 240,
        caption:
          "VMs virtualize hardware (guest OS each); containers share the host kernel — namespaces isolate what they see, cgroups limit what they use.",
        graph: {
          nodes: [
            { id: "vm", label: "VM", sub: "hypervisor + guest OS · GBs · seconds", kind: "infra", x: 20, y: 30 },
            { id: "ct", label: "Container", sub: "shared kernel · MBs · milliseconds", kind: "infra", x: 20, y: 120 },
            { id: "img", label: "Image", sub: "immutable layered template", kind: "infra", x: 20, y: 210 },
            { id: "reg", label: "Registry", sub: "push / pull images", kind: "infra", x: 300, y: 120 },
          ],
          edges: [
            { from: "img", to: "ct", label: "runs as" },
            { from: "img", to: "reg" },
            { from: "reg", to: "ct", label: "pull", dashed: true },
          ],
        },
      },
      {
        t: "list",
        items: [
          "**Image** = read-only stack of layers (each Dockerfile instruction ≈ one layer). Layers cache: reorder least-changing → most-changing.",
          "**Container** = a running process (or few) with an extra writable layer on top. Delete it and changes vanish — state belongs in volumes.",
          "**Namespaces** isolate PID/network/mount views; **cgroups** cap CPU/memory. Containers are isolated processes, not mini-VMs — that's why they start in milliseconds.",
        ],
      },
      { t: "h", text: "A production-grade Dockerfile" },
      {
        t: "code",
        lang: "dockerfile",
        title: "Multi-stage FastAPI service (~150MB final)",
        code: `# ---- build stage ----
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ---- runtime stage ----
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl \\
    && rm -rf /var/lib/apt/lists/*

# non-root user
RUN useradd -m -u 10001 appuser

COPY --from=builder /install /usr/local
WORKDIR /app
COPY src/ ./src/

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \\
  CMD curl -fsS http://localhost:8000/healthz || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]`,
      },
      {
        t: "table",
        head: ["Technique", "Why it matters"],
        rows: [
          ["Multi-stage builds", "Compilers/build tools never ship; final image is small and attack surface shrinks"],
          ["Copy requirements before code", "Dependency layer caches across code-only changes — rebuilds drop from minutes to seconds"],
          ["Non-root USER", "Container escape impact drops dramatically; required by most security policies"],
          ["Explicit HEALTHCHECK", "Orchestrators can restart unhealthy instances automatically"],
          ["One concern per container", "Logs to stdout, no SSH, no supervisor — 12-factor all the way"],
        ],
      },
      { t: "h", text: "Volumes, networks, Compose" },
      {
        t: "code",
        lang: "yaml",
        title: "docker-compose.yml — app + Postgres + Redis",
        code: `services:
  api:
    build: .
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgres://app:\${DB_PASSWORD}@db:5432/app
      REDIS_URL: redis://cache:6379
    depends_on:
      db:    { condition: service_healthy }
      cache: { condition: service_started }
    volumes:
      - ./src:/app/src          # live reload in dev

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: \${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data   # named volume survives rebuilds
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s

  cache:
    image: redis:7-alpine

volumes:
  pgdata:`,
      },
      {
        t: "callout",
        kind: "info",
        title: "Compose creates a network for you",
        md: "Services reach each other by name (`db`, `cache`) via Docker's embedded DNS — that's service discovery at lab scale, and exactly the pattern K8s Services generalize. Named volumes persist data across container lifecycles; bind mounts (`./src:...`) sync your editor's changes live.",
      },
      {
        t: "callout",
        kind: "danger",
        title: "Failure scenario: the disk-full deploy",
        md: "Six months of deploys leave hundreds of dangling images and stopped containers. The build node hits 100% disk; new pulls fail mid-layer; prod rollout stalls half-finished. **Fixes:** scheduled `docker system prune` (CI runners especially), immutable tags + digest pinning instead of `latest`, and image size budgets enforced in CI. Container hygiene is disk hygiene.",
      },
    ],
    quiz: [
      {
        id: "dk-q1",
        q: "Why put `COPY requirements.txt` + install BEFORE copying source code?",
        options: [
          "Docker requires it syntactically",
          "The dependency layer caches; source edits skip reinstalls",
          "It improves runtime performance",
          "To reduce image size",
        ],
        correct: [1],
        explain:
          "Layers invalidate top-down. Code changes after the dependency layer reuse the cached pip layer — turning minute-long builds into seconds. Classic order: system deps → language deps → source.",
      },
      {
        id: "dk-q2",
        q: "A container writes user uploads to /app/data and gets recreated. Uploads vanish because…",
        options: [
          "Containers are broken",
          "The writable layer is ephemeral; persistent paths need volumes",
          "You must commit the container first",
          "Uploads need root permissions",
        ],
        correct: [1],
        explain:
          "Everything outside volumes lives in the throwaway writable layer. Treat containers as cattle: any path that must survive belongs to a volume (or better, object storage).",
      },
      {
        id: "dk-q3",
        q: "What does multi-stage building primarily achieve?",
        options: [
          "Faster container startup",
          "Build toolchain stays out of the final image — smaller, safer artifacts",
          "Automatic horizontal scaling",
          "Layer encryption",
        ],
        correct: [1],
        explain:
          "Compile in stage one, copy only artifacts into a clean minimal stage two. Result: no compilers/package managers in prod, often 5–10× smaller images.",
      },
      {
        id: "dk-q4",
        q: "In Compose, how does the `api` service resolve hostname `db`?",
        options: [
          "Public DNS",
          "Docker's embedded DNS resolves service names on the shared network",
          "/etc/hosts mounted from the host",
          "It doesn't — you must link containers",
        ],
        correct: [1],
        explain:
          "Compose attaches services to one network where names are resolvable — the same logical pattern as K8s Service DNS. Legacy `link:` is deprecated.",
      },
    ],
    exercise: {
      prompt:
        "Containerize a small API of yours: multi-stage build, non-root user, healthcheck. Then write the three-service Compose file (api+postgres+redis), verify data survives `docker compose down && up` via the named volume, and shrink your final image by 40%+ (measure before/after).",
      hints: [
        "`docker image ls` and `dive <image>` show layer bloat.",
        "slim/alpine bases + --no-cache-dir + rm -rf apt lists add up fast.",
        "Prove non-root: docker exec whoami should NOT print root.",
      ],
    },
  },

  {
    slug: "kubernetes",
    track: "infrastructure",
    num: 2,
    title: "Kubernetes",
    subtitle:
      "Pods, Deployments, Services, Ingress, probes, autoscaling — how the control plane actually reconciles your declared state.",
    minutes: 32,
    skills: ["infra", "architecture"],
    concepts: ["kubernetes", "pod", "deployment", "hpa", "ingress", "statefulset"],
    blocks: [
      {
        t: "p",
        md: "Kubernetes runs containers across a fleet by continuously reconciling **declared desired state** against reality. You don't tell it steps ('start two pods'); you declare facts ('this Deployment wants 3 replicas') and controllers converge forever. Internalize reconcile-loops and everything else follows.",
      },
      { t: "h", text: "Control plane vs workers" },
      {
        t: "diagram",
        height: 280,
        caption:
          "API server is the only door. etcd holds state; scheduler assigns pods; controller-manager enforces desires; kubelets run them.",
        graph: {
          nodes: [
            { id: "kc", label: "kubectl / CI", kind: "client", x: 20, y: 95 },
            { id: "api", label: "API Server", sub: "authn · admission · watch", kind: "app", x: 230, y: 95 },
            { id: "etcd", label: "etcd", sub: "cluster state (Raft)", kind: "data", x: 230, y: 210 },
            { id: "sch", label: "Scheduler", sub: "bin-packs pods", kind: "app", x: 470, y: 30 },
            { id: "cm", label: "Controllers", sub: "deploy/rs/node loops", kind: "app", x: 470, y: 160 },
            { id: "n1", label: "Node 1", sub: "kubelet + kube-proxy", kind: "infra", x: 700, y: 60 },
            { id: "n2", label: "Node 2", sub: "kubelet + kube-proxy", kind: "infra", x: 700, y: 190 },
            { id: "p1", label: "Pods", kind: "infra", x: 920, y: 60 },
            { id: "p2", label: "Pods", kind: "infra", x: 920, y: 190 },
          ],
          edges: [
            { from: "kc", to: "api" },
            { from: "api", to: "etcd" },
            { from: "sch", to: "api", label: "watch" },
            { from: "cm", to: "api", label: "watch" },
            { from: "n1", to: "api", label: "watch" },
            { from: "n2", to: "api", label: "watch" },
            { from: "n1", to: "p1" },
            { from: "n2", to: "p2" },
          ],
        },
      },
      { t: "h", text: "The objects you'll use daily" },
      {
        t: "table",
        head: ["Object", "Job", "Remember"],
        rows: [
          ["Pod", "Smallest unit: 1+ containers sharing net/volumes", "Cattle, mortal, replaceable — never 'fix' a pod"],
          ["ReplicaSet", "Keeps N identical pods", "Created by Deployments, rarely hand-written"],
          ["Deployment", "Rolling updates + rollback for stateless apps", "Your default workload type"],
          ["StatefulSet", "Stable identity + ordered boot for DBs/queues", "Still doesn't manage your data — storage does"],
          ["Service", "Stable VIP + DNS over changing pod IPs", "ClusterIP internal; NodePort/LB to expose"],
          ["Ingress", "HTTP routing/TLS from outside to Services", "Needs a controller (nginx/envoy) installed"],
          ["ConfigMap / Secret", "Config & credentials injection", "Secrets are base64, not encrypted — add external KMS for real secrets"],
          ["HPA", "Autoscale replicas on metrics", "Set requests/limits FIRST or HPA has nothing to read"],
        ],
      },
      {
        t: "code",
        lang: "yaml",
        title: "A deployment worth copying",
        code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  strategy:
    rollingUpdate: { maxUnavailable: 0, maxSurge: 1 }   # zero-downtime
  selector:
    matchLabels: { app: api }
  template:
    metadata:
      labels: { app: api }
    spec:
      containers:
        - name: api
          image: registry.example.com/api:1.7.2   # immutable tag, never latest
          ports: [{ containerPort: 8000 }]
          resources:
            requests: { cpu: 250m, memory: 256Mi }  # scheduling + HPA input
            limits:   { cpu: 500m, memory: 512Mi }  # throttle/OOM-kill bounds
          readinessProbe:
            httpGet: { path: /readyz, port: 8000 }
            initialDelaySeconds: 3
          livenessProbe:
            httpGet: { path: /healthz, port: 8000 }
            periodSeconds: 10
          envFrom:
            - secretRef: { name: api-secrets }`,
      },
      {
        t: "callout",
        kind: "warn",
        title: "Liveness ≠ readiness — confuse them and outages follow",
        md: "**Readiness** gates traffic: failing it removes the pod from Service endpoints (deployments, dependency hiccups). **Liveness** means 'process is wedged': failing it RESTARTS the pod. Make liveness dependency-free — if it checks the database, one DB blip restarts every pod simultaneously and turns degradation into total outage.",
      },
      { t: "h", text: "How a request enters" },
      {
        t: "diagram",
        height: 220,
        caption:
          "Ingress terminates TLS and routes by host/path → Service (stable ClusterIP) → kube-proxy load-balances to pod IPs.",
        graph: {
          nodes: [
            { id: "u", label: "Internet", kind: "client", x: 20, y: 95 },
            { id: "ing", label: "Ingress", sub: "TLS · rules", kind: "infra", x: 220, y: 95 },
            { id: "svc", label: "Service", sub: "api.svc.cluster.local", kind: "app", x: 440, y: 95 },
            { id: "pod1", label: "Pod :8000", kind: "infra", x: 680, y: 25 },
            { id: "pod2", label: "Pod :8000", kind: "infra", x: 680, y: 165 },
          ],
          edges: [
            { from: "u", to: "ing" },
            { from: "ing", to: "svc" },
            { from: "svc", to: "pod1" },
            { from: "svc", to: "pod2" },
          ],
        },
      },
      { t: "h", text: "Rolling deploy, step by step" },
      {
        t: "list",
        ordered: true,
        items: [
          "Deployment controller creates new ReplicaSet with 1 surge pod (maxSurge).",
          "New pod schedules onto a node with free CPU per **requests**; kubelet pulls image, starts container.",
          "Readiness probe passes → endpoints controller adds pod to Service; traffic flows.",
          "ReplicaSet scales old RS down by 1 (maxUnavailable 0) — graceful termination drains connections.",
          "Repeat until all replicas are new. Old ReplicaSet kept at 0 → `kubectl rollout undo` in seconds.",
        ],
      },
      {
        t: "callout",
        kind: "danger",
        title: "Failure scenario: the OOMKill loop",
        md: "A pod's memory limit is 512Mi but the app's heap grows to 600Mi under peak load. Kernel OOM-kills it; Deployment restarts it; it warms up, takes traffic, grows, dies again — crash-loop every ~4 minutes during peaks, invisible unless you alert on `container_memory_working_set_bytes / limit`. **Fixes:** right-size limits from measured p99×1.3, alert at 80% sustained, and remember CPU limits cause throttling (latency!) while memory limits cause death.",
      },
    ],
    quiz: [
      {
        id: "k8s-q1",
        q: "During a rolling update, when does a new pod receive traffic?",
        options: [
          "Immediately when the container starts",
          "When its readinessProbe first succeeds and it joins Service endpoints",
          "After livenessProbe passes twice",
          "When the Deployment completes",
        ],
        correct: [1],
        explain:
          "Endpoints membership is driven by readiness. That's why readiness should reflect true serving capability — it IS the traffic gate for deploys, scale-ups and node drains.",
      },
      {
        id: "k8s-q2",
        q: "Why should liveness probes avoid checking database connectivity?",
        options: [
          "Probes cannot reach other pods",
          "A DB outage would fail liveness everywhere, restarting all pods and converting degradation into full outage",
          "It slows the kubelet",
          "K8s forbids external calls in probes",
        ],
        correct: [1],
        explain:
          "Liveness answers 'is this process wedged?' A dead DB makes pods unhealthy-but-restartable-worthless. Keep liveness local; express dependency trouble through readiness/degradation and alerts.",
      },
      {
        id: "k8s-q3",
        q: "HPA shows 'unknown' metrics and never scales. Most likely cause?",
        options: [
          "Too many replicas",
          "Containers lack resource requests (or metrics-server missing)",
          "Ingress misconfigured",
          "Wrong namespace",
        ],
        correct: [1],
        explain:
          "HPA computes utilization as usage/request. No request → no denominator → unknown. Install metrics-server and set requests; then utilization-based scaling works.",
      },
      {
        id: "k8s-q4",
        q: "What does a Service provide that raw pod IPs don't?",
        options: [
          "Encryption",
          "A stable virtual IP/DNS name that tracks healthy pods automatically",
          "Persistent storage",
          "Autoscaling",
        ],
        correct: [1],
        explain:
          "Pods are mortal with changing IPs. The Service abstraction (via label selectors + endpoints) gives consumers one address while kube-proxy routes to current healthy backends.",
      },
    ],
    exercise: {
      prompt:
        "Deploy the Compose stack from the Docker chapter into a local cluster (kind/minikube): Deployment+Service for api, StatefulSet-style Postgres (or managed addon), ConfigMap/Secret wiring, Ingress with TLS via localhost. Then: scale api 1→5, kill a pod mid-load-test, and perform a bad-deploy + `rollout undo`. Record what your probes did at each step.",
      hints: [
        "kind get clusters → kubectl config use-context kind-kind.",
        "Watch rollouts live: kubectl get pods -w and kubectl describe svc api (endpoints!).",
        "Break deliberately: wrong probe path, missing secret, OOM limit — learn the failure signatures now.",
      ],
    },
  },

  {
    slug: "git-and-github",
    track: "infrastructure",
    num: 3,
    title: "Git & GitHub Workflows",
    subtitle:
      "Branching, rebase vs merge, conflict surgery, PR discipline and branch protection — version control as a team sport.",
    minutes: 22,
    skills: ["infra"],
    concepts: ["git", "rebase", "pull-request"],
    blocks: [
      {
        t: "p",
        md: "Git is a **content-addressed graph of snapshots**, not a folder of diffs. Every commit points to a tree of files plus its parents; branches are movable labels. Once that clicks, rebase/reset/cherry-pick stop being magic and become graph editing.",
      },
      { t: "h", text: "The daily graph operations" },
      {
        t: "code",
        lang: "bash",
        title: "Commands that cover 95% of real work",
        code: `git switch -c feat/rate-limiter          # new branch off main
git add -p                                # stage hunk-by-hunk (review yourself!)
git commit -m "feat: sliding-window limiter"

git pull --rebase origin main             # replay your work atop latest main
git push -u origin feat/rate-limiter

# --- review feedback round ---
git add -p && git commit --amend          # fold into last commit
git push --force-with-lease               # safe force: refuses if remote moved

# --- rescue operations ---
git restore --staged file                 # unstage
git restore file                          # discard working changes
git revert <sha>                          # NEW commit undoing an old one (safe on main)
git reset --soft HEAD~1                   # uncommit, keep changes staged
git reflog                                # time machine — almost nothing is lost`,
      },
      {
        t: "table",
        head: ["", "merge", "rebase"],
        rows: [
          ["History", "Preserves true topology + merge commits", "Linear, rewritten — reads like a story"],
          ["Safety", "Never rewrites existing commits", "Rewrites YOUR unpushed commits only"],
          ["Use", "Integrating long-lived/shared branches", "Updating a feature branch; cleaning pre-PR history"],
        ],
      },
      {
        t: "callout",
        kind: "danger",
        title: "The iron rule",
        md: "Never rewrite commits others may have pulled (`git rebase` on shared branches, `push --force` without lease). Rewriting shared history invalidates every teammate's clone and CI caches. On main: revert. On your feature branch: rebase freely.",
      },
      { t: "h", text: "Conflict surgery" },
      {
        t: "code",
        lang: "bash",
        title: "Resolving like an adult",
        code: `git rebase origin/main
# CONFLICT in src/limiter.py
git status                     # list conflicted files (both modified)
# edit files: search <<<<<<< markers, choose/combine intent
git diff                       # verify the RESULT, not just the markers
git add src/limiter.py
git rebase --continue
# panic exit hatch: git rebase --abort`,
      },
      {
        t: "p",
        md: "Conflicts are semantic questions, not text questions: both sides changed the rate limit — which intent wins? Read the surrounding logic, not just the marker block. And keep branches short-lived; a two-day-old branch rarely conflicts, a two-month-old branch is archaeology.",
      },
      { t: "h", text: "Pull requests that reviewers love" },
      {
        t: "list",
        items: [
          "**Small.** Under ~400 changed lines gets real review; 2000-line PRs get rubber-stamped approval and production incidents.",
          "**Description = why**: problem, approach, alternatives rejected, screenshots/benchmarks, rollout plan and rollback.",
          "**CI green before human review** — let machines find the typos.",
          "**Review your own diff first.** You'll catch half the comments yourself.",
        ],
      },
      {
        t: "code",
        lang: "yaml",
        title: ".github/CODEOWNERS + protection essentials",
        code: `# CODEOWNERS — auto-request the right reviewers
/src/limiter/   @platform-team
/infra/         @sre-team

# Branch protection for main (Settings → Branches):
# ✓ Require PR reviews: 1+
# ✓ Require status checks: ci/test, ci/lint, ci/build
# ✓ Require linear history (enables rebase workflow)
# ✓ Dismiss stale approvals on new commits`,
      },
    ],
    quiz: [
      {
        id: "git-q1",
        q: "A bad commit reached main an hour ago and others have built on it. Cleanest fix?",
        options: [
          "git reset --hard <before-bad> && git push --force",
          "git revert <bad-sha> creating a new inverse commit",
          "Delete the repository",
          "Edit history with filter-branch",
        ],
        correct: [1],
        explain:
          "Revert adds a forward commit undoing the change without rewriting history — safe with collaborators and CI. Force-pushing rewritten main breaks everyone who pulled.",
      },
      {
        id: "git-q2",
        q: "Why prefer `--force-with-lease` over `--force`?",
        options: [
          "It's faster",
          "It refuses the push if the remote moved since your last fetch, preventing clobbering teammates' commits",
          "It preserves merge commits",
          "No difference",
        ],
        correct: [1],
        explain:
          "Plain force overwrites whatever is remote. With-lease checks your remembered remote state matches reality — a seatbelt for legitimate history rewrites on your own branches.",
      },
      {
        id: "git-q3",
        q: "Which PR practice most improves review quality?",
        options: [
          "Detailed commit messages only",
          "Small diffs (<400 lines) with a description explaining WHY and the rollback plan",
          "Assigning two reviewers",
          "Opening PRs early with failing CI",
        ],
        correct: [1],
        explain:
          "Research and experience agree: review quality collapses as diff size grows. Small scope + clear rationale beats reviewer count.",
      },
    ],
    exercise: {
      prompt:
        "Deliberately create a conflict between two branches editing the same lines; resolve it preserving BOTH intents. Then make a messy feature branch (5 WIP commits) and squash it into 3 clean conventional commits via interactive rebase. Finally, break something on a clone of main, revert it, and inspect git log --graph to see the topology.",
      hints: [
        "git rebase -i HEAD~5 → pick/squash/reword.",
        "Conventional commits (feat:, fix:, chore:) make changelogs automatic later.",
        "git log --oneline --graph --all is your map.",
      ],
    },
  },

  {
    slug: "github-actions",
    track: "infrastructure",
    num: 4,
    title: "CI/CD with GitHub Actions",
    subtitle:
      "Pipelines that test, build, scan and deploy automatically — with caching, environments and instant rollback.",
    minutes: 24,
    skills: ["infra"],
    concepts: ["ci-cd", "github-actions", "canary", "rollback"],
    blocks: [
      {
        t: "p",
        md: "CI/CD turns 'we should probably test that' into an automated gate nobody can forget. GitHub Actions models pipelines as **workflows** of **jobs** (parallel by default) made of **steps**, triggered by repo events. The craft is designing stages that fail fast, cache aggressively, and deploy safely.",
      },
      { t: "h", text: "The pipeline anatomy" },
      {
        t: "diagram",
        height: 260,
        caption:
          "Fast checks gate expensive ones; deploy happens only from protected main, tagged images, with automatic rollback on failed health checks.",
        graph: {
          nodes: [
            { id: "push", label: "Git Push", kind: "client", x: 20, y: 120 },
            { id: "lint", label: "Lint", sub: "~30s", kind: "app", x: 200, y: 40 },
            { id: "test", label: "Tests", sub: "matrix: py3.11/3.12", kind: "app", x: 200, y: 200 },
            { id: "build", label: "Build Image", sub: "multi-stage + cache", kind: "infra", x: 420, y: 120 },
            { id: "scan", label: "Security Scan", sub: "trivy · CVE gate", kind: "infra", x: 620, y: 120 },
            { id: "reg", label: "Registry", sub: "tag = git SHA", kind: "data", x: 800, y: 40 },
            { id: "dep", label: "Deploy", sub: "staging → prod", kind: "app", x: 800, y: 200 },
            { id: "hc", label: "Health Check", sub: "auto-rollback", kind: "infra", x: 1000, y: 200 },
          ],
          edges: [
            { from: "push", to: "lint" },
            { from: "push", to: "test" },
            { from: "lint", to: "build" },
            { from: "test", to: "build" },
            { from: "build", to: "scan" },
            { from: "scan", to: "reg" },
            { from: "reg", to: "dep" },
            { from: "dep", to: "hc" },
          ],
        },
      },
      {
        t: "code",
        lang: "yaml",
        title: ".github/workflows/ci.yml — the real thing",
        code: `name: ci
on:
  push: { branches: [main] }
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: test }
        options: >-
          --health-cmd pg_isready --health-interval 5s --health-retries 10
        ports: ["5432:5432"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12", cache: pip }
      - run: pip install -r requirements.txt
      - run: pytest -q --cov=src --cov-fail-under=80
        env: { DATABASE_URL: postgres://postgres:test@localhost:5432/postgres }

  build-push:
    needs: test
    if: github.ref == 'refs/heads/main'
    permissions: { contents: read, packages: write }
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with: { registry: ghcr.io, username: \${{ github.actor }}, password: \${{ secrets.GITHUB_TOKEN }} }
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ghcr.io/\${{ github.repository }}:\${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - name: Vulnerability gate
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ghcr.io/\${{ github.repository }}:\${{ github.sha }}
          severity: CRITICAL,HIGH
          exit-code: "1"

  deploy:
    needs: build-push
    environment: production        # protected env → manual approval possible
    steps:
      - run: kubectl set image deploy/api api=ghcr.io/$REPO:\${{ github.sha }}
      - run: kubectl rollout status deploy/api --timeout=120s
        # nonzero exit here = failed health = visible red X`,
      },
      {
        t: "table",
        head: ["Practice", "Payoff"],
        rows: [
          ["Fail-fast ordering", "Lint (30s) kills PRs before tests (5min) run"],
          ["Cache dependencies AND docker layers", "Pipeline minutes drop 50–90%; GHA cache keyed on lockfiles"],
          ["Tag images with git SHA", "Any deployed artifact traces to exact code; 'latest' is forbidden"],
          ["Protected environments", "Prod deploys require approval + restricted secrets"],
          ["Rollout status as the gate", "Failed health check fails the pipeline → page someone, don't hope"],
        ],
      },
      {
        t: "callout",
        kind: "ok",
        title: "Rollback is a first-class feature",
        md: "Deploys fail even with perfect pipelines. The recovery reflex must be mechanical: `kubectl rollout undo deploy/api` returns to the previous ReplicaSet in seconds. Practice it BEFORE you need it — time yourself. If rollback takes longer than five minutes, your pipeline isn't done.",
      },
      {
        t: "callout",
        kind: "danger",
        title: "Failure scenario: the poisoned cache",
        md: "A flaky integration test fails once; someone re-runs with a flag skipping it; green pipeline deploys a broken image. Weeks later a different symptom appears and nobody connects it. **Rules:** never skip tests to 'unblock' (fix or explicitly disable with a tracking issue), treat flaky tests as P2 bugs, and make re-run-with-skip impossible via required checks.",
      },
    ],
    quiz: [
      {
        id: "ci-q1",
        q: "Why tag images with the git SHA instead of `latest`?",
        options: [
          "SHAs sort alphabetically",
          "Exact traceability from any running container back to its code, and no ambiguity about what 'latest' means",
          "Registries require unique tags",
          "It compresses better",
        ],
        correct: [1],
        explain:
          "`latest` is a moving target: two pods can run different code believing they're identical. Immutable SHA tags make audits, rollbacks and incident forensics deterministic.",
      },
      {
        id: "ci-q2",
        q: "Trivy finds a CRITICAL CVE in a base package. Pipeline exits 1. Correct response?",
        options: [
          "Lower severity threshold",
          "Patch/upgrade the dependency, or accept risk explicitly with a documented, expiring waiver",
          "Disable scanning",
          "Deploy anyway but monitor",
        ],
        correct: [1],
        explain:
          "Gates only work if bypassing them is harder than fixing. Waivers exist for genuine blockers but must be explicit, owned and expiring — silent threshold-lowering erodes the whole control.",
      },
      {
        id: "ci-q3",
        q: "What makes `kubectl rollout status` valuable in the deploy job?",
        options: [
          "It speeds up deployments",
          "It blocks until the rollout completes healthily — failed probes fail the pipeline visibly",
          "It rolls back automatically",
          "It generates release notes",
        ],
        correct: [1],
        explain:
          "Without it, the pipeline reports success the moment kubectl accepts the command — while pods crash-loop. Watching rollout completion converts silent bad deploys into immediate, actionable failures.",
      },
    ],
    exercise: {
      prompt:
        "Add a complete Actions pipeline to your containerized project: lint+test with a Postgres service, buildx with GHA layer caching, Trivy gate, and a deploy job gated by a protected environment. Then rehearse disaster: deploy a deliberately broken image, watch rollout status fail, and execute rollback — target: under 3 minutes end to end.",
      hints: [
        "actions/cache for pip; buildx cache-to=type=gha for layers.",
        "Environment protection rules live in repo Settings → Environments.",
        "Time the rollback drill; write the number down where on-call can find it.",
      ],
    },
  },

  {
    slug: "observability",
    track: "infrastructure",
    num: 5,
    title: "Observability",
    subtitle:
      "Logs, metrics, traces — the three pillars that turn 'it's slow somewhere' into a five-minute diagnosis.",
    minutes: 26,
    skills: ["observability"],
    concepts: ["observability", "correlation-id", "red-metrics", "distributed-tracing", "slo"],
    blocks: [
      {
        t: "p",
        md: "Monitoring tells you **that** something is wrong; observability lets you ask **why** — interrogating arbitrary dimensions of live systems without shipping new code. The three pillars aren't products, they're questions: metrics (is it healthy?), logs (what happened?), traces (where did time go?).",
      },
      { t: "h", text: "Metrics: RED and USE" },
      {
        t: "table",
        head: ["Framework", "For", "Questions"],
        rows: [
          ["RED — Rate, Errors, Duration", "Request-driven services", "How busy? How broken? How fast? (per endpoint!)"],
          ["USE — Utilization, Saturation, Errors", "Resources (CPU, pools, queues)", "How full? How backed up? Failing?"],
        ],
      },
      {
        t: "list",
        items: [
          "Always instrument **histograms**, not averages: p50/p95/p99 expose the tail where users live. An average of 80ms happily hides 5% of requests burning 4s.",
          "Alert on **symptoms users feel** (SLO burn rates: 'error budget consuming too fast'), not causes ('CPU>80%' pages nobody about user pain).",
          "Cardinality discipline: labels like `endpoint`, `method` fine; `user_id` will explode Prometheus — aggregate elsewhere.",
        ],
      },
      { t: "h", text: "Traces: the request's biography" },
      {
        t: "diagram",
        height: 250,
        caption:
          "One trace ID threads through every hop. Spans expose exactly where 480ms went — the gateway span shows the cache miss dominating.",
        graph: {
          nodes: [
            { id: "gw", label: "gateway", sub: "span 480ms total", kind: "app", x: 20, y: 95 },
            { id: "auth", label: "auth.check", sub: "12ms", kind: "app", x: 250, y: 15 },
            { id: "svc", label: "feed.render", sub: "455ms", kind: "app", x: 250, y: 175 },
            { id: "rc", label: "redis.get", sub: "MISS 3ms", kind: "cache", x: 500, y: 105 },
            { id: "db", label: "pg.query", sub: "430ms ⚠ seq scan", kind: "data", x: 500, y: 225 },
          ],
          edges: [
            { from: "gw", to: "auth" },
            { from: "gw", to: "svc" },
            { from: "svc", to: "rc" },
            { from: "rc", to: "db", label: "miss → query" },
          ],
        },
      },
      {
        t: "code",
        lang: "python",
        title: "OpenTelemetry: instrument once, export anywhere",
        code: `from opentelemetry import trace
from opentelemetry.sdk.resources import Resource

tracer = trace.get_tracer("feed")

resource = Resource.create({
    "service.name": "feed-api",
    "service.version": os.environ["GIT_SHA"],
})

@app.get("/feed")
def feed(user_id: str):
    with tracer.start_as_current_span("render_feed") as span:
        span.set_attribute("user.id", user_id)
        cached = redis.get(f"feed:{user_id}")
        if not cached:
            span.set_attribute("cache.hit", False)
            posts = db.fetch_feed(user_id)     # child span auto-created
        ...
    # propagate: traceparent header rides along automatically`,
      },
      { t: "h", text: "Logs: structured or useless" },
      {
        t: "code",
        lang: "json",
        title: 'Searchable JSON > poetic prose',
        code: `{"ts":"2026-08-21T14:03:22.481Z","level":"error",
 "service":"feed-api","trace_id":"a1b2c3d4e5f6","span_id":"99aa",
 "user_id":"u_8842","endpoint":"/feed","status":500,
 "err":"ConnectionError: pg-primary:5432 timeout after 1000ms",
 "attempt":2,"duration_ms":1002}`,
      },
      {
        t: "list",
        items: [
          "One line = one event = one JSON object. Grep died with the last monolith; Loki/Elasticsearch query fields.",
          "**Correlation IDs are non-negotiable:** generate at the edge, propagate via headers, log on every line. The jump from 'error spike' to 'all errors share trace X on shard 3' is the observability superpower.",
          "Log levels mean things: ERROR = human attention now; WARN = trend to watch; INFO = business events; DEBUG = off in prod by default.",
          "Never log secrets, tokens, or full card numbers. Log destinations leak — design accordingly.",
        ],
      },
      {
        t: "callout",
        kind: "info",
        title: "The incident walkthrough this academy simulates",
        md: "In the Observability Lab you'll face a live-looking dashboard: p99 climbing, error rate rising, logs flooding with timeout stacks. The trace view shows every slow request funneling through one Redis call — a hot key. Diagnosis path: RED metric flags symptom → SLO burn alert pages → exemplar trace pinpoints hop → log line confirms key name → fix ships. That loop, muscle-memoryed, is what this chapter is for.",
      },
      {
        t: "callout",
        kind: "danger",
        title: "Failure scenario: dashboards lie by aggregation",
        md: "Global p99 looks flat at 120ms. Support floods with 'app slow' tickets from ONE region. The global metric hides a regional collapse behind healthy majority traffic. **Lesson:** slice golden metrics by region/AZ/instance-class from day one, and alert on per-segment SLOs. Aggregates are for trends; segments are for truth.",
      },
    ],
    quiz: [
      {
        id: "ob-q1",
        q: "Average latency is stable but complaints rise. First instrumentation gap to check?",
        options: [
          "CPU graphs",
          "Percentiles (p95/p99) — averages hide tail latency where affected users live",
          "Disk space",
          "Number of pods",
        ],
        correct: [1],
        explain:
          "Averages smooth away the tail. If p99 tripled while mean held steady, a minority segment (region, tenant, query shape) is suffering — percentiles reveal it, means conceal it.",
      },
      {
        id: "ob-q2",
        q: "What makes distributed tracing actually powerful in an incident?",
        options: [
          "Pretty waterfall charts",
          "One trace ID correlating every hop, exposing precisely which service/span consumed the latency",
          "It replaces logging",
          "Sampling reduces cost",
        ],
        correct: [1],
        explain:
          "Traces answer 'where did the 2 seconds go?' across service boundaries — the question logs and metrics alone answer slowly, hop by hop.",
      },
      {
        id: "ob-q3",
        q: "Which alert fires when users are ACTUALLY suffering (vs a cause proxy)?",
        options: [
          "CPU > 80% for 10 min",
          "SLO error-budget burn rate exceeding threshold",
          "Memory above 90%",
          "Deploy finished",
        ],
        correct: [1],
        explain:
          "Burn-rate alerts derive from user-facing success-rate/latency objectives. Cause-based alerts (CPU etc.) belong in dashboards for investigation, not paging.",
      },
      {
        id: "ob-q4",
        q: "Why is labeling metrics with user_id dangerous in Prometheus?",
        options: [
          "Privacy only",
          "Unbounded cardinality: millions of label combinations explode memory and query cost",
          "Prometheus forbids strings",
          "It slows down Grafana rendering only",
        ],
        correct: [1],
        explain:
          "Each unique label set is a stored time series. user_id multiplies series count by user count — OOM'd Prometheuses have shipped. Aggregate high-cardinality dims in traces/logs instead.",
      },
    ],
    exercise: {
      prompt:
        "Instrument your lab API with OpenTelemetry (traces + RED metrics), ship to a local Grafana stack (LGTM all-in-one container), and generate load. Create: a p99 panel sliced by endpoint, an error-budget burn alert, and a log→trace deep link. Then inject 300ms latency into Redis and walk the full diagnosis path using ONLY the dashboards.",
      hints: [
        "grafana/otel-lgtm image bundles Loki-Grafana-Tempo-Prometheus for local dev.",
        "Exemplars link histogram buckets to example traces — enable them.",
        "Write down your diagnosis time; repeat after adding the second failure mode.",
      ],
    },
  },
];
