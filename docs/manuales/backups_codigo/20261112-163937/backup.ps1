$ErrorActionPreference='Stop'
$manualWork=$PSScriptRoot
$manualRoot=Split-Path -Parent $manualWork
$manualBackupRoot=Join-Path $manualRoot 'backups_codigo'
New-Item -ItemType Directory -Path $manualBackupRoot -Force | Out-Null
Set-Content -LiteralPath (Join-Path $manualWork 'backup.pid') -Value $PID
function Save-ManualBackup {
    $manualStamp=Get-Date -Format 'yyyyMMdd-HHmmss'
    $manualTarget=Join-Path $manualBackupRoot $manualStamp
    New-Item -ItemType Directory -Path $manualTarget -Force | Out-Null
    foreach($manualFile in Get-ChildItem -LiteralPath $manualWork -File){
        if($manualFile.Extension -in '.py','.json','.md','.ps1','.docx','.pdf'){
            Copy-Item -LiteralPath $manualFile.FullName -Destination $manualTarget -ErrorAction Continue
        }
    }
    foreach($manualName in 'Manual_de_codigo_LaPreDigital.docx','Manual_de_codigo_LaPreDigital.pdf'){
        $manualArtifact=Join-Path $manualRoot $manualName
        if(Test-Path -LiteralPath $manualArtifact){Copy-Item -LiteralPath $manualArtifact -Destination $manualTarget -ErrorAction Continue}
    }
    $manualCaptureDir=Join-Path $manualWork 'capturas_codigo'
    if(Test-Path -LiteralPath $manualCaptureDir){Copy-Item -LiteralPath $manualCaptureDir -Destination $manualTarget -Recurse -ErrorAction Continue}
    Add-Content -LiteralPath (Join-Path $manualBackupRoot 'registro.txt') -Value ($manualStamp+' copia guardada')
}
while(-not (Test-Path -LiteralPath (Join-Path $manualWork 'detener-backup'))){
    Save-ManualBackup
    for($manualTick=0;$manualTick -lt 300;$manualTick++){
        if(Test-Path -LiteralPath (Join-Path $manualWork 'detener-backup')){break}
        Start-Sleep -Seconds 1
    }
}
Save-ManualBackup
