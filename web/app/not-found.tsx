import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "../components/ui/button";

export const metadata = {
  title: "Page not found",
  description: "The page you're looking for doesn't exist.",
};

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 py-12">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <span className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          404
        </span>
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Compass className="h-10 w-10" strokeWidth={1.5} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Page not found
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          This place isn&apos;t on the map. The link may be broken or the page may have moved.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="rounded-xl">
            <Link href="/">Go home</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-xl">
            <Link href="/feed">Explore feed</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
