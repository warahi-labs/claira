import { signOutUser } from "@/actions/auth";
import { fetchRepos, fetchAllRepoStatuses } from "@/actions/github";
import { auth } from "@/auth";
import { Button } from "@/components/button";
import RepoCard from "@/components/repo-card";
import Image from "next/image";

export default async function Page() {
  const session = (await auth())!;
  const user = session.user!;
  const repos = await fetchRepos(session.accessToken!);
  const statuses = repos.length > 0
    ? await fetchAllRepoStatuses(repos, session.accessToken!)
    : {};

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-6xl space-y-6 text-center">
        <h1 className="text-3xl font-bold">Title</h1>
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3">
            {user.image && (
              <Image
                src={user.image}
                alt={user.name ?? "Avatar"}
                width={80}
                height={80}
                className="rounded-full"
              />
            )}
            <p className="text-lg font-medium">{user.name}</p>
          </div>
          {repos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {repos.map((repo) => (
                <RepoCard
                  key={repo.id}
                  repo={repo}
                  initialStatus={statuses[repo.full_name]}
                />
              ))}
            </div>
          )}
          <form action={signOutUser}>
            <Button type="submit" variant="outline" className="w-auto">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
