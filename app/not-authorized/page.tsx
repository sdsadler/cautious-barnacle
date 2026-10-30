import Link from "next/link";

export default function NotAuthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-lg rounded-xl border border-amber-200 bg-white p-8 text-center shadow-lg">
        <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-amber-600">
          Access required
        </p>
        <h1 className="mb-4 text-3xl font-bold text-slate-900">Admin access required</h1>
        <p className="mb-6 text-slate-600">
          Your account is signed in, but it does not have the required admin permissions.
        </p>

        <div className="flex justify-center gap-3">
          <Link
            href="/login"
            className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Sign in as admin
          </Link>
          <Link
            href="/"
            className="rounded-md border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
