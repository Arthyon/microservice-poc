FROM microsoft/dotnet:2.1-sdk AS build-env
WORKDIR /app

COPY *.csproj ./
RUN dotnet restore

COPY . ./
RUN dotnet publish -c Release -o out

# Pay attention to the following two lines
FROM microsoft/dotnet:2.1-aspnetcore-runtime

# Alpine runtime doesn't expose 80 by default (Dang)
EXPOSE 80

WORKDIR /app
COPY --from=build-env /app/out .

ENTRYPOINT ["dotnet", "gateway.dll"] 