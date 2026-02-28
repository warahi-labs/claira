"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, Unplug, Loader2, ExternalLink, Check } from "lucide-react";
import { fetchBranches, createSecret, createWorkflowPR, checkRepoStatus } from "./actions";

type Branch = { name: string; default: boolean };

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
  const [token, setToken] = useState("");
  const [modalRepo, setModalRepo] = useState<string | null>(null);
  const [getStartedRepo, setGetStartedRepo] = useState<string | null>(null);
  const checkedOnMount = useRef(false);

  // PR creation state
  const [prStatus, setPrStatus] = useState<"idle" | "creating" | "created" | "error">("idle");
  const [prResult, setPrResult] = useState<{ prUrl: string; prNumber: number } | null>(null);
  const [prError, setPrError] = useState("");

  // Secret state
  const [secretStatus, setSecretStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [secretError, setSecretError] = useState("");

  // Confirm-level error
  const [confirmError, setConfirmError] = useState("");

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
    setToken("");
    setSecretStatus("idle");
    setSecretError("");
    setPrStatus("idle");
    setPrResult(null);
    setPrError("");
    setConfirmError("");
  }

  function closeModal() {
    setModalRepo(null);
  }

  async function handleConfirm(repo: string, branch: string) {
    const cacheKey = `${repo}:${branch}`;
    const check = statusCache[cacheKey];
    if (!check) return;

    const needsSecret = !check.secretExists;
    const needsWorkflow = !check.workflowValid;

    setConfirmError("");

    // 1. Save secret first (so we don't create an orphaned PR if token is bad)
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

    // 2. Create workflow PR if needed
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

    // 3. Recheck status
    invalidateAndRecheck(repo, branch);
  }

  // Modal data
  const modalRepoData = modalRepo ? repos.find((r) => r.full_name === modalRepo) : null;
  const modalBranch = modalRepo
    ? selectedBranches[modalRepo] ?? modalRepoData?.default_branch ?? "main"
    : "";
  const modalCacheKey = modalRepo ? `${modalRepo}:${modalBranch}` : "";
  const modalCheck = modalCacheKey ? statusCache[modalCacheKey] : undefined;

  const needsWorkflow = modalCheck ? !modalCheck.workflowValid : false;
  const needsSecret = modalCheck ? !modalCheck.secretExists : false;

  const isConfirming = secretStatus === "saving" || prStatus === "creating";
  const isDone =
    (needsWorkflow ? prStatus === "created" : true) &&
    (needsSecret ? secretStatus === "saved" : true) &&
    (prStatus === "created" || secretStatus === "saved");

  // Confirm button label adapts to what's needed
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
          const isPartial =
            check &&
            !check.loading &&
            !isConnected &&
            (check.workflowValid || check.secretExists);

          return (
            <div
              key={repo.id}
              className="rounded-lg border border-foreground/20 p-4 text-left text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="relative group shrink-0 h-4 w-4">
                    {!check || check.loading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-foreground/30" />
                    ) : isPartial ? (
                      <Unplug className="h-4 w-4 text-red-400" />
                    ) : (
                      <Image
                        src="/claude_logo.png"
                        alt="Claude"
                        width={16}
                        height={16}
                        className={isConnected ? "" : "grayscale brightness-[1.8] opacity-50"}
                      />
                    )}
                    {check && !check.loading && (
                      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background opacity-0 group-hover:opacity-100 transition-opacity">
                        {isConnected
                          ? "Claude Code connected"
                          : isPartial
                            ? "Claude Code partially configured"
                            : "Claude Code not set up"}
                      </span>
                    )}
                  </span>
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

              <div className="mt-2">
                <select
                  value={chosenBranch}
                  onFocus={() => loadBranches(repo.full_name)}
                  onChange={(e) => {
                    const newBranch = e.target.value;
                    setSelectedBranches((prev) => ({ ...prev, [repo.full_name]: newBranch }));
                    checkStatus(repo.full_name, newBranch);
                  }}
                  className="w-full rounded-lg border border-foreground/20 bg-background px-2 py-1.5 text-xs"
                >
                  {branchesMap[repo.full_name]
                    ? branchesMap[repo.full_name].map((b) => (
                        <option key={b.name} value={b.name}>
                          {b.name}{b.default ? " (default)" : ""}
                        </option>
                      ))
                    : <option value={repo.default_branch}>{repo.default_branch} (default)</option>
                  }
                </select>
              </div>

              <div className="mt-2">
                {!check || check.loading ? (
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium opacity-50 flex items-center justify-center gap-2"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking...
                  </button>
                ) : isConnected ? (
                  <button
                    type="button"
                    onClick={() => setGetStartedRepo(repo.full_name)}
                    className="w-full rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/90"
                  >
                    Create Board
                  </button>
                ) : isPartial ? (
                  <button
                    type="button"
                    onClick={() => openConnectModal(repo.full_name)}
                    className="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-4 py-2 text-sm font-medium transition-colors hover:bg-amber-500/20"
                  >
                    Complete Setup
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openConnectModal(repo.full_name)}
                    className="w-full rounded-lg border border-foreground/20 bg-transparent text-foreground px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/5"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Connect / Complete Setup Modal */}
      {modalRepo && modalRepoData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => { if (!(isDone && prStatus === "created")) closeModal(); }}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-foreground/20 bg-background p-6 shadow-lg space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{modalRepo}</h2>
              {!(isDone && prStatus === "created") && (
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg p-1 transition-colors hover:bg-foreground/10"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {modalCheck?.loading ? (
              <div className="flex items-center gap-2 text-sm text-foreground/50">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking setup status...
              </div>
            ) : modalCheck && !isDone ? (
              <div className="space-y-4">
                {/* Step 1: Install Claude GitHub App (always shown) */}
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">1. Install the Claude GitHub App</p>
                  <p className="text-xs text-foreground/50">
                    The Claude app must be installed on <strong>{modalRepo}</strong> for GitHub Actions to work.
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

                {/* Step 2: Add workflow file (only if missing) */}
                {needsWorkflow && (
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">2. Add workflow file</p>
                    <p className="text-xs text-foreground/50">
                      A PR will be created to add <code className="bg-foreground/10 px-1 rounded">.github/workflows/claude.yml</code> to the <code className="bg-foreground/10 px-1 rounded">{modalBranch}</code> branch.
                    </p>
                  </div>
                )}

                {/* Step 3: Add Claude token (only if missing) */}
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

                {/* Confirm button */}
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={isConfirming || modalCheck?.loading}
                    onClick={() => handleConfirm(modalRepo, modalBranch)}
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
            ) : modalCheck && isDone ? (
              /* Success state */
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
                        Merge the PR to activate the workflow on <code className="bg-foreground/10 px-1 rounded">{modalBranch}</code>, then confirm below.
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
                    onClick={() => {
                      closeModal();
                      invalidateAndRecheck(modalRepo, modalBranch);
                    }}
                    className="w-full rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/90"
                  >
                    I&apos;ve merged the PR
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={closeModal}
                    className="w-full rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/90"
                  >
                    Done
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Create Board Modal */}
      {getStartedRepo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setGetStartedRepo(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-foreground/20 bg-background p-6 shadow-lg space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{getStartedRepo}</h2>
              <button
                type="button"
                onClick={() => setGetStartedRepo(null)}
                className="rounded-lg p-1 transition-colors hover:bg-foreground/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <p className="font-medium">
                Have you installed the Claude GitHub App on this repo?
              </p>
              <p className="text-foreground/60">
                The Claude app needs to be installed on{" "}
                <strong>{getStartedRepo}</strong> for Claude Code to work with
                GitHub Actions.
              </p>
              <div className="flex flex-col gap-2 text-sm">
                <a
                  href={`https://github.com/${getStartedRepo}/settings/installations`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-500"
                >
                  Check installed apps on this repo
                </a>
                <a
                  href="https://github.com/apps/claude"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-500"
                >
                  Install the Claude GitHub App
                </a>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const branch = selectedBranches[getStartedRepo] ??
                  repos.find((r) => r.full_name === getStartedRepo)?.default_branch ?? "main";
                const cacheKey = `${getStartedRepo}:${branch}`;
                const check = statusCache[cacheKey];
                console.log("Create Board:", {
                  repo: getStartedRepo,
                  branch,
                  workflowValid: check?.workflowValid ?? false,
                  secretExists: check?.secretExists ?? false,
                });
              }}
              className="w-full rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/90"
            >
              Create Board
            </button>
          </div>
        </div>
      )}
    </>
  );
}
