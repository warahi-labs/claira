import { Modal } from "@/components/modal";

interface CreateBoardModalProps {
  repo: string;
  onClose: () => void;
  onCreateBoard: () => void;
}

export default function CreateBoardModal({
  repo,
  onClose,
  onCreateBoard,
}: CreateBoardModalProps) {
  return (
    <Modal title={repo} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="font-medium">
          Have you installed the Claude GitHub App on this repo?
        </p>
        <p className="text-foreground/60">
          The Claude app needs to be installed on{" "}
          <strong>{repo}</strong> for Claude Code to work with
          GitHub Actions.
        </p>
        <div className="flex flex-col gap-2 text-sm">
          <a
            href={`https://github.com/${repo}/settings/installations`}
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
        onClick={onCreateBoard}
        className="w-full rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/90"
      >
        Create Board
      </button>
    </Modal>
  );
}
