# Use Node.js as base image
FROM node:20

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install

# Copy obfuscated code
# COPY dist/ ./

# Expose port
EXPOSE 4000

# Start the app
CMD ["node", "server.js"]