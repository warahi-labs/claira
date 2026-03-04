import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { CLAUDE_CODE_EXECUTION_WORKFLOW_YAML } from "@/constants/claude";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ workflowValid: false, secretExists: false }, { status: 401 });
  }

  const repo = req.nextUrl.searchParams.get("repo");
  const branch = req.nextUrl.searchParams.get("branch");

  if (!repo || !repo.includes("/") || !branch) {
    return NextResponse.json({ workflowValid: false, secretExists: false }, { status: 400 });
  }

  const [owner, name] = repo.split("/");
  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    Accept: "application/vnd.github+json",
  };

  const [workflowResult, secretResult] = await Promise.all([
    fetch(
      `https://api.github.com/repos/${owner}/${name}/contents/.github/workflows/claude.yml?ref=${branch}`,
      { headers, cache: "no-store" },
    ).then(async (res) => {
      if (!res.ok) return { valid: false };
      const data = (await res.json()) as { content?: string; encoding?: string };
      if (!data.content || data.encoding !== "base64") return { valid: false };
      const decoded = Buffer.from(data.content, "base64").toString("utf-8");
      return { valid: decoded.trim() === CLAUDE_CODE_EXECUTION_WORKFLOW_YAML.trim() };
    }),

    fetch(
      `https://api.github.com/repos/${owner}/${name}/actions/secrets/CLAUDE_CODE_OAUTH_TOKEN`,
      { headers, cache: "no-store" },
    ).then((res) => ({ exists: res.ok })),
  ]);

  return NextResponse.json({
    workflowValid: workflowResult.valid,
    secretExists: secretResult.exists,
  });
}
