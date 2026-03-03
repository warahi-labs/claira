"use client";

import { useEffect, useRef, useState } from "react";
import RepoCard from "@/components/repo-card";
import ConnectModal from "@/components/connect-modal";
import CreateBoardModal from "@/components/create-board-modal";
import { fetchBranches, checkRepoStatus } from "./actions";
import { GitHubRepo } from "@/types/github";

type BranchOption = { value: string; label: string };
type Branch = { name: string; default: boolean };

interface SetupCheck {
  workflowValid: boolean;
  secretExists: boolean;
  loading: boolean;
}

export default function RepoPicker({ repos }: { repos: GitHubRepo[] }) {
  const [selectedBranches, setSelectedBranches] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const repo of repos) {
      initial[repo.full_name] = repo.default_branch;
    }
    return initial;
  });
  const [branchOptions, setBranchOptions] = useState<Record<string, BranchOption[]>>({});
  const [branchLoading, setBranchLoading] = useState<Record<string, boolean>>({});
  const [statusCache, setStatusCache] = useState<Record<string, SetupCheck>>({});
  const [modalRepo, setModalRepo] = useState<string | null>(null);
  const [getStartedRepo, setGetStartedRepo] = useState<string | null>(null);
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
    if (branchOptions[repo] || branchLoading[repo]) return;
    setBranchLoading((prev) => ({ ...prev, [repo]: true }));
    const result = await fetchBranches(repo);
    if ("error" in result) {
      setBranchLoading((prev) => ({ ...prev, [repo]: false }));
      return;
    }
    const options = result.branches.map((b: Branch) => ({
      value: b.name,
      label: b.default ? `${b.name} (default)` : b.name,
    }));
    setBranchOptions((prev) => ({ ...prev, [repo]: options }));
    setBranchLoading((prev) => ({ ...prev, [repo]: false }));
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
  }

  function closeModal() {
    setModalRepo(null);
  }

  const modalRepoData = modalRepo ? repos.find((r) => r.full_name === modalRepo) : null;
  const modalBranch = modalRepo
    ? selectedBranches[modalRepo] ?? modalRepoData?.default_branch ?? "main"
    : "";
  const modalCacheKey = modalRepo ? `${modalRepo}:${modalBranch}` : "";
  const modalCheck = modalCacheKey ? statusCache[modalCacheKey] : undefined;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {repos.map((repo) => {
          const chosenBranch = selectedBranches[repo.full_name] ?? repo.default_branch;
          const cacheKey = `${repo.full_name}:${chosenBranch}`;

          return (
            <RepoCard
              key={repo.id}
              repo={repo}
              chosenBranch={chosenBranch}
              check={statusCache[cacheKey]}
              branches={branchOptions[repo.full_name] ?? []}
              branchesLoading={branchLoading[repo.full_name] ?? false}
              onLoadBranches={() => loadBranches(repo.full_name)}
              onBranchChange={(newBranch) => {
                setSelectedBranches((prev) => ({ ...prev, [repo.full_name]: newBranch }));
                checkStatus(repo.full_name, newBranch);
              }}
              onConnect={() => openConnectModal(repo.full_name)}
              onGetStarted={() => setGetStartedRepo(repo.full_name)}
            />
          );
        })}
      </div>

      {modalRepo && modalRepoData && (
        <ConnectModal
          key={modalRepo}
          repo={modalRepo}
          branch={modalBranch}
          check={modalCheck}
          onClose={closeModal}
          onConfirmMerged={() => {
            closeModal();
            invalidateAndRecheck(modalRepo, modalBranch);
          }}
        />
      )}

      {getStartedRepo && (
        <CreateBoardModal
          repo={getStartedRepo}
          onClose={() => setGetStartedRepo(null)}
          onCreateBoard={() => {
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
        />
      )}
    </>
  );
}
