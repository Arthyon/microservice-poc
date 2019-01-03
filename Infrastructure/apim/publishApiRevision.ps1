Param(
  [string]    $apiManagementRg,
  [string]    $apiManagementName,
  [string]    $kubernetesUrl, # ip to kubernetes (with protocol)
  [string]    $swaggerFilePath, # path to swagger spec
  [string]    $apiRevision, # Build number
  [string[]]  $products,
  [string]  $apiId, # e.g. service-2
  [string]  $apiSuffix, # e.g. api/service2
  [string]  $apiName # e.g. Service 2
)
# TODO This script won't work, as adding products to revision does not currently have any effect
# This should be reported to MS

# In regular Powershell:
# Connect-AzureRmAccount - Log in
# Get-AzureRmSubscription - list subscriptions
# Set-AzureRmContext -SubscriptionId "$subscriptionId" - Choose correct subscription


$ApiMgmtContext = New-AzureRmApiManagementContext -ResourceGroupName "$apiManagementRg" -ServiceName "$apiManagementName"

Write-Host ($ApiMgmtContext | Format-List | Out-String)

$revision = Get-AzureRmApiManagementApiRevision -Context $ApiMgmtContext -ApiId "$apiId" -ApiRevision "$apiRevision" -ErrorAction SilentlyContinue

if($revision) {
  Write-Host "Revision $apiRevision already exists:"
  Write-Host ($revision | Format-List | Out-String)

  if($revision.IsCurrent) {
    Write-Host "Revision is already current. No need to do anything"
    exit
  }

} else {
  Write-Host "Revision $apiRevision not found. Creating..."

  # Create a new revision if revision does not exist.
  # This does not make it active yet.
  # Revision cannot use dot in name.
  Import-AzureRmApiManagementApi -Context $ApiMgmtContext -SpecificationFormat "Swagger" -SpecificationPath "$swaggerFilePath" -Path "$apiSuffix" -ApiId "$apiId" -ApiRevision "$apiRevision"

  # Update ServiceUrl from deploy. Cannot use url from swagger file
  $ServiceUrl = "$kubernetesUrl/$apiSuffix"
  # Set-AzureRmApiManagementApiRevision -ApiRevision "$apiRevision" -Context $ApiMgmtContext -ApiId "$apiId" -ServiceUrl "$ServiceUrl" -Name "$apiName" -Protocols @('https')
  # ServiceUrl: url to backend (kubernetes)
  # Protocols: List of protocols available in APIM (not kubernetes)

  # Apply products to revision
  foreach($product in $products){
    Write-Host "Applying api to product $product"
    Add-AzureRmApiManagementApiToProduct -Context $ApiMgmtContext -ProductId $product -ApiId "$apiId;rev=$apiRevision"

  }

}

Write-Host "Making revision $apiRevision active"

# Create a release, making the revision current
New-AzureRmApiManagementApiRelease -Context $ApiMgmtContext -ApiId "$apiId" -ApiRevision "$apiRevision" -Note "Current revision: $apiRevision"
