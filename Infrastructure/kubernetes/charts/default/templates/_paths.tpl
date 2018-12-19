{{/*
Defines the ingress paths
*/}}
{{- define "default.ingress.paths" -}}
- path: /api/service2/
  backend:
    serviceName: service2
    servicePort: 80
- path: /api/service1
  backend:
    serviceName: service1
    servicePort: 8001
{{ end -}}
