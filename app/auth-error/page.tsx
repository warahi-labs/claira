import { signInWithGitHub } from "@/actions/auth";
import { Button } from "@/components/button";

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-3xl font-bold">Authentication Error</h1>
        <p className="text-foreground/60">
          Your session has expired or is invalid. Please sign in again.
        </p>
        <form action={signInWithGitHub}>
          <Button type="submit">Sign in with GitHub</Button>
        </form>
      </div>
    </main>
  );
}
