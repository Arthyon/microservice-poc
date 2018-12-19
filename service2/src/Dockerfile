ARG DOTNET_VERSION=2.1
FROM microsoft/dotnet:${DOTNET_VERSION}-sdk as build

# Required inside Docker, otherwise file-change events may not trigger
ENV DOTNET_USE_POLLING_FILE_WATCHER 1
ENV ASPNETCORE_ENVIRONMENT=Development
ENV DOTNET_RUNNING_IN_CONTAINER=true

# Installing vsdbg debugger into our container 
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    unzip \
    && rm -rf /var/lib/apt/lists/* \
    && curl -sSL https://aka.ms/getvsdbgsh | bash /dev/stdin -v latest -l /vsdbg

# Set a working dir at least 2 deep. The output and intermediate output folders will be /code/obj and /code/bin
WORKDIR /code/app

# By copying these into the image when building it, we don't have to re-run restore everytime we launch a new container
COPY service2.csproj .
COPY Directory.Build.props .
RUN dotnet restore

# This will build and launch the server in a loop, restarting whenever a *.cs file changes
# ENTRYPOINT dotnet watch run --no-restore
CMD ["dotnet", "watch", "run", "--no-restore"]