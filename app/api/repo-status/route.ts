import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { checkWorkflow, checkSecret } from "@/actions/github";

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
  const [workflowValid, secretExists] = await Promise.all([
    checkWorkflow(session.accessToken, owner, name, branch),
    checkSecret(session.accessToken, owner, name),
  ]);

  return NextResponse.json({ workflowValid, secretExists });
}
