import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2 lg:hidden">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
      <Skeleton className="hidden h-56 w-full rounded-[1.6rem] lg:block" />
      <Skeleton className="h-11 w-full rounded-2xl" />
      <div className="pad-panel overflow-hidden rounded-[1.35rem]">
        <Skeleton className="h-16 w-full rounded-none" />
        <Skeleton className="h-16 w-full rounded-none" />
        <Skeleton className="h-16 w-full rounded-none" />
      </div>
    </div>
  );
}
