"use server";

import { auth } from "@/auth";
import sodium from "libsodium-wrappers";


const WORKFLOW_YAML = `name: Claude Code

on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  issues:
    types: [opened, assigned]
  pull_request_review:
    types: [submitted]

jobs:
  claude:
    if: |
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude')) ||
      (github.event_name == 'pull_request_review_comment' && contains(github.event.comment.body, '@claude')) ||
      (github.event_name == 'pull_request_review' && contains(github.event.review.body, '@claude')) ||
      (github.event_name == 'issues' && (contains(github.event.issue.body, '@claude') || contains(github.event.issue.title, '@claude')))
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
      issues: read
      id-token: write
      actions: read
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Run Claude Code
        id: claude
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: \$\{{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          additional_permissions: |
            actions: read
`;

export async function fetchBranches(repo: string) {
  const session = await auth();
  if (!session?.accessToken) {
    return { error: "Not authenticated" };
  }

  if (!repo || !repo.includes("/")) {
    return { error: "Invalid repo" };
  }

  const [owner, name] = repo.split("/");
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${name}/branches?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Accept: "application/vnd.github+json",
      },
    },
  );

  if (!res.ok) {
    return { error: `Failed to fetch branches (${res.status})` };
  }

  const data: { name: string; protected: boolean }[] = await res.json();

  // Get repo info to identify the default branch
  const repoRes = await fetch(
    `https://api.github.com/repos/${owner}/${name}`,
    {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Accept: "application/vnd.github+json",
      },
    },
  );
  const repoData = await repoRes.json();
  const defaultBranch: string = repoData.default_branch ?? "main";

  return {
    branches: data.map((b) => ({
      name: b.name,
      default: b.name === defaultBranch,
    })),
  };
}

export async function setupClaude(repo: string, branch: string) {
  const session = await auth();
  if (!session?.accessToken) {
    return { error: "Not authenticated" };
  }

  if (!repo || !repo.includes("/")) {
    return { error: "Invalid repo" };
  }

  const [owner, name] = repo.split("/");
  const path = ".github/workflows/claude.yml";
  const apiUrl = `https://api.github.com/repos/${owner}/${name}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    Accept: "application/vnd.github+json",
  };

  // Check if the file already exists on this branch
  let existingSha: string | undefined;
  const getRes = await fetch(`${apiUrl}?ref=${branch}`, { headers });
  if (getRes.ok) {
    const data = await getRes.json();
    existingSha = data.sha;
  }

  // Push the workflow file
  const putRes = await fetch(apiUrl, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: existingSha
        ? "Update Claude Code workflow"
        : "Add Claude Code workflow",
      content: Buffer.from(WORKFLOW_YAML).toString("base64"),
      branch,
      ...(existingSha && { sha: existingSha }),
    }),
  });

  if (!putRes.ok) {
    const err = await putRes.json();
    return { error: (err.message as string) || `GitHub API error (${putRes.status})` };
  }

  const result = await putRes.json();
  return {
    success: true,
    updated: !!existingSha,
    htmlUrl: result.content?.html_url as string,
    repo,
  };
}

export async function createSecret(repo: string, secretValue: string) {
  const session = await auth();
  if (!session?.accessToken) {
    return { error: "Not authenticated" };
  }

  if (!repo || !repo.includes("/")) {
    return { error: "Invalid repo" };
  }

  if (!secretValue.trim()) {
    return { error: "Token is empty" };
  }

  const [owner, name] = repo.split("/");
  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    Accept: "application/vnd.github+json",
  };

  // Get the repo's public key for encrypting secrets
  const keyRes = await fetch(
    `https://api.github.com/repos/${owner}/${name}/actions/secrets/public-key`,
    { headers },
  );

  if (!keyRes.ok) {
    return { error: `Failed to fetch repo public key (${keyRes.status})` };
  }

  const { key, key_id } = (await keyRes.json()) as {
    key: string;
    key_id: string;
  };

  // Encrypt the secret using libsodium sealed box
  await sodium.ready;
  const binKey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
  const binSecret = sodium.from_string(secretValue);
  const encrypted = sodium.crypto_box_seal(binSecret, binKey);
  const encryptedB64 = sodium.to_base64(
    encrypted,
    sodium.base64_variants.ORIGINAL,
  );

  // Push the encrypted secret
  const putRes = await fetch(
    `https://api.github.com/repos/${owner}/${name}/actions/secrets/CLAUDE_CODE_OAUTH_TOKEN`,
    {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        encrypted_value: encryptedB64,
        key_id,
      }),
    },
  );

  if (!putRes.ok) {
    const err = await putRes.json().catch(() => null);
    return {
      error:
        (err as { message?: string })?.message ??
        `GitHub API error (${putRes.status})`,
    };
  }

  return { success: true };
}

export async function checkRepoStatus(repo: string, branch: string) {
  const session = await auth();
  if (!session?.accessToken) {
    return { workflowValid: false, secretExists: false };
  }

  if (!repo || !repo.includes("/")) {
    return { workflowValid: false, secretExists: false };
  }

  const [owner, name] = repo.split("/");
  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    Accept: "application/vnd.github+json",
  };

  const [workflowResult, secretResult] = await Promise.all([
    // Check workflow file
    fetch(
      `https://api.github.com/repos/${owner}/${name}/contents/.github/workflows/claude.yml?ref=${branch}`,
      { headers },
    ).then(async (res) => {
      if (!res.ok) return { valid: false };
      const data = (await res.json()) as { content?: string; encoding?: string };
      if (!data.content || data.encoding !== "base64") return { valid: false };
      const decoded = Buffer.from(data.content, "base64").toString("utf-8");
      return { valid: decoded.trim() === WORKFLOW_YAML.trim() };
    }),

    // Check secret exists
    fetch(
      `https://api.github.com/repos/${owner}/${name}/actions/secrets/CLAUDE_CODE_OAUTH_TOKEN`,
      { headers },
    ).then((res) => ({ exists: res.ok })),
  ]);

  return {
    workflowValid: workflowResult.valid,
    secretExists: secretResult.exists,
  };
}
