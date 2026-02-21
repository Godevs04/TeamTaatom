import Link from "next/link";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card className="p-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">The page you’re looking for doesn’t exist.</p>
        <div className="mt-6 flex justify-center">
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}

