import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
        <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
      </div>
    </div>
  );
}
