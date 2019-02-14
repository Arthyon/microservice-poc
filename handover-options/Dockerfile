# No need for multi stage image in development. Go straight to pm2-image
FROM keymetrics/pm2:8-alpine

# Create working directory (possibly not necessary)
RUN mkdir -p /app

# Set /app as current directory
WORKDIR /app

# Copy setting-files into the container
COPY package.json /app
COPY yarn.lock /app
COPY tsconfig.json /app
COPY pm2.json /app
COPY .npmrc /app

# Restore packages
RUN yarn --frozen-lockfile
# Move restored node files (I have no idea why, but we must do this to get it to work)
RUN mv /app/node_modules /node_modules
# Set environment variable to development
ENV NODE_ENV=development
# Set default command when starting container to "yarn docker-dev"
# This builds typescript and runs pm2
CMD ["yarn", "docker-dev"]