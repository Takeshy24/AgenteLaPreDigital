$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$word = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    foreach ($name in @('usuario', 'codigo')) {
        $inputPath = Join-Path $taskRoot ($name + '_corregido.docx')
        $outputPath = Join-Path $taskRoot ($name + '_corregido.pdf')
        $document = $null
        try {
            $document = $word.Documents.Open($inputPath, $false, $true, $false)
            $document.Repaginate()
            $headings = @()
            foreach ($paragraph in $document.Paragraphs) {
                $outlineLevel = [int]$paragraph.OutlineLevel
                if ($outlineLevel -eq 1 -or $outlineLevel -eq 2) {
                    $headings += @{
                        number = $paragraph.Range.ListFormat.ListString
                        text = $paragraph.Range.Text.Trim()
                        page = $paragraph.Range.Information(3)
                    }
                }
            }
            $headings | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $taskRoot ($name + '_paginas.json')) -Encoding utf8
            $document.ExportAsFixedFormat($outputPath, 17)
            Write-Output ($name + ': PDF generado; títulos ' + $headings.Count)
        } finally {
            if ($document) {
                $document.Close(0)
                [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($document)
            }
        }
    }
} finally {
    if ($word) {
        $word.Quit()
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
    }
}
