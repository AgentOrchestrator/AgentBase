export default function Loading() {
  return (
    <div className="container mx-auto py-10 space-y-6 px-24">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sessions</h1>
          <p className="text-muted-foreground mt-2">
            Loading your chat sessions...
          </p>
        </div>
      </div>

      {/* Loading skeleton */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border border-border rounded-lg p-4 animate-pulse">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 bg-muted rounded"></div>
                <div className="h-4 w-32 bg-muted rounded"></div>
              </div>
              <div className="h-4 w-24 bg-muted rounded"></div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted rounded"></div>
              <div className="h-4 w-3/4 bg-muted rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
