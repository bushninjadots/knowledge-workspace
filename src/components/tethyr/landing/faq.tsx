const FAQS = [
  {
    q: "Is Tethyr free to use?",
    a: "Yes — Tethyr is free during early access. Create a profile, start a project, and join the community at no cost.",
  },
  {
    q: "Who is Tethyr for?",
    a: "Developers first — and the designers, makers, writers and indie hackers who build alongside them. If you make things and want people to make them with, you're in the right place.",
  },
  {
    q: "What's the Ship log?",
    a: "Once a week you post what you shipped — a feature, a fix, a design, something you learned. Connect GitHub and Tethyr drafts it from your commits, pull requests and releases; you edit and post. Others give kudos and reply, and consecutive weeks build a streak.",
  },
  {
    q: "How is Tethyr different from GitHub or LinkedIn?",
    a: "GitHub holds your code; LinkedIn holds your résumé. Tethyr is the weekly story of what you're building — pulled from GitHub, told in your words — and the people you meet through it.",
  },
  {
    q: "Do I need to have a project to join?",
    a: "No. You can join, build your profile, discover community spaces, and connect with builders before starting your own project.",
  },
  {
    q: "How does reputation work?",
    a: "It comes from what you actually do — what you ship, the people you help, endorsements from people you've built with — not from self-promotion. Profiles show the work itself, not a score.",
  },
];

export function Faq() {
  return (
    <section className="border-y border-border/60 bg-surface/40">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <div className="mb-10 text-center">
          <p className="section-label mb-3">FAQ</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Questions, answered
          </h2>
        </div>
        <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-surface/40">
          {FAQS.map((item) => (
            <details key={item.q} className="group open:bg-surface-elevated/20">
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
      </div>
    </section>
  );
}
