ARG DOTNET_VERSION=2.1
FROM microsoft/dotnet:${DOTNET_VERSION}-sdk AS build-env
WORKDIR /app

COPY *.csproj ./
RUN dotnet restore

COPY . ./
RUN dotnet publish -c Release -o out

FROM microsoft/dotnet:${DOTNET_VERSION}-aspnetcore-runtime

WORKDIR /app
COPY --from=build-env /app/out .

ENTRYPOINT ["dotnet", "service2.dll"] 