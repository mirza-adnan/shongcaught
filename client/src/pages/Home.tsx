import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  {
    title: "Auth, ready to go",
    description: "Email/password and Google sign-in wired into JWT-based sessions.",
  },
  {
    title: "AI with fallback",
    description: "Groq, Gemini, and OpenRouter chained together so a slow model never blocks you.",
  },
  {
    title: "Typed data layer",
    description: "Drizzle ORM over Postgres, with docker-compose for local development.",
  },
];

export function Home() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-24 px-6 py-24">
      <section className="flex flex-col items-center gap-6 text-center">
        <span className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">
          Built for shipping fast
        </span>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          A minimal, modular starting point for your next hackathon
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Express + TypeScript backend, React + Vite frontend, Postgres via Drizzle, and an AI
          module that just works.
        </p>
        <div className="flex items-center gap-3">
          <Button size="lg">Get started</Button>
          <Button size="lg" variant="outline">
            View docs
          </Button>
        </div>
      </section>

      <section id="features" className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <Card key={feature.title} className="border-border/60 bg-card/50">
            <CardHeader>
              <CardTitle className="text-base">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {feature.description}
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
