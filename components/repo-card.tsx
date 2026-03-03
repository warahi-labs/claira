import Image from "next/image";
import { Loader2, Unplug } from "lucide-react";
import { Select } from "@/components/select";

type BranchOption = { value: string; label: string };

interface Repo {
  id: number;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  visibility: string;
  default_branch: string;
}

interface SetupCheck {
  workflowValid: boolean;
  secretExists: boolean;
  loading: boolean;
}

interface RepoCardProps {
  repo: Repo;
  chosenBranch: string;
  check: SetupCheck | undefined;
  branches: BranchOption[];
  branchesLoading: boolean;
  onLoadBranches: () => void;
  onBranchChange: (branch: string) => void;
  onConnect: () => void;
  onGetStarted: () => void;
}

export default function RepoCard({
  repo,
  chosenBranch,
  check,
  branches,
  branchesLoading,
  onLoadBranches,
  onBranchChange,
  onConnect,
  onGetStarted,
}: RepoCardProps) {
  const isConnected =
    check && !check.loading && check.workflowValid && check.secretExists;
  const isPartial =
    check &&
    !check.loading &&
    !isConnected &&
    (check.workflowValid || check.secretExists);

  return (
    <div className="rounded-lg border border-foreground/20 p-4 text-left text-sm">
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
        <Select
          instanceId={`branch-${repo.id}`}
          options={branches}
          isLoading={branchesLoading}
          onMenuOpen={onLoadBranches}
          value={{ value: chosenBranch, label: chosenBranch }}
          onChange={(opt) => opt && onBranchChange(opt.value)}
        />
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
            onClick={onGetStarted}
            className="w-full rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/90"
          >
            Create Board
          </button>
        ) : isPartial ? (
          <button
            type="button"
            onClick={onConnect}
            className="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-4 py-2 text-sm font-medium transition-colors hover:bg-amber-500/20"
          >
            Complete Setup
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            className="w-full rounded-lg border border-foreground/20 bg-transparent text-foreground px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/5"
          >
            Connect
          </button>
        )}
      </div>
    </div>
  );
}
