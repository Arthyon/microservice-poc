# Set dotnet version in variable
ARG DOTNET_VERSION=2.1
# Use fat build image as our build stage
FROM microsoft/dotnet:${DOTNET_VERSION}-sdk AS build-env
# Set /app as current directory
WORKDIR /app

# Copy csproj-file (where nuget-packages are referenced)
COPY *.csproj ./
# Restore nuget packages
RUN dotnet restore

# Copy the rest of the source
COPY . ./
# Build and publish a release version
RUN dotnet publish -c Release -o out

# Create a new build stage with a slimmer production-ready image
FROM microsoft/dotnet:${DOTNET_VERSION}-aspnetcore-runtime

# Expose port 80 out of the container
EXPOSE 80
# Set /app as current directory
WORKDIR /app

# Copy output of publish-command in previous stage to new image 
COPY --from=build-env /app/out .

# Set default command for image to run service
ENTRYPOINT ["dotnet", "service2.dll"] 