import { Logo } from "@/components/logo";

export default function Layout(props: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Left Panel - Branding/Marketing */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-zinc-950 p-12 text-zinc-50 border-r border-zinc-800 relative overflow-hidden">
        {/* Abstract background graphics */}
        <div className="absolute inset-0 z-0">
          <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-emerald-500/20 blur-[120px]" />
          <div className="absolute top-[60%] -right-[10%] w-[50%] h-[50%] rounded-full bg-blue-500/20 blur-[120px]" />
        </div>

        <div className="relative z-10 w-fit">
          <Logo className="text-xl" />
        </div>

        <div className="relative z-10 max-w-lg mb-20 space-y-8">
          <div>
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-6 mt-12 bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
              Automate your accounting with precision.
            </h1>
            <p className="text-zinc-400 text-lg leading-relaxed mb-8">
              Join thousands of businesses streamlining their bookkeeping. Extract bank statements directly into Tally effortlessly.
            </p>
          </div>

          <div className="flex items-center gap-4 text-sm font-medium text-zinc-300 bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800/80 backdrop-blur-md w-fit shadow-xl shadow-black/20">
            <div className="flex -space-x-3">
              <div className="h-10 w-10 rounded-full border-2 border-zinc-900 bg-indigo-500 flex items-center justify-center text-xs font-bold text-white">CA</div>
              <div className="h-10 w-10 rounded-full border-2 border-zinc-900 bg-emerald-500 flex items-center justify-center text-xs font-bold text-white">TAX</div>
              <div className="h-10 w-10 rounded-full border-2 border-zinc-900 bg-blue-500 flex items-center justify-center text-xs font-bold text-white">CPA</div>
            </div>
            <div className="ml-2">
              <p className="text-zinc-100 font-semibold text-base">Built for Professionals</p>
              <p className="text-zinc-400 text-xs mt-0.5">Trusted by leading CA firms.</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-zinc-600 text-sm font-medium">
          © {new Date().getFullYear()} Number Works. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Auth Content */}
      <div className="w-full lg:w-1/2 flex flex-col relative bg-zinc-50 dark:bg-zinc-950">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
          <Logo />
        </div>

        {/* Stack Auth automatically centers itself vertically and horizontally inside the remaining flex space when fullPage is false, or takes the whole viewport if fullPage is true. If fullPage is true, we should force our layout container styling into the Stack Auth component, or just let Stack Auth take the area. */}
        <div className="flex-1 w-full bg-white dark:bg-zinc-950 relative overflow-y-auto">
          {props.children}
        </div>
      </div>
    </div>
  );
}