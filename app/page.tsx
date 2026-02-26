import { auth, signOut } from "@/auth";
import Image from "next/image";
import RepoPicker from "./repo-picker";

interface GitHubRepo {
  id: number;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  visibility: string;
  updated_at: string;
  default_branch: string;
}

async function fetchRepos(accessToken: string): Promise<GitHubRepo[]> {
  const res = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function Home() {
  const session = await auth();

  const repos = session?.accessToken ? await fetchRepos(session.accessToken) : [];

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-6xl space-y-6 text-center">
        <h1 className="text-3xl font-bold">Title</h1>
        {session?.user && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              {session.user.image && (
                <Image
                  src={session.user.image}
                  alt={session.user.name ?? "Avatar"}
                  width={80}
                  height={80}
                  className="rounded-full"
                />
              )}
              <p className="text-lg font-medium">{session.user.name}</p>
            </div>
            {repos.length > 0 && <RepoPicker repos={repos} />}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/signin" });
              }}
            >
              <button
                type="submit"
                className="rounded-lg border border-foreground/20 px-4 py-2 text-sm transition-colors hover:bg-foreground/5"
              >
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
