import { ProfileSection } from "@/components/profile/profile-section";
import { BackToAppLink } from "@/components/ui/back-to-app-link";

export const metadata = {
  title: "Profile · RAG Notebook",
};

export default function ProfilePage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 px-4 py-8 sm:px-6">
      <header className="space-y-3">
        <BackToAppLink />
        <div className="space-y-1">
          <h1 className="font-display text-2xl">Profile</h1>
          <p className="text-sm text-[var(--color-fg-muted)]">
            Your account and plan.
          </p>
        </div>
      </header>
      <ProfileSection />
    </div>
  );
}
