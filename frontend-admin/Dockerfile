FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
# If package.json doesn't exist yet, this will fail. We'll handle it during setup.
# RUN npm install

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
