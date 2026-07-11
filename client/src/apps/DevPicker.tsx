export function DevPicker() {
  const port = window.location.port ? `:${window.location.port}` : "";

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background text-foreground">
      <h1 className="text-lg font-semibold">Choose a portal</h1>
      <p className="max-w-sm text-center text-sm text-muted-foreground">
        This app is served per role on a subdomain. Pick one for local development.
      </p>
      <div className="flex gap-3">
        <a
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          href={`http://agent.localhost${port}`}
        >
          Agent portal
        </a>
        <a
          className="rounded-md border border-border/60 px-4 py-2 text-sm font-medium"
          href={`http://ops.localhost${port}`}
        >
          Operations portal
        </a>
      </div>
    </div>
  );
}
