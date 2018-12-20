param(
    # the selector from your yml file
    #  selector:
    #    matchLabels:
    #      app: myweb
    # -Selector app=myweb
    # [Parameter(Mandatory=$true)][string]$Selector
    # [Parameter(Mandatory=$true)][string]$T
)
# $pod = kubectl get pods --selector=$Selector -o jsonpath='{.items[0].metadata.name}';
$pod = kubectl get pods --selector=app=service2 -o jsonpath='{.items[0].metadata.name}';
# $cmd = 'dotnet';
# Write-Host '6. seaching for' $cmd 'process PID in pod:' $pod '...';
# $prid = kubectl exec $pod -i -- pidof -s $cmd;
# $pod = kubectl get pods --selector=$env:selector -o jsonpath='{.items[0].metadata.name}';
# kubectl exec $pod -i -- /vsdbg/vsdbg --interpreter=vscode --attach $prid;
# Write-Host "args: $args"
kubectl exec $pod -i -- $args;