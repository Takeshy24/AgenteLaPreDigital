param([Parameter(Mandatory=$true)][string]$InputPath,[Parameter(Mandatory=$true)][string]$PdfPath,[switch]$UpdateFields,[switch]$RepairHeadingNumbers)
$ErrorActionPreference='Stop'
$manualWord=$null
$manualDoc=$null
try {
    $manualWord=New-Object -ComObject Word.Application
    $manualWord.Visible=$false
    $manualWord.DisplayAlerts=0
    $manualWord.AutomationSecurity=3
    $manualDoc=$manualWord.Documents.Open($InputPath,$false,(-not $UpdateFields.IsPresent),$false)
    if ($UpdateFields) {
        if($RepairHeadingNumbers){
            $manualList=$manualDoc.ListTemplates.Add($true,'NumeracionManual')
            for($manualLevel=1;$manualLevel -le 9;$manualLevel++){
                $manualDef=$manualList.ListLevels.Item($manualLevel)
                $manualDef.NumberFormat=((1..$manualLevel | ForEach-Object {'%'+$_}) -join '.')
                $manualDef.NumberStyle=0
                $manualDef.StartAt=1
                $manualDef.ResetOnHigher=if($manualLevel -gt 1){$manualLevel-1}else{0}
                $manualDef.TrailingCharacter=1
                $manualDef.NumberPosition=0
                $manualDef.TextPosition=0
                $manualDef.TabPosition=0
            }
            foreach($manualParagraph in $manualDoc.Paragraphs){
                $manualOutline=$manualParagraph.OutlineLevel
                if($manualOutline -eq 1 -or $manualOutline -eq 2){
                    $manualParagraph.Range.ListFormat.ApplyListTemplateWithLevel($manualList,$true,2,1,$manualOutline)
                }
            }
        }
        $manualDoc.Fields.Update() | Out-Null
        foreach($manualToc in $manualDoc.TablesOfContents){$manualToc.Update()}
        $manualDoc.Repaginate()
        foreach($manualToc in $manualDoc.TablesOfContents){$manualToc.UpdatePageNumbers()}
        $manualDoc.Save()
    }
    $manualDoc.ExportAsFixedFormat($PdfPath,17)
    Write-Output ('PDF exportado: '+$PdfPath)
} finally {
    if($manualDoc){$manualDoc.Close(0);[Runtime.InteropServices.Marshal]::FinalReleaseComObject($manualDoc) | Out-Null}
    if($manualWord){$manualWord.Quit();[Runtime.InteropServices.Marshal]::FinalReleaseComObject($manualWord) | Out-Null}
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
