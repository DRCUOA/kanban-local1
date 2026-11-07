// Railway Infrastructure as Code for Kanbando: Railway project "Kanbando", service
// "kanban-local1". It replaced railway.json (Config as Code, which Railway stops reading on
// 2026-12-01) and was first applied on 7 Nov 2026.
//
// Railway does not read this file at deploy time. `railway config plan` previews it against the
// linked environment and `railway config apply` writes it into the service's settings, which
// every later deploy then uses. An apply also starts a deploy. README.md ("Production on
// Railway") has the steps.
//
// Declare every setting the service should keep: the first plan showed that leaving `source`
// or the restart retries out of this file clears them.
import { defineRailway, github, project, service } from 'railway/iac';

// A named partial: this file owns the kanban-local1 service and nothing else, so an apply can
// never delete or change the Postgres service, which it does not declare. It is the shape
// `railway config migrate` writes for a single-service repository.
export const partial = 'kanban-local1';

export default defineRailway(() => {
  const app = service('kanban-local1', {
    // Without a source the plan disconnects the service from GitHub.
    source: github('DRCUOA/kanban-local1', { branch: 'main', checkSuites: false }),
    // The apply of 7 Nov 2026 left the service's builder at Railpack (cause not known), so every
    // plan lists this one change. Railway builds from the root Dockerfile regardless: that
    // deploy's build log loads it and runs its node:24-slim stages.
    build: { builder: 'DOCKERFILE' },
    start: 'node dist/index.cjs',
    healthcheck: '/api/health',
    healthcheckTimeout: 120,
    // Restart on failure, at most once: the service's setting before this file.
    deploy: { restartPolicyMaxRetries: 1 },
    // No pre-deploy command, and the file cannot pin one to null (the SDK drops nulls). The server
    // runs its own migrations at start-up. A dashboard `npm run db:push` pre-deploy once broke
    // every deploy (BUGLOG.md), so never set one in the dashboard.
  });

  // Variables stay out of this file. Without `managed: false` the CLI's default is that the file
  // owns every variable on the service, and DATABASE_URL and the secrets are not declared here.
  // This is the line `railway config migrate --variables unmanaged` writes. SDK 3.16.0's types
  // do not list `variables` yet, though `project()` passes it through, so the definition goes in
  // as a variable rather than a literal.
  const definition = { variables: { managed: false }, resources: [app] };
  return project('Kanbando', definition);
});
