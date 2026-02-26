"use client";

import { useEffect, useRef, useState } from "react";
import { fetchBranches, setupClaude, createSecret, checkRepoStatus } from "./actions";

type Branch = { name: string; default: boolean };

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; htmlUrl: string; updated: boolean; repo: string }
  | { kind: "error"; message: string };

interface Repo {
  id: number;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  visibility: string;
  updated_at: string;
  default_branch: string;
}

interface SetupCheck {
  workflowValid: boolean;
  secretExists: boolean;
  loading: boolean;
}

function StatusLine({ label, ok, href }: { label: string; ok: boolean; href?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={ok ? "text-green-500" : "text-foreground/30"}>
        {ok ? "\u2713" : "\u2717"}
      </span>
      <span>{label}</span>
      {!ok && href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-blue-500"
        >
          Install
        </a>
      )}
    </div>
  );
}

export default function RepoPicker({ repos }: { repos: Repo[] }) {
  const [selected, setSelected] = useState("");
  const [branchesMap, setBranchesMap] = useState<Record<string, Branch[]>>({});
  const [selectedBranches, setSelectedBranches] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const repo of repos) {
      initial[repo.full_name] = repo.default_branch;
    }
    return initial;
  });
  const [loadingBranches, setLoadingBranches] = useState<Record<string, boolean>>({});
  const [statusCache, setStatusCache] = useState<Record<string, SetupCheck>>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [token, setToken] = useState("");
  const [secretStatus, setSecretStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [secretError, setSecretError] = useState("");
  const checkedOnMount = useRef(false);

  useEffect(() => {
    if (checkedOnMount.current) return;
    checkedOnMount.current = true;
    for (const repo of repos) {
      checkStatus(repo.full_name, repo.default_branch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBranches(repo: string) {
    if (branchesMap[repo] || loadingBranches[repo]) return;

    setLoadingBranches((prev) => ({ ...prev, [repo]: true }));
    try {
      const result = await fetchBranches(repo);
      if ("error" in result) return;
      setBranchesMap((prev) => ({ ...prev, [repo]: result.branches }));
    } finally {
      setLoadingBranches((prev) => ({ ...prev, [repo]: false }));
    }
  }

  async function checkStatus(repo: string, branch: string) {
    const cacheKey = `${repo}:${branch}`;
    if (statusCache[cacheKey]?.loading) return;

    setStatusCache((prev) => ({
      ...prev,
      [cacheKey]: { workflowValid: false, secretExists: false, loading: true },
    }));

    try {
      const result = await checkRepoStatus(repo, branch);
      setStatusCache((prev) => ({
        ...prev,
        [cacheKey]: {
          workflowValid: result.workflowValid,
          secretExists: result.secretExists,
          loading: false,
        },
      }));
    } catch {
      setStatusCache((prev) => ({
        ...prev,
        [cacheKey]: { workflowValid: false, secretExists: false, loading: false },
      }));
    }
  }

  function invalidateAndRecheck(repo: string, branch: string) {
    const cacheKey = `${repo}:${branch}`;
    setStatusCache((prev) => {
      const next = { ...prev };
      delete next[cacheKey];
      return next;
    });
    checkStatus(repo, branch);
  }

  function handleSelect(repo: string) {
    setSelected(repo);
    setStatus({ kind: "idle" });
    setSecretStatus("idle");
    setToken("");
    loadBranches(repo);
  }

  async function handleSetupFor(repo: string, branch: string) {
    setSelected(repo);
    setStatus({ kind: "loading" });
    try {
      const data = await setupClaude(repo, branch);
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
      invalidateAndRecheck(repo, branch);
    } catch {
      setStatus({ kind: "error", message: "Something went wrong" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {repos.map((repo) => {
          const isSelected = selected === repo.full_name;
          const repoBranches = branchesMap[repo.full_name];
          const chosenBranch = selectedBranches[repo.full_name] ?? repo.default_branch;
          const cacheKey = `${repo.full_name}:${chosenBranch}`;
          const check = statusCache[cacheKey];
          const isConnected =
            check &&
            !check.loading &&
            check.workflowValid &&
            check.secretExists;

          return (
            <div
              key={repo.id}
              onClick={() => { if (!isSelected) handleSelect(repo.full_name); }}
              className={`rounded-lg border p-4 text-left text-sm transition-colors ${
                isSelected
                  ? "border-foreground bg-foreground/5"
                  : "border-foreground/20 hover:border-foreground/40 hover:bg-foreground/[0.02] cursor-pointer"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium truncate">{repo.full_name}</p>
                <span className="shrink-0 rounded-full border border-foreground/20 px-2 py-0.5 text-xs text-foreground/50">
                  {repo.visibility}
                </span>
              </div>
              {repo.description && (
                <p className="mt-1.5 text-foreground/50 line-clamp-2">{repo.description}</p>
              )}
              <div className="mt-2 flex items-center gap-3 text-xs text-foreground/40">
                {repo.language && <span>{repo.language}</span>}
                {repo.stargazers_count > 0 && <span>&#9733; {repo.stargazers_count}</span>}
              </div>

              <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                <select
                  value={chosenBranch}
                  onFocus={() => loadBranches(repo.full_name)}
                  onChange={(e) => {
                    const newBranch = e.target.value;
                    setSelectedBranches((prev) => ({ ...prev, [repo.full_name]: newBranch }));
                    checkStatus(repo.full_name, newBranch);
                  }}
                  className="w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm"
                >
                  {repoBranches
                    ? repoBranches.map((b) => (
                        <option key={b.name} value={b.name}>
                          {b.name}{b.default ? " (default)" : ""}
                        </option>
                      ))
                    : <option value={repo.default_branch}>{repo.default_branch} (default)</option>
                  }
                </select>

                {loadingBranches[repo.full_name] && (
                  <p className="text-xs text-foreground/50">Loading branches...</p>
                )}

                {check?.loading ? (
                  <p className="text-xs text-foreground/50">Checking setup...</p>
                ) : isConnected ? (
                  <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2">
                    <span className="text-green-600 dark:text-green-400 text-sm font-medium">
                      Connected
                    </span>
                  </div>
                ) : check ? (
                  <div className="space-y-2">
                    <div className="space-y-1 text-xs text-foreground/50">
                      <StatusLine label="Workflow file" ok={check.workflowValid} />
                      <StatusLine label="OAuth secret" ok={check.secretExists} />
                      <StatusLine label="GitHub App" ok={false} href="https://github.com/apps/claude" />
                    </div>
                    {!(isSelected && status.kind === "success") && (
                      <button
                        type="button"
                        disabled={isSelected && status.kind === "loading"}
                        onClick={() => {
                          if (!isSelected) {
                            setSelected(repo.full_name);
                            setStatus({ kind: "idle" });
                            setSecretStatus("idle");
                            setToken("");
                          }
                          handleSetupFor(repo.full_name, chosenBranch);
                        }}
                        className="w-full rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/90 disabled:opacity-50"
                      >
                        {isSelected && status.kind === "loading" ? "Connecting..." : "Connect"}
                      </button>
                    )}
                  </div>
                ) : null}

                {isSelected && status.kind === "error" && (
                  <p className="text-xs text-red-600 dark:text-red-400">{status.message}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
          <p className="font-medium pt-2">Remaining steps:</p>
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
                            invalidateAndRecheck(
                              status.repo,
                              selectedBranches[status.repo],
                            );
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
    </div>
  );
}
