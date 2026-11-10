$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8

Add-Type -AssemblyName System.Data

$builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$builder['Data Source'] = if ($env:DB_SERVER) {
    $env:DB_SERVER
} else {
    'localhost'
}
$builder['Initial Catalog'] = if ($env:DB_DATABASE) {
    $env:DB_DATABASE
} else {
    'LaPreDigital_OLTP'
}
$builder['Integrated Security'] = -not [bool]$env:DB_USER

if ($env:DB_USER) {
    $builder['User ID'] = $env:DB_USER
    $builder['Password'] = $env:DB_PASSWORD
}

$builder['Encrypt'] = $true
$builder['TrustServerCertificate'] = $env:DB_TRUST_CERTIFICATE -ne 'false'
$builder['Connect Timeout'] = 10
$connection = New-Object System.Data.SqlClient.SqlConnection($builder.ConnectionString)
$transaction = $null

try {
    while ($null -ne ($line = [Console]::ReadLine())) {
        try {
            $request = $line | ConvertFrom-Json
            if ($connection.State -ne 'Open') {
                $connection.Open()
            }

            switch ($request.action) {
                'begin' {
                    $transaction = $connection.BeginTransaction([System.Data.IsolationLevel]::Serializable)
                    $result = @{ ok = $true }
                }
                'commit' {
                    $transaction.Commit()
                    $transaction = $null
                    $result = @{ ok = $true }
                }
                'rollback' {
                    if ($transaction) {
                        $transaction.Rollback()
                        $transaction = $null
                    }
                    $result = @{ ok = $true }
                }
                'query' {
                    $command = $connection.CreateCommand()
                    $command.CommandText = $request.text
                    $command.CommandTimeout = 15
                    if ($transaction) {
                        $command.Transaction = $transaction
                    }

                    foreach ($property in $request.params.PSObject.Properties) {
                        $value = $property.Value
                        if ($null -eq $value) {
                            $value = [DBNull]::Value
                        }

                        [void]$command.Parameters.AddWithValue('@' + $property.Name, $value)
                    }
                    $reader = $command.ExecuteReader()
                    $sets = New-Object System.Collections.Generic.List[object]
                    try {
                        do {
                            if ($reader.FieldCount -gt 0) {
                                $rows = New-Object System.Collections.Generic.List[object]
                                while ($reader.Read()) {
                                    $row = @{}
                                    for ($i = 0; $i -lt $reader.FieldCount; $i++) {
                                        $value = $reader.GetValue($i)
                                        if ($value -is [DBNull]) {
                                            $value = $null
                                        }
                                        if ($value -is [DateTime]) {
                                            $value = $value.ToString('yyyy-MM-ddTHH:mm:ss')
                                        }
                                        $row[$reader.GetName($i)] = $value
                                    }
                                    $rows.Add($row)
                                }
                                $sets.Add(@($rows.ToArray()))
                            }
                        } while ($reader.NextResult())
                    } finally {
                        $reader.Close()
                        $command.Dispose()
                    }
                    $first = @()
                    if ($sets.Count -gt 0) {
                        $first = @($sets[0])
                    }
                    $result = @{
                        recordset = $first
                        recordsets = @($sets.ToArray())
                    }
                }
                default {
                    throw 'Operación SQL desconocida'
                }
            }
            [Console]::WriteLine(($result | ConvertTo-Json -Depth 20 -Compress))
        } catch {
            [Console]::WriteLine((@{ error = $_.Exception.Message } | ConvertTo-Json -Compress))
        }
    }
} finally {
    if ($transaction) {
        $transaction.Rollback()
    }
    $connection.Dispose()
}
