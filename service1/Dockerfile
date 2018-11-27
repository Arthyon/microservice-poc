# Choose node version
ARG NODE_VERSION=8

# Create a base (build) image based on basic node alpine
FROM node:${NODE_VERSION}-alpine as base

# Set active directory
WORKDIR /app

# Copy everything from local machine to /app in image
COPY . .

# Install only production dependencies
RUN yarn install --pure-lockfile --production
# Copy these dependencies for later use
RUN cp -R node_modules prod_node_modules
# Install all dependencies
RUN yarn install --pure-lockfile
# Run build script (compile typescript)
RUN yarn build

# Create new image for running tests
FROM base AS test

# Copy everything again 
# TODO Maybe use output from previous step?
COPY . .
# Run test command
RUN yarn test

# Create release image based on official pm2-image
FROM keymetrics/pm2:${NODE_VERSION}-alpine AS release

EXPOSE 8001

# Put everything in a new directory to avoid polluting /
WORKDIR /app

# Copy restored production node modules from previous stage
COPY --from=base /app/prod_node_modules ./node_modules
# Copy built files from previous stage
COPY --from=base /app/dist ./dist
# Copy pm2 settings
COPY pm2-production.json .
# Set environment to production
ENV NODE_ENV=production

# Set default startup command
CMD ["pm2-docker", "start", "pm2-production.json"]