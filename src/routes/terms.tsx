import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: TermsOfService,
});

function TermsOfService() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-semibold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: August 20, 2026</p>

      <div className="prose prose-neutral dark:prose-invert mt-8 space-y-6 text-foreground">
        <section>
          <h2 className="font-display text-xl font-semibold">1. Acceptance of Terms</h2>
          <p className="mt-2 text-muted-foreground">
            By accessing or using Tethyr, you agree to be bound by these Terms of Service.
            If you do not agree, do not use the platform.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">2. Account Responsibilities</h2>
          <p className="mt-2 text-muted-foreground">
            You are responsible for maintaining the security of your account and for all
            activities that occur under your account. You must provide accurate and complete
            information when creating your account.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">3. User Content</h2>
          <p className="mt-2 text-muted-foreground">
            You retain ownership of all content you post on Tethyr. By posting content, you
            grant Tethyr a non-exclusive license to display, distribute, and promote your
            content on the platform.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">4. Community Standards</h2>
          <p className="mt-2 text-muted-foreground">
            You agree to interact respectfully with other users, not to harass, spam, or
            impersonate others, and not to post content that is illegal, harmful, or violates
            the rights of others.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">5. Intellectual Property</h2>
          <p className="mt-2 text-muted-foreground">
            Tethyr and its original content, features, and functionality are owned by Tethyr
            and are protected by copyright, trademark, and other intellectual property laws.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">6. Termination</h2>
          <p className="mt-2 text-muted-foreground">
            We may suspend or terminate your account at any time for conduct that violates
            these terms or is harmful to other users, the platform, or third parties.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">7. Limitation of Liability</h2>
          <p className="mt-2 text-muted-foreground">
            Tethyr is provided "as is" without warranties of any kind. We shall not be liable
            for any indirect, incidental, special, consequential, or punitive damages resulting
            from your use of the platform.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">8. Changes to Terms</h2>
          <p className="mt-2 text-muted-foreground">
            We reserve the right to modify these terms at any time. Continued use of the
            platform after changes constitutes acceptance of the new terms.
          </p>
        </section>
      </div>
    </div>
  );
}
