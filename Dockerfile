# Use Node.js as base image
FROM node:20

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install

# Copy obfuscated code
COPY dist/ ./

# Copy entrypoint script
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Copy .env file if it exists (for CI/CD), otherwise entrypoint will create default
COPY .env* ./

# Expose port
EXPOSE 4000

# Start the app using entrypoint
CMD ["./entrypoint.sh"]