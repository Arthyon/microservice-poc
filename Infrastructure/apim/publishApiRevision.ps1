Param(
  [string] $apiManagementRg,
  [string] $apiManagementName,
  [string] $kubernetesUrl, # ip to kubernetes (with protocol)
  [string] $apiId, # service-2
  [string] $swaggerFilePath, # path to swagger spec
  [string] $apiSuffix, # api/service2
  [string] $apiName, # Service 2
  [string] $apiRevision # Build number
)
# In regular Powershell:
# Connect-AzureRmAccount - Log in
# Get-AzureRmSubscription - list subscriptions
# Set-AzureRmContext -SubscriptionId "$subscriptionId" - Choose correct subscription

$ApiMgmtContext = New-AzureRmApiManagementContext -ResourceGroupName "$apiManagementRg" -ServiceName "$apiManagementName"

Write-verbose "$ApiMgmtContext" -verbose

# This creates a new revision, but does not make it active yet
# Revision cannot use dot in name.
Import-AzureRmApiManagementApi -Context $ApiMgmtContext -SpecificationFormat "Swagger" -SpecificationPath "$swaggerFilePath" -Path "$apiSuffix" -ApiId "$apiId" -ApiRevision "$apiRevision"

# When backend does not answer on https, the next lines are needed
# -------------
$ServiceUrl = $kubernetesUrl + $apiSuffix

Set-AzureRmApiManagementApiRevision -ApiRevision "$apiRevision" -Context $ApiMgmtContext -ApiId "$apiId" -ServiceUrl "$ServiceUrl" -Name "$apiName" -Protocols @('https')
# ServiceUrl: url to backend (kubernetes)
# Protocols: List of protocols available in APIM (not kubernetes)

## -----------

# Create a release, making the new revision current
New-AzureRmApiManagementApiRelease -Context $ApiMgmtContext -ApiId "$apiId" -ApiRevision "$apiRevision" -Note "Current revision: $apiRevision"