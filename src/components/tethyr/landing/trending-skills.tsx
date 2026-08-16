import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { DiscoverSkills } from "../discover-skills";

export function TrendingSkills() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="section-label mb-3">Trending skills</p>{" "}
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Skills people are building with right now
          </h2>
        </div>
        <Link
          to="/explore"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary"
        >
          Browse the catalog <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <DiscoverSkills limit={18} />
    </section>
  );
}
