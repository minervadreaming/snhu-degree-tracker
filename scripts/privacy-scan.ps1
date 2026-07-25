param(
  [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"
$git = Get-Command git -ErrorAction Stop
$tracked = & $git.Source -C $RepositoryRoot ls-files --cached --others --exclude-standard
$productionExtensions = @(".html", ".js", ".css", ".json", ".md", ".txt", ".map")
$targets = $tracked | Where-Object {
  $extension = [IO.Path]::GetExtension($_).ToLowerInvariant()
  $productionExtensions -contains $extension
}

$findings = [System.Collections.Generic.List[object]]::new()
$genericPatterns = [ordered]@{
  "student identifier label with long value" = '(?:"studentId"|student\s+(?:id|number))\s*[:#=]\s*["'']?[A-Z0-9-]{6,}'
  "real-looking email address" = '[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}'
  "transfer evaluation filename" = 'transfer[\s_-]*evaluation[^\r\n]{0,40}\.(?:pdf|json|txt)'
  "academic evaluation filename" = 'academic[\s_-]*evaluation[^\r\n]{0,40}\.(?:pdf|json|txt)'
  "private directory referenced by production code" = '(?:private-data|private-seeds|local-backups)[\\/]'
}
$productionModules = @("index.html", "app.js", "engine.js", "academic-data.js", "privacy.js")

foreach ($relativePath in $targets) {
  $fullPath = Join-Path $RepositoryRoot $relativePath
  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { continue }
  $content = Get-Content -LiteralPath $fullPath -Raw -ErrorAction SilentlyContinue
  foreach ($entry in $genericPatterns.GetEnumerator()) {
    if ($entry.Key -eq "private directory referenced by production code" -and $relativePath -notin $productionModules) { continue }
    if ($content -match $entry.Value) {
      $findings.Add([pscustomobject]@{ Path = $relativePath; Category = $entry.Key })
    }
  }
}

foreach ($relativePath in $tracked | Where-Object { [IO.Path]::GetExtension($_) -ieq ".pdf" }) {
  $findings.Add([pscustomobject]@{ Path = $relativePath; Category = "unexpected tracked PDF" })
}

$localPatternFile = Join-Path $RepositoryRoot ".privacy-patterns.local"
if (Test-Path -LiteralPath $localPatternFile) {
  $privatePatterns = Get-Content -LiteralPath $localPatternFile | Where-Object { $_.Trim() -and -not $_.Trim().StartsWith("#") }
  foreach ($relativePath in $targets) {
    $fullPath = Join-Path $RepositoryRoot $relativePath
    foreach ($privatePattern in $privatePatterns) {
      if (Select-String -LiteralPath $fullPath -SimpleMatch $privatePattern -Quiet -ErrorAction SilentlyContinue) {
        $findings.Add([pscustomobject]@{ Path = $relativePath; Category = "local prohibited pattern" })
        break
      }
    }
  }
}

if ($findings.Count) {
  $findings | Sort-Object Path, Category -Unique | Format-Table -AutoSize
  throw "Privacy defense-in-depth scan found $($findings.Count) item(s). Review each finding; this scan cannot prove complete privacy."
}

Write-Output "Privacy defense-in-depth scan passed for tracked production-readable files. A passing scan does not prove complete privacy."
