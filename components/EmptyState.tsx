import Link from "next/link";

type EmptyStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
};

export default function EmptyState({
  title,
  message,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-[#2b2b2b] bg-[#171717] p-6 text-center shadow-lg shadow-black/10">
      <h2 className="mb-2 text-2xl text-white">{title}</h2>
      <p className="mb-4 text-sm leading-6 text-[#d9d9d9]">{message}</p>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="inline-flex items-center rounded bg-[#d1c905] px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#111111] transition hover:brightness-110"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
