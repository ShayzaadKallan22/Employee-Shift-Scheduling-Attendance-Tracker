# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.13.0

FROM node:${NODE_VERSION}-alpine

WORKDIR /webService

# Copy package.json from the API subdirectory
COPY API/package*.json ./

RUN npm install

# Copy the rest of the API source files
COPY API/ .

EXPOSE 3000

CMD ["npm", "start"]