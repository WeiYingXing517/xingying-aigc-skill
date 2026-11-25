param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [ValidateSet('short-drama', 'series', 'film', 'commercial', 'narrated')]
    [string]$Channel = 'short-drama'
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Path)) {
    Write-Error "File not found: $Path"
    exit 1
}

$rates = @{
    'short-drama' = @{ MinRate = 4.2; MaxRate = 4.8; MaxClause = 18; ActionSec = 2.2; SceneSec = 1.2 }
    'series'      = @{ MinRate = 3.5; MaxRate = 4.0; MaxClause = 25; ActionSec = 3.0; SceneSec = 2.0 }
    'film'        = @{ MinRate = 3.2; MaxRate = 3.8; MaxClause = 25; ActionSec = 3.8; SceneSec = 2.5 }
    'commercial'  = @{ MinRate = 4.5; MaxRate = 5.0; MaxClause = 18; ActionSec = 1.5; SceneSec = 0.5 }
    'narrated'    = @{ MinRate = 4.5; MaxRate = 5.2; MaxClause = 18; ActionSec = 1.5; SceneSec = 0.8 }
}

$cfg = $rates[$Channel]
$lines = [System.IO.File]::ReadAllLines((Resolve-Path -LiteralPath $Path).Path, [System.Text.Encoding]::UTF8)

$spokenChars = 0
$actionBlocks = 0
$sceneCount = 0
$longLines = [System.Collections.Generic.List[string]]::new()
$inFence = $false

function Count-SpokenChars([string]$s) {
    $clean = $s -replace '（[^）]*）', '' -replace '\([^)]*\)', '' -replace '【[^】]*】', ''
    $matches = [regex]::Matches($clean, '[\p{L}\p{N}]')
    return $matches.Count
}

function Check-Clauses([string]$s, [int]$lineNo, [int]$limit) {
    $clean = $s -replace '^（[^）]*）\s*[:：]?\s*', '' -replace '^\([^)]*\)\s*[:：]?\s*', '' -replace '（[^）]*）', '' -replace '【[^】]*】', ''
    $clauses = $clean -split '[，。！？；：、,.!?;:—…]+'
    foreach ($c in $clauses) {
        $len = ([regex]::Matches($c, '[\p{L}\p{N}]')).Count
        if ($len -gt $limit) {
            $script:longLines.Add("L${lineNo} (${len}字 > ${limit}字上限): $($c.Trim())")
        }
    }
}

for ($i = 0; $i -lt $lines.Count; $i++) {
    $lineNo = $i + 1
    $raw = $lines[$i].Trim()
    if (-not $raw) { continue }
    if ($raw.StartsWith('```') -or $raw.StartsWith('~~~')) { $inFence = -not $inFence; continue }
    if ($raw.StartsWith('#') -or $raw.StartsWith('>')) { continue }

    # Table row mode (for ch-commercial: visual & VO play synchronously)
    if ($raw.StartsWith('|') -and $raw.EndsWith('|')) {
        if ($raw -match '^\|\s*[-:]+\s*\|' -or $raw -match '镜号与秒段|画面动作') { continue }
        $cols = $raw.Trim('|') -split '\|'
        if ($cols.Count -ge 3) {
            $sceneCount++
            $audio = $cols[2].Trim()
            $cCount = Count-SpokenChars $audio
            $spokenChars += $cCount
            if ($cCount -eq 0 -and $cols[1].Trim()) { $actionBlocks += 1 }
            Check-Clauses $audio $lineNo $cfg.MaxClause
        }
        continue
    }

    # Scene headers
    if ($raw -match '^(\d+-\d+[A-Za-z]?|第\s*\d+\s*场|【段落\s*\d+)') {
        $sceneCount++
        continue
    }
    if ($raw -match '^(第\s*\d+\s*集|人物|【状态锚点|【视角|【字幕|【花字|【音效|【系统|【闪回)') {
        continue
    }

    # Action blocks
    if ($raw.StartsWith('△')) {
        $actionBlocks++
        continue
    }

    # Dialogue / VO lines: Name (optional): Speech
    if ($raw -match '^([^\s:：△【】（()）]{1,16})\s*([（(][^）)]*[）)])?\s*[:：]\s*(.+)$') {
        $speech = $Matches[3].Trim()
        # Skip OS in pure mouth-movement overlap? Still takes viewer reading/listening time!
        $spokenChars += (Count-SpokenChars $speech)
        Check-Clauses $speech $lineNo $cfg.MaxClause
    }
}

if ($sceneCount -eq 0) { $sceneCount = 1 }
$speechMin = [math]::Round($spokenChars / $cfg.MaxRate, 1)
$speechMax = [math]::Round($spokenChars / $cfg.MinRate, 1)
# ~60% of action blocks run independently of dialogue
$indepActionMin = [math]::Round($actionBlocks * ($cfg.ActionSec * 0.55), 1)
$indepActionMax = [math]::Round($actionBlocks * ($cfg.ActionSec * 0.85), 1)
$transSec = [math]::Round($sceneCount * $cfg.SceneSec, 1)

$totalMin = [math]::Round($speechMin + $indepActionMin + $transSec, 1)
$totalMax = [math]::Round($speechMax + $indepActionMax + $transSec, 1)

Write-Output "=== 剧本时长与气口测算报告 ==="
Write-Output "通道模式   : $Channel (语速基准 $($cfg.MinRate)~$($cfg.MaxRate) 字/秒 | 单句气口上限 $($cfg.MaxClause) 字)"
Write-Output "统计概览   : 场次/镜段数=$sceneCount | 有效发声字数=$spokenChars 字 | 动作段落数=$actionBlocks"
Write-Output "分项耗时   : 发声对白 ${speechMin}~${speechMax}s + 非重叠动作 ${indepActionMin}~${indepActionMax}s + 转场停顿 ${transSec}s"
Write-Output "预估总时长 : ${totalMin} ~ ${totalMax} 秒 (约 $([math]::Round($totalMin/60, 1)) ~ $([math]::Round($totalMax/60, 1)) 分钟)"

if ($longLines.Count -gt 0) {
    Write-Output ""
    Write-Output "[气口超长预警] 发现 $($longLines.Count) 处单句连续字数超限，建议拆短或插入动作气口："
    foreach ($warn in $longLines) { Write-Output "  - $warn" }
} else {
    Write-Output "[气口检查] PASS（所有台词单句长度均符合当前通道气口上限）"
}
