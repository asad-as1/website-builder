"use client";

import { useState, useEffect } from "react";
import { ExternalLink, Check, Loader2, X, Lock, Globe, Key } from "lucide-react";

const GithubIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

type ProjectFile = { path: string; content: string };

interface GitHubExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  files: ProjectFile[];
}

export default function GitHubExportModal({
  isOpen,
  onClose,
  projectName,
  files,
}: GitHubExportModalProps) {
  const [token, setToken] = useState("");
  const [repoName, setRepoName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [createdRepoUrl, setCreatedRepoUrl] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const savedToken = window.localStorage.getItem("genetix_github_token") || "";
      setToken(savedToken);
      const cleanName = projectName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "my-website";
      setRepoName(cleanName);
      setError("");
      setStatusMessage("");
      setCreatedRepoUrl("");
    }
  }, [isOpen, projectName]);

  if (!isOpen) return null;

  const handleExport = async () => {
    if (!token.trim()) {
      setError("Please provide a GitHub Personal Access Token (PAT).");
      return;
    }
    if (!repoName.trim()) {
      setError("Please enter a repository name.");
      return;
    }

    setIsBusy(true);
    setError("");
    setStatusMessage("Authenticating with GitHub...");

    try {
      // 1. Validate Token & Get User
      const userRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (!userRes.ok) {
        if (userRes.status === 401) {
          throw new Error("Invalid GitHub token. Please verify permissions.");
        }
        throw new Error(`GitHub auth failed with status ${userRes.status}`);
      }

      const userData = await userRes.json();
      const username = userData.login;

      // Save token for convenience
      window.localStorage.setItem("genetix_github_token", token.trim());

      // 2. Create Repository
      setStatusMessage(`Creating repository "${repoName}" for @${username}...`);
      const createRes = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: repoName.trim(),
          private: isPrivate,
          description: "Production website built with Genetix AI Website Builder",
          auto_init: false,
        }),
      });

      if (!createRes.ok) {
        const createErr = await createRes.json();
        throw new Error(createErr.message || "Failed to create GitHub repository.");
      }

      const repoData = await createRes.json();
      const repoFullName = repoData.full_name;

      // 3. Commit Files
      const total = files.length;
      for (let i = 0; i < total; i++) {
        const file = files[i];
        setStatusMessage(`Pushing ${file.path} (${i + 1}/${total})...`);

        // Convert content to utf-8 safe base64
        const utf8Bytes = new TextEncoder().encode(file.content);
        let binary = "";
        for (let b = 0; b < utf8Bytes.length; b++) {
          binary += String.fromCharCode(utf8Bytes[b]);
        }
        const base64Content = btoa(binary);

        const putRes = await fetch(
          `https://api.github.com/repos/${repoFullName}/contents/${file.path}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token.trim()}`,
              Accept: "application/vnd.github.v3+json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: `Initial commit: ${file.path}`,
              content: base64Content,
            }),
          }
        );

        if (!putRes.ok) {
          console.warn(`Could not upload ${file.path}`);
        }
      }

      setStatusMessage("All files pushed successfully!");
      setCreatedRepoUrl(repoData.html_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "GitHub export failed");
    } finally {
      setIsBusy(false);
    }
  };

  const copyRepoUrl = async () => {
    if (!createdRepoUrl) return;
    try {
      await navigator.clipboard.writeText(createdRepoUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#12121f] p-6 sm:p-8 shadow-2xl relative text-white">
        <button
          onClick={onClose}
          disabled={isBusy}
          className="absolute right-5 top-5 p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-white/10 text-white">
            <GithubIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Push to GitHub</h2>
            <p className="text-xs text-gray-400">
              Directly export your project to your personal GitHub profile.
            </p>
          </div>
        </div>

        {createdRepoUrl ? (
          <div className="space-y-4 pt-2">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Repository Created!</h3>
              <p className="text-xs text-gray-300 mb-4">
                All {files.length} project files have been pushed to your GitHub account.
              </p>

              <div className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/10 font-mono text-xs text-emerald-300">
                <span className="truncate flex-1 text-left px-2">{createdRepoUrl}</span>
                <button
                  onClick={copyRepoUrl}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-xs flex items-center gap-1 shrink-0"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : "Copy"}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium text-gray-300"
              >
                Close
              </button>
              <a
                href={createdRepoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 font-semibold text-sm text-white shadow-lg"
              >
                <span>View on GitHub</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-300">
                {error}
              </div>
            )}

            {statusMessage && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-xs text-cyan-200">
                <Loader2 className="w-4 h-4 animate-spin shrink-0 text-cyan-300" />
                <span>{statusMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Repository Name
              </label>
              <input
                type="text"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                disabled={isBusy}
                placeholder="e.g. aria-photography"
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/30 border border-white/10 text-sm font-mono text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2.5">
                {isPrivate ? (
                  <Lock className="w-4 h-4 text-purple-400" />
                ) : (
                  <Globe className="w-4 h-4 text-cyan-400" />
                )}
                <div>
                  <span className="text-xs font-semibold text-white block">
                    {isPrivate ? "Private Repository" : "Public Repository"}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {isPrivate ? "Only you can see this repo" : "Anyone on GitHub can view"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrivate(!isPrivate)}
                disabled={isBusy}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 transition"
              >
                Switch to {isPrivate ? "Public" : "Private"}
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-300 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  GitHub Personal Access Token (PAT)
                </label>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=Genetix+Website+Builder"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <span>Generate Token</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={isBusy}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/30 border border-white/10 text-sm font-mono text-white outline-none focus:border-cyan-400"
              />
              <p className="mt-1.5 text-[11px] text-gray-400 leading-relaxed">
                Requires the <strong>repo</strong> scope. Token is saved only in your local browser storage.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                disabled={isBusy}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium text-gray-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={isBusy || !token.trim() || !repoName.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 text-sm font-semibold text-white shadow-lg transition disabled:opacity-50 cursor-pointer"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Pushing...</span>
                  </>
                ) : (
                  <>
                    <GithubIcon className="w-4 h-4" />
                    <span>Create & Push</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
