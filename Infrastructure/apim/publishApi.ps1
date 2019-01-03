Param(
  [string]  $apiManagementRg,
  [string]  $apiManagementName,
  [string]  $kubernetesUrl, # ip to kubernetes (with protocol)
  [string]  $swaggerFilePath, # path to swagger spec
  [string]  $buildNumber, # Build number
  [string]  $apiId, # e.g. service-2
  [string]  $apiSuffix, # e.g. api/service2
  [string]  $apiName # e.g. Service 2
)

$ApiMgmtContext = New-AzureRmApiManagementContext -ResourceGroupName "$apiManagementRg" -ServiceName "$apiManagementName"

Write-Host ($ApiMgmtContext | Format-List | Out-String)

Write-Host "Importing new specification for api $apiId"

Import-AzureRmApiManagementApi -Context $ApiMgmtContext -SpecificationFormat "Swagger" -SpecificationPath "$swaggerFilePath" -Path "$apiSuffix" -ApiId "$apiId"

# Update ServiceUrl from deploy. Cannot use url from swagger file
$ServiceUrl = "$kubernetesUrl/$apiSuffix"
Write-Host "Updating api with Service Url $ServiceUrl"

Set-AzureRmApiManagementApi -Context $ApiMgmtContext -ApiId "$apiId" -ServiceUrl "$ServiceUrl" -Name "$apiName" -Protocols @('https') -Description "Current version: $buildNumber"
# ServiceUrl: url to backend (kubernetes)
# Protocols: List of protocols available in APIM (not kubernetes)