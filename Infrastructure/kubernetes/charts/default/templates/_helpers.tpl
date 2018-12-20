{{/*
Volume mount for local development
*/}}
{{- define "default.volumeMounts" -}}
{{- if .basePath -}}
volumeMounts:
  - mountPath: {{ .val.localVolume.containerPath }}
    name: {{ .val.localVolume.mountName }}
{{- end -}}
{{- end -}}

{{/*
Volumes for local development
*/}}
{{- define "default.volumes" -}}
{{- if .basePath -}}
volumes:
  - name: {{ .val.localVolume.mountName }}
    hostPath:
      path: {{ .basePath }}{{ .val.localVolume.localPath }}
{{- end -}}
{{- end -}}