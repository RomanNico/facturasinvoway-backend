FROM node:20-alpine

# Setup working directory
WORKDIR /app

# Copiamos TODOS los archivos, incluyendo node_modules instalados desde el PC corporativo
COPY . .

# Comando para correr la aplicación
CMD ["npm", "start"]
