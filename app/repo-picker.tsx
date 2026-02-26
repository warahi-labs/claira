"use client";

import { useState } from "react";
import { fetchBranches, setupClaude, createSecret } from "./actions";

type Branch = { name: string; default: boolean };

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; htmlUrl: string; updated: boolean; repo: string }
  | { kind: "error"; message: string };

export default function RepoPicker({ repos }: { repos: { id: number; full_name: string }[] }) {
  const [selected, setSelected] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [token, setToken] = useState("");
  const [secretStatus, setSecretStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [secretError, setSecretError] = useState("");

  async function handleRepoChange(repo: string) {
    setSelected(repo);
    setStatus({ kind: "idle" });
    setBranches([]);
    setSelectedBranch("");

    if (!repo) return;

    setLoadingBranches(true);
    try {
      const result = await fetchBranches(repo);
      if ("error" in result) {
        setStatus({ kind: "error", message: result.error ?? "Unknown error" });
        return;
      }
      setBranches(result.branches);
      const defaultBranch = result.branches.find((b) => b.default);
      setSelectedBranch(defaultBranch?.name ?? result.branches[0]?.name ?? "");
    } catch {
      setStatus({ kind: "error", message: "Failed to load branches" });
    } finally {
      setLoadingBranches(false);
    }
  }

  async function handleSetup() {
    setStatus({ kind: "loading" });
    try {
      const data = await setupClaude(selected, selectedBranch);
      if ("error" in data) {
        setStatus({ kind: "error", message: data.error ?? "Unknown error" });
        return;
      }
      setStatus({
        kind: "success",
        htmlUrl: data.htmlUrl,
        updated: data.updated,
        repo: data.repo,
      });
    } catch {
      setStatus({ kind: "error", message: "Something went wrong" });
    }
  }

  return (
    <div className="space-y-3">
      <select
        value={selected}
        onChange={(e) => handleRepoChange(e.target.value)}
        className="w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm"
      >
        <option value="">Select a repository</option>
        {repos.map((repo) => (
          <option key={repo.id} value={repo.full_name}>
            {repo.full_name}
          </option>
        ))}
      </select>

      {selected && branches.length > 0 && (
        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm"
        >
          {branches.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name}{b.default ? " (default)" : ""}
            </option>
          ))}
        </select>
      )}

      {loadingBranches && (
        <p className="text-sm text-foreground/50">Loading branches...</p>
      )}

      {selected && selectedBranch && status.kind !== "success" && !loadingBranches && (
        <button
          type="button"
          disabled={status.kind === "loading"}
          onClick={handleSetup}
          className="w-full rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/90 disabled:opacity-50"
        >
          {status.kind === "loading" ? "Setting up..." : "Enter"}
        </button>
      )}

      {status.kind === "success" && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-left text-sm space-y-2">
          <p className="font-medium text-green-700 dark:text-green-400">
            Workflow {status.updated ? "updated" : "added"} successfully!
          </p>
          <a
            href={status.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block underline text-green-700 dark:text-green-400"
          >
            View file on GitHub
          </a>
          <p className="font-medium pt-2">Next steps:</p>
          <ol className="list-decimal list-inside space-y-1 text-foreground/70">
            <li>
              <a
                href="https://github.com/apps/claude"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Install the Claude GitHub App
              </a>{" "}
              on <strong>{status.repo}</strong>
            </li>
            <li className="space-y-2">
              <span>
                Add your <code className="bg-foreground/10 px-1 rounded">CLAUDE_CODE_OAUTH_TOKEN</code>
              </span>
              {secretStatus === "saved" ? (
                <p className="ml-5 text-green-700 dark:text-green-400 font-medium">
                  Secret saved!
                </p>
              ) : (
                <div className="ml-5 space-y-2">
                  <p className="text-foreground/50 text-xs">
                    Run <code className="bg-foreground/10 px-1 rounded">claude setup-token</code> in your terminal, then paste the token here
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Paste token here"
                      value={token}
                      onChange={(e) => {
                        setToken(e.target.value);
                        if (secretStatus === "error") setSecretStatus("idle");
                      }}
                      className="flex-1 rounded-lg border border-foreground/20 bg-background px-3 py-1.5 text-sm font-mono"
                    />
                    <button
                      type="button"
                      disabled={secretStatus === "saving" || !token.trim()}
                      onClick={async () => {
                        setSecretStatus("saving");
                        setSecretError("");
                        try {
                          const result = await createSecret(status.repo, token);
                          if ("error" in result) {
                            setSecretStatus("error");
                            setSecretError(result.error ?? "Unknown error");
                          } else {
                            setSecretStatus("saved");
                          }
                        } catch {
                          setSecretStatus("error");
                          setSecretError("Something went wrong");
                        }
                      }}
                      className="rounded-lg bg-foreground text-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-foreground/90 disabled:opacity-50 whitespace-nowrap"
                    >
                      {secretStatus === "saving" ? "Saving..." : "Save Secret"}
                    </button>
                  </div>
                  {secretStatus === "error" && (
                    <p className="text-red-600 dark:text-red-400 text-xs">
                      {secretError}
                    </p>
                  )}
                </div>
              )}
            </li>
          </ol>
        </div>
      )}

      {status.kind === "error" && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-left text-sm">
          <p className="text-red-700 dark:text-red-400">{status.message}</p>
        </div>
      )}
    </div>
  );
}
