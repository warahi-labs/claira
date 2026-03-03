import { ActionResponse } from "@/types/action";
import { GitHubRepo } from "@/types/github";

export async function fetchRepos(accessToken?: string): Promise<ActionResponse<GitHubRepo[]>> {
  if (!accessToken) {
    return { data: [], error: "Not authenticated" };
  }
  const response = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!response.ok) {
    return { data: [], error: `Failed to fetch repos (${response.status})` };
  }
  const repos: GitHubRepo[] = await response.json();
  return {
    data: repos.map(({ id, full_name, description, language, stargazers_count, visibility, default_branch }) => ({
      id, full_name, description, language, stargazers_count, visibility, default_branch,
    })),
  };
}
