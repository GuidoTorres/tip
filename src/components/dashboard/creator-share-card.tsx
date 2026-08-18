import { CopyLink } from "@/components/shared/copy-link";
import { CreatorQr } from "@/components/dashboard/creator-qr";

export function CreatorShareCard({ publicUrl, username }: { publicUrl: string; username: string }) {
  return (
    <div aria-label="Compartir página" className="flex min-w-0 items-center justify-end gap-1">
      <p className="min-w-0 truncate text-right text-sm font-semibold opacity-80">{publicUrl.replace(/^https?:\/\//, "")}</p>
      <CopyLink url={publicUrl} iconOnly inverse />
      <CreatorQr publicUrl={publicUrl} username={username} iconOnly inverse />
    </div>
  );
}
