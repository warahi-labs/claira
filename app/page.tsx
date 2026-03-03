import { signOutUser } from "@/actions/auth";
import { fetchRepos } from "@/actions/github";
import { auth } from "@/auth";
import { Button } from "@/components/button";
import Image from "next/image";
import RepoPicker from "./repo-picker";

export default async function Page() {
  const session = (await auth())!;
  const user = session.user!;
  const repos = await fetchRepos(session.accessToken!);

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
          {repos.length > 0 && <RepoPicker repos={repos} />}
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
