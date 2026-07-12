# Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY socihr-frontend/package*.json ./
RUN npm ci
COPY socihr-frontend ./
RUN npm run build

# Build backend
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY socihr-backend ./
RUN dotnet restore
RUN dotnet publish -c Release -o /app

# Final image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app .
# Copy frontend build into wwwroot
COPY --from=frontend-build /frontend/dist ./wwwroot
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "socihr-backend.dll"]
