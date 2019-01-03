Param(
  [string] $apiManagementRg,
  [string] $apiManagementName,
  [string] $kubernetesUrl, # ip to kubernetes (with protocol)
  [string] $swaggerFilePath, # path to swagger spec
  [string] $apiRevision, # Build number
  [string] $apiId, # e.g. service-2
  [string] $apiSuffix, # e.g. api/service2
  [string] $apiName # e.g. Service 2
)

# In regular Powershell:
# Connect-AzureRmAccount - Log in
# Get-AzureRmSubscription - list subscriptions
# Set-AzureRmContext -SubscriptionId "$subscriptionId" - Choose correct subscription


$ApiMgmtContext = New-AzureRmApiManagementContext -ResourceGroupName "$apiManagementRg" -ServiceName "$apiManagementName"

Write-verbose "$ApiMgmtContext" -verbose

$revision = Get-AzureRmApiManagementApiRevision -Context $ApiMgmtContext -ApiId "$apiId" -ApiRevision "$apiRevision" -ErrorAction SilentlyContinue

if($revision) {
  Write-Host "Revision $apiRevision already exists:"
  Write-verbose $revision -verbose

  if($rev.IsCurrent) {
    Write-Host "Revision is already current. No need to do anything"
    exit
  }

} else {
  Write-Host "Revision $apiRevision not found. Creating..."

  # Create a new revision if revision does not exist.
  # This does not make it active yet.
  # Revision cannot use dot in name.
  Import-AzureRmApiManagementApi -Context $ApiMgmtContext -SpecificationFormat "Swagger" -SpecificationPath "$swaggerFilePath" -Path "$apiSuffix" -ApiId "$apiId" -ApiRevision "$apiRevision"

  # When backend does not answer on https, the next lines are needed
  # -------------
  $ServiceUrl = $kubernetesUrl + $apiSuffix

  Set-AzureRmApiManagementApiRevision -ApiRevision "$apiRevision" -Context $ApiMgmtContext -ApiId "$apiId" -ServiceUrl "$ServiceUrl" -Name "$apiName" -Protocols @('https')
  # ServiceUrl: url to backend (kubernetes)
  # Protocols: List of protocols available in APIM (not kubernetes)

  ## -----------

}

Write-Host "Making revision $apiRevision active"

# Create a release, making the revision current
New-AzureRmApiManagementApiRelease -Context $ApiMgmtContext -ApiId "$apiId" -ApiRevision "$apiRevision" -Note "Current revision: $apiRevision"