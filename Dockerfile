FROM node:18 as builder

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm ci

# Bundle app source
COPY . .

# Build app
RUN npm run build

FROM node:18 as runner

# Create app directory
WORKDIR /usr/src/app

COPY package*.json ./

# Production build
RUN npm ci --omit=dev

COPY --from=builder /usr/src/app/build ./

# Expose port
EXPOSE 3000

# Start app
CMD [ "node", "server.js" ]
