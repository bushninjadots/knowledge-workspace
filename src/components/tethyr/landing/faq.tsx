const FAQS = [
  {
    q: "Is Tethyr free to use?",
    a: "Yes — Tethyr is free during early access. Create a profile, start a project, and join the community at no cost.",
  },
  {
    q: "Who is Tethyr for?",
    a: "Developers, designers, writers, musicians, researchers, founders, artists — anyone making something tangible and looking for collaborators.",
  },
  {
    q: "How is Tethyr different from GitHub or LinkedIn?",
    a: "GitHub showcases code; LinkedIn showcases résumés. Tethyr showcases the journey — your projects, contributions, and growth, all in public.",
  },
  {
    q: "Do I need to have a project to join?",
    a: "No. You can join, build your profile, discover community spaces, and connect with builders before starting your own project.",
  },
  {
    q: "How does reputation work?",
    a: "Reputation comes from real contributions — completed milestones, endorsements from peers, and challenges you've won — not from self-promotion.",
  },
];

export function Faq() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <div className="mb-10 text-center">
        <p className="section-label mb-3">FAQ</p>
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Questions, answered
        </h2>
      </div>
      <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-surface/40">
        {FAQS.map((item) => (
          <details key={item.q} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-sm font-medium transition hover:bg-surface-elevated/30">
              {item.q}
              <span className="mt-0.5 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-45">
                +
              </span>
            </summary>
            <div className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
