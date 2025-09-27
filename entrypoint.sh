#!/bin/bash

# Check if .env file exists, if not create a default one
if [ ! -f .env ]; then
    echo "Creating default .env file..."
    cat > .env << EOF
PORT=4000
MONGO_URI=mongodb://admin:digividya@147.93.106.220:27017/DigitalVidyaSaarthi?authSource=admin
JWT_SECRET=THESECRETKEY
CLOUDINARY_CLIENT_NAME=dhbspxlha
CLOUDINARY_CLIENT_API=458391913267188
CLOUDINARY_CLIENT_SECRET=VsNKdClPL9Gw4oHwFpVLjkNd9rw
SMTP_MAIL=digitalvidyasaarthi@gmail.com
SMTP_PASSWORD=yjsl ehwa gsin vmpu
MINIO_ENDPOINT=https://minio.digitalvidyasaarthi.in
MINIO_ACCESS_KEY=digividya
MINIO_SECRET_KEY=digividya
MINIO_BUCKET=digitalvidyasaarthi
ENCRYPTION_KEY=your32bytekeyinhexformat1234567890abcdef1234567890abcdef
ENCRYPTION_IV=your16byteiv1234567890abcdef
EOF
    echo "Default .env file created."
else
    echo ".env file already exists."
fi

# Start the application
echo "Starting the application..."
exec node server.js
