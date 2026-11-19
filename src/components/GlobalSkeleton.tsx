import type { NavSection } from './Sidebar.tsx';

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`skeleton-bar rounded ${className}`} aria-hidden="true" />;
}

export function TableRowsSkeleton({
  rows = 6,
  cols = 6,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="divide-y divide-slate-800/80" aria-busy="true" aria-label="Loading table rows">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div
          key={rIdx}
          className="h-10 px-4 flex items-center justify-between gap-4"
        >
          {Array.from({ length: cols }).map((__, cIdx) => (
            <SkeletonBlock
              key={cIdx}
              className={`h-3.5 ${
                cIdx === 0 ? 'w-20' : cIdx === cols - 1 ? 'w-16' : 'flex-1 max-w-[140px]'
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ViewSkeleton({ section }: { section: NavSection }) {
  if (section === 'scoring') {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading Live Scoring view">
        {/* Control Strip Skeleton */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <SkeletonBlock className="h-3 w-28" />
              <SkeletonBlock className="h-10 w-full rounded-lg" />
            </div>
            <div className="space-y-2">
              <SkeletonBlock className="h-3 w-40" />
              <SkeletonBlock className="h-10 w-full rounded-lg" />
            </div>
            <div className="flex items-end gap-2">
              <SkeletonBlock className="h-9 w-24 rounded-lg" />
              <SkeletonBlock className="h-9 w-28 rounded-lg" />
              <SkeletonBlock className="h-9 w-24 rounded-lg" />
            </div>
          </div>
          <div className="pt-4 border-t border-slate-800 flex flex-wrap gap-4">
            <SkeletonBlock className="h-3 w-36" />
            <SkeletonBlock className="h-3 w-48" />
            <SkeletonBlock className="h-3 w-28" />
          </div>
        </section>

        {/* Primary Decision Skeleton */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <SkeletonBlock className="h-5 w-44" />
                <SkeletonBlock className="h-5 w-24" />
              </div>
              <SkeletonBlock className="h-3 w-72" />
            </div>
            <SkeletonBlock className="h-9 w-40 rounded-lg" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-5 space-y-2.5">
                <SkeletonBlock className="h-3 w-32" />
                <SkeletonBlock className="h-7 w-28" />
                <SkeletonBlock className="h-3 w-40" />
              </div>
            ))}
          </div>

          <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
            <SkeletonBlock className="h-4 w-80" />
            <SkeletonBlock className="h-4 w-24" />
          </div>
        </section>

        {/* Two-Column Split Skeleton */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <section className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <SkeletonBlock className="h-4 w-44" />
              <SkeletonBlock className="h-3 w-16" />
            </div>
            <div className="divide-y divide-slate-800/80">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-6 py-3 space-y-2">
                  <div className="flex justify-between">
                    <SkeletonBlock className="h-3 w-36" />
                    <SkeletonBlock className="h-3 w-16" />
                  </div>
                  <SkeletonBlock className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          </section>

          <section className="xl:col-span-7 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="space-y-1.5">
                <SkeletonBlock className="h-4 w-48" />
                <SkeletonBlock className="h-3 w-64" />
              </div>
              <SkeletonBlock className="h-3 w-14" />
            </div>
            <TableRowsSkeleton rows={8} cols={5} />
          </section>
        </div>
      </div>
    );
  }

  if (section === 'telemetry') {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading Portfolio Telemetry view">
        <section className="bg-slate-900 border border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-5 space-y-2.5">
              <SkeletonBlock className="h-3 w-36" />
              <SkeletonBlock className="h-7 w-24" />
              <SkeletonBlock className="h-3 w-40" />
            </div>
          ))}
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-9 w-64 rounded-lg" />
              <SkeletonBlock className="h-9 w-56 rounded-lg" />
            </div>
            <div className="flex items-center gap-2">
              <SkeletonBlock className="h-8 w-40 rounded-lg" />
              <SkeletonBlock className="h-8 w-24 rounded-lg" />
            </div>
          </div>
          <TableRowsSkeleton rows={9} cols={7} />
        </section>
      </div>
    );
  }

  if (section === 'drift') {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading Drift and Calibration view">
        <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="space-y-1.5">
              <SkeletonBlock className="h-4 w-56" />
              <SkeletonBlock className="h-3 w-72" />
            </div>
            <SkeletonBlock className="h-3 w-36" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-5 space-y-2.5">
                <SkeletonBlock className="h-3 w-24" />
                <SkeletonBlock className="h-7 w-20" />
                <SkeletonBlock className="h-3 w-32" />
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <section className="xl:col-span-7 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <SkeletonBlock className="h-4 w-52" />
              <SkeletonBlock className="h-8 w-36 rounded-lg" />
            </div>
            <TableRowsSkeleton rows={6} cols={4} />
            <div className="p-6 border-t border-slate-800 space-y-3">
              <SkeletonBlock className="h-4 w-48" />
              <SkeletonBlock className="h-2.5 w-full rounded-full" />
              <SkeletonBlock className="h-2.5 w-full rounded-full" />
              <SkeletonBlock className="h-2.5 w-4/5 rounded-full" />
            </div>
          </section>

          <section className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 space-y-1.5">
              <SkeletonBlock className="h-4 w-48" />
              <SkeletonBlock className="h-3 w-64" />
            </div>
            <div className="p-6 space-y-4">
              <SkeletonBlock className="h-56 w-full rounded-lg" />
              <TableRowsSkeleton rows={5} cols={4} />
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (section === 'pipeline') {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading AI Pipeline view">
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap justify-between gap-4">
            <div className="space-y-2">
              <SkeletonBlock className="h-5 w-64" />
              <SkeletonBlock className="h-3.5 w-96" />
            </div>
            <SkeletonBlock className="h-9 w-72 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        </section>
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <SkeletonBlock className="h-5 w-52" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonBlock className="h-44 w-full rounded-lg" />
            <SkeletonBlock className="h-44 w-full rounded-lg" />
          </div>
        </section>
      </div>
    );
  }

  if (section === 'roadmap') {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading Scaling and Next AI view">
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <SkeletonBlock className="h-5 w-64" />
          <SkeletonBlock className="h-64 w-full rounded-lg" />
        </section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading Contract and Ops view">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <section className="xl:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
          <SkeletonBlock className="h-5 w-48" />
          <div className="grid grid-cols-2 gap-4">
            <SkeletonBlock className="h-10 w-full rounded-lg" />
            <SkeletonBlock className="h-10 w-full rounded-lg" />
          </div>
          <div className="flex justify-end">
            <SkeletonBlock className="h-9 w-40 rounded-lg" />
          </div>
        </section>
        <section className="xl:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <SkeletonBlock className="h-5 w-52" />
          <SkeletonBlock className="h-12 w-full rounded-lg" />
          <SkeletonBlock className="h-12 w-full rounded-lg" />
          <SkeletonBlock className="h-14 w-full rounded-lg" />
        </section>
      </div>
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
        <SkeletonBlock className="h-5 w-52" />
        <SkeletonBlock className="h-44 w-full rounded-lg" />
      </section>
      <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <SkeletonBlock className="h-5 w-64" />
        </div>
        <TableRowsSkeleton rows={6} cols={3} />
      </section>
    </div>
  );
}
