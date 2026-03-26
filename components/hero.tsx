import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Hero(props: {
  capsuleText: string;
  capsuleLink: string;
  title: string;
  subtitle: string;
  credits?: React.ReactNode;
  primaryCtaText: string;
  primaryCtaLink: string;
  secondaryCtaText: string;
  secondaryCtaLink: string;
}) {
  return (
    <section className="relative space-y-6 py-32 md:py-48 lg:py-52 overflow-hidden flex items-center justify-center min-h-[90vh] bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      {/* Dynamic Background Gradients */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[10%] left-[20%] w-[40%] h-[40%] rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[20%] w-[40%] h-[40%] rounded-full bg-blue-500/10 dark:bg-blue-500/20 blur-[120px]" />
      </div>

      <div className="container relative z-10 flex max-w-[64rem] flex-col items-center gap-6 text-center transition-all duration-500 hover:scale-[1.01]">
        <Link
          href={props.capsuleLink}
          className="group relative inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 backdrop-blur-md transition-all hover:bg-emerald-500/20 shadow-sm cursor-pointer"
          target="_blank"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          {props.capsuleText}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
        <h1 className="font-heading text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight bg-gradient-to-br from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-500 bg-clip-text text-transparent pb-4 drop-shadow-sm h-auto sm:h-auto lg:h-[180px]">
          {props.title}
        </h1>
        <p className="max-w-[42rem] mt-2 sm:mt-0 leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-xl sm:leading-8">
          {props.subtitle}
        </p>
        <div className="flex gap-4 flex-wrap justify-center mt-6">
          <Link
            href={props.primaryCtaLink}
            className={cn(buttonVariants({ size: "lg" }), "rounded-full px-8 py-6 text-lg font-semibold bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 shadow-xl transition-all hover:-translate-y-1 group")}
          >
            {props.primaryCtaText}
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>

          <Link
            href={props.secondaryCtaLink}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-full px-8 py-6 text-lg font-semibold bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all hover:-translate-y-1")}
          >
            {props.secondaryCtaText}
          </Link>
        </div>

        {props.credits && (
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-8 flex items-center justify-center gap-2 bg-zinc-100/50 dark:bg-zinc-900/50 px-4 py-2 rounded-full backdrop-blur-sm border border-zinc-200 dark:border-zinc-800">
            {props.credits}
          </p>
        )}
      </div>
    </section>
  );
}
