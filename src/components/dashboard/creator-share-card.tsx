import { CopyLink } from "@/components/shared/copy-link";
import { CreatorQr } from "@/components/dashboard/creator-qr";

export function CreatorShareCard({ publicUrl, username }: { publicUrl: string; username: string }) {
  return (
    <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
      <p className="text-sm text-muted">Tu página</p>
      <p className="mt-2 truncate text-lg font-semibold text-accent">{publicUrl.replace(/^https?:\/\//, "")}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <CopyLink url={publicUrl} label="Copiar link" />
        <CreatorQr publicUrl={publicUrl} username={username} />
      </div>
    </section>
  );
}
