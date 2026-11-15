$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$errors = [System.Collections.Generic.List[string]]::new()
$files = @(Get-ChildItem -LiteralPath $root -Recurse -File -Filter '*.md')
$texts = @{}
foreach ($file in $files) { $texts[$file.FullName] = [System.IO.File]::ReadAllText($file.FullName) }
function Get-Anchors([string]$text) {
    $result = [System.Collections.Generic.List[string]]::new()
    $counts = @{}; $fence = $false
    foreach ($line in ($text -split '\r?\n')) {
        if ($line.TrimStart().StartsWith('```') -or $line.TrimStart().StartsWith('~~~')) { $fence = -not $fence; continue }
        if (-not $fence -and $line -match '^#{1,6}\s+(.+?)\s*#*$') {
            $base = $Matches[1].ToLowerInvariant() -replace '[`*_~]', ''
            $base = $base.Trim() -replace '[^\p{L}\p{N} _-]', '' -replace '\s', '-'
            $count = 0; if ($counts.ContainsKey($base)) { $count = $counts[$base] }
            if ($count -eq 0) { $result.Add($base) } else { $result.Add("$base-$count") }
            $counts[$base] = $count + 1
        }
    }
    return $result.ToArray()
}
$entries = @(Get-ChildItem -LiteralPath (Join-Path $root 'screenplay-writing') -Recurse -File -Filter 'SKILL.md')
$entry = Join-Path $root 'screenplay-writing\SKILL.md'
if ($entries.Count -ne 1 -or $entries[0].FullName -ne $entry) { $errors.Add('Expected exactly one installed entry') }
if ($texts[$entry] -notmatch '\A---\r?\nname: screenplay-writing\r?\ndescription: .+\r?\n---') { $errors.Add('Invalid entry metadata') }
$links = 0
foreach ($file in $files) {
    foreach ($match in [regex]::Matches($texts[$file.FullName], '!?\[[^\]\n]*\]\(([^)\n]+)\)')) {
        $target = $match.Groups[1].Value.Trim().Trim('<','>')
        if ($target -match '^[a-zA-Z][a-zA-Z0-9+.-]*:' -or $target.StartsWith('//')) { continue }
        $links++
        $parts = $target -split '#', 2
        $relative = [uri]::UnescapeDataString(($parts[0] -split '\?',2)[0])
        if ($relative) { $resolved = [System.IO.Path]::GetFullPath((Join-Path $file.DirectoryName $relative)) } else { $resolved = $file.FullName }
        if (-not $resolved.StartsWith($root + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { $errors.Add("Outside package: $target"); continue }
        if (-not (Test-Path -LiteralPath $resolved)) { $errors.Add("Missing link in $($file.Name): $target"); continue }
        if ($parts.Count -gt 1 -and $resolved.EndsWith('.md')) {
            $anchor = [uri]::UnescapeDataString($parts[1])
            if ($anchor -and $anchor -notin @(Get-Anchors $texts[$resolved])) { $errors.Add("Missing anchor in $($file.Name): $target") }
        }
    }
}
$required = @{
 'screenplay-writing\SKILL.md' = @('创作导航与路况','references/style.md','references/curves.md')
 'screenplay-writing\references\characters.md' = @('反应机制与人物层次','script.md#情绪变化链与跨场余波')
 'screenplay-writing\references\script.md' = @('情绪变化链与跨场余波','style.md','curves.md')
 'screenplay-writing\references\brief.md' = @('起伏与文风偏好','style.md','curves.md')
 'screenplay-writing\references\review.md' = @('人物情绪、文风与起伏复核','style.md','curves.md')
 'screenplay-writing\references\project.md' = @('创作路线、文风与情绪的最小交接')
 'screenplay-writing\references\style.md' = @('style-samples.md','缺实际独立运行','有限轮次')
 'screenplay-writing\references\style-samples.md' = @('## A.','## B.','## C.','## D.','## E.','候选')
 'tests\回归规范.md' = @('人物情绪与起伏文风回归.md')
}
foreach ($relative in $required.Keys) {
    $text = $texts[(Join-Path $root $relative)]
    foreach ($token in $required[$relative]) { if (-not $text -or -not $text.Contains($token)) { $errors.Add("Missing routing token in ${relative}: $token") } }
}
Write-Output "Checked $($files.Count) Markdown files, $links local links, $($required.Count) routing contracts."
Write-Output 'Scope: static package structure only; no narrative or cross-model validation.'
foreach ($problem in $errors) { Write-Output "ERROR: $problem" }
if ($errors.Count) { Write-Output 'FAIL'; exit 1 }
Write-Output 'PASS'
