"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Unplug } from "lucide-react";
import { Select } from "@/components/select";
import ConnectModal from "@/components/connect-modal";
import CreateBoardModal from "@/components/create-board-modal";
import { fetchBranches } from "@/app/actions";
import { GitHubRepo } from "@/types/github";
import { RepoStatus } from "@/actions/github";

type BranchOption = { value: string; label: string };
type Branch = { name: string; default: boolean };

interface RepoCardProps {
  repo: GitHubRepo;
  initialStatus?: RepoStatus;
}

export default function RepoCard({ repo, initialStatus }: RepoCardProps) {
  const [chosenBranch, setChosenBranch] = useState(repo.default_branch);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [status, setStatus] = useState<RepoStatus | null>(initialStatus ?? null);
  const [statusLoading, setStatusLoading] = useState(!initialStatus);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showCreateBoardModal, setShowCreateBoardModal] = useState(false);
  const branchesLoadedRef = useRef(false);

  useEffect(() => {
    if (!initialStatus) {
      checkStatus(repo.default_branch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBranches() {
    if (branchesLoadedRef.current || branchesLoading) return;
    branchesLoadedRef.current = true;
    setBranchesLoading(true);
    const result = await fetchBranches(repo.full_name);
    if ("error" in result) {
      setBranchesLoading(false);
      branchesLoadedRef.current = false;
      return;
    }
    setBranches(
      result.branches.map((b: Branch) => ({
        value: b.name,
        label: b.default ? `${b.name} (default)` : b.name,
      })),
    );
    setBranchesLoading(false);
  }

  async function checkStatus(branch: string) {
    setStatusLoading(true);
    try {
      const res = await fetch(
        `/api/repo-status?repo=${encodeURIComponent(repo.full_name)}&branch=${encodeURIComponent(branch)}`,
      );
      const result = await res.json();
      setStatus({ workflowValid: result.workflowValid, secretExists: result.secretExists });
    } catch {
      setStatus({ workflowValid: false, secretExists: false });
    }
    setStatusLoading(false);
  }

  function handleBranchChange(newBranch: string) {
    setChosenBranch(newBranch);
    checkStatus(newBranch);
  }

  const isConnected = status && status.workflowValid && status.secretExists;
  const isPartial = status && !isConnected && (status.workflowValid || status.secretExists);

  return (
    <>
      <div className="rounded-lg border border-foreground/20 p-4 text-left text-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative group shrink-0 h-4 w-4">
              {statusLoading ? (
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
              {!statusLoading && (
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
          <Select
            instanceId={`branch-${repo.id}`}
            options={branches}
            isLoading={branchesLoading}
            onMenuOpen={loadBranches}
            value={{ value: chosenBranch, label: chosenBranch }}
            onChange={(opt) => opt && handleBranchChange(opt.value)}
          />
        </div>

        <div className="mt-2">
          {statusLoading ? (
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
              onClick={() => setShowCreateBoardModal(true)}
              className="w-full rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/90"
            >
              Create Board
            </button>
          ) : isPartial ? (
            <button
              type="button"
              onClick={() => setShowConnectModal(true)}
              className="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-4 py-2 text-sm font-medium transition-colors hover:bg-amber-500/20"
            >
              Complete Setup
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowConnectModal(true)}
              className="w-full rounded-lg border border-foreground/20 bg-transparent text-foreground px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/5"
            >
              Connect
            </button>
          )}
        </div>
      </div>

      {showConnectModal && (
        <ConnectModal
          repo={repo.full_name}
          branch={chosenBranch}
          check={status ? { ...status, loading: false } : undefined}
          onClose={() => setShowConnectModal(false)}
          onConfirmMerged={() => {
            setShowConnectModal(false);
            checkStatus(chosenBranch);
          }}
        />
      )}

      {showCreateBoardModal && (
        <CreateBoardModal
          repo={repo.full_name}
          onClose={() => setShowCreateBoardModal(false)}
          onCreateBoard={() => {
            console.log("Create Board:", {
              repo: repo.full_name,
              branch: chosenBranch,
              workflowValid: status?.workflowValid ?? false,
              secretExists: status?.secretExists ?? false,
            });
          }}
        />
      )}
    </>
  );
}
