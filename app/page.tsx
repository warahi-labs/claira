import { auth, signOut } from "@/auth";
import Image from "next/image";

interface GitHubRepo {
  id: number;
  full_name: string;
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
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-3xl font-bold">Claira</h1>
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
            {repos.length > 0 && (
              <select className="w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm">
                <option value="">Select a repository</option>
                {repos.map((repo) => (
                  <option key={repo.id} value={repo.full_name}>
                    {repo.full_name}
                  </option>
                ))}
              </select>
            )}
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
