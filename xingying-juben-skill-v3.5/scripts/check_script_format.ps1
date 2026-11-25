param(
    [string]$Path = '',
    [ValidateSet('', 'modern', 'ancient')]
    [string]$Era = '',
    [switch]$SelfCheck
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

if ($SelfCheck -or -not $Path) {
    $errors = [System.Collections.Generic.List[string]]::new()
    $entry = Join-Path $root 'SKILL.md'
    $allSkills = @(Get-ChildItem -LiteralPath $root -Recurse -File -Filter 'SKILL.md')
    if ($allSkills.Count -ne 1 -or $allSkills[0].FullName -ne $entry) {
        $errors.Add("Expected single root SKILL.md, found $($allSkills.Count)")
    }

    $entryLines = [System.IO.File]::ReadAllLines($entry, [System.Text.Encoding]::UTF8)
    $entryText = [System.IO.File]::ReadAllText($entry, [System.Text.Encoding]::UTF8)
    if ($entryLines.Count -gt 120) {
        $errors.Add("SKILL.md exceeds 120-line budget ($($entryLines.Count) lines)")
    }
    if ($entryText -notmatch '\A---\r?\nname:\s*xingying-juben-v3-5\r?\ndescription:\s*.+\r?\n---') {
        $errors.Add("Invalid SKILL.md YAML frontmatter (expected name: xingying-juben-v3-5)")
    }

    function Get-Anchors([string]$text) {
        $result = [System.Collections.Generic.HashSet[string]]::new()
        $counts = @{}; $fence = $false
        foreach ($line in ($text -split '\r?\n')) {
            if ($line.TrimStart().StartsWith('```') -or $line.TrimStart().StartsWith('~~~')) { $fence = -not $fence; continue }
            if (-not $fence -and $line -match '^#{1,6}\s+(.+?)\s*#*$') {
                $base = $Matches[1].ToLowerInvariant() -replace '[`*_~]', ''
                $base = $base.Trim() -replace '[^\p{L}\p{N} _-]', '' -replace '\s', '-'
                $count = 0; if ($counts.ContainsKey($base)) { $count = $counts[$base] }
                if ($count -eq 0) { [void]$result.Add($base) } else { [void]$result.Add("$base-$count") }
                $counts[$base] = $count + 1
            }
        }
        return $result
    }

    $mdFiles = @(Get-ChildItem -LiteralPath $root -Recurse -File -Filter '*.md')
    $linkCount = 0
    $anchorCount = 0
    $hedgingTokens = @('不承诺完播', '不保证跨模型', '尚未完成发布回归', '缺实际独立运行', '不承诺独创性')
    $isolatedDirs = @('core', 'channels', 'examples', 'templates')

    foreach ($f in $mdFiles) {
        $txt = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
        $relDir = $f.DirectoryName.Substring($root.Length).TrimStart('\', '/')
        $topDir = ($relDir -split '[\\/]')[0]

        if ($topDir -ne 'dev') {
            foreach ($bad in $hedgingTokens) {
                if ($txt.Contains($bad)) {
                    $errors.Add("Banned hedging phrase '$bad' found in runtime file $($f.Name)")
                }
            }
        }

        foreach ($m in [regex]::Matches($txt, '!?\[[^\]\n]*\]\(([^)\n]+)\)')) {
            $target = $m.Groups[1].Value.Trim().Trim('<', '>')
            if ($target -match '^[a-zA-Z][a-zA-Z0-9+.-]*:' -or $target.StartsWith('//')) { continue }
            $linkCount++
            $parts = $target -split '#', 2
            $cleanRel = [uri]::UnescapeDataString(($parts[0] -split '\?', 2)[0])
            $resolved = if ($cleanRel) { [System.IO.Path]::GetFullPath((Join-Path $f.DirectoryName $cleanRel)) } else { $f.FullName }
            if (-not $resolved.StartsWith($root + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
                $errors.Add("Link escapes skill package in $($f.Name): $target")
                continue
            } elseif (-not (Test-Path -LiteralPath $resolved)) {
                $errors.Add("Broken relative link in $($f.Name): $target")
                continue
            }

            if ($topDir -in $isolatedDirs -and $cleanRel -and $cleanRel.EndsWith('.md')) {
                $errors.Add("Lateral cross-link violation in ${topDir}/$($f.Name) -> $target (only SKILL.md may dispatch)")
            }

            if ($parts.Count -gt 1 -and $parts[1] -and $resolved.EndsWith('.md')) {
                $anchorCount++
                $frag = [uri]::UnescapeDataString($parts[1])
                $targetTxt = [System.IO.File]::ReadAllText($resolved, [System.Text.Encoding]::UTF8)
                $anchors = Get-Anchors $targetTxt
                if (-not $anchors.Contains($frag)) {
                    $errors.Add("Missing heading anchor in $($f.Name): $target")
                }
            }
        }
    }

    $requiredRoutes = @(
        'channels/ch-short-drama.md', 'channels/ch-series.md', 'channels/ch-film.md',
        'channels/ch-commercial.md', 'channels/ch-narrated.md',
        'core/iron-laws.md', 'core/dialogue-surgery.md', 'core/adaptation.md', 'core/audit-and-risk.md',
        'examples/samples-short-drama.md', 'examples/samples-film-series.md', 'examples/samples-commercial-vo.md',
        'templates/project-state-schema.md',
        'scripts/estimate_duration.cjs', 'scripts/check_script_format.cjs'
    )
    foreach ($r in $requiredRoutes) {
        if (-not $entryText.Contains($r)) {
            $errors.Add("SKILL.md missing dispatch route: $r")
        }
    }

    Write-Output "=== 星应剧本 3.5 · 架构与全链路路由自检 ==="
    Write-Output "检查范围 : $($mdFiles.Count) 份 Markdown | $linkCount 个文件/脚本链接 | $anchorCount 个精确章节锚点 | SKILL.md 行数=$($entryLines.Count)/120"
    Write-Output "架构守卫 : 单向路由派发锁 + 精确章节锚点可达 + 脚本路径挂载 + 运行时零免责废话锁"
    if ($errors.Count -gt 0) {
        foreach ($e in $errors) { Write-Output "ERROR: $e" }
        Write-Output "RESULT: FAIL"
        exit 1
    }
    Write-Output "RESULT: PASS"
    exit 0
}

if (-not (Test-Path -LiteralPath $Path)) {
    Write-Error "Script file not found: $Path"
    exit 1
}

$lines = [System.IO.File]::ReadAllLines((Resolve-Path -LiteralPath $Path).Path, [System.Text.Encoding]::UTF8)
$issues = [System.Collections.Generic.List[string]]::new()
$currentScene = ''
$castList = @()
$hasCastLine = $false
$sceneCount = 0
$isTableMode = $false
$cliches = @('命运的齿轮', '气氛瞬间凝固', '空气瞬间凝固', '三分凉薄', '三分讥诮', '展开了一番激烈')
$modernStiff = @('是否', '因此', '从而', '鉴于', '予以', '加以', '可否', '何以', '颇为', '甚为', '然而')
$ancientAnach = @('逻辑', '机制', '维度', '复盘', '闭环', '赋能', '抓手', '颗粒度', '情绪价值', '经济损失', '心理阴影', '物理意义')

for ($i = 0; $i -lt $lines.Count; $i++) {
    $ln = $i + 1
    $raw = $lines[$i].Trim()
    if (-not $raw -or $raw.StartsWith('#') -or $raw.StartsWith('```')) { continue }

    foreach ($c in $cliches) {
        if ($raw.Contains($c)) {
            $issues.Add("L${ln} [抽象废话预警]: 命中禁用套话「$c」，请改为具体可拍动作")
        }
    }

    if ($raw.StartsWith('△')) {
        if ($raw -match '(车窗.{0,6}递.{0,6}伞|伞.{0,6}递出车窗)') {
            $issues.Add("L${ln} [AIGC防穿模预警]: 跨窄车窗递伞极易导致 AI 视频穿模，建议改为推门下车撑伞或门外收伞")
        }
        if ($raw -match '(伞尖悬在雨里|剑尖停在咽喉)') {
            $issues.Add("L${ln} [AIGC防穿模预警]: 无根局部悬空词，请补全握持部位、开合状态与物理落点")
        }
    }

    if ($raw.StartsWith('|') -and $raw -match '^\|\s*\*?\*?S\d+') {
        $isTableMode = $true
        $sceneCount++
        $cols = $raw.Trim('|') -split '\|'
        if ($cols.Count -ge 3) {
            $visCol = $cols[1].Trim()
            $audCol = $cols[2].Trim()
            if ($visCol -match '(车窗.{0,6}递.{0,6}伞|伞.{0,6}递出车窗)') {
                $issues.Add("L${ln} [AIGC防穿模预警]: 跨窄车窗递伞极易导致 AI 视频穿模，建议改为推门下车撑伞或门外收伞")
            }
            if ($Era -eq 'modern') {
                foreach ($w in $modernStiff) { if ($audCol.Contains($w)) { $issues.Add("L${ln} [现代书面虚词预警]: 台词含公文腔词「$w」，非官腔人设建议改为自然口语") } }
            } elseif ($Era -eq 'ancient') {
                foreach ($w in $ancientAnach) { if ($audCol.Contains($w)) { $issues.Add("L${ln} [古装现代词穿越预警]: 古装台词混入现代词「$w」，请替换为符合时代的表达") } }
            }
        }
        continue
    }

    if ($raw -match '^(\d+-\d+[A-Za-z]?|第\s*\d+\s*场)\s+.+') {
        $currentScene = $raw
        $castList = @()
        $hasCastLine = $false
        $isTableMode = $false
        $sceneCount++
        continue
    }
    if ($raw -match '^【段落\s*\d+') {
        $currentScene = $raw
        $castList = @()
        $hasCastLine = $false
        $isTableMode = $false
        $sceneCount++
        continue
    }

    if ($raw -match '^人物\s*[:：]\s*(.+)$') {
        $hasCastLine = $true
        $cleaned = $Matches[1] -replace '（[^）]*）', '' -replace '\([^)]*\)', ''
        $castList = @($cleaned -split '[\s、，,/]+' | Where-Object { $_ })
        continue
    }

    if ($raw -match '^[^\s:：△【】（()）]{1,12}\s+(VO|OS|O\.S\.)\s*[:：]') {
        $issues.Add("L${ln} [说话人通道歧义]: 请将 VO/OS 放入圆括号内（如 角色名（VO）：），避免下游误生成幽灵角色")
        continue
    }

    if ($currentScene -and -not $isTableMode -and $raw -match '^([^\s:：△【】（()）]{1,12})\s*([（(][^）)]*[）)])?\s*[:：]\s*(.+)$') {
        $speaker = $Matches[1].Trim()
        $channelTag = if ($Matches[2]) { $Matches[2].Trim() } else { '' }
        $speech = $Matches[3].Trim()
        if ($speaker -in @('时间', '地点', '传播目标', '预估发声字数')) { continue }

        if ($speaker -in @('内心', '主角', '角色')) {
            $issues.Add("L${ln} [非具名说话人违规]: 严禁用「$speaker」当说话人，请改为真实角色名（如 角色名（OS）：）")
        } elseif ($speaker -eq '旁白' -and $channelTag -notmatch 'VO') {
            $issues.Add("L${ln} [旁白标记不规范]: 无具名旁白请统一写作「旁白（VO）：」以区分实体角色")
        } elseif ($speaker -ne '旁白' -and $hasCastLine -and $castList.Count -gt 0 -and ($speaker -notin $castList)) {
            $issues.Add("L${ln} [出场名单漏标]: 场景「$currentScene」中角色「$speaker」未列入本场「人物：」行")
        }

        if ($Era -eq 'modern') {
            foreach ($w in $modernStiff) {
                if ($speech.Contains($w)) {
                    $issues.Add("L${ln} [现代书面虚词预警]: 台词含公文腔词「$w」，非官腔人设建议改为自然口语")
                }
            }
        } elseif ($Era -eq 'ancient') {
            foreach ($w in $ancientAnach) {
                if ($speech.Contains($w)) {
                    $issues.Add("L${ln} [古装现代词穿越预警]: 古装台词混入现代词「$w」，请替换为符合时代的表达")
                }
            }
        }
    }
}

$eraLabel = if ($Era) { " (era=$Era)" } else { "" }
Write-Output "=== 星应剧本 3.5 · 成稿格式与语感体检报告${eraLabel} ==="
Write-Output "识别场次/镜段数 : $sceneCount"
if ($issues.Count -gt 0) {
    foreach ($it in $issues) { Write-Output "  - $it" }
    Write-Output "RESULT: WARN ($($issues.Count) 项待修正)"
    exit 1
} else {
    Write-Output "RESULT: PASS（场标、出场名单、通道防歧义及反套话扫描全部通过）"
}
