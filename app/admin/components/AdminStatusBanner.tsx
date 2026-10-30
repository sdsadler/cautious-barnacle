type AdminStatusBannerProps = {
  message?: string;
  type?: "info" | "success" | "error";
  title?: string;
};

export default function AdminStatusBanner({
  message,
  type = "info",
  title,
}: AdminStatusBannerProps) {
  if (!message) {
    return null;
  }

  const palette = {
    info: "border-[#3a3a3a] bg-[#1d1d1d] text-[#f5f5f5]",
    success: "border-[#3a3a3a] bg-[#1f2d1f] text-[#d8f7d8]",
    error: "border-[#4a2a2a] bg-[#2d1a1a] text-[#ffd7d7]",
  };

  const labels = {
    info: "Notice",
    success: "Success",
    error: "Error",
  };

  return (
    <div
      className={`mb-4 rounded border p-3 text-sm shadow-sm ${palette[type]}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[10px] font-bold">
          {type === "success" ? "✓" : type === "error" ? "!" : "i"}
        </span>
        <div>
          <div className="font-semibold">
            {title ?? labels[type]}
          </div>
          <div className="mt-1">{message}</div>
        </div>
      </div>
    </div>
  );
}
