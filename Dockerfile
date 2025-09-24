# Use Node.js as base image
FROM node:20

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install

# Copy obfuscated code
COPY dist/ ./

# Create .env file with default values
RUN echo "PORT=4000" > .env && \
    echo "NODE_ENV=production" >> .env && \
    echo "MONGO_URI=mongodb://admin:digividya@147.93.106.220:27017/DigitalVidyaSaarthi?authSource=admin" >> .env && \
    echo "JWT_SECRET=THESECRETKEY" >> .env && \
    echo "CLOUDINARY_CLIENT_NAME=dhbspxlha" >> .env && \
    echo "CLOUDINARY_CLIENT_API=458391913267188" >> .env && \
    echo "CLOUDINARY_CLIENT_SECRET=VsNKdClPL9Gw4oHwFpVLjkNd9rw" >> .env && \
    echo "SMTP_MAIL=digitalvidyasaarthi@gmail.com" >> .env && \
    echo "SMTP_PASSWORD=yjsl ehwa gsin vmpu" >> .env && \
    echo "MINIO_ENDPOINT=https://minio.digitalvidyasaarthi.in" >> .env && \
    echo "MINIO_ACCESS_KEY=digividya" >> .env && \
    echo "MINIO_SECRET_KEY=digividya" >> .env && \
    echo "MINIO_BUCKET=digitalvidyasaarthi" >> .env && \
    echo "ENCRYPTION_KEY=your32bytekeyinhexformat1234567890abcdef1234567890abcdef" >> .env && \
    echo "ENCRYPTION_IV=your16byteiv1234567890abcdef" >> .env

# Expose port
EXPOSE 4000

# Start the app
CMD ["node", "server.js"]