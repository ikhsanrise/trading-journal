export default function Loading() {
  return (
    <div className="p-4 space-y-3">
      <div className="skeleton h-6 w-40 rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-56 rounded-2xl" />
    </div>
  );
}
