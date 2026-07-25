param(
  [string]$ReplacementFile = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path ".privacy-replacements.local")
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $ReplacementFile -PathType Leaf)) {
  throw "Create the ignored replacement file first. Put one git-filter-repo replace-text expression on each line."
}
if (-not (Get-Command git-filter-repo -ErrorAction SilentlyContinue)) {
  throw "git-filter-repo is required. Install and review it before continuing."
}

Write-Warning "This rewrites commit hashes. Collaborators must re-clone, and the remote requires a force push."
$confirmation = Read-Host "Type REWRITE HISTORY to continue"
if ($confirmation -cne "REWRITE HISTORY") { throw "History rewrite cancelled." }

git-filter-repo --sensitive-data-removal --replace-text $ReplacementFile
