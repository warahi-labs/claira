import { redirect } from "next/navigation";
import { GitHubRepo } from "@/types/github";

export async function fetchRepos(accessToken: string): Promise<GitHubRepo[]> {
  const response = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!response.ok) {
    redirect("/error");
  }
  const repos: GitHubRepo[] = await response.json();
  return repos.map(({ id, full_name, description, language, stargazers_count, visibility, default_branch }) => ({
    id, full_name, description, language, stargazers_count, visibility, default_branch,
  }));
}
