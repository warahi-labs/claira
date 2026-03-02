import { signInWithGitHub } from "@/actions/auth";
import { Button } from "@/components/button";
import Image from "next/image";

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-3xl font-bold">Welcome to Claira</h1>
        <p className="text-foreground/60">Sign in to continue</p>
        <form action={signInWithGitHub}>
          <Button type="submit">
            <Image
              src="/github_logo.png"
              alt="GitHub"
              width={20}
              height={20}
            />
            Continue with GitHub
          </Button>
        </form>
      </div>
    </main>
  );
}
