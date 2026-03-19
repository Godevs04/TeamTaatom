import { Skeleton } from "@/components/ui/skeleton";

export default function FeedLoading() {
  return (
    <div className="relative space-y-5 sm:space-y-6 lg:space-y-8">
      <div className="pointer-events-none absolute inset-x-0 -top-6 h-80 overflow-hidden opacity-80" aria-hidden>
        <div className="absolute -left-24 top-0 h-64 w-64 rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="absolute right-0 top-16 h-72 w-72 rounded-full bg-violet-500/[0.05] blur-3xl" />
      </div>
      <div className="relative z-10 space-y-5 sm:space-y-6 lg:space-y-8">
        <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-5 shadow-premium backdrop-blur-sm sm:p-6 md:p-8">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-9 w-56 max-w-full" />
          <Skeleton className="mt-2 h-4 w-full max-w-lg" />
          <div className="mt-5 flex flex-wrap gap-3">
            <Skeleton className="h-11 w-[200px] max-w-full rounded-2xl" />
            <Skeleton className="h-10 w-10 rounded-xl" />
          </div>
        </div>
        <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-4 shadow-premium backdrop-blur-sm sm:p-6">
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
        <div className="grid gap-4 sm:gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] w-full rounded-[1.75rem]" />
          ))}
        </div>
      </div>
    </div>
  );
}
