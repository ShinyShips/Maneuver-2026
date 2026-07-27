import { Skeleton } from "maneuver-2026";

export function TeamCardLoading() {
  return (
    <div className="flex flex-col gap-3 p-4 w-72 rounded-lg border">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

export function TableRowsLoading() {
  return (
    <div className="flex flex-col gap-2 p-4 w-96">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

export function ProfileLoading() {
  return (
    <div className="flex items-center gap-3 p-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}
