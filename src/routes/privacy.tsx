import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-3xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: August 20, 2026</p>

      <div className="prose prose-neutral dark:prose-invert mt-8 space-y-6 text-foreground">
        <section>
          <h2 className="font-display text-xl font-semibold">1. Information We Collect</h2>
          <p className="mt-2 text-muted-foreground">
            Tethyr collects information you provide directly: your name, email address, handle,
            profile information, skills, projects, and community posts. We also collect usage data
            such as pages viewed, features used, and interactions with other users.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">2. How We Use Your Information</h2>
          <p className="mt-2 text-muted-foreground">
            We use your information to provide and improve the Tethyr platform, personalize your
            experience, facilitate connections between creators, and communicate with you about
            platform updates and features.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">3. Information Sharing</h2>
          <p className="mt-2 text-muted-foreground">
            We do not sell your personal information. We may share information with service
            providers who assist in operating the platform (e.g., hosting, authentication), and when
            required by law or to protect the safety of our users.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">4. Data Security</h2>
          <p className="mt-2 text-muted-foreground">
            We implement industry-standard security measures to protect your data. However, no
            method of transmission over the Internet is 100% secure, and we cannot guarantee
            absolute security.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">5. Your Rights</h2>
          <p className="mt-2 text-muted-foreground">
            You can access, update, or delete your account information at any time through your
            profile settings. You may also request a copy of all data we hold about you by
            contacting us.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">6. Cookies</h2>
          <p className="mt-2 text-muted-foreground">
            Tethyr uses essential cookies for authentication and session management. We do not use
            third-party advertising cookies or tracking pixels.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">7. Changes to This Policy</h2>
          <p className="mt-2 text-muted-foreground">
            We may update this privacy policy from time to time. We will notify you of any material
            changes by posting the new policy on this page and updating the "Last updated" date.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">8. Contact Us</h2>
          <p className="mt-2 text-muted-foreground">
            If you have questions about this privacy policy, please contact us through the Tethyr
            platform or at the email associated with your account.
          </p>
        </section>
      </div>
    </div>
  );
}
