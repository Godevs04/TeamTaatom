import { Skeleton } from "@/components/ui/skeleton";

export default function FeedLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20 rounded-lg" />
        <Skeleton className="h-9 w-20 rounded-lg" />
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
      <Skeleton className="aspect-[4/3] w-full rounded-3xl" />
      <Skeleton className="aspect-[4/3] w-full rounded-3xl" />
      <Skeleton className="aspect-[4/3] w-full rounded-3xl" />
    </div>
  );
}
