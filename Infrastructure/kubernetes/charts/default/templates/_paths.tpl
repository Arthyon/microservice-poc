{{/*
Defines the ingress paths
*/}}
{{- define "default.ingress.paths" -}}
- path: /api/stores
  backend:
    serviceName: stores
    servicePort: 8001
- path: /api/handover-options
  backend:
    serviceName: handover-options
    servicePort: 8002
- path: /api/service2/
  backend:
    serviceName: service2
    servicePort: 80
- path: /api/service1
  backend:
    serviceName: service1
    servicePort: 8001
{{ end -}}
