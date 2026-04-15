param (
    [string]$TextInput = "This is a secret message!",
    [string]$SecretKey = "12345678-1234-1234-1234-123456789012" # Your 36-character key
)

# 1. Derive a 32-byte key using SHA-256 to fit AES-256 requirements
$sha256 = [System.Security.Cryptography.SHA256]::Create()
$keyBytes = $sha256.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($SecretKey))

# 2. Setup AES-256-CBC
$aes = [System.Security.Cryptography.Aes]::Create()
$aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
$aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7
$aes.Key = $keyBytes
$aes.GenerateIV() # Generate a random 16-byte Initialization Vector (IV)

# 3. Encrypt the text
$encryptor = $aes.CreateEncryptor()
$inputBytes = [System.Text.Encoding]::UTF8.GetBytes($TextInput)
$cipherBytes = $encryptor.TransformFinalBlock($inputBytes, 0, $inputBytes.Length)

# 4. Prefix the encrypted data with the IV so the decrypter knows what IV was used
$combinedBytes = New-Object byte[] ($aes.IV.Length + $cipherBytes.Length)
[Array]::Copy($aes.IV, 0, $combinedBytes, 0, $aes.IV.Length)
[Array]::Copy($cipherBytes, 0, $combinedBytes, $aes.IV.Length, $cipherBytes.Length)

# 5. Base64 Encode
$TextOutput = [Convert]::ToBase64String($combinedBytes)

# 6. URL Encode explicitly (so that '+' characters don't get converted to spaces in the URL)
$UrlSafeOutput = [uri]::EscapeDataString($TextOutput)

Write-Host "Raw Base64: $TextOutput"
Write-Host "URL-Safe Parameter (Use this in the URL!): $UrlSafeOutput"

# 7. Generate local HTML file with the constructed URL
$redirectUrl = "https://www.oursamaj.org/redirect.php?text_output=$UrlSafeOutput"
$htmlContent = @"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Encrypted Data Redirect</title>
</head>
<body style="font-family: sans-serif; padding: 20px;">
    <h2>Encrypted Redirect Link</h2>
    <p>Your encrypted text has been safely encoded. Click the link below to visit the redirect destination:</p>
    <a href="$redirectUrl" target="_blank">Go to oursamaj.org/redirect.php</a>
</body>
</html>
"@

$scriptPath = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$htmlPath = Join-Path -Path $scriptPath -ChildPath "myhtml.html"

$htmlContent | Out-File -FilePath $htmlPath -Encoding utf8
Write-Host "Generated local HTML file: $htmlPath"