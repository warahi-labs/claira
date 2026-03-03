"use client";

import { useState } from "react";
import { Loader2, ExternalLink, Check } from "lucide-react";
import { createSecret, createWorkflowPR } from "@/app/actions";
import { Modal } from "@/components/modal";

interface SetupCheck {
  workflowValid: boolean;
  secretExists: boolean;
  loading: boolean;
}

interface ConnectModalProps {
  repo: string;
  branch: string;
  check: SetupCheck | undefined;
  onClose: () => void;
  onConfirmMerged: () => void;
}

export default function ConnectModal({
  repo,
  branch,
  check,
  onClose,
  onConfirmMerged,
}: ConnectModalProps) {
  const [token, setToken] = useState("");

  const [prStatus, setPrStatus] = useState<"idle" | "creating" | "created" | "error">("idle");
  const [prResult, setPrResult] = useState<{ prUrl: string; prNumber: number } | null>(null);
  const [prError, setPrError] = useState("");

  const [secretStatus, setSecretStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [secretError, setSecretError] = useState("");

  const [confirmError, setConfirmError] = useState("");

  const needsWorkflow = check ? !check.workflowValid : false;
  const needsSecret = check ? !check.secretExists : false;

  const isConfirming = secretStatus === "saving" || prStatus === "creating";
  const isDone =
    (needsWorkflow ? prStatus === "created" : true) &&
    (needsSecret ? secretStatus === "saved" : true) &&
    (prStatus === "created" || secretStatus === "saved");

  function getConfirmLabel() {
    if (isConfirming) {
      if (secretStatus === "saving") return "Saving token...";
      if (prStatus === "creating") return "Creating PR...";
    }
    if (needsWorkflow && needsSecret) return "Connect";
    if (needsWorkflow) return "Create Workflow PR";
    if (needsSecret) return "Save Token";
    return "Connect";
  }

  async function handleConfirm() {
    if (!check) return;

    setConfirmError("");

    if (needsSecret && token.trim()) {
      setSecretStatus("saving");
      setSecretError("");
      try {
        const result = await createSecret(repo, token);
        if ("error" in result) {
          setSecretStatus("error");
          setSecretError(result.error ?? "Unknown error");
          return;
        }
        setSecretStatus("saved");
      } catch {
        setSecretStatus("error");
        setSecretError("Something went wrong");
        return;
      }
    } else if (needsSecret && !token.trim()) {
      setConfirmError("Please enter your Claude Code token");
      return;
    }

    if (needsWorkflow) {
      setPrStatus("creating");
      setPrError("");
      try {
        const result = await createWorkflowPR(repo, branch);
        if ("error" in result) {
          setPrStatus("error");
          setPrError(result.error ?? "Unknown error");
          return;
        }
        setPrStatus("created");
        setPrResult({ prUrl: result.prUrl!, prNumber: result.prNumber! });
      } catch {
        setPrStatus("error");
        setPrError("Something went wrong");
        return;
      }
    }
  }

  const canClose = !(isDone && prStatus === "created");

  return (
    <Modal
      title={repo}
      onClose={canClose ? onClose : undefined}
      showClose={canClose}
    >
      {check?.loading ? (
        <div className="flex items-center gap-2 text-sm text-foreground/50">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking setup status...
        </div>
      ) : check && !isDone ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">1. Install the Claude GitHub App</p>
            <p className="text-xs text-foreground/50">
              The Claude app must be installed on <strong>{repo}</strong> for GitHub Actions to work.
            </p>
            <a
              href="https://github.com/apps/claude"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-500 underline"
            >
              Install Claude GitHub App
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {needsWorkflow && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">2. Add workflow file</p>
              <p className="text-xs text-foreground/50">
                A PR will be created to add <code className="bg-foreground/10 px-1 rounded">.github/workflows/claude.yml</code> to the <code className="bg-foreground/10 px-1 rounded">{branch}</code> branch.
              </p>
            </div>
          )}

          {needsSecret && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">
                {needsWorkflow ? "3" : "2"}. Add your Claude Code token
              </p>
              <p className="text-xs text-foreground/50">
                Run <code className="bg-foreground/10 px-1 rounded">claude setup-token</code> in your terminal, then paste the token below.
              </p>
              <input
                type="password"
                placeholder="Paste token here"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  if (confirmError) setConfirmError("");
                  if (secretStatus === "error") setSecretStatus("idle");
                }}
                className="w-full rounded-lg border border-foreground/20 bg-background px-3 py-1.5 text-sm font-mono"
              />
              {secretStatus === "error" && (
                <p className="text-xs text-red-600 dark:text-red-400">{secretError}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <button
              type="button"
              disabled={isConfirming || check?.loading}
              onClick={handleConfirm}
              className="w-full rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isConfirming && <Loader2 className="h-4 w-4 animate-spin" />}
              {getConfirmLabel()}
            </button>
            {confirmError && (
              <p className="text-xs text-red-600 dark:text-red-400">{confirmError}</p>
            )}
            {prStatus === "error" && (
              <p className="text-xs text-red-600 dark:text-red-400">{prError}</p>
            )}
          </div>
        </div>
      ) : check && isDone ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm space-y-3">
            {prStatus === "created" && prResult ? (
              <>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Workflow PR created</p>
                    <a
                      href={prResult.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-500 underline text-xs mt-1"
                    >
                      View PR #{prResult.prNumber}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                {secretStatus === "saved" && (
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    <p>OAuth token saved as repository secret</p>
                  </div>
                )}

                <p className="text-xs text-foreground/50">
                  Merge the PR to activate the workflow on <code className="bg-foreground/10 px-1 rounded">{branch}</code>, then confirm below.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-green-700 dark:text-green-400">Setup complete!</p>
                {secretStatus === "saved" && (
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    <p>OAuth token saved as repository secret</p>
                  </div>
                )}
              </>
            )}
          </div>

          {prStatus === "created" && prResult ? (
            <button
              type="button"
              onClick={onConfirmMerged}
              className="w-full rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/90"
            >
              I&apos;ve merged the PR
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/90"
            >
              Done
            </button>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
