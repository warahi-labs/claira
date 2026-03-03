import Link from "next/link";
import { Button } from "@/components/button";

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-3xl font-bold">Something Went Wrong</h1>
        <p className="text-foreground/60">
          An unexpected error occurred. Please try again.
        </p>
        <Link href="/">
          <Button>Go Home</Button>
        </Link>
      </div>
    </main>
  );
}
