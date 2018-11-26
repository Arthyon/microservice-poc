# Microservice POC

This repository is a proof of concept for microservices in docker, using both .Net and Node-services.
We are using Ocelot to route requests to the correct service, so the only port we expose from our docker-environment is port 5000 for Ocelot.

## Development experience

This should hopefully be a nice development experience.
The workflow will be something like this:

Starting development:

- `docker-compose up -d` or `docker-compose up` to run either in detached mode or not.

Changing a node-service without adding new dependencies to package.json:

- Make your changes
- `docker-compose restart <servicename>`

Changing a node-service that adds a new dependency

- Make your changes
- `docker-compose down` or Ctrl+C (depending on if in detached mode)
- `docker-compose build <servicename>`
- `docker-compose up`

Changing a .Net-service without adding new nuget-packages:

- Make your changes
- App will hot reload

Changing a .Net-service that adds new nuget-packages:

- Make your changes
- `docker-compose down` or Ctrl+C (depending on if in detached mode)
- `docker-compose build <servicename>`
- `docker-compose up`

Adding a new service:

- `docker-compose down` or Ctrl+C (depending on if in detached mode)
- Add the new service (using scaffolding?)
- Add a corresponding entry to docker-compose.yml and docker-compose.override.yml
- Add an entry to gateway/ocelot.json
- `docker-compose build gateway`
- `docker-compose up`

## Explanations

This section contains explanations for the commands presented above.

### Starting development

`docker-compose up -d` will run the system in detached mode, returning terminal control to us. It is of course also possible to use two different terminals and not running in detached mode. One reason to not doing this is to look at container output, as stdout from each container is redirected to the terminal.

### Changing a node-service without adding new dependencies to package.json:

In this situation we can just restart the service. We have mounted our filesystem in the container, so all local changes is automatically present inside the container. This means that `yarn build` will see the updated .ts-files without having to rebuild the image. We still need to restart the container as hot reloading is not available for node service. See section `Notes on hot reload+debug in node containers` for more information.

### Changing a node-service that adds a new dependency

When adding a dependency, we need to rebuild the container. We are resolving node_modules when creating the image so we don't need to download them every time we start a container. This saves time in the long run, as we typically do not add dependencies as often as we make code changes.

Before building the new image, shut down everything and set it up with the new container afterwards.
TODO: Could we only shut down a single container and then set it up again?

### Changing a .Net-service without adding new nuget-packages:

In this situation we can just restart the service. We have mounted our filesystem in the container, so all local changes is automatically present inside the container. This means that `dotnet run watch` will see the updated .cs-files without having to rebuild the image. Dotnet apps have hot reloading enabled, so we do not need to restart the container.

### Changing a .Net-service that adds new nuget-packages:

When adding a dependency, we need to rebuild the container. We are resolving nuget-packages when creating the image so we don't need to download them every time we start a container. This saves time in the long run, as we typically do not add dependencies as often as we make code changes.

Before building the new image, shut down everything and set it up with the new container afterwards.
TODO: Could we only shut down a single container and then set it up again?

### Adding a new service:

When adding a new service, we need to add it two places,
docker-compose.yml and Ocelot.

#### Docker-compose:

We need to add an entry here to be able to create it using `docker-compose up`. This command scans the docker-compose.yml file (and also docker-compose.override.yml if present). We also set up volume mounting and port-exposing here.

#### Ocelot

To enable Ocelot to redirect traffic to the new service, an entry needs to be added to this config file.
After adding the entry we need to rebuild the image. This is because the config-file is copied into the image in build time.
TODO: We can also set up volume mounting to read the updated config-file if this becomes a problem.

# Setting up a new service

This section describes the special considerations needed to set up a new service from scratch.

## Node

## .Net

# Deploying

`docker-compose -f docker-compose.yml` up to not use override.

# Notes on hot reload+debug in node containers

It is currently not possible to have both hot reloading and debugging in node containers. This section describes encountered challenges and attempted workarounds.

## PM2

Can run ts-files with watch directly.
The problem is that it is using ts-node@latest under the hood, and a breaking change in ts-node makes it unable to read node args (i.e. --inspect=0.0.0.0:9229).
This means that we cannot run ts directly AND debug at the same time.

An attempted workaround is to let tsc watch ts-files and build, and pm2 watch build output directory for reloading, running these concurrently in the container using a package.json-task.
This either forces pm2 to create new debug ports (which does not play well with how we expose ports out of docker) or forces it to attempt to attach to the same port. The latter fails because port is still in use. We cannot kill the port using SIGTERM because the signal does not propagate to our app when pm2 is not allowed to run a js-file directly.

Issue touching upon breaking change in ts-node: https://github.com/Unitech/pm2/issues/3512

## Nodemon

Works good for debugging (will reuse inspector port even in container), but cannot restart when running in containers. It seems like the signals aren't propagated correctly to the app (specifically SIGUSR2), so the port is never released before restart. Have tried package kill-port, but I still get EADDRINUSE for specific port.
nodemon: https://github.com/remy/nodemon
Nodemon-events: https://medium.com/netscape/nodemon-events-run-tasks-at-server-start-restart-crash-exit-93a34c54dfd8

people using kill port: https://github.com/remy/nodemon/issues/1050
A bit about using ts-node && nodemon: https://intellij-support.jetbrains.com/hc/en-us/community/posts/360000386099-How-to-debug-ts-node-via-Attach-to-Node-js-Chrome-

debugging TS in docker, recipe from MS: https://github.com/Microsoft/vscode-recipes/tree/master/Docker-TypeScript

blog about developing with nodemon in docker: https://medium.com/lucjuggery/docker-in-development-with-nodemon-d500366e74df

Tini, should be able to use this to forward signals, didn't work for me: https://github.com/krallin/tini

## General links

Debugging node: https://nodejs.org/en/docs/guides/debugging-getting-started/
debug node/docker in Vscode: https://blog.risingstack.com/how-to-debug-a-node-js-app-in-a-docker-container/

Docker node best practices: https://github.com/nodejs/docker-node/blob/master/docs/BestPractices.md

For production: https://nodesource.com/blog/8-protips-to-start-killing-it-when-dockerizing-node-js/
