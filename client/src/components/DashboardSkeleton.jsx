// Shared loading skeleton for the Dashboard, used by BOTH the App-level
// Suspense fallback (while the lazy chunk loads) and the Dashboard's own
// data-loading state - so the two never drift in style, block layout, or
// container width, which previously caused a double flash + width jump.
// Kept in its own file so App.jsx can render it without importing (and
// bundling) the heavy Dashboard page.
export default function DashboardSkeleton() {
  return (
    <div className="max-w-[1240px] mx-auto px-4 pt-9 pb-14 md:px-11 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="skel h-24 rounded-xl" />)}
      </div>
      <div className="skel h-48 rounded-xl" />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="skel h-36 rounded-xl" />
        <div className="skel h-36 rounded-xl" />
      </div>
      <div className="skel h-20 rounded-xl" />
    </div>
  );
}
