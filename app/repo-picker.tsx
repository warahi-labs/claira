"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
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
    <div className="flex items-center gap-2">
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
  const [modalRepo, setModalRepo] = useState<string | null>(null);
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

  function openConnectModal(repo: string) {
    setModalRepo(repo);
    setStatus({ kind: "idle" });
    setSecretStatus("idle");
    setToken("");
    loadBranches(repo);
  }

  function closeModal() {
    setModalRepo(null);
  }

  async function handleSetupFor(repo: string, branch: string) {
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

  // Modal data
  const modalRepoData = modalRepo ? repos.find((r) => r.full_name === modalRepo) : null;
  const modalBranch = modalRepo
    ? selectedBranches[modalRepo] ?? modalRepoData?.default_branch ?? "main"
    : "";
  const modalCacheKey = modalRepo ? `${modalRepo}:${modalBranch}` : "";
  const modalCheck = modalCacheKey ? statusCache[modalCacheKey] : undefined;
  const modalBranches = modalRepo ? branchesMap[modalRepo] : undefined;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {repos.map((repo) => {
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
              className="rounded-lg border border-foreground/20 p-4 text-left text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {isConnected && (
                    <span className="relative group shrink-0">
                      <Image src="/claude_logo.png" alt="Claude" width={16} height={16} />
                      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background opacity-0 group-hover:opacity-100 transition-opacity">
                        Claude Code connected
                      </span>
                    </span>
                  )}
                  <p className="font-medium truncate">{repo.full_name}</p>
                </div>
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

              <div className="mt-3">
                {check?.loading ? (
                  <p className="text-xs text-foreground/50">Checking setup...</p>
                ) : isConnected ? (
                  <button
                    type="button"
                    onClick={() => {}}
                    className="w-full rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/90"
                  >
                    Get Started
                  </button>
                ) : check ? (
                  <button
                    type="button"
                    onClick={() => openConnectModal(repo.full_name)}
                    className="w-full rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/90"
                  >
                    Connect
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Connect Modal */}
      {modalRepo && modalRepoData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-foreground/20 bg-background p-6 shadow-lg space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{modalRepo}</h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1 transition-colors hover:bg-foreground/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Branch select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Branch</label>
              <select
                value={modalBranch}
                onFocus={() => loadBranches(modalRepo)}
                onChange={(e) => {
                  const newBranch = e.target.value;
                  setSelectedBranches((prev) => ({ ...prev, [modalRepo]: newBranch }));
                  checkStatus(modalRepo, newBranch);
                }}
                className="w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm"
              >
                {modalBranches
                  ? modalBranches.map((b) => (
                      <option key={b.name} value={b.name}>
                        {b.name}{b.default ? " (default)" : ""}
                      </option>
                    ))
                  : <option value={modalRepoData.default_branch}>{modalRepoData.default_branch} (default)</option>
                }
              </select>
            </div>

            {/* Status checklist */}
            <div className="space-y-2 text-sm">
              <p className="font-medium">Setup status</p>
              {modalCheck?.loading ? (
                <p className="text-foreground/50 text-xs">Checking...</p>
              ) : modalCheck ? (
                <div className="space-y-1.5 text-foreground/60">
                  <StatusLine label="Workflow file" ok={modalCheck.workflowValid} />
                  <StatusLine label="OAuth secret" ok={modalCheck.secretExists} />
                  <StatusLine label="GitHub App" ok={false} href="https://github.com/apps/claude" />
                </div>
              ) : null}
            </div>

            {/* Connect / success */}
            {status.kind === "success" ? (
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
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={status.kind === "loading" || modalCheck?.loading}
                  onClick={() => handleSetupFor(modalRepo, modalBranch)}
                  className="w-full rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/90 disabled:opacity-50"
                >
                  {status.kind === "loading" ? "Connecting..." : "Connect"}
                </button>
                {status.kind === "error" && (
                  <p className="text-sm text-red-600 dark:text-red-400">{status.message}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
