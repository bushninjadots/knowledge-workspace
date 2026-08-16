import { FeaturedHeroCard } from "./featured-hero-card";
import { HeroActivityPanel } from "./hero-activity-panel";

export function HeroShowcase() {
  return (
    <div className="relative hidden flex-col gap-6 lg:flex">
      <HeroActivityPanel />
      <FeaturedHeroCard />
    </div>
  );
}
