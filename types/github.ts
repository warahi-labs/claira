export interface GitHubRepo {
  id: number;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  visibility: string;
  default_branch: string;
}
