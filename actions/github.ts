import { redirect } from "next/navigation";
import { GitHubRepo } from "@/types/github";
import { CLAUDE_CODE_EXECUTION_WORKFLOW_YAML } from "@/constants/claude";

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

export async function checkWorkflow(accessToken: string, owner: string, name: string, branch: string): Promise<boolean> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${name}/contents/.github/workflows/claude.yml?ref=${branch}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return false;
  }
  const data: { content?: string; encoding?: string } = await response.json();
  if (!data.content || data.encoding !== "base64") {
    return false;
  }
  const decoded = Buffer.from(data.content, "base64").toString("utf-8");
  return decoded.trim() === CLAUDE_CODE_EXECUTION_WORKFLOW_YAML.trim();
}

export async function checkSecret(accessToken: string, owner: string, name: string): Promise<boolean> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${name}/actions/secrets/CLAUDE_CODE_OAUTH_TOKEN`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    },
  );
  return response.ok;
}

export interface RepoStatus {
  workflowValid: boolean;
  secretExists: boolean;
}

export async function fetchAllRepoStatuses(
  repos: GitHubRepo[],
  accessToken: string,
): Promise<Record<string, RepoStatus>> {
  const entries = await Promise.all(
    repos.map(async (repo) => {
      const [owner, name] = repo.full_name.split("/");
      const [workflowValid, secretExists] = await Promise.all([
        checkWorkflow(accessToken, owner, name, repo.default_branch),
        checkSecret(accessToken, owner, name),
      ]);
      return [repo.full_name, { workflowValid, secretExists }] as const;
    }),
  );
  return Object.fromEntries(entries);
}
